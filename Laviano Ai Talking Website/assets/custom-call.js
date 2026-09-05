/* Laviano AI — voice call UI.
   Replaces Retell's drop-in widget so reCAPTCHA can actually be enforced.

   Flow:
     1. ask for the microphone (needs a user gesture, so this runs on click)
     2. grecaptcha.execute() -> fresh token
     3. POST the token to /api/create-web-call
     4. that function verifies it with the secret key and mints the call with
        the secret Retell API key, returning an access token
     5. RetellWebClient.startCall({ accessToken })

   Retell's own widget skips steps 2-4 entirely, which is why enabling Abuse
   Prevention on a public key breaks it with "Missing reCAPTCHA token". */
(function () {
  'use strict';

  var CONTACT = 'support@lavianoai.com';
  var SITE_KEY = '6Lf_AqgtAAAAAMqjD0jWb0G2FqV3ThQyt_4Go00X';
  var ENDPOINT = '/api/create-web-call';
  var SDK = 'https://esm.sh/retell-client-js-sdk@2.0.7';
  var NUDGE_AT_MS = 6000;

  var cc = document.getElementById('cc');
  if (!cc) return;

  var panel   = cc.querySelector('.cc__panel');
  var nudge   = cc.querySelector('.cc__nudge');
  var fab     = cc.querySelector('.cc__fab');
  var statusEl= cc.querySelector('.cc__status');
  var timerEl = cc.querySelector('.cc__timer');
  var stateEl = cc.querySelector('.cc__state');
  var muteBtn = cc.querySelector('[data-act="mute"]');

  var client = null;      // RetellWebClient instance
  var timer = null, seconds = 0, muted = false;

  function setState(s, text, sub) {
    cc.dataset.state = s;
    if (text !== undefined) statusEl.textContent = text;
    if (sub !== undefined) stateEl.textContent = sub;
  }

  function openPanel(open) {
    panel.classList.toggle('open', open);
    nudge.classList.remove('show');
    fab.classList.remove('nudging');
  }

  function startTimer() {
    seconds = 0; timerEl.textContent = '00:00';
    timer = setInterval(function () {
      seconds++;
      timerEl.textContent =
        String(Math.floor(seconds / 60)).padStart(2, '0') + ':' +
        String(seconds % 60).padStart(2, '0');
    }, 1000);
  }

  function resetIdle() {
    clearInterval(timer);
    timerEl.textContent = '';
    muted = false;
    if (muteBtn) muteBtn.textContent = 'Mute';
    setState('idle', 'Ask about pricing, hours, or book a call.', 'Ready');
  }

  function fail(msg, sub) {
    clearInterval(timer);
    timerEl.textContent = '';
    setState('error', msg, sub || 'Not connected');
  }

  /* ---------------------------------------------------------------- step 1 */
  function requestMic() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject({ kind: 'unsupported' });
    }
    return navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function (stream) {
        // release it; the SDK opens its own track
        stream.getTracks().forEach(function (t) { t.stop(); });
      })
      .catch(function (err) { throw { kind: 'mic', name: err && err.name }; });
  }

  /* ---------------------------------------------------------------- step 2 */
  function getToken() {
    if (typeof grecaptcha === 'undefined' || !grecaptcha.execute) {
      return Promise.reject({ kind: 'captcha-missing' });
    }
    return new Promise(function (resolve) { grecaptcha.ready(resolve); })
      .then(function () { return grecaptcha.execute(SITE_KEY, { action: 'voice_call' }); })
      .catch(function () { throw { kind: 'captcha-failed' }; });
  }

  /* ---------------------------------------------------------------- step 3 */
  function mintCall(token) {
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recaptchaToken: token })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || !data.accessToken) {
          throw { kind: 'mint', status: res.status, error: data.error };
        }
        return data.accessToken;
      });
    });
  }

  /* ---------------------------------------------------------------- step 5 */
  function connect(accessToken) {
    return import(SDK).then(function (mod) {
      var RetellWebClient = mod.RetellWebClient;
      client = new RetellWebClient();

      client.on('call_started', function () {
        setState('live', 'Listening…', 'Live');
        startTimer();
      });
      client.on('call_ended', function () {
        clearInterval(timer);
        timerEl.textContent = '';
        setState('ended', 'Call ended. Thanks for stopping by.', 'Ended');
        setTimeout(resetIdle, 2600);
      });
      client.on('agent_start_talking', function () { setState('live', 'Assistant is speaking…', 'Live'); });
      client.on('agent_stop_talking',  function () { setState('live', 'Listening…', 'Live'); });
      client.on('error', function (e) {
        console.error('[call] sdk error', e);
        try { client.stopCall(); } catch (x) {}
        fail('The call dropped. Please try again, or email ' + CONTACT + '.', 'Disconnected');
      });

      return client.startCall({ accessToken: accessToken });
    });
  }

  /* ------------------------------------------------------------- the flow */
  function start() {
    setState('asking', 'Waiting for microphone permission…', 'Connecting');

    requestMic()
      .then(function () {
        setState('connecting', 'Checking you are human…', 'Connecting');
        return getToken();
      })
      .then(function (token) {
        setState('connecting', 'Connecting you to the assistant…', 'Connecting');
        return mintCall(token);
      })
      .then(connect)
      .catch(function (e) {
        console.error('[call] failed', e);
        if (!e || !e.kind) return fail('Something went wrong. Please email ' + CONTACT + '.');

        if (e.kind === 'unsupported') {
          fail('This browser can\'t start a voice call. Try Chrome or Safari, or email ' + CONTACT + '.', 'Unsupported');
        } else if (e.kind === 'mic') {
          if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
            fail('No microphone found. Check your mic and try again, or email ' + CONTACT + '.', 'Mic unavailable');
          } else if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
            fail('Microphone blocked. Allow mic access in your browser, then try again.', 'Permission denied');
          } else if (e.name === 'NotReadableError') {
            fail('Your microphone is in use by another app. Close it and try again.', 'Mic busy');
          } else {
            fail('We could not reach your microphone. Try again, or email ' + CONTACT + '.', 'Mic unavailable');
          }
        } else if (e.kind === 'captcha-missing' || e.kind === 'captcha-failed') {
          fail('Could not verify your browser. Reload the page and try again.', 'Verification failed');
        } else if (e.kind === 'mint') {
          if (e.status === 403) {
            fail('We could not verify this request. Reload and try again, or email ' + CONTACT + '.', 'Verification failed');
          } else {
            fail('We could not start the call right now. Please email ' + CONTACT + '.', 'Unavailable');
          }
        } else {
          fail('Something went wrong. Please email ' + CONTACT + '.');
        }
      });
  }

  function end() {
    try { if (client) client.stopCall(); } catch (e) {}
    clearInterval(timer);
    timerEl.textContent = '';
    setState('ended', 'Call ended. Thanks for stopping by.', 'Ended');
    setTimeout(resetIdle, 2600);
  }

  function toggleMute() {
    if (!client) return;
    muted = !muted;
    try {
      if (muted && client.mute) client.mute();
      else if (!muted && client.unmute) client.unmute();
      muteBtn.textContent = muted ? 'Unmute' : 'Mute';
    } catch (e) { muted = !muted; }
  }

  /* --------------------------------------------------------------- wiring */
  fab.addEventListener('click', function () { openPanel(!panel.classList.contains('open')); });
  cc.querySelector('.cc__x').addEventListener('click', function () {
    if (cc.dataset.state === 'live') end();
    openPanel(false);
  });
  cc.querySelector('[data-act="start"]').addEventListener('click', start);
  cc.querySelector('[data-act="retry"]').addEventListener('click', start);
  cc.querySelector('[data-act="end"]').addEventListener('click', end);
  if (muteBtn) muteBtn.addEventListener('click', toggleMute);

  // every "Talk to our assistant" button on the page opens the panel
  document.querySelectorAll('[data-talk]').forEach(function (b) {
    b.addEventListener('click', function () {
      openPanel(true);
      if (cc.dataset.state === 'idle') start();
    });
  });

  resetIdle();
  setTimeout(function () {
    if (panel.classList.contains('open')) return;
    nudge.classList.add('show');
    fab.classList.add('nudging');
    setTimeout(function () { fab.classList.remove('nudging'); }, 7000);
  }, NUDGE_AT_MS);
})();
