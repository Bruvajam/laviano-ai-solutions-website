/**
 * Creates a Retell web-call access token for the on-page orb demo.
 *
 * Netlify env vars:
 *   RETELL_API_KEY         — required
 *   RETELL_AGENT_ID        — optional (defaults to Laviano demo agent)
 *   RECAPTCHA_SECRET_KEY   — required for bot protection (reCAPTCHA v3)
 *   RECAPTCHA_MIN_SCORE    — optional, default 0.5
 *
 * POST /api/create-web-call
 * Body: { recaptchaToken: string }
 * → { accessToken, callId }
 */
exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  var apiKey = process.env.RETELL_API_KEY;
  var agentId = process.env.RETELL_AGENT_ID || 'agent_1dd119e25304181d44a0397fc8';
  var captchaSecret = process.env.RECAPTCHA_SECRET_KEY;
  var minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');

  if (!apiKey) {
    console.error('[create-web-call] RETELL_API_KEY is not set');
    return json(500, { error: 'Server misconfigured' });
  }

  var body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (e) {
    return json(400, { error: 'Invalid JSON' });
  }

  // Bot protection — required when secret is configured
  if (captchaSecret) {
    var token = body.recaptchaToken || '';
    if (!token) {
      return json(403, { error: 'Captcha required' });
    }
    try {
      var ok = await verifyRecaptcha(captchaSecret, token, event.headers);
      if (!ok.success || (typeof ok.score === 'number' && ok.score < minScore)) {
        console.warn('[create-web-call] reCAPTCHA rejected', {
          success: ok.success,
          score: ok.score,
          action: ok.action,
          errors: ok['error-codes']
        });
        return json(403, { error: 'Captcha failed' });
      }
    } catch (err) {
      console.error('[create-web-call] reCAPTCHA verify error', err);
      return json(403, { error: 'Captcha failed' });
    }
  } else {
    console.warn('[create-web-call] RECAPTCHA_SECRET_KEY not set — bot protection disabled');
  }

  try {
    var res = await fetch('https://api.retellai.com/v2/create-web-call', {
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
          surface: 'hero_orb'
        }
      })
    });

    var data = await res.json().catch(function () { return {}; });

    if (!res.ok) {
      console.error('[create-web-call] Retell error', res.status, data);
      return json(res.status === 401 || res.status === 403 ? 502 : 500, {
        error: 'Failed to create web call'
      });
    }

    if (!data.access_token) {
      console.error('[create-web-call] Missing access_token', data);
      return json(500, { error: 'Failed to create web call' });
    }

    return json(200, {
      accessToken: data.access_token,
      callId: data.call_id || null
    });
  } catch (err) {
    console.error('[create-web-call] Exception', err);
    return json(500, { error: 'Failed to create web call' });
  }
};

async function verifyRecaptcha(secret, token, headers) {
  var params = new URLSearchParams();
  params.set('secret', secret);
  params.set('response', token);
  var ip = (headers && (headers['x-nf-client-connection-ip'] || headers['x-forwarded-for'] || '')) || '';
  if (ip) params.set('remoteip', String(ip).split(',')[0].trim());

  var res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  return res.json();
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}

function json(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: Object.assign(
      { 'Content-Type': 'application/json' },
      corsHeaders()
    ),
    body: JSON.stringify(body)
  };
}
