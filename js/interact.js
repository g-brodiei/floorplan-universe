/* 畫布互動：選取、拖曳、旋轉、縮放、平移 */
window.FP = window.FP || {};

(function (FP) {
  "use strict";

  var G = FP.geom;
  var store = FP.store;
  var S = store.S;

  var svg = null;
  var drag = null;
  var pointers = {};
  var pinch = null;
  var onHint = function () {};
  var onCursor = function () {};

  function toWorld(evt) {
    var m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    var pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    var q = pt.matrixTransform(m.inverse());
    return { x: q.x, y: q.y };
  }

  function closest(target, selector) {
    if (!target || !target.closest) return null;
    return target.closest(selector);
  }

  function draw() { FP.render.render(); }

  /* ---------- 建立新元素 ---------- */

  function addOpening(type, p) {
    var found = G.hitWall(S.doc.rooms, p);
    if (!found) {
      onHint("請點在房間的牆線上。靠近牆邊一點就抓得到。");
      return false;
    }
    var wallLen = found.hit.wallLen;
    var want = type === "window" ? 90 : 85;
    var len = Math.min(want, wallLen);
    var off = Math.max(0, Math.min(found.hit.along - len / 2, wallLen - len));

    store.begin(type === "window" ? "加窗戶" : "加門");
    var op = {
      id: FP.schema.nid("op"),
      type: type,
      wall: found.hit.wall,
      offset: Math.round(off / 5) * 5,
      length: Math.round(len),
      note: ""
    };
    found.room.openings.push(op);
    S.sel = { kind: "opening", roomId: found.room.id, id: op.id };
    store.commit("add-opening");
    return true;
  }

  function addLabel(p, text) {
    store.begin("加文字");
    var item = {
      id: FP.schema.nid("extra"),
      kind: "label",
      text: text,
      x: Math.round(p.x), y: Math.round(p.y),
      w: 0, h: 0, rot: 0
    };
    S.doc.extras.push(item);
    S.sel = { kind: "extra", id: item.id };
    store.commit("add-label");
  }

  /* ---------- 指標事件 ---------- */

  function onPointerDown(e) {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pointers);

    if (ids.length === 2) {
      // 雙指：捏合縮放
      drag = null;
      var a = pointers[ids[0]], b = pointers[ids[1]];
      pinch = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        view: { x: S.view.x, y: S.view.y, w: S.view.w, h: S.view.h },
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      };
      return;
    }
    if (ids.length > 2) return;

    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    var p = toWorld(e);

    if (S.tool === "window" || S.tool === "door") {
      if (addOpening(S.tool === "window" ? "window" : "door", p)) {
        FP.ui.setTool("select");
      }
      return;
    }

    if (S.tool === "label") {
      FP.ui.promptText("要標註什麼？", "", function (text) {
        if (text) addLabel(p, text);
        FP.ui.setTool("select");
      });
      return;
    }

    if (S.tool === "area") {
      store.begin("畫區域");
      var area = {
        id: FP.schema.nid("extra"),
        kind: "area",
        text: "區域",
        x: Math.round(p.x / 5) * 5,
        y: Math.round(p.y / 5) * 5,
        w: 0, h: 0, rot: 0
      };
      S.doc.extras.push(area);
      S.sel = { kind: "extra", id: area.id };
      drag = { mode: "draw-area", id: area.id, ox: area.x, oy: area.y };
      draw();
      return;
    }

    var t = e.target;

    // 旋轉把手
    var rot = closest(t, "[data-rotate]");
    if (rot) {
      var rid = rot.getAttribute("data-rotate");
      var obj = store.findRoom(rid) || store.findExtra(rid);
      if (obj) {
        var c = G.center(obj);
        drag = { mode: "rotate", label: "旋轉", obj: obj, c: c, grab: G.angleTo(c, p), start: obj.rot || 0 };
        onHint("拖著轉。靠近 15 度的倍數會自動吸附。");
        return;
      }
    }

    // 開口
    var opNode = closest(t, "[data-opening]");
    if (opNode) {
      var roomId = opNode.getAttribute("data-opening-room");
      var opId = opNode.getAttribute("data-opening");
      var room = store.findRoom(roomId);
      var op = store.findOpening(roomId, opId);
      if (room && op) {
        var L = G.openingLocal(room, op);
        var lp = G.toLocal(room, p);
        S.sel = { kind: "opening", roomId: roomId, id: opId };
        var grip = t.getAttribute && t.getAttribute("data-grip");
        drag = {
          mode: grip ? ("opening-" + grip) : "opening-move",
          label: "調整開口",
          room: room, op: op,
          startOffset: op.offset, startLength: op.length,
          startPos: L.axis === "x" ? lp.x : lp.y,
          axis: L.axis, wallLen: L.wallLen
        };
        FP.ui.refreshPanels();
        draw();
        return;
      }
    }

    // 底圖縮放把手
    if (closest(t, "[data-underlay-handle]")) {
      S.sel = { kind: "underlay" };
      drag = { mode: "resize-underlay", label: "調整底圖", ox: S.doc.underlay.x, oy: S.doc.underlay.y };
      draw();
      return;
    }

    // 區域縮放把手
    var exHandle = closest(t, "[data-extra-handle]");
    if (exHandle) {
      var ehId = exHandle.getAttribute("data-extra-handle");
      var ea = store.findExtra(ehId);
      if (ea) {
        S.sel = { kind: "extra", id: ehId };
        drag = { mode: "resize-area", label: "調整區域", id: ehId, ox: ea.x, oy: ea.y };
        draw();
        return;
      }
    }

    // 區域或文字本體
    var exNode = closest(t, "[data-extra]");
    if (exNode) {
      var exId = exNode.getAttribute("data-extra");
      var ex = store.findExtra(exId);
      if (ex) {
        S.sel = { kind: "extra", id: exId };
        drag = { mode: "move-extra", label: "移動", id: exId, dx: p.x - ex.x, dy: p.y - ex.y };
        FP.ui.refreshPanels();
        draw();
        return;
      }
    }

    // 房間
    var roomNode = closest(t, "[data-room]");
    if (roomNode) {
      var rId = roomNode.getAttribute("data-room");
      var rm = store.findRoom(rId);
      if (rm) {
        S.sel = { kind: "room", roomId: rId };
        drag = { mode: "move-room", label: "移動房間", room: rm, dx: p.x - rm.x, dy: p.y - rm.y };
        // 提到最上層，方便連續操作
        S.doc.rooms = S.doc.rooms.filter(function (x) { return x.id !== rId; });
        S.doc.rooms.push(rm);
        FP.ui.refreshPanels();
        draw();
        return;
      }
    }

    // 底圖本體
    if (closest(t, "[data-underlay]")) {
      S.sel = { kind: "underlay" };
      drag = { mode: "move-underlay", label: "移動底圖", dx: p.x - S.doc.underlay.x, dy: p.y - S.doc.underlay.y };
      draw();
      return;
    }

    // 空白處：平移畫面
    S.sel = null;
    drag = { mode: "pan", sx: e.clientX, sy: e.clientY, vx: S.view.x, vy: S.view.y };
    FP.ui.refreshPanels();
    draw();
  }

  function onPointerMove(e) {
    if (pointers[e.pointerId]) {
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    }

    if (pinch) {
      var ids = Object.keys(pointers);
      if (ids.length < 2) return;
      var a = pointers[ids[0]], b = pointers[ids[1]];
      var dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > 0 && pinch.dist > 0) {
        var k = pinch.dist / dist;
        var rect = svg.getBoundingClientRect();
        var fx = (pinch.mid.x - rect.left) / rect.width;
        var fy = (pinch.mid.y - rect.top) / rect.height;
        var anchorX = pinch.view.x + pinch.view.w * fx;
        var anchorY = pinch.view.y + pinch.view.h * fy;
        var nw = Math.min(60000, Math.max(120, pinch.view.w * k));
        var nh = nw * (pinch.view.h / pinch.view.w);
        S.view.w = nw;
        S.view.h = nh;
        S.view.x = anchorX - nw * fx;
        S.view.y = anchorY - nh * fy;
        draw();
      }
      return;
    }

    var p = toWorld(e);
    onCursor(p);
    if (!drag) return;

    // 真正動到東西的第一刻才記錄復原點，單純點選不會塞滿復原紀錄
    if (drag.label) store.beginDrag(drag.label);

    if (drag.mode === "pan") {
      var r = svg.getBoundingClientRect();
      var scale = S.view.w / r.width;
      S.view.x = drag.vx - (e.clientX - drag.sx) * scale;
      S.view.y = drag.vy - (e.clientY - drag.sy) * scale;
      draw();
      return;
    }

    if (drag.mode === "rotate") {
      var cur = G.angleTo(drag.c, p);
      drag.obj.rot = G.snapAngle(drag.start + (cur - drag.grab));
      draw();
      FP.ui.refreshPanels();
      return;
    }

    if (drag.mode === "move-room") {
      var np = G.snapMove(S.doc, drag.room, p.x - drag.dx, p.y - drag.dy, S.snap);
      drag.room.x = np[0];
      drag.room.y = np[1];
      draw();
      return;
    }

    if (drag.mode === "move-extra") {
      var ex = store.findExtra(drag.id);
      if (!ex) return;
      ex.x = Math.round((p.x - drag.dx) / 5) * 5;
      ex.y = Math.round((p.y - drag.dy) / 5) * 5;
      draw();
      return;
    }

    if (drag.mode === "draw-area" || drag.mode === "resize-area") {
      var ea = store.findExtra(drag.id);
      if (!ea) return;
      ea.w = Math.max(10, Math.round((p.x - drag.ox) / 5) * 5);
      ea.h = Math.max(10, Math.round((p.y - drag.oy) / 5) * 5);
      draw();
      return;
    }

    if (drag.mode === "move-underlay") {
      S.doc.underlay.x = Math.round(p.x - drag.dx);
      S.doc.underlay.y = Math.round(p.y - drag.dy);
      draw();
      return;
    }

    if (drag.mode === "resize-underlay") {
      var u = S.doc.underlay;
      var nwv = Math.max(20, Math.round(p.x - drag.ox));
      // 維持長寬比
      var ratio = u.h / u.w;
      u.w = nwv;
      u.h = Math.max(20, Math.round(nwv * ratio));
      draw();
      return;
    }

    if (drag.mode.indexOf("opening") === 0) {
      var lp = G.toLocal(drag.room, p);
      var cur2 = drag.axis === "x" ? lp.x : lp.y;
      var d = Math.round((cur2 - drag.startPos) / 5) * 5;
      var op = drag.op;
      if (drag.mode === "opening-move") {
        op.offset = Math.max(0, Math.min(drag.startOffset + d, drag.wallLen - op.length));
      } else if (drag.mode === "opening-a") {
        var far = drag.startOffset + drag.startLength;
        var na = Math.max(0, Math.min(drag.startOffset + d, far - 10));
        op.offset = na;
        op.length = far - na;
      } else {
        op.length = Math.max(10, Math.min(drag.startLength + d, drag.wallLen - op.offset));
      }
      draw();
      FP.ui.refreshPanels();
      return;
    }
  }

  function onPointerUp(e) {
    delete pointers[e.pointerId];
    if (Object.keys(pointers).length < 2) pinch = null;
    if (!drag) return;

    if (drag.mode === "draw-area") {
      var ea = store.findExtra(drag.id);
      if (ea && (ea.w < 25 || ea.h < 25)) {
        S.doc.extras = S.doc.extras.filter(function (x) { return x.id !== drag.id; });
        S.sel = null;
        drag = null;
        store.commit("cancel-area");
        FP.ui.setTool("select");
        FP.ui.refreshPanels();
        draw();
        return;
      }
      drag = null;
      FP.ui.promptText("這塊區域叫什麼？", "區域", function (text) {
        var a = store.findExtra(ea.id);
        if (a && text) a.text = text;
        store.endDrag("area-done");
        FP.ui.setTool("select");
        FP.ui.refreshPanels();
        draw();
      });
      return;
    }

    drag = null;
    store.endDrag("drag-end");
    FP.ui.refreshPanels();
  }

  /* ---------- 縮放 ---------- */

  function zoomBy(k, focus) {
    var v = S.view;
    var nw = Math.min(60000, Math.max(120, v.w * k));
    var nh = nw * (v.h / v.w);
    var fx = focus ? focus.fx : 0.5;
    var fy = focus ? focus.fy : 0.5;
    var ax = v.x + v.w * fx;
    var ay = v.y + v.h * fy;
    v.w = nw;
    v.h = nh;
    v.x = ax - nw * fx;
    v.y = ay - nh * fy;
    draw();
    store.scheduleSave();
  }

  function fit() {
    var b = G.bounds(S.doc);
    var rect = svg.getBoundingClientRect();
    var aspect = rect.height > 0 ? rect.width / rect.height : 0.8;
    if (!b) {
      S.view = { x: -200, y: -200, w: 1600, h: 1600 / aspect };
      draw();
      return;
    }
    var bw = b.x2 - b.x1, bh = b.y2 - b.y1;
    var pad = Math.max(140, Math.max(bw, bh) * 0.1);
    var w = bw + pad * 2, h = bh + pad * 2;
    if (w / h > aspect) h = w / aspect; else w = h * aspect;
    S.view = {
      x: (b.x1 + b.x2) / 2 - w / 2,
      y: (b.y1 + b.y2) / 2 - h / 2,
      w: w, h: h
    };
    draw();
    store.scheduleSave();
  }

  function onWheel(e) {
    e.preventDefault();
    var rect = svg.getBoundingClientRect();
    zoomBy(e.deltaY > 0 ? 1.12 : 0.89, {
      fx: (e.clientX - rect.left) / rect.width,
      fy: (e.clientY - rect.top) / rect.height
    });
  }

  /* ---------- 初始化 ---------- */

  function init(svgNode, hooks) {
    svg = svgNode;
    hooks = hooks || {};
    if (hooks.onHint) onHint = hooks.onHint;
    if (hooks.onCursor) onCursor = hooks.onCursor;

    svg.addEventListener("pointerdown", onPointerDown);
    svg.addEventListener("pointermove", onPointerMove);
    svg.addEventListener("pointerup", onPointerUp);
    svg.addEventListener("pointercancel", onPointerUp);
    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }

  FP.interact = {
    init: init,
    zoomBy: zoomBy,
    fit: fit,
    toWorld: toWorld
  };
})(window.FP);
