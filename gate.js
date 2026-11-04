// Password gate: decrypts data.enc.json (the product list) in the browser, then starts the app.
// In development, data.js defines PRODUCTS directly and the gate is skipped.
(function () {
  var APP = ['logic.js', 'store.js', 'export.js', 'app.js'];
  var $ = function (id) { return document.getElementById(id); };

  function b64(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }

  async function decrypt(enc, password) {
    var raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    var key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b64(enc.salt), iterations: enc.iter, hash: 'SHA-256' },
      raw, { name: 'AES-CBC', length: 256 }, false, ['decrypt']);
    var plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: b64(enc.iv) }, key, b64(enc.ct));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function start(products) {
    globalThis.PRODUCTS = products;
    $('gate').hidden = true;
    (function next(i) {
      if (i >= APP.length) return;
      var s = document.createElement('script');
      s.src = APP[i];
      s.onload = function () { next(i + 1); };
      document.body.appendChild(s);
    })(0);
  }

  async function unlock(enc, password) {
    try { start(await decrypt(enc, password)); return true; } catch (e) { return false; }
  }

  async function boot() {
    if (globalThis.PRODUCTS) { $('gate').hidden = true; start(globalThis.PRODUCTS); return; }
    var enc = await (await fetch('data.enc.json')).json();
    var saved = null;
    try { saved = localStorage.getItem('stock.pw'); } catch (e) {}
    if (saved && await unlock(enc, saved)) return;
    $('gate').hidden = false;
    $('gate-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var pw = $('pw').value;
      if (await unlock(enc, pw)) {
        try { localStorage.setItem('stock.pw', pw); } catch (e2) {}
      } else {
        $('gate-err').textContent = 'סיסמה שגויה';
        $('pw').select();
      }
    });
  }
  boot();
})();
