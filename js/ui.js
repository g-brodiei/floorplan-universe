/* 工具列、屬性面板、對話框、匯入匯出 */
window.FP = window.FP || {};

(function (FP) {
  "use strict";

  var G = FP.geom;
  var store = FP.store;
  var S = store.S;
  var $ = function (id) { return document.getElementById(id); };

  var WINDOW_KINDS = ["標準窗", "雙開窗", "大窗", "推射窗", "橫拉窗", "氣窗", "落地窗", "格柵窗"];
  var DOOR_KINDS = ["門", "紗窗門", "鐵門", "紗窗門＋鐵門", "拉門", "折門", "開口（無門）"];

  var hintTimer = null;

  /* ---------- 小工具 ---------- */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function hint(text, sticky) {
    var node = $("hint");
    if (!node) return;
    node.textContent = text;
    if (hintTimer) clearTimeout(hintTimer);
    if (!sticky) {
      hintTimer = setTimeout(function () {
        node.textContent = toolHint(S.tool);
      }, 6000);
    }
  }

  function toolHint(tool) {
    return {
      select: "拖動房間排出你家的形狀。選起來後，上方的圓形把手可以自由旋轉。",
      window: "點房間的牆線加窗戶。加好後拖兩端的圓點調整寬度。",
      door: "點房間的牆線加門。加好後在下方選擇門的種類。",
      area: "在空白處拖出方形，用來標走道、陽台、天井這類額外空間。",
      label: "點畫面任一處加一段文字備註。"
    }[tool] || "";
  }

  function toast(text, kind) {
    var wrap = $("toast");
    wrap.textContent = text;
    wrap.className = "toast show" + (kind ? " " + kind : "");
    setTimeout(function () { wrap.className = "toast"; }, 2600);
  }

  function copyText(text, okMessage) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "readonly");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      toast(ok ? (okMessage || "已複製") : "複製失敗，請手動選取文字複製", ok ? "" : "warn");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast(okMessage || "已複製");
      }, fallback);
    } else {
      fallback();
    }
  }

  /* ---------- 對話框 ---------- */

  var dialogOnClose = null;

  function openDialog(title, bodyHTML, actionsHTML, onMount) {
    $("dialog-title").textContent = title;
    $("dialog-body").innerHTML = bodyHTML;
    $("dialog-actions").innerHTML = actionsHTML || '<button class="btn" data-close>關閉</button>';
    var back = $("dialog-backdrop");
    back.hidden = false;
    document.body.classList.add("dialog-open");
    if (onMount) onMount();
    var first = $("dialog-body").querySelector("input, textarea, button, select");
    if (first) first.focus();
  }

  function closeDialog() {
    $("dialog-backdrop").hidden = true;
    document.body.classList.remove("dialog-open");
    if (dialogOnClose) { var f = dialogOnClose; dialogOnClose = null; f(); }
  }

  function promptText(label, initial, callback) {
    var settled = false;
    openDialog(
      label,
      '<label class="field"><span class="field-label">內容</span>' +
      '<input type="text" id="prompt-input" value="' + esc(initial) + '" maxlength="40"></label>',
      '<button class="btn" data-close>取消</button>' +
      '<button class="btn btn-primary" id="prompt-ok">確定</button>',
      function () {
        var input = $("prompt-input");
        input.select();
        function done() {
          if (settled) return;
          settled = true;
          var v = input.value.trim();
          dialogOnClose = null;
          closeDialog();
          callback(v);
        }
        $("prompt-ok").addEventListener("click", done);
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter") { e.preventDefault(); done(); }
        });
      }
    );
    dialogOnClose = function () {
      if (settled) return;
      settled = true;
      callback(null);
    };
  }

  function confirmAction(title, message, confirmLabel, callback) {
    var done = false;
    openDialog(
      title,
      '<p class="dialog-text">' + esc(message) + "</p>",
      '<button class="btn" data-close>取消</button>' +
      '<button class="btn btn-danger" id="confirm-ok">' + esc(confirmLabel) + "</button>",
      function () {
        $("confirm-ok").addEventListener("click", function () {
          done = true;
          closeDialog();
          callback(true);
        });
      }
    );
    dialogOnClose = function () { if (!done) callback(false); };
  }

  /* ---------- 工具切換 ---------- */

  function setTool(tool) {
    S.tool = tool;
    var buttons = document.querySelectorAll("[data-tool]");
    for (var i = 0; i < buttons.length; i++) {
      var active = buttons[i].getAttribute("data-tool") === tool;
      buttons[i].classList.toggle("is-active", active);
      buttons[i].setAttribute("aria-pressed", active ? "true" : "false");
    }
    hint(toolHint(tool), true);
  }

  /* ---------- 屬性面板 ---------- */

  function refreshPanels() {
    renderProps();
    renderSummary();
    renderStatus();
    var u = $("btn-undo"), r = $("btn-redo");
    if (u) u.disabled = !store.canUndo();
    if (r) r.disabled = !store.canRedo();
  }

  /* 長度欄位：公分模式用數字框，呎吋模式用文字框顯示 11'10" 這種格式 */
  function lenField(id, label, cm) {
    if (FP.units.get() === "cm") {
      return '<label class="field field-num"><span class="field-label">' + label + '</span>' +
        '<input type="number" id="' + id + '" value="' + Math.round(cm) + '" step="1"></label>';
    }
    return '<label class="field field-num"><span class="field-label">' + label + '</span>' +
      '<input type="text" id="' + id + '" value="' + esc(FP.units.fmtLen(cm)) + '" spellcheck="false"></label>';
  }

  function renderProps() {
    var box = $("props");
    if (!S.sel) {
      box.innerHTML = '<p class="props-empty">點一下房間、窗戶、門或區域，這裡就會出現可以調整的欄位。</p>';
      return;
    }

    if (S.sel.kind === "room") {
      var r = store.findRoom(S.sel.roomId);
      if (!r) { S.sel = null; return renderProps(); }
      box.innerHTML =
        '<div class="props-row">' +
        '<span class="chip">房間</span>' +
        '<label class="field"><span class="field-label">名稱</span>' +
        '<input type="text" id="p-name" value="' + esc(r.name) + '" maxlength="24"></label>' +
        lenField("p-w", "寬", r.w) +
        lenField("p-h", "高", r.h) +
        '<label class="field field-num"><span class="field-label">角度</span>' +
        '<input type="number" id="p-rot" value="' + Math.round(r.rot) + '" step="5"></label>' +
        '<span class="props-note">上牆朝 ' + G.wallCompass(r, "N", S.doc.upBearing) + '</span>' +
        "</div>";

      bindText("p-name", function (v) { r.name = v; }, "改名稱");
      bindLen("p-w", function (v) {
        if (v < 20) return;
        r.w = v;
        clampOpenings(r);
      }, "改尺寸");
      bindLen("p-h", function (v) {
        if (v < 20) return;
        r.h = v;
        clampOpenings(r);
      }, "改尺寸");
      bindNumber("p-rot", function (v) { r.rot = FP.schema.norm360(v); }, "旋轉");
      return;
    }

    if (S.sel.kind === "opening") {
      var room = store.findRoom(S.sel.roomId);
      var op = store.findOpening(S.sel.roomId, S.sel.id);
      if (!room || !op) { S.sel = null; return renderProps(); }
      var L = G.openingLocal(room, op);
      var kinds = op.type === "window" ? WINDOW_KINDS : DOOR_KINDS;
      var opts = kinds.map(function (k) {
        return '<option value="' + esc(k) + '"' + (op.note === k ? " selected" : "") + ">" + esc(k) + "</option>";
      }).join("");

      box.innerHTML =
        '<div class="props-row">' +
        '<span class="chip chip-' + op.type + '">' + (op.type === "window" ? "窗戶" : "門") + "</span>" +
        '<span class="props-note">' + esc(room.name) + " · " +
        FP.schema.WALL_LABEL[op.wall] + "牆，朝" + G.wallCompass(room, op.wall, S.doc.upBearing) + "</span>" +
        lenField("p-len", "寬", op.length) +
        lenField("p-off", "距牆端", op.offset) +
        '<label class="field"><span class="field-label">種類</span>' +
        '<select id="p-note"><option value="">未指定</option>' + opts + "</select></label>" +
        '<button class="btn btn-slim" id="p-flip">換到對面牆</button>' +
        "</div>";

      bindLen("p-len", function (v) {
        op.length = Math.max(10, Math.min(v, L.wallLen));
        op.offset = Math.min(op.offset, L.wallLen - op.length);
      }, "改開口寬度");
      bindLen("p-off", function (v) {
        op.offset = Math.max(0, Math.min(v, L.wallLen - op.length));
      }, "移動開口");
      $("p-note").addEventListener("change", function (e) {
        store.begin("設定種類");
        op.note = e.target.value;
        store.commit();
        FP.render.render();
      });
      $("p-flip").addEventListener("click", function () {
        var opposite = { N: "S", S: "N", E: "W", W: "E" };
        store.begin("換牆面");
        op.wall = opposite[op.wall];
        clampOpenings(room);
        store.commit();
        FP.render.render();
        refreshPanels();
      });
      return;
    }

    if (S.sel.kind === "underlay") {
      var u = S.doc.underlay;
      if (!u) { S.sel = null; return renderProps(); }
      box.innerHTML =
        '<div class="props-row">' +
        '<span class="chip">底圖</span>' +
        lenField("p-uw", "寬", u.w) +
        '<label class="field field-num"><span class="field-label">角度</span>' +
        '<input type="number" id="p-urot" value="' + Math.round(u.rot) + '" step="5"></label>' +
        '<label class="field field-num"><span class="field-label">濃度</span>' +
        '<input type="range" id="p-uop" min="5" max="100" value="' + Math.round(u.opacity * 100) + '"></label>' +
        '<button class="btn btn-slim btn-danger" id="p-udel">移除底圖</button>' +
        "</div>";

      $("p-uw").addEventListener("change", function (e) {
        var v = FP.units.parseLen(e.target.value);
        if (!(v > 20)) return;
        store.begin("調整底圖");
        var ratio = u.h / u.w;
        u.w = v;
        u.h = v * ratio;
        store.commit();
        FP.render.render();
      });
      bindNumber("p-urot", function (v) { u.rot = FP.schema.norm360(v); }, "旋轉底圖");
      $("p-uop").addEventListener("input", function (e) {
        u.opacity = parseInt(e.target.value, 10) / 100;
        FP.render.render();
      });
      $("p-uop").addEventListener("change", function () { store.commit(); });
      $("p-udel").addEventListener("click", function () {
        store.begin("移除底圖");
        S.doc.underlay = null;
        S.sel = null;
        store.commit();
        FP.render.render();
        refreshPanels();
      });
      return;
    }

    var ex = store.findExtra(S.sel.id);
    if (!ex) { S.sel = null; return renderProps(); }
    var isArea = ex.kind === "area";
    box.innerHTML =
      '<div class="props-row">' +
      '<span class="chip chip-area">' + (isArea ? "區域" : "文字") + "</span>" +
      '<label class="field"><span class="field-label">內容</span>' +
      '<input type="text" id="p-text" value="' + esc(ex.text) + '" maxlength="40"></label>' +
      (isArea
        ? lenField("p-ew", "寬", ex.w) +
          lenField("p-eh", "高", ex.h) +
          '<label class="field field-num"><span class="field-label">角度</span>' +
          '<input type="number" id="p-erot" value="' + Math.round(ex.rot) + '" step="5"></label>'
        : "") +
      "</div>";

    bindText("p-text", function (v) { ex.text = v; }, "改文字");
    if (isArea) {
      bindLen("p-ew", function (v) { ex.w = Math.max(10, v); }, "改尺寸");
      bindLen("p-eh", function (v) { ex.h = Math.max(10, v); }, "改尺寸");
      bindNumber("p-erot", function (v) { ex.rot = FP.schema.norm360(v); }, "旋轉");
    }
  }

  function clampOpenings(room) {
    room.openings.forEach(function (op) {
      var wallLen = (op.wall === "N" || op.wall === "S") ? room.w : room.h;
      op.length = Math.min(op.length, wallLen);
      op.offset = Math.max(0, Math.min(op.offset, wallLen - op.length));
    });
  }

  function bindText(id, apply, label) {
    var node = $(id);
    if (!node) return;
    var opened = false;
    node.addEventListener("input", function (e) {
      if (!opened) { store.begin(label); opened = true; }
      apply(e.target.value);
      FP.render.render();
      renderSummary();
    });
    node.addEventListener("blur", function () {
      if (opened) { store.commit(); opened = false; }
    });
  }

  function bindNumber(id, apply, label) {
    var node = $(id);
    if (!node) return;
    node.addEventListener("change", function (e) {
      var v = parseFloat(e.target.value);
      if (isNaN(v)) return;
      store.begin(label);
      apply(Math.round(v));
      store.commit();
      FP.render.render();
      refreshPanels();
    });
  }

  /* 長度欄位的綁定：輸入經 FP.units.parseLen 解讀後以公分套用 */
  function bindLen(id, apply, label) {
    var node = $(id);
    if (!node) return;
    node.addEventListener("change", function (e) {
      var v = FP.units.parseLen(e.target.value);
      if (isNaN(v)) {
        toast('看不懂這個長度。可以輸入 300、12\'6" 或 76"', "warn");
        refreshPanels();
        return;
      }
      store.begin(label);
      apply(Math.round(v));
      store.commit();
      FP.render.render();
      refreshPanels();
    });
  }

  /* ---------- 文字摘要 ---------- */

  function buildSummary() {
    var doc = S.doc;
    var U = FP.units;
    var lines = [];
    lines.push("【" + doc.name + "】" + U.summaryUnitLine());
    lines.push("畫面上方 = " + G.bearing8(doc.upBearing));
    lines.push("座標 (x, y) 為房間左上角，x 往右增加、y 往下增加。角度為順時針旋轉。");
    lines.push("牆厚 " + U.fmtLen(doc.wallThickness) + "，房間尺寸為室內淨寬。");
    lines.push("");

    var total = 0;
    doc.rooms.forEach(function (r) {
      total += r.w * r.h;
      lines.push("■ " + r.name + "  " + U.fmtDim(r.w, r.h) +
        "  位置(" + U.fmtPoint(r.x, r.y) + ")" +
        (r.rot ? "  旋轉 " + Math.round(r.rot) + "°" : ""));
      if (!r.openings.length) {
        lines.push("    （未標窗戶或門）");
      } else {
        var order = { N: 0, E: 1, S: 2, W: 3 };
        r.openings.slice().sort(function (a, b) {
          return order[a.wall] - order[b.wall] || a.offset - b.offset;
        }).forEach(function (op) {
          var from = (op.wall === "N" || op.wall === "S") ? "左端" : "上端";
          lines.push("    ・" + (op.type === "window" ? "窗" : "門") + "：" +
            FP.schema.WALL_LABEL[op.wall] + "牆，朝" + G.wallCompass(r, op.wall, doc.upBearing) +
            "，寬" + U.fmtLen(op.length) +
            "，距" + from + U.fmtLen(op.offset) +
            (op.note ? "，" + op.note : ""));
        });
      }
    });

    var areas = doc.extras.filter(function (e) { return e.kind === "area"; });
    if (areas.length) {
      lines.push("");
      lines.push("【額外區域】");
      areas.forEach(function (e) {
        lines.push("□ " + e.text + "  " + U.fmtDim(e.w, e.h) +
          "  位置(" + U.fmtPoint(e.x, e.y) + ")" +
          (e.rot ? "  旋轉 " + Math.round(e.rot) + "°" : ""));
      });
    }

    var labels = doc.extras.filter(function (e) { return e.kind === "label"; });
    if (labels.length) {
      lines.push("");
      lines.push("【備註】");
      labels.forEach(function (e) {
        lines.push("※ " + e.text + "  位置(" + U.fmtPoint(e.x, e.y) + ")");
      });
    }

    var b = G.bounds(doc);
    lines.push("");
    if (b) {
      lines.push("整體外框（含外牆）約 " +
        U.fmtDim(b.x2 - b.x1 + doc.wallThickness, b.y2 - b.y1 + doc.wallThickness));
    }
    lines.push("室內淨面積合計約 " + U.fmtAreaTotal(total));

    return lines.join("\n");
  }

  function renderSummary() {
    var out = $("summary-text");
    if (out) out.value = buildSummary();
    var count = $("room-count");
    if (count) {
      var ops = S.doc.rooms.reduce(function (s, r) { return s + r.openings.length; }, 0);
      count.textContent = S.doc.rooms.length + " 間房 · " + ops + " 個開口";
    }
  }

  function renderStatus() {
    var node = $("save-state");
    if (!node) return;
    if (!S.storageOk) {
      node.textContent = "無法自動存檔";
      node.className = "save-state is-warn";
      return;
    }
    if (S.lastSaved) {
      var t = S.lastSaved;
      var hh = String(t.getHours()).padStart(2, "0");
      var mm = String(t.getMinutes()).padStart(2, "0");
      node.textContent = "已存於本機 " + hh + ":" + mm;
      node.className = "save-state";
    } else {
      node.textContent = "尚未存檔";
      node.className = "save-state";
    }
  }

  /* ---------- 匯入 ---------- */

  function importFromObject(raw, label) {
    var res;
    try {
      res = FP.schema.normalize(raw);
    } catch (e) {
      toast("資料格式無法解析：" + e.message, "warn");
      return false;
    }
    if (!res.doc.rooms.length) {
      toast("這份資料裡沒有任何房間", "warn");
      return false;
    }
    store.replaceDoc(res.doc, label || "匯入資料");
    FP.interact.fit();
    refreshPanels();
    if (res.warnings.length) {
      toast("已載入，但有 " + res.warnings.length + " 項提醒", "warn");
      showWarnings(res.warnings);
    } else {
      toast("已載入 " + res.doc.rooms.length + " 個房間");
    }
    return true;
  }

  function showWarnings(warnings) {
    openDialog(
      "載入時的提醒",
      '<ul class="warn-list">' +
      warnings.map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") +
      "</ul>",
      '<button class="btn btn-primary" data-close>知道了</button>'
    );
  }

  function handleImportText(text) {
    var raw;
    try {
      raw = FP.schema.parseLoose(text);
    } catch (e) {
      toast(e.message, "warn");
      return false;
    }
    return importFromObject(raw, "貼上資料");
  }

  function handleRoomList(text) {
    var res;
    try {
      res = FP.schema.fromRoomList(text);
    } catch (e) {
      toast(e.message, "warn");
      return false;
    }
    // 呎吋模式下清單裡的數字視為吋，換算成公分儲存（座標一併換算以維持排版比例）
    if (FP.units.get() === "ftin") {
      res.rooms.forEach(function (r) {
        r.w = Math.round(r.w * FP.units.IN);
        r.h = Math.round(r.h * FP.units.IN);
        r.x = Math.round(r.x * FP.units.IN);
        r.y = Math.round(r.y * FP.units.IN);
      });
    }
    var doc = FP.schema.blank();
    doc.name = "我的平面圖";
    doc.rooms = res.rooms;
    var ok = importFromObject(doc, "建立房間");
    if (ok && res.skipped.length) {
      toast("已建立 " + res.rooms.length + " 個房間，有 " + res.skipped.length + " 行看不懂已略過", "warn");
    }
    return ok;
  }

  function readFile(file, onText) {
    var reader = new FileReader();
    reader.onload = function () { onText(String(reader.result)); };
    reader.onerror = function () { toast("檔案讀取失敗", "warn"); };
    reader.readAsText(file);
  }

  /* 底圖：縮小後轉 JPEG，避免撐爆 localStorage */
  function loadUnderlayImage(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var MAX = 1500;
        var scale = Math.min(1, MAX / Math.max(img.width, img.height));
        var cw = Math.round(img.width * scale);
        var ch = Math.round(img.height * scale);
        var canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        var dataUrl = canvas.toDataURL("image/jpeg", 0.72);

        var b = G.bounds(S.doc);
        var targetW = b ? Math.max(600, b.x2 - b.x1) : 1200;
        store.begin("加入底圖");
        S.doc.underlay = {
          src: dataUrl,
          x: b ? b.x1 : 0,
          y: b ? b.y1 : 0,
          w: targetW,
          h: targetW * (ch / cw),
          rot: 0,
          opacity: 0.45
        };
        S.sel = { kind: "underlay" };
        store.commit();
        FP.render.render();
        refreshPanels();
        toast("底圖已加入。拖角落調整大小，對齊後就能描圖");
      };
      img.onerror = function () { toast("這張圖片無法讀取", "warn"); };
      img.src = String(reader.result);
    };
    reader.onerror = function () { toast("檔案讀取失敗", "warn"); };
    reader.readAsDataURL(file);
  }

  /* ---------- AI 提示詞 ---------- */

  function buildAIPrompt(userNotes) {
    var example = {
      version: 1,
      name: "我家",
      unit: "cm",
      upBearing: 0,
      wallThickness: 12,
      rooms: [
        {
          name: "客廳", w: 360, h: 480, x: 0, y: 0, rot: 0,
          openings: [
            { type: "window", wall: "S", offset: 120, length: 210, note: "大窗" },
            { type: "door", wall: "W", offset: 40, length: 90, note: "開口（無門）" }
          ]
        },
        {
          name: "主臥室", w: 350, h: 400, x: 372, y: 0, rot: 0,
          openings: [
            { type: "window", wall: "N", offset: 100, length: 145, note: "橫拉窗" },
            { type: "door", wall: "W", offset: 300, length: 80, note: "門" }
          ]
        }
      ],
      extras: [
        { kind: "area", text: "天井", x: -130, y: 200, w: 110, h: 300, rot: 0 },
        { kind: "label", text: "電表在這面牆", x: 60, y: -60 }
      ]
    };

    return [
      "請把我描述的住家格局，轉成下面這個 JSON 格式。",
      "",
      "【輸出規則】",
      "1. 只輸出 JSON 本身，不要任何說明文字，也不要 markdown 的程式碼圍籬。",
      "2. 所有長度單位一律是公分，整數。",
      "3. 座標系：x 往右增加，y 往下增加。每個房間的 x, y 是它左上角的位置。",
      "4. 請主動幫我把房間排成不重疊、且符合我描述的相對位置。相鄰房間之間留 wallThickness 的間隔代表共用一道牆；完全貼齊代表沒有隔牆。",
      "5. rot 是順時針旋轉角度，通常填 0，需要轉向時填 90、180、270。",
      "6. upBearing 是「畫面上方對應的方位角」：北填 0、東北 45、東 90、東南 135、南 180、西南 225、西 270、西北 315。如果我說了大門或某面牆朝哪個方位，請據此推算。",
      "",
      "【開口的寫法】",
      "wall 只能是 N（上）、E（右）、S（下）、W（左），指的是房間自己的四面牆。",
      "offset 是開口起點距離該面牆起點的距離：上下牆從左端算，左右牆從上端算。",
      "type 只能是 window 或 door。沒有門扇的通道也用 door，並把 note 寫成「開口（無門）」。",
      "note 建議從這些詞裡挑：" + WINDOW_KINDS.join("、") + "、" + DOOR_KINDS.join("、") + "。",
      "",
      "【extras 的用途】",
      "kind 為 area 時是一塊額外空間（天井、走道、陽台、樓梯），需要 x, y, w, h。",
      "kind 為 label 時是一段文字備註，只需要 x, y。",
      "",
      "【完整範例】",
      JSON.stringify(example, null, 2),
      "",
      "【我家的情況】",
      userNotes && userNotes.trim()
        ? userNotes.trim()
        : "（在這行下面描述你家：有哪些空間、各自的長寬、彼此相鄰的關係、窗戶和門在哪面牆、大門朝哪個方位）"
    ].join("\n");
  }

  FP.ui = {
    setTool: setTool,
    hint: hint,
    toast: toast,
    copyText: copyText,
    refreshPanels: refreshPanels,
    renderSummary: renderSummary,
    renderStatus: renderStatus,
    buildSummary: buildSummary,
    buildAIPrompt: buildAIPrompt,
    openDialog: openDialog,
    closeDialog: closeDialog,
    promptText: promptText,
    confirmAction: confirmAction,
    importFromObject: importFromObject,
    handleImportText: handleImportText,
    handleRoomList: handleRoomList,
    loadUnderlayImage: loadUnderlayImage,
    readFile: readFile,
    esc: esc,
    WINDOW_KINDS: WINDOW_KINDS,
    DOOR_KINDS: DOOR_KINDS
  };
})(window.FP);
