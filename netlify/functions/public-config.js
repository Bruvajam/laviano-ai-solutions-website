/**
 * Public config for the browser (no secrets).
 * Netlify env:
 *   RECAPTCHA_SITE_KEY — Google reCAPTCHA v3 site key
 */
exports.handler = async function () {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || ''
    })
  };
};
