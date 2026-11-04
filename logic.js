// Pure helpers: quantity text handling, search matching, export row building.
globalThis.Logic = (function () {
  var HEADER = ['שם המוצר', 'מקט', 'כמות'];

  function parseQty(text) {
    var m = /^\s*(\d+(?:\.\d+)?)\s*(.*?)\s*$/.exec(text || '');
    return m ? { n: parseFloat(m[1]), unit: m[2] } : null;
  }

  function formatQty(q) {
    if (!q || !(q.n > 0)) return '';
    return q.unit ? q.n + ' ' + q.unit : String(q.n);
  }

  // Items ordered by weight in half-kilo steps (default unit applies when starting from empty).
  var RULES = {
    'גינגר': { step: 0.5, unit: 'קג' },
    'פלפל חריף': { step: 0.5, unit: 'קג' }
  };

  function ruleFor(name) { return RULES[name] || null; }

  function stepQty(text, dir, rule) {
    var q = parseQty(text) || { n: 0, unit: rule ? rule.unit : '' };
    var step = rule ? rule.step : (q.n % 1 !== 0 ? 0.5 : 1);
    return formatQty({ n: q.n + dir * step, unit: q.unit });
  }

  function normalize(s) {
    return String(s).toLowerCase().replace(/[׳'’״"]/g, '').replace(/\s+/g, ' ').trim();
  }

  function matches(item, query) {
    var q = normalize(query);
    if (!q) return true;
    return normalize(item.name).indexOf(q) !== -1 || item.sku.indexOf(q) !== -1;
  }

  function cell(text) { return /^\d+(\.\d+)?$/.test(text) ? Number(text) : text; }

  // qtys is indexed by the item's position in the flattened product list.
  function buildRows(products, qtys) {
    var rows = [HEADER.slice()], k = 0;
    products.sections.forEach(function (sec, si) {
      if (si > 0) rows.push([]);
      sec.items.forEach(function (it) {
        rows.push([it.name, cell(it.sku), cell(qtys[k++] || '')]);
      });
    });
    return rows;
  }

  var DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

  // One light colour per category (section), used for rows in the app and fills in the Excel.
  var CAT_COLORS = ['E1ECFA', 'FDE3D3', 'F3E6CF', 'F9DADA', 'EBDDF5', 'D9F0D3',
                    'FFF1BF', 'DDD0C4', 'D3F0F0', 'E4E4E4', 'F3D9A4', 'FAD9EC'];

  function catColor(si) { return CAT_COLORS[si % CAT_COLORS.length]; }

  // Vegan items (name says טבעוני / טבעונית) get a deeper shade of their category colour.
  function isVegan(name) { return String(name).indexOf('טבעונ') !== -1; }

  // Per-channel map over a 6-digit hex colour.
  function mapHex(hex, fn) {
    var out = '';
    for (var k = 0; k < 3; k++) {
      out += ('0' + Math.round(fn(parseInt(hex.substr(k * 2, 2), 16), k)).toString(16)).slice(-2);
    }
    return out.toUpperCase();
  }
  var DARK_CARD = [0x1d, 0x24, 0x25];

  function shade(hex, f) { return mapHex(hex, function (v) { return v * f; }); }
  // The colour as a tint over the dark-mode card background (matches the app's dark theme).
  function darkTint(hex) { return mapHex(hex, function (v, k) { return v * 0.26 + DARK_CARD[k] * 0.74; }); }

  function veganColor(si) { return shade(catColor(si), 0.85); }

  function itemColor(name, si) { return isVegan(name) ? veganColor(si) : catColor(si); }

  // Parallel to buildRows: the section index of each row, -1 for the header and blank separators.
  function rowSections(products) {
    var out = [-1];
    products.sections.forEach(function (sec, si) {
      if (si > 0) out.push(-1);
      sec.items.forEach(function () { out.push(si); });
    });
    return out;
  }

  var DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

  // Parallel to buildRows: true for rows of the gluten-free section.
  function glutenFlags(products) {
    var flags = [false];
    products.sections.forEach(function (sec, si) {
      if (si > 0) flags.push(false);
      sec.items.forEach(function () { flags.push(sec.title.indexOf('גלוטן') !== -1); });
    });
    return flags;
  }

  function exportFilename(floor, date) {
    return 'הייבוב - מנחם בגין 148 - קומה ' + floor + ' - ' + date.getDate() + '.' + (date.getMonth() + 1) +
      ' יום ' + DAYS[date.getDay()] + '.xlsx';
  }

  return { parseQty: parseQty, formatQty: formatQty, stepQty: stepQty, normalize: normalize,
           matches: matches, buildRows: buildRows, ruleFor: ruleFor, rowSections: rowSections, catColor: catColor,
           shade: shade, darkTint: darkTint, isVegan: isVegan, veganColor: veganColor, itemColor: itemColor, exportFilename: exportFilename };
})();
