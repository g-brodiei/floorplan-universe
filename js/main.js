/* 啟動與事件綁定 */
(function (FP) {
  "use strict";

  var store = FP.store;
  var S = store.S;
  var ui = FP.ui;
  var $ = function (id) { return document.getElementById(id); };

  var SAMPLE_URL = "examples/sample-home.json";

  /* ---------- 範例資料（內建一份，離線也能用） ---------- */

  var SAMPLE = {
    version: 1,
    name: "範例：三房公寓",
    unit: "cm",
    upBearing: 0,
    wallThickness: 12,
    rooms: [
      {
        name: "客廳", w: 420, h: 360, x: 0, y: 0, rot: 0, fill: "#F2DFC6",
        openings: [
          { type: "window", wall: "S", offset: 110, length: 240, note: "大窗" },
          { type: "door", wall: "E", offset: 140, length: 100, note: "開口（無門）" },
          { type: "door", wall: "N", offset: 30, length: 90, note: "紗窗門＋鐵門" }
        ]
      },
      {
        name: "餐廚", w: 300, h: 360, x: 432, y: 0, rot: 0, fill: "#D8E8D2",
        openings: [
          { type: "window", wall: "S", offset: 90, length: 120, note: "推射窗" },
          { type: "door", wall: "E", offset: 150, length: 80, note: "拉門" }
        ]
      },
      {
        name: "主臥室", w: 380, h: 330, x: 0, y: 372, rot: 0, fill: "#D3E2EE",
        openings: [
          { type: "window", wall: "S", offset: 100, length: 180, note: "橫拉窗" },
          { type: "door", wall: "N", offset: 250, length: 80, note: "門" }
        ]
      },
      {
        name: "次臥", w: 300, h: 330, x: 392, y: 372, rot: 0, fill: "#E6DDEE",
        openings: [
          { type: "window", wall: "S", offset: 80, length: 150, note: "橫拉窗" },
          { type: "door", wall: "N", offset: 40, length: 80, note: "門" }
        ]
      },
      {
        name: "浴室", w: 220, h: 250, x: 704, y: 372, rot: 0, fill: "#D2E9E6",
        openings: [
          { type: "window", wall: "E", offset: 60, length: 90, note: "氣窗" },
          { type: "door", wall: "N", offset: 60, length: 70, note: "門" }
        ]
      },
      {
        name: "走廊", w: 690, h: 100, x: 0, y: 260, rot: 0, fill: "#E2E2DA",
        openings: []
      }
    ],
    extras: [
      { kind: "area", text: "前陽台", x: 0, y: -140, w: 420, h: 128, rot: 0 },
      { kind: "label", text: "電箱在這面牆", x: 740, y: 250 }
    ]
  };

  /* ---------- 分頁 ---------- */

  function setTab(name) {
    var tabs = document.querySelectorAll("[data-tab]");
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute("data-tab") === name;
      tabs[i].classList.toggle("is-active", on);
      tabs[i].setAttribute("aria-selected", on ? "true" : "false");
    }
    var panels = document.querySelectorAll("[data-panel]");
    for (var j = 0; j < panels.length; j++) {
      panels[j].hidden = panels[j].getAttribute("data-panel") !== name;
    }
    if (name === "summary") ui.renderSummary();
    if (name === "data") $("json-text").value = JSON.stringify(
      FP.schema.serialize(S.doc, { includeUnderlay: false }), null, 2
    );
    if (name === "ai") refreshAIPrompt();
  }

  function refreshAIPrompt() {
    var notes = $("ai-notes") ? $("ai-notes").value : "";
    $("ai-prompt").value = ui.buildAIPrompt(notes);
  }

  /* ---------- 匯出 ---------- */

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function safeName() {
    return (S.doc.name || "平面圖").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
  }

  function exportPNG() {
    try {
      var W = 1600, H = 2000;
      var markup = FP.render.toStandaloneSVG(W, H);
      var blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        var ctx = canvas.getContext("2d");
        var paper = getComputedStyle(document.documentElement)
          .getPropertyValue("--paper").trim() || "#ffffff";
        ctx.fillStyle = paper;
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, 0, 0, W, H);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (out) {
          if (!out) { ui.toast("圖片轉檔失敗，可以直接截圖畫面", "warn"); return; }
          var a = document.createElement("a");
          a.href = URL.createObjectURL(out);
          a.download = safeName() + ".png";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          ui.toast("平面圖已下載");
        }, "image/png");
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        ui.toast("圖片轉檔失敗，可以直接截圖畫面", "warn");
      };
      img.src = url;
    } catch (e) {
      ui.toast("圖片轉檔失敗，可以直接截圖畫面", "warn");
    }
  }

  /* ---------- 刪除與旋轉 ---------- */

  function deleteSelection() {
    if (!S.sel) { ui.hint("先選一個項目再刪除。"); return; }

    if (S.sel.kind === "opening") {
      var r = store.findRoom(S.sel.roomId);
      if (r) {
        store.begin("刪除開口");
        r.openings = r.openings.filter(function (o) { return o.id !== S.sel.id; });
        S.sel = null;
        store.commit();
      }
    } else if (S.sel.kind === "extra") {
      store.begin("刪除項目");
      S.doc.extras = S.doc.extras.filter(function (e) { return e.id !== S.sel.id; });
      S.sel = null;
      store.commit();
    } else if (S.sel.kind === "underlay") {
      store.begin("移除底圖");
      S.doc.underlay = null;
      S.sel = null;
      store.commit();
    } else if (S.sel.kind === "room") {
      var room = store.findRoom(S.sel.roomId);
      var name = room ? room.name : "這個房間";
      ui.confirmAction("要移除房間嗎？", "「" + name + "」和它上面的窗戶、門都會一起消失。可以用復原救回來。", "移除房間", function (ok) {
        if (!ok) return;
        store.begin("刪除房間");
        S.doc.rooms = S.doc.rooms.filter(function (x) { return x.id !== S.sel.roomId; });
        S.sel = null;
        store.commit();
        FP.render.render();
        ui.refreshPanels();
      });
      return;
    }
    FP.render.render();
    ui.refreshPanels();
  }

  function rotateBy(deg) {
    var obj = store.selectedObject();
    if (!obj || (obj.kind === "label")) {
      ui.hint("先選一個房間或區域，再按旋轉。");
      return;
    }
    store.begin("旋轉");
    obj.rot = FP.schema.norm360((obj.rot || 0) + deg);
    store.commit();
    FP.render.render();
    ui.refreshPanels();
  }

  function addRoom() {
    var b = FP.geom.bounds(S.doc);
    var x = b ? b.x2 + 60 : 0;
    var y = b ? b.y1 : 0;
    store.begin("新增房間");
    var room = {
      id: FP.schema.nid("room"),
      name: "新房間",
      w: 300, h: 300,
      x: Math.round(x), y: Math.round(y),
      rot: 0,
      fill: FP.schema.PALETTE[S.doc.rooms.length % FP.schema.PALETTE.length],
      openings: []
    };
    S.doc.rooms.push(room);
    S.sel = { kind: "room", roomId: room.id };
    store.commit();
    FP.render.render();
    ui.refreshPanels();
    var input = $("p-name");
    if (input) { input.focus(); input.select(); }
  }

  /* ---------- 對話框內容 ---------- */

  function openStartDialog() {
    ui.openDialog(
      "從哪裡開始？",
      '<div class="start-grid">' +
        '<button class="start-card" id="start-list">' +
          "<h3>打房間清單</h3>" +
          "<p>一行一個房間，寫上名稱和長寬，其他之後再排。</p>" +
        "</button>" +
        '<button class="start-card" id="start-json">' +
          "<h3>貼上 JSON</h3>" +
          "<p>之前下載過的檔案，或是 AI 幫你產生的資料。</p>" +
        "</button>" +
        '<button class="start-card" id="start-image">' +
          "<h3>描現成的圖</h3>" +
          "<p>把平面圖照片放到底層，對齊後照著描。</p>" +
        "</button>" +
        '<button class="start-card" id="start-sample">' +
          "<h3>看範例</h3>" +
          "<p>載入一份做好的三房公寓，直接改成你家。</p>" +
        "</button>" +
      "</div>",
      '<button class="btn" data-close>取消</button>',
      function () {
        $("start-list").addEventListener("click", function () { ui.closeDialog(); openRoomListDialog(); });
        $("start-json").addEventListener("click", function () { ui.closeDialog(); openImportDialog(); });
        $("start-image").addEventListener("click", function () { ui.closeDialog(); $("file-image").click(); });
        $("start-sample").addEventListener("click", function () { ui.closeDialog(); loadSample(); });
      }
    );
  }

  function openRoomListDialog() {
    var ftin = FP.units.get() === "ftin";
    ui.openDialog(
      "打一份房間清單",
      '<p class="dialog-text">一行一個房間，格式是「名稱 寬x高」，單位' +
      (ftin ? "吋（inch）" : "公分") + "。排版之後可以再拖。</p>" +
      '<textarea id="list-input" class="dialog-textarea" rows="9" ' +
      'placeholder="' + (ftin
        ? "客廳 141x192&#10;主臥室 185x141&#10;廁所 72x109&#10;走廊 201x38"
        : "客廳 358x487&#10;主臥室 469x358&#10;廁所 183x277&#10;走廊 511x97") + '"></textarea>',
      '<button class="btn" data-close>取消</button>' +
      '<button class="btn btn-primary" id="list-ok">建立房間</button>',
      function () {
        $("list-ok").addEventListener("click", function () {
          var text = $("list-input").value;
          if (ui.handleRoomList(text)) ui.closeDialog();
        });
      }
    );
  }

  function openImportDialog() {
    ui.openDialog(
      "貼上資料",
      '<p class="dialog-text">貼上 JSON 就會整份取代目前的內容。前後有多餘的說明文字也沒關係，會自動找出資料的部分。</p>' +
      '<textarea id="import-input" class="dialog-textarea" rows="10" placeholder="{ &quot;version&quot;: 1, &quot;rooms&quot;: [ ... ] }"></textarea>' +
      '<p class="dialog-text dialog-muted">或者選一個之前下載的 .json 檔：</p>' +
      '<button class="btn btn-slim" id="import-file">選擇檔案</button>',
      '<button class="btn" data-close>取消</button>' +
      '<button class="btn btn-primary" id="import-ok">匯入</button>',
      function () {
        $("import-ok").addEventListener("click", function () {
          if (ui.handleImportText($("import-input").value)) ui.closeDialog();
        });
        $("import-file").addEventListener("click", function () { $("file-json").click(); });
      }
    );
  }

  function loadSample() {
    // 優先讀 examples 目錄，讀不到就用內建的副本
    fetch(SAMPLE_URL)
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (data) { ui.importFromObject(data, "載入範例"); })
      .catch(function () { ui.importFromObject(SAMPLE, "載入範例"); });
  }

  /* ---------- 顯示單位 ---------- */

  /* 牆厚輸入框跟著顯示單位換算：公分整數，或吋（0.5 一格） */
  function syncWallInput() {
    var inp = $("wall-input");
    var suffix = $("wall-unit");
    if (FP.units.get() === "ftin") {
      inp.min = 0; inp.max = 24; inp.step = 0.5;
      inp.value = String(Math.round(S.doc.wallThickness / FP.units.IN * 2) / 2);
      if (suffix) suffix.textContent = "吋";
    } else {
      inp.min = 0; inp.max = 60; inp.step = 1;
      inp.value = S.doc.wallThickness;
      if (suffix) suffix.textContent = "cm";
    }
  }

  function applyUnit(u) {
    FP.units.set(u);
    $("unit-cm").classList.toggle("is-active", u === "cm");
    $("unit-ftin").classList.toggle("is-active", u === "ftin");
    $("unit-cm").setAttribute("aria-pressed", u === "cm" ? "true" : "false");
    $("unit-ftin").setAttribute("aria-pressed", u === "ftin" ? "true" : "false");
    syncWallInput();
    FP.render.render();
    ui.refreshPanels();
  }

  /* ---------- 綁定 ---------- */

  function bind() {
    var svg = $("board");
    FP.render.init(svg);
    FP.interact.init(svg, {
      onHint: ui.hint,
      onCursor: function (p) {
        var node = $("cursor-pos");
        if (node) node.textContent = FP.units.fmtPoint(p.x, p.y);
      }
    });

    var tools = document.querySelectorAll("[data-tool]");
    for (var i = 0; i < tools.length; i++) {
      (function (btn) {
        btn.addEventListener("click", function () { ui.setTool(btn.getAttribute("data-tool")); });
      })(tools[i]);
    }

    var tabs = document.querySelectorAll("[data-tab]");
    for (var j = 0; j < tabs.length; j++) {
      (function (btn) {
        btn.addEventListener("click", function () { setTab(btn.getAttribute("data-tab")); });
      })(tabs[j]);
    }

    $("btn-add-room").addEventListener("click", addRoom);
    $("btn-rot-ccw").addEventListener("click", function () { rotateBy(-90); });
    $("btn-rot-cw").addEventListener("click", function () { rotateBy(90); });
    $("btn-delete").addEventListener("click", deleteSelection);
    $("btn-undo").addEventListener("click", function () {
      if (store.undo()) { FP.render.render(); ui.refreshPanels(); }
    });
    $("btn-redo").addEventListener("click", function () {
      if (store.redo()) { FP.render.render(); ui.refreshPanels(); }
    });

    $("btn-zoom-in").addEventListener("click", function () { FP.interact.zoomBy(0.8); });
    $("btn-zoom-out").addEventListener("click", function () { FP.interact.zoomBy(1.25); });
    $("btn-fit").addEventListener("click", function () { FP.interact.fit(); });

    $("chk-snap").addEventListener("change", function (e) {
      S.snap = e.target.checked;
      store.setPref("snap", S.snap);
    });

    $("compass-select").addEventListener("change", function (e) {
      store.begin("設定方位");
      S.doc.upBearing = parseInt(e.target.value, 10);
      store.commit();
      FP.render.render();
      ui.refreshPanels();
    });

    $("wall-input").addEventListener("change", function (e) {
      var v = parseFloat(e.target.value);
      var cm = FP.units.get() === "ftin" ? v * FP.units.IN : v;
      if (isNaN(cm) || cm < 0 || cm > 60) { syncWallInput(); return; }
      store.begin("設定牆厚");
      S.doc.wallThickness = Math.round(cm * 10) / 10;
      store.commit();
      FP.render.render();
      ui.refreshPanels();
    });

    $("unit-cm").addEventListener("click", function () { applyUnit("cm"); });
    $("unit-ftin").addEventListener("click", function () { applyUnit("ftin"); });

    $("doc-name").addEventListener("input", function (e) {
      S.doc.name = e.target.value.slice(0, 60);
      store.scheduleSave();
      ui.renderSummary();
    });

    $("btn-start").addEventListener("click", openStartDialog);
    $("btn-help").addEventListener("click", function () { FP.tour.start(true); });

    $("btn-reset").addEventListener("click", function () {
      ui.confirmAction(
        "要清空重來嗎？",
        "目前的平面圖會被清掉，本機存檔也會一併移除。建議先到「資料」頁下載一份備份。",
        "清空重來",
        function (ok) {
          if (!ok) return;
          store.clearAll();
          store.replaceDoc(FP.schema.blank(), "清空");
          FP.interact.fit();
          ui.refreshPanels();
          openStartDialog();
        }
      );
    });

    // 匯出
    $("btn-copy-summary").addEventListener("click", function () {
      ui.copyText(ui.buildSummary(), "文字摘要已複製");
    });
    $("btn-copy-json").addEventListener("click", function () {
      ui.copyText($("json-text").value, "JSON 已複製");
    });
    $("btn-download-json").addEventListener("click", function () {
      download(safeName() + ".json",
        JSON.stringify(FP.schema.serialize(S.doc, { includeUnderlay: false }), null, 2),
        "application/json");
      ui.toast("已下載 JSON");
    });
    $("btn-download-png").addEventListener("click", exportPNG);
    $("btn-copy-prompt").addEventListener("click", function () {
      refreshAIPrompt();
      ui.copyText($("ai-prompt").value, "提示詞已複製，貼給任何 AI 都可以");
    });
    $("ai-notes").addEventListener("input", refreshAIPrompt);
    $("btn-paste-ai").addEventListener("click", function () {
      var text = $("ai-reply").value;
      if (!text.trim()) { ui.toast("先把 AI 回覆的內容貼進上面的框", "warn"); return; }
      if (ui.handleImportText(text)) $("ai-reply").value = "";
    });

    // 檔案輸入
    $("file-json").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      ui.readFile(f, function (text) {
        if (ui.handleImportText(text)) ui.closeDialog();
      });
      e.target.value = "";
    });
    $("file-image").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) ui.loadUnderlayImage(f);
      e.target.value = "";
    });
    $("btn-underlay").addEventListener("click", function () { $("file-image").click(); });

    // 對話框關閉
    $("dialog-backdrop").addEventListener("click", function (e) {
      if (e.target === $("dialog-backdrop") || e.target.hasAttribute("data-close")) {
        ui.closeDialog();
      }
    });
    $("dialog-close").addEventListener("click", ui.closeDialog);

    // 拖放檔案到畫布
    var stage = $("stage");
    ["dragenter", "dragover"].forEach(function (ev) {
      stage.addEventListener(ev, function (e) {
        e.preventDefault();
        stage.classList.add("is-dropping");
      });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      stage.addEventListener(ev, function (e) {
        e.preventDefault();
        stage.classList.remove("is-dropping");
      });
    });
    stage.addEventListener("drop", function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      if (/^image\//.test(f.type)) ui.loadUnderlayImage(f);
      else ui.readFile(f, ui.handleImportText);
    });

    // 鍵盤
    document.addEventListener("keydown", function (e) {
      var tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (!$("dialog-backdrop").hidden) return;

      var mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        var ok = e.shiftKey ? store.redo() : store.undo();
        if (ok) { FP.render.render(); ui.refreshPanels(); }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelection(); return; }
      if (e.key === "[") { e.preventDefault(); rotateBy(-15); return; }
      if (e.key === "]") { e.preventDefault(); rotateBy(15); return; }
      if (e.key === "Escape") { S.sel = null; ui.setTool("select"); FP.render.render(); ui.refreshPanels(); return; }
      if (e.key === "v" || e.key === "V") ui.setTool("select");
      if (e.key === "w" || e.key === "W") ui.setTool("window");
      if (e.key === "d" || e.key === "D") ui.setTool("door");
      if (e.key === "a" || e.key === "A") ui.setTool("area");
      if (e.key === "t" || e.key === "T") ui.setTool("label");
      if (e.key === "f" || e.key === "F") FP.interact.fit();
    });

    window.addEventListener("resize", function () { FP.render.render(); });
    window.addEventListener("beforeunload", function () { store.saveNow(); });

    store.on(function (reason) {
      if (reason === "save-failed") {
        ui.toast("這個瀏覽器無法自動存檔，請記得下載備份", "warn");
      }
      ui.renderStatus();
    });
  }

  /* ---------- 啟動 ---------- */

  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    bind();

    var restored = store.load();
    var prefs = store.prefs();
    if (typeof prefs.snap === "boolean") S.snap = prefs.snap;
    $("chk-snap").checked = S.snap;
    FP.units.init(prefs.unit);

    if (!restored) {
      var res = FP.schema.normalize(SAMPLE);
      S.doc = res.doc;
    }

    // 選單只提供八個方位，把載入的值對齊到最接近的一個
    S.doc.upBearing = Math.round(S.doc.upBearing / 45) % 8 * 45;

    $("doc-name").value = S.doc.name;
    $("compass-select").value = String(S.doc.upBearing);
    applyUnit(FP.units.get());

    ui.setTool("select");
    setTab("summary");
    if (restored) FP.render.render(); else FP.interact.fit();
    ui.refreshPanels();

    if (!store.tourSeen()) {
      setTimeout(function () { FP.tour.start(); }, 400);
    }
    if (restored) {
      ui.toast("已回復上次的進度");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window.FP);
