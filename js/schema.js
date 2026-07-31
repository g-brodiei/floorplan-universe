/* 平面圖資料格式：定義、驗證、正規化 */
window.FP = window.FP || {};

(function (FP) {
  "use strict";

  var SCHEMA_VERSION = 1;

  var WALLS = ["N", "E", "S", "W"];
  var WALL_LABEL = { N: "上", E: "右", S: "下", W: "左" };

  var PALETTE = [
    "#F2DFC6", "#D3E2EE", "#D8E8D2", "#E6DDEE",
    "#F4E3E7", "#D2E9E6", "#EDE7D3", "#E2E2DA"
  ];

  var uidCounter = 0;
  function nid(prefix) {
    uidCounter += 1;
    return (prefix || "id") + "_" + Date.now().toString(36) + "_" + uidCounter;
  }

  function clampNum(v, lo, hi, fallback) {
    var n = typeof v === "number" ? v : parseFloat(v);
    if (isNaN(n)) return fallback;
    return Math.min(hi, Math.max(lo, n));
  }

  function norm360(a) {
    return ((a % 360) + 360) % 360;
  }

  /* 建立空白文件 */
  function blank() {
    return {
      version: SCHEMA_VERSION,
      name: "未命名平面圖",
      unit: "cm",
      upBearing: 0,
      wallThickness: 12,
      rooms: [],
      extras: [],
      underlay: null
    };
  }

  /* 把任意輸入整理成合法文件。回傳 {doc, warnings} */
  function normalize(input) {
    var warnings = [];
    var raw = input || {};
    var doc = blank();

    if (typeof raw.name === "string" && raw.name.trim()) {
      doc.name = raw.name.trim().slice(0, 60);
    }
    if (raw.unit && raw.unit !== "cm") {
      warnings.push("資料檔一律以公分儲存，已忽略 unit 欄位。顯示單位可用工具列的 cm / ft-in 切換。");
    }
    doc.upBearing = norm360(clampNum(raw.upBearing, 0, 360, 0));
    doc.wallThickness = clampNum(raw.wallThickness, 0, 60, 12);

    var rooms = Array.isArray(raw.rooms) ? raw.rooms : [];
    if (!rooms.length) warnings.push("資料裡沒有任何房間。");

    rooms.forEach(function (r, i) {
      if (!r || typeof r !== "object") {
        warnings.push("第 " + (i + 1) + " 筆房間格式不正確，已略過。");
        return;
      }
      var w = clampNum(r.w, 20, 5000, NaN);
      var h = clampNum(r.h, 20, 5000, NaN);
      if (isNaN(w) || isNaN(h)) {
        warnings.push("「" + (r.name || "第 " + (i + 1) + " 筆") + "」缺少有效的寬高，已略過。");
        return;
      }
      var room = {
        id: nid("room"),
        name: String(r.name || "房間 " + (i + 1)).slice(0, 24),
        w: Math.round(w),
        h: Math.round(h),
        x: Math.round(clampNum(r.x, -100000, 100000, 0)),
        y: Math.round(clampNum(r.y, -100000, 100000, 0)),
        rot: norm360(clampNum(r.rot, -3600, 3600, 0)),
        fill: /^#[0-9a-fA-F]{6}$/.test(r.fill) ? r.fill : PALETTE[i % PALETTE.length],
        openings: []
      };

      var ops = Array.isArray(r.openings) ? r.openings : [];
      ops.forEach(function (o) {
        if (!o || typeof o !== "object") return;
        var wall = String(o.wall || "").toUpperCase();
        if (WALLS.indexOf(wall) < 0) {
          warnings.push("「" + room.name + "」有一筆開口的 wall 值無效（" + o.wall + "），已略過。");
          return;
        }
        var wallLen = (wall === "N" || wall === "S") ? room.w : room.h;
        var len = clampNum(o.length, 10, wallLen, NaN);
        if (isNaN(len)) {
          warnings.push("「" + room.name + "」有一筆開口缺少 length，已略過。");
          return;
        }
        var off = clampNum(o.offset, 0, wallLen - len, 0);
        var type = (o.type === "door") ? "door" : "window";
        room.openings.push({
          id: nid("op"),
          type: type,
          wall: wall,
          offset: Math.round(off),
          length: Math.round(len),
          note: String(o.note || "").slice(0, 24)
        });
      });

      doc.rooms.push(room);
    });

    var extras = Array.isArray(raw.extras) ? raw.extras : [];
    extras.forEach(function (e) {
      if (!e || typeof e !== "object") return;
      var kind = e.kind === "label" ? "label" : "area";
      var item = {
        id: nid("extra"),
        kind: kind,
        text: String(e.text || (kind === "label" ? "備註" : "區域")).slice(0, 40),
        x: Math.round(clampNum(e.x, -100000, 100000, 0)),
        y: Math.round(clampNum(e.y, -100000, 100000, 0)),
        w: kind === "area" ? Math.round(clampNum(e.w, 10, 5000, 100)) : 0,
        h: kind === "area" ? Math.round(clampNum(e.h, 10, 5000, 100)) : 0,
        rot: norm360(clampNum(e.rot, -3600, 3600, 0))
      };
      doc.extras.push(item);
    });

    if (raw.underlay && typeof raw.underlay.src === "string" &&
        raw.underlay.src.indexOf("data:image/") === 0) {
      doc.underlay = {
        src: raw.underlay.src,
        x: clampNum(raw.underlay.x, -100000, 100000, 0),
        y: clampNum(raw.underlay.y, -100000, 100000, 0),
        w: clampNum(raw.underlay.w, 10, 100000, 1000),
        h: clampNum(raw.underlay.h, 10, 100000, 1000),
        rot: norm360(clampNum(raw.underlay.rot, -3600, 3600, 0)),
        opacity: clampNum(raw.underlay.opacity, 0.05, 1, 0.45)
      };
    }

    return { doc: doc, warnings: warnings };
  }

  /* 匯出時剝掉內部 id，產生乾淨的可攜資料 */
  function serialize(doc, opts) {
    opts = opts || {};
    var out = {
      version: SCHEMA_VERSION,
      name: doc.name,
      unit: "cm",
      upBearing: Math.round(doc.upBearing),
      wallThickness: doc.wallThickness,
      rooms: doc.rooms.map(function (r) {
        return {
          name: r.name,
          w: r.w, h: r.h, x: r.x, y: r.y,
          rot: Math.round(r.rot),
          fill: r.fill,
          openings: r.openings.map(function (o) {
            return {
              type: o.type, wall: o.wall,
              offset: o.offset, length: o.length,
              note: o.note || undefined
            };
          })
        };
      }),
      extras: doc.extras.map(function (e) {
        var base = { kind: e.kind, text: e.text, x: e.x, y: e.y };
        if (e.kind === "area") { base.w = e.w; base.h = e.h; base.rot = Math.round(e.rot); }
        return base;
      })
    };
    if (doc.underlay && opts.includeUnderlay) out.underlay = doc.underlay;
    return out;
  }

  /* 從貼上的文字取出 JSON。容忍 markdown 圍籬與前後說明文字 */
  function parseLoose(text) {
    if (typeof text !== "string") throw new Error("沒有可讀取的內容。");
    var s = text.trim();
    if (!s) throw new Error("沒有可讀取的內容。");

    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

    try {
      return JSON.parse(s);
    } catch (e) { /* 往下嘗試擷取 */ }

    var start = s.indexOf("{");
    var end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      var slice = s.slice(start, end + 1);
      try {
        return JSON.parse(slice);
      } catch (e2) {
        throw new Error("找到疑似 JSON 的片段，但格式有誤：" + e2.message);
      }
    }
    throw new Error("這段文字裡找不到 JSON 物件。");
  }

  /* 從「名稱 寬x高」的清單快速建立房間，自動排成網格 */
  function fromRoomList(text) {
    var lines = String(text || "").split(/\r?\n/);
    var rooms = [];
    var bad = [];

    lines.forEach(function (line) {
      var t = line.trim();
      if (!t) return;
      // 支援：客廳 358x487 / 客廳,358,487 / 客廳 358 487 / 客廳 358×487
      var m = t.match(/^(.+?)[\s,、:：]+(\d+(?:\.\d+)?)\s*[x×*,\s]\s*(\d+(?:\.\d+)?)\s*$/i);
      if (!m) { bad.push(t); return; }
      rooms.push({
        name: m[1].trim(),
        w: parseFloat(m[2]),
        h: parseFloat(m[3])
      });
    });

    if (!rooms.length) {
      throw new Error("每一行請寫成「房間名稱 寬x高」，例如：客廳 358x487");
    }

    layoutGrid(rooms);
    return { rooms: rooms, skipped: bad };
  }

  /* 把房間排成不重疊的列，避免初始狀態全部疊在一起 */
  function layoutGrid(rooms) {
    var GAP = 60;
    var maxRowWidth = Math.max(
      600,
      Math.ceil(Math.sqrt(rooms.reduce(function (s, r) { return s + r.w * r.h; }, 0)) * 1.3)
    );
    var cx = 0, cy = 0, rowH = 0;
    rooms.forEach(function (r) {
      if (cx > 0 && cx + r.w > maxRowWidth) {
        cx = 0; cy += rowH + GAP; rowH = 0;
      }
      r.x = cx;
      r.y = cy;
      cx += r.w + GAP;
      rowH = Math.max(rowH, r.h);
    });
  }

  FP.schema = {
    VERSION: SCHEMA_VERSION,
    WALLS: WALLS,
    WALL_LABEL: WALL_LABEL,
    PALETTE: PALETTE,
    nid: nid,
    norm360: norm360,
    blank: blank,
    normalize: normalize,
    serialize: serialize,
    parseLoose: parseLoose,
    fromRoomList: fromRoomList,
    layoutGrid: layoutGrid
  };
})(window.FP);
