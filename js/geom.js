/* 幾何運算：本地座標、外框、貼齊、方位 */
window.FP = window.FP || {};

(function (FP) {
  "use strict";

  var norm360 = FP.schema.norm360;

  var DIR8 = ["北", "東北", "東", "東南", "南", "西南", "西", "西北"];
  var DIR16 = [
    "北", "北北東", "東北", "東北東", "東", "東南東", "東南", "南南東",
    "南", "南南西", "西南", "西南西", "西", "西北西", "西北", "北北西"
  ];
  var WALL_ANGLE = { N: 0, E: 90, S: 180, W: 270 };

  function bearing8(b) { return DIR8[Math.round(norm360(b) / 45) % 8]; }
  function bearing16(b) { return DIR16[Math.round(norm360(b) / 22.5) % 16]; }

  /* 某面牆的外法線指向哪個方位 */
  function wallBearing(room, wall, upBearing) {
    return norm360(WALL_ANGLE[wall] + (room.rot || 0) + upBearing);
  }
  function wallCompass(room, wall, upBearing) {
    return bearing16(wallBearing(room, wall, upBearing));
  }

  /* 世界座標 -> 物件本地座標（反轉物件自身旋轉） */
  function toLocal(obj, p) {
    var cx = obj.w / 2, cy = obj.h / 2;
    var dx = p.x - obj.x - cx, dy = p.y - obj.y - cy;
    var a = -(obj.rot || 0) * Math.PI / 180;
    var ca = Math.cos(a), sa = Math.sin(a);
    return { x: dx * ca - dy * sa + cx, y: dx * sa + dy * ca + cy };
  }

  function center(obj) {
    return { x: obj.x + obj.w / 2, y: obj.y + obj.h / 2 };
  }

  /* 旋轉後在世界座標的軸對齊外框 */
  function footprint(obj) {
    var r = norm360(obj.rot || 0);
    if (r === 90 || r === 270) {
      return {
        x: obj.x + (obj.w - obj.h) / 2,
        y: obj.y + (obj.h - obj.w) / 2,
        w: obj.h, h: obj.w
      };
    }
    if (r === 0 || r === 180) {
      return { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
    }
    // 任意角度：取四個角的包絡
    var c = center(obj), a = r * Math.PI / 180;
    var ca = Math.cos(a), sa = Math.sin(a);
    var hw = obj.w / 2, hh = obj.h / 2;
    var xs = [], ys = [];
    [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].forEach(function (q) {
      xs.push(c.x + q[0] * ca - q[1] * sa);
      ys.push(c.y + q[0] * sa + q[1] * ca);
    });
    var x1 = Math.min.apply(null, xs), x2 = Math.max.apply(null, xs);
    var y1 = Math.min.apply(null, ys), y2 = Math.max.apply(null, ys);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  /* 開口在房間本地座標的線段 */
  function openingLocal(room, op) {
    var w = room.w, h = room.h, o = op.offset, L = op.length;
    if (op.wall === "N") return { x1: o, y1: 0, x2: o + L, y2: 0, axis: "x", wallLen: w, nx: 0, ny: -1 };
    if (op.wall === "S") return { x1: o, y1: h, x2: o + L, y2: h, axis: "x", wallLen: w, nx: 0, ny: 1 };
    if (op.wall === "W") return { x1: 0, y1: o, x2: 0, y2: o + L, axis: "y", wallLen: h, nx: -1, ny: 0 };
    return { x1: w, y1: o, x2: w, y2: o + L, axis: "y", wallLen: h, nx: 1, ny: 0 };
  }

  /* 門扇開啟弧線（本地座標） */
  function doorSwing(room, op) {
    var L = op.length, o = op.offset, w = room.w, h = room.h;
    if (op.wall === "N") return { hx: o, hy: 0, ox: o, oy: L, arc: "M " + o + " " + L + " A " + L + " " + L + " 0 0 0 " + (o + L) + " 0" };
    if (op.wall === "S") return { hx: o, hy: h, ox: o, oy: h - L, arc: "M " + o + " " + (h - L) + " A " + L + " " + L + " 0 0 1 " + (o + L) + " " + h };
    if (op.wall === "W") return { hx: 0, hy: o, ox: L, oy: o, arc: "M " + L + " " + o + " A " + L + " " + L + " 0 0 1 0 " + (o + L) };
    return { hx: w, hy: o, ox: w - L, oy: o, arc: "M " + (w - L) + " " + o + " A " + L + " " + L + " 0 0 0 " + w + " " + (o + L) };
  }

  /* 找出點擊落在哪個房間的哪面牆 */
  function hitWall(rooms, p, tolerance) {
    var tol = tolerance || 48;
    for (var i = rooms.length - 1; i >= 0; i--) {
      var r = rooms[i];
      var L = toLocal(r, p);
      if (L.x < -tol || L.x > r.w + tol || L.y < -tol || L.y > r.h + tol) continue;
      var okX = L.x >= -tol / 2 && L.x <= r.w + tol / 2;
      var okY = L.y >= -tol / 2 && L.y <= r.h + tol / 2;
      var cands = [
        { wall: "N", d: Math.abs(L.y), along: L.x, wallLen: r.w, ok: okX },
        { wall: "S", d: Math.abs(L.y - r.h), along: L.x, wallLen: r.w, ok: okX },
        { wall: "W", d: Math.abs(L.x), along: L.y, wallLen: r.h, ok: okY },
        { wall: "E", d: Math.abs(L.x - r.w), along: L.y, wallLen: r.h, ok: okY }
      ];
      var best = null;
      cands.forEach(function (c) {
        if (c.ok && (!best || c.d < best.d)) best = c;
      });
      if (best && best.d < tol) return { room: r, hit: best };
    }
    return null;
  }

  /*
   * 移動時的貼齊。提供三種吸附位置：
   *  - 完全貼合（共牆中心線重疊）
   *  - 留一道牆厚（各自獨立的牆）
   *  - 邊緣對齊（同一條起始線）
   */
  function snapMove(doc, room, nx, ny, enabled) {
    var GRID = 5;
    nx = Math.round(nx / GRID) * GRID;
    ny = Math.round(ny / GRID) * GRID;
    if (!enabled) return [nx, ny];
    if (norm360(room.rot || 0) % 90 !== 0) return [nx, ny];

    var self = footprint(room);
    var offX = self.x - room.x, offY = self.y - room.y;
    var fw = self.w, fh = self.h;
    var fx = nx + offX, fy = ny + offY;

    var W = doc.wallThickness;
    var TOL = 14;
    var bx = fx, by = fy, bdx = TOL + 1, bdy = TOL + 1;

    doc.rooms.forEach(function (o) {
      if (o.id === room.id) return;
      if (norm360(o.rot || 0) % 90 !== 0) return;
      var f = footprint(o);
      var candX = [
        f.x, f.x + f.w - fw,           // 邊緣對齊
        f.x + f.w, f.x - fw,           // 完全貼合
        f.x + f.w + W, f.x - W - fw    // 留一道牆
      ];
      var candY = [
        f.y, f.y + f.h - fh,
        f.y + f.h, f.y - fh,
        f.y + f.h + W, f.y - W - fh
      ];
      candX.forEach(function (c) {
        var d = Math.abs(c - fx);
        if (d < bdx) { bdx = d; bx = c; }
      });
      candY.forEach(function (c) {
        var d = Math.abs(c - fy);
        if (d < bdy) { bdy = d; by = c; }
      });
    });

    return [
      (bdx <= TOL ? bx : fx) - offX,
      (bdy <= TOL ? by : fy) - offY
    ];
  }

  /* 旋轉把手角度：以中心為圓心，畫面上方為 0 度 */
  function angleTo(c, p) {
    return norm360(Math.atan2(p.x - c.x, -(p.y - c.y)) * 180 / Math.PI);
  }

  function snapAngle(a, step, tol) {
    step = step || 15;
    tol = tol || 4;
    var n = Math.round(a / step) * step;
    var diff = Math.abs(norm360(a - n + 180) - 180);
    return diff <= tol ? norm360(n) : norm360(Math.round(a));
  }

  /* 全部內容的包圍框 */
  function bounds(doc) {
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity, any = false;
    function eat(f, padW, padH) {
      any = true;
      x1 = Math.min(x1, f.x); y1 = Math.min(y1, f.y);
      x2 = Math.max(x2, f.x + (f.w || padW || 0));
      y2 = Math.max(y2, f.y + (f.h || padH || 0));
    }
    doc.rooms.forEach(function (r) { eat(footprint(r)); });
    doc.extras.forEach(function (e) {
      if (e.kind === "area") eat(footprint(e));
      else eat({ x: e.x, y: e.y, w: 120, h: 40 });
    });
    if (doc.underlay) eat(footprint(doc.underlay));
    if (!any) return null;
    return { x1: x1, y1: y1, x2: x2, y2: y2 };
  }

  FP.geom = {
    DIR8: DIR8,
    bearing8: bearing8,
    bearing16: bearing16,
    wallBearing: wallBearing,
    wallCompass: wallCompass,
    toLocal: toLocal,
    center: center,
    footprint: footprint,
    openingLocal: openingLocal,
    doorSwing: doorSwing,
    hitWall: hitWall,
    snapMove: snapMove,
    angleTo: angleTo,
    snapAngle: snapAngle,
    bounds: bounds
  };
})(window.FP);
