// Builds the order workbook and hands it to the phone's share sheet (or downloads it).
globalThis.Export = (function () {
  var MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  function makeWorkbook(XLSX, products, qtys) {
    var aoa = Logic.buildRows(products, qtys).map(function (r) {
      return r.map(function (c) { return c === '' ? null : c; });
    });
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    var names = Logic.buildRows(products, []).map(function (row) { return row[0]; });
    Logic.rowSections(products).forEach(function (si, r) {
      if (si < 0) return;
      for (var c = 0; c < 3; c++) {
        var addr = XLSX.utils.encode_cell({ r: r, c: c });
        var cell = ws[addr] || (ws[addr] = { t: 's', v: '' });
        cell.s = { fill: { patternType: 'solid', fgColor: { rgb: Logic.itemColor(names[r], si) } } };
      }
    });
    ws['!cols'] = [{ wch: 50 }, { wch: 10 }, { wch: 10 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'גיליון1');
    wb.Workbook = { Views: [{ RTL: true }] };
    return wb;
  }

  function download(blob, filename) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function shareOrDownload(blob, filename) {
    var file = new File([blob], filename, { type: MIME });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file] }).then(function () { return 'shared'; }, function (e) {
        if (e && e.name === 'AbortError') return 'cancelled';
        download(blob, filename);
        return 'downloaded';
      });
    }
    download(blob, filename);
    return Promise.resolve('downloaded');
  }

  function send(floor, qtys, date) {
    try {
      var wb = makeWorkbook(XLSX, PRODUCTS, qtys);
      var bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      return shareOrDownload(new Blob([bytes], { type: MIME }), Logic.exportFilename(floor, date || new Date()));
    } catch (e) { return Promise.reject(e); }
  }

  return { makeWorkbook: makeWorkbook, shareOrDownload: shareOrDownload, send: send };
})();
