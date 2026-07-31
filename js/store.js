/* 狀態、自動存檔、復原重做 */
window.FP = window.FP || {};

(function (FP) {
  "use strict";

  var KEY_DOC = "fp.doc.v1";
  var KEY_VIEW = "fp.view.v1";
  var KEY_SEEN = "fp.tourSeen.v1";
  var KEY_PREFS = "fp.prefs.v1";

  var listeners = [];
  var undoStack = [];
  var redoStack = [];
  var LIMIT = 60;
  var saveTimer = null;
  var pendingLabel = null;

  var S = {
    doc: FP.schema.blank(),
    view: { x: 0, y: 0, w: 1400, h: 1750 },
    tool: "select",
    sel: null,          // {kind:'room'|'opening'|'extra'|'underlay', roomId, id}
    snap: true,
    showUnderlay: true,
    storageOk: true,
    lastSaved: null
  };

  function on(fn) { listeners.push(fn); }
  function emit(reason) {
    listeners.forEach(function (fn) {
      try { fn(reason); } catch (e) { console.error(e); }
    });
  }

  /* ---------- localStorage ---------- */

  function available() {
    try {
      var k = "__fp_probe__";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  function saveNow() {
    if (!S.storageOk) return;
    try {
      var payload = FP.schema.serialize(S.doc, { includeUnderlay: true });
      window.localStorage.setItem(KEY_DOC, JSON.stringify(payload));
      window.localStorage.setItem(KEY_VIEW, JSON.stringify(S.view));
      S.lastSaved = new Date();
      emit("saved");
    } catch (e) {
      // 多半是底圖太大撐爆配額，退而求其次存不含底圖的版本
      try {
        var lite = FP.schema.serialize(S.doc, { includeUnderlay: false });
        window.localStorage.setItem(KEY_DOC, JSON.stringify(lite));
        S.lastSaved = new Date();
        emit("saved-partial");
      } catch (e2) {
        S.storageOk = false;
        emit("save-failed");
      }
    }
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 400);
  }

  function load() {
    S.storageOk = available();
    if (!S.storageOk) return false;
    var rawDoc = window.localStorage.getItem(KEY_DOC);
    if (!rawDoc) return false;
    try {
      var parsed = JSON.parse(rawDoc);
      var res = FP.schema.normalize(parsed);
      S.doc = res.doc;
      var rawView = window.localStorage.getItem(KEY_VIEW);
      if (rawView) {
        var v = JSON.parse(rawView);
        if (v && v.w > 0 && v.h > 0) S.view = v;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function prefs() {
    if (!S.storageOk) return {};
    try { return JSON.parse(window.localStorage.getItem(KEY_PREFS) || "{}"); }
    catch (e) { return {}; }
  }
  function setPref(k, v) {
    if (!S.storageOk) return;
    var p = prefs();
    p[k] = v;
    try { window.localStorage.setItem(KEY_PREFS, JSON.stringify(p)); } catch (e) { /* 忽略 */ }
  }

  function tourSeen() {
    if (!S.storageOk) return false;
    return window.localStorage.getItem(KEY_SEEN) === "1";
  }
  function markTourSeen() {
    if (!S.storageOk) return;
    try { window.localStorage.setItem(KEY_SEEN, "1"); } catch (e) { /* 忽略 */ }
  }

  function clearAll() {
    if (!S.storageOk) return;
    [KEY_DOC, KEY_VIEW, KEY_SEEN, KEY_PREFS].forEach(function (k) {
      try { window.localStorage.removeItem(k); } catch (e) { /* 忽略 */ }
    });
  }

  /* ---------- 復原 / 重做 ---------- */

  function snapshot() {
    return JSON.stringify(FP.schema.serialize(S.doc, { includeUnderlay: true }));
  }

  /* 在修改前呼叫，記錄當下狀態 */
  function begin(label) {
    pendingLabel = label || "編輯";
    undoStack.push({ label: pendingLabel, data: snapshot() });
    if (undoStack.length > LIMIT) undoStack.shift();
    redoStack.length = 0;
  }

  /* 修改完成後呼叫，觸發重繪與存檔 */
  function commit(reason) {
    scheduleSave();
    emit(reason || "change");
  }

  /* 拖曳這類連續動作：整段只記一次 */
  var dragOpen = false;
  function beginDrag(label) {
    if (dragOpen) return;
    dragOpen = true;
    begin(label);
  }
  function endDrag(reason) {
    dragOpen = false;
    commit(reason);
  }

  function restore(json) {
    var res = FP.schema.normalize(JSON.parse(json));
    S.doc = res.doc;
    S.sel = null;
  }

  function undo() {
    if (!undoStack.length) return false;
    var entry = undoStack.pop();
    redoStack.push({ label: entry.label, data: snapshot() });
    restore(entry.data);
    scheduleSave();
    emit("undo");
    return true;
  }

  function redo() {
    if (!redoStack.length) return false;
    var entry = redoStack.pop();
    undoStack.push({ label: entry.label, data: snapshot() });
    restore(entry.data);
    scheduleSave();
    emit("redo");
    return true;
  }

  function canUndo() { return undoStack.length > 0; }
  function canRedo() { return redoStack.length > 0; }

  /* ---------- 文件層級操作 ---------- */

  function replaceDoc(doc, label) {
    begin(label || "載入資料");
    S.doc = doc;
    S.sel = null;
    commit("replace");
  }

  function findRoom(id) {
    for (var i = 0; i < S.doc.rooms.length; i++) {
      if (S.doc.rooms[i].id === id) return S.doc.rooms[i];
    }
    return null;
  }
  function findExtra(id) {
    for (var i = 0; i < S.doc.extras.length; i++) {
      if (S.doc.extras[i].id === id) return S.doc.extras[i];
    }
    return null;
  }
  function findOpening(roomId, id) {
    var r = findRoom(roomId);
    if (!r) return null;
    for (var i = 0; i < r.openings.length; i++) {
      if (r.openings[i].id === id) return r.openings[i];
    }
    return null;
  }

  /* 目前選取的物件（房間或額外區域） */
  function selectedObject() {
    if (!S.sel) return null;
    if (S.sel.kind === "room") return findRoom(S.sel.roomId);
    if (S.sel.kind === "extra") return findExtra(S.sel.id);
    if (S.sel.kind === "underlay") return S.doc.underlay;
    return null;
  }

  FP.store = {
    S: S,
    on: on,
    emit: emit,
    load: load,
    saveNow: saveNow,
    scheduleSave: scheduleSave,
    clearAll: clearAll,
    prefs: prefs,
    setPref: setPref,
    tourSeen: tourSeen,
    markTourSeen: markTourSeen,
    begin: begin,
    commit: commit,
    beginDrag: beginDrag,
    endDrag: endDrag,
    undo: undo,
    redo: redo,
    canUndo: canUndo,
    canRedo: canRedo,
    replaceDoc: replaceDoc,
    findRoom: findRoom,
    findExtra: findExtra,
    findOpening: findOpening,
    selectedObject: selectedObject
  };
})(window.FP);
