(function () {
  var L = Logic, secs = PRODUCTS.sections;
  var flat = [];
  secs.forEach(function (s, si) { s.items.forEach(function (it) { flat.push({ it: it, si: si }); }); });

  var storage = null;
  try { storage = window.localStorage; storage.getItem('x'); } catch (e) { storage = null; }
  var seen = {};
  var keys = flat.map(function (f) {
    var base = f.it.name + '|' + f.it.sku, n = seen[base] || 0;
    seen[base] = n + 1;
    return base + '|' + n;
  });
  var store = createStore(storage, flat.map(function (f) { return f.it.qty; }), keys);

  var floor = 1;
  try { floor = Number(storage.getItem('stock.tab')) === 2 ? 2 : 1; } catch (e) {}

  // Light colour, dark-mode tint and accent for a category colour, as CSS variables (no color-mix: older Safari lacks it).
  function paintCat(el, hex) {
    el.style.setProperty('--cat', '#' + hex);
    el.style.setProperty('--cat-d', '#' + L.darkTint(hex));
    el.style.setProperty('--cat-l', '#' + L.shade(hex, 0.6));
  }

  var $ = function (id) { return document.getElementById(id); };
  var list = $('list'), rows = [], armTimer = null, toastTimer = null;

  function build() {
    list.textContent = '';
    rows = [];
    var k = 0;
    secs.forEach(function (s, si) {
      var sec = document.createElement('section');
      sec.id = 'sec' + si;
      paintCat(sec, L.catColor(si));
      sec.innerHTML = '<button class="sec-h"><span></span><span class="n"></span></button><ul></ul>';
      sec.querySelector('.sec-h span').textContent = s.title;
      var ul = sec.querySelector('ul');
      s.items.forEach(function (it) {
        var li = document.createElement('li');
        li.dataset.i = k;
        if (L.isVegan(it.name)) paintCat(li, L.veganColor(si));
        li.innerHTML = '<div><div class="name"></div><div class="sub"></div></div>' +
          '<div class="ctl"><button class="minus" data-d="-1" aria-label="הפחת">−</button>' +
          '<span class="qty"></span><button class="plus" data-d="1" aria-label="הוסף">+</button></div>';
        li.querySelector('.name').textContent = it.name;
        ul.appendChild(li);
        rows.push(li);
        k++;
      });
      list.appendChild(sec);
    });
    var none = document.createElement('div');
    none.className = 'empty-msg'; none.id = 'none'; none.textContent = 'לא נמצאו מוצרים'; none.hidden = true;
    list.appendChild(none);
  }

  function buildNav() {
    var nav = $('nav');
    nav.textContent = '';
    secs.forEach(function (s, si) {
      var b = document.createElement('button');
      b.textContent = s.title;
      b.dataset.sec = si;
      paintCat(b, L.catColor(si));
      nav.appendChild(b);
    });
    nav.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-sec]');
      if (!b) return;
      if ($('q').value) { $('q').value = ''; filter(); }
      var sec = $('sec' + b.dataset.sec);
      sec.classList.remove('closed');
      sec.style.scrollMarginTop = (document.querySelector('header').offsetHeight + 6) + 'px';
      sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function paintRow(i) {
    var d = store.get(floor), li = rows[i];
    var cur = d.current[i], was = d.last[i], it = flat[i].it;
    var q = li.querySelector('.qty');
    q.textContent = cur || '–';
    q.classList.toggle('empty', !cur);
    li.classList.toggle('changed', cur !== was);
    li.querySelector('.sub').textContent =
      (it.sku ? 'מק״ט ' + it.sku : 'ללא מק״ט') + (cur !== was ? ' · היה: ' + (was || '–') : '');
  }

  function paintCounts() {
    var d = store.get(floor);
    list.querySelectorAll('section').forEach(function (sec) {
      var lis = sec.querySelectorAll('li'), ordered = 0;
      lis.forEach(function (li) { if (d.current[li.dataset.i]) ordered++; });
      sec.querySelector('.n').textContent = ordered ? ordered + ' בהזמנה' : '';
    });
  }

  function paintAll() {
    for (var i = 0; i < rows.length; i++) paintRow(i);
    paintCounts();
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.setAttribute('aria-selected', String(Number(b.dataset.floor) === floor));
    });
    var d = store.get(floor);
    $('meta').textContent = d.lastDate ? 'הזמנה אחרונה: ' + d.lastDate : 'עוד לא נשלחה הזמנה מקומה זו';
    $('banner').hidden = store.persistent;
    if ($('date').value) paintName();
    filter();
  }

  function filter() {
    var q = $('q').value, shown = 0;
    rows.forEach(function (li, i) {
      var m = L.matches(flat[i].it, q);
      li.hidden = !m;
      if (m) shown++;
    });
    list.querySelectorAll('section').forEach(function (sec) {
      var any = sec.querySelector('li:not([hidden])');
      sec.hidden = !any;
      if (q) sec.classList.remove('closed');
    });
    $('none').hidden = shown > 0;
  }

  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 4000);
  }

  function disarm() { clearTimeout(armTimer); $('reset').classList.remove('armed'); $('reset').textContent = 'אפס הכל'; }

  // Tap = one step. Long press on − zeroes the item; long press on + counts up fast (accelerating).
  var HOLD_MS = 450, press = null;

  function step(i, dir, times) {
    var cur = store.get(floor).current[i], rule = L.ruleFor(flat[i].it.name);
    for (var n = 0; n < times; n++) cur = L.stepQty(cur, dir, rule);
    store.set(floor, i, cur);
    paintRow(i); paintCounts();
  }

  function endPress() {
    if (!press) return;
    clearTimeout(press.timer); clearInterval(press.rep);
    var p = press; press = null;
    return p;
  }

  list.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('button[data-d]');
    if (!b || e.button > 0) return;
    endPress();
    var i = Number(b.closest('li').dataset.i), dir = Number(b.dataset.d);
    press = { b: b, long: false };
    press.timer = setTimeout(function () {
      press.long = true;
      if (navigator.vibrate) navigator.vibrate(30);
      if (dir < 0) { store.set(floor, i, ''); paintRow(i); paintCounts(); return; }
      var ticks = 0;
      press.rep = setInterval(function () {
        ticks++;
        step(i, 1, ticks < 12 ? 1 : ticks < 30 ? 3 : 8);
      }, 80);
    }, HOLD_MS);
  });

  list.addEventListener('pointerup', function (e) {
    var p = endPress();
    if (!p || p.long) return;
    var b = e.target.closest('button[data-d]');
    if (b === p.b) step(Number(b.closest('li').dataset.i), Number(b.dataset.d), 1);
  });
  list.addEventListener('pointercancel', endPress);
  list.addEventListener('contextmenu', function (e) { if (e.target.closest('.ctl')) e.preventDefault(); });

  list.addEventListener('click', function (e) {
    var h = e.target.closest('.sec-h');
    if (h) { h.parentElement.classList.toggle('closed'); return; }
    var b = e.target.closest('button[data-d]');
    if (b && e.detail === 0) step(Number(b.closest('li').dataset.i), Number(b.dataset.d), 1); // keyboard / assistive tech
  });

  document.querySelectorAll('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      floor = Number(b.dataset.floor);
      try { storage.setItem('stock.tab', String(floor)); } catch (e) {}
      disarm(); paintAll(); window.scrollTo(0, 0);
    });
  });
  $('q').addEventListener('input', filter);

  $('reset').addEventListener('click', function () {
    var btn = $('reset');
    if (!btn.classList.contains('armed')) {
      btn.classList.add('armed'); btn.textContent = 'בטוח? לחץ שוב';
      armTimer = setTimeout(disarm, 3000); return;
    }
    disarm(); store.reset(floor); paintAll(); toast('כל הכמויות אופסו (ההזמנה האחרונה נשמרה)');
  });

  function pickedDate() {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec($('date').value);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
  }
  function todayValue() {
    var n = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; };
    return n.getFullYear() + '-' + p(n.getMonth() + 1) + '-' + p(n.getDate());
  }
  function paintName() { $('fname').textContent = L.exportFilename(floor, pickedDate()); }
  $('date').value = todayValue();
  $('date').addEventListener('input', paintName);

  $('send').addEventListener('click', function () {
    var d = store.get(floor);
    Export.send(floor, d.current, pickedDate()).then(function (res) {
      if (res === 'cancelled') return;
      var iso = new Date().toLocaleDateString('he-IL');
      store.submit(floor, iso);
      paintAll();
      toast(res === 'shared' ? 'הקובץ נשלח' : 'הקובץ ירד למכשיר');
    }, function (err) { toast('שגיאה ביצירת הקובץ: ' + err.message); });
  });

  build(); buildNav(); paintAll();
  if (store.migrated) toast('רשימת המוצרים עודכנה – הכמויות השמורות הותאמו');
})();
