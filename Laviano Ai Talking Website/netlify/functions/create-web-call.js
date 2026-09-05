/**
 * Mints a Retell web-call access token — but only for a caller who passes
 * Google reCAPTCHA v3 verification first.
 *
 * This is the piece Retell's drop-in widget cannot do. The widget calls
 * Retell directly from the browser with a public key and never sends a
 * reCAPTCHA token, so enabling Abuse Prevention on the public key breaks it.
 * Here the browser talks to us, we verify the token with the SECRET key, and
 * only then do we call Retell with the SECRET API key. Neither secret is ever
 * exposed to the page.
 *
 * Required Netlify environment variables:
 *   RETELL_API_KEY         — Retell secret API key
 *   RECAPTCHA_SECRET_KEY   — the secret half of the reCAPTCHA v3 pair
 * Optional:
 *   RETELL_AGENT_ID        — defaults to the talking-website agent
 *   RECAPTCHA_MIN_SCORE    — default 0.5
 *   ALLOWED_ORIGINS        — comma separated; defaults to the live site
 *
 * POST /api/create-web-call   body: { recaptchaToken }
 *   200 -> { accessToken, callId }
 *   400 / 403 / 500 -> { error }
 */

const DEFAULT_AGENT = 'agent_e61f39ec459ecfb92da7763049';
const DEFAULT_ORIGINS = 'https://lavianoai.com,https://www.lavianoai.com,http://localhost:8787,http://127.0.0.1:8787';

exports.handler = async function (event) {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const allowed = (process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS)
    .split(',').map(s => s.trim()).filter(Boolean);
  const originOk = allowed.includes(origin);
  const cors = {
    'Access-Control-Allow-Origin': originOk ? origin : allowed[0],
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' }, cors);

  // Defence in depth. The reCAPTCHA check is the real gate; this just makes
  // casual reuse from another site harder.
  if (origin && !originOk) {
    console.warn('[create-web-call] blocked origin:', origin);
    return json(403, { error: 'Origin not allowed' }, cors);
  }

  const apiKey = process.env.RETELL_API_KEY;
  const captchaSecret = process.env.RECAPTCHA_SECRET_KEY;
  const agentId = process.env.RETELL_AGENT_ID || DEFAULT_AGENT;
  const minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');

  if (!apiKey) {
    console.error('[create-web-call] RETELL_API_KEY is not set');
    return json(500, { error: 'Server misconfigured' }, cors);
  }
  // Fail closed. Without the secret we cannot verify anyone, and silently
  // letting calls through would defeat the point of this endpoint.
  if (!captchaSecret) {
    console.error('[create-web-call] RECAPTCHA_SECRET_KEY is not set — refusing to mint calls');
    return json(500, { error: 'Server misconfigured' }, cors);
  }

  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; }
  catch (e) { return json(400, { error: 'Invalid JSON' }, cors); }

  const token = body.recaptchaToken;
  if (!token) return json(400, { error: 'Missing reCAPTCHA token' }, cors);

  // ---- 1. verify the human ------------------------------------------------
  let verdict;
  try {
    verdict = await verifyRecaptcha(captchaSecret, token, event.headers);
  } catch (err) {
    console.error('[create-web-call] reCAPTCHA verify threw', err);
    return json(403, { error: 'Verification failed' }, cors);
  }

  if (!verdict.success || (typeof verdict.score === 'number' && verdict.score < minScore)) {
    console.warn('[create-web-call] reCAPTCHA rejected', {
      success: verdict.success,
      score: verdict.score,
      action: verdict.action,
      hostname: verdict.hostname,
      errors: verdict['error-codes']
    });
    return json(403, { error: 'Verification failed' }, cors);
  }

  // ---- 2. mint the call ---------------------------------------------------
  try {
    const res = await fetch('https://api.retellai.com/v2/create-web-call', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        agent_id: agentId,
        metadata: {
          source: 'lavianoai.com',
          surface: 'custom_call_ui',
          recaptcha_score: verdict.score
        }
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.access_token) {
      console.error('[create-web-call] Retell error', res.status, data);
      return json(502, { error: 'Could not start the call' }, cors);
    }

    return json(200, { accessToken: data.access_token, callId: data.call_id || null }, cors);
  } catch (err) {
    console.error('[create-web-call] exception', err);
    return json(500, { error: 'Could not start the call' }, cors);
  }
};

async function verifyRecaptcha(secret, token, headers) {
  const params = new URLSearchParams();
  params.set('secret', secret);
  params.set('response', token);

  const ip = (headers && (headers['x-nf-client-connection-ip'] || headers['x-forwarded-for'])) || '';
  if (ip) params.set('remoteip', String(ip).split(',')[0].trim());

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  return res.json();
}

function json(statusCode, payload, cors) {
  return {
    statusCode,
    headers: Object.assign({ 'Content-Type': 'application/json' }, cors),
    body: JSON.stringify(payload)
  };
}
