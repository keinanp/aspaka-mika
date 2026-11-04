// Per-floor quantity state with "last submitted" memory, persisted in localStorage.
// Quantities are indexed by the item's position in the flattened product list.
// keys[i] identifies item i (name|sku|nth duplicate) so saved data survives list edits.
globalThis.createStore = function (storage, seed, keys) {
  var n = seed.length;
  var blank = function () { return seed.map(function () { return ''; }); };
  var persistent = !!storage;
  var floors = {};
  var migrated = false;

  function fresh(floor) {
    var q = floor === 1 ? seed.slice() : blank();
    return { keys: keys, current: q.slice(), last: q.slice(), lastDate: null };
  }
  function valid(d) {
    return d && Array.isArray(d.keys) && Array.isArray(d.current) && Array.isArray(d.last) &&
      d.current.length === d.keys.length && d.last.length === d.keys.length;
  }
  // Re-index saved quantities onto the current list by key; unknown items start empty.
  function remap(d) {
    var pos = {};
    d.keys.forEach(function (k, i) { pos[k] = i; });
    var pick = function (arr) {
      return keys.map(function (k) { return k in pos ? arr[pos[k]] : ''; });
    };
    migrated = true;
    return { keys: keys, current: pick(d.current), last: pick(d.last), lastDate: d.lastDate };
  }
  function load(floor) {
    if (storage) {
      try {
        var d = JSON.parse(storage.getItem('stock.floor' + floor));
        if (valid(d)) return d.keys.join('\n') === keys.join('\n') ? d : remap(d);
      } catch (e) { if (!(e instanceof SyntaxError)) persistent = false; }
    }
    return fresh(floor);
  }
  function save(floor) {
    if (!storage) return;
    try { storage.setItem('stock.floor' + floor, JSON.stringify(floors[floor])); }
    catch (e) { persistent = false; }
  }
  function get(floor) {
    if (!floors[floor]) { floors[floor] = load(floor); if (migrated) save(floor); }
    return floors[floor];
  }

  return {
    get: get,
    get migrated() { get(1); get(2); return migrated; },
    set: function (floor, i, v) { get(floor).current[i] = v; save(floor); },
    submit: function (floor, dateISO) {
      var d = get(floor); d.last = d.current.slice(); d.lastDate = dateISO; save(floor);
    },
    reset: function (floor) { get(floor).current = blank(); save(floor); },
    get persistent() { return persistent; }
  };
};
