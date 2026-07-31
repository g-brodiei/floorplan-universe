const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path').join(__dirname, '..');

const html = fs.readFileSync(path + '/index.html', 'utf8');
const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  url: 'http://localhost/'
});
const { window } = dom;

// jsdom 沒有 SVG 幾何 API，補上最小可用的替身
const proto = window.SVGElement.prototype;
proto.getScreenCTM = function () {
  return { inverse: () => ({ a:1,b:0,c:0,d:1,e:0,f:0 }) };
};
window.SVGSVGElement.prototype.createSVGPoint = function () {
  return { x:0, y:0, matrixTransform(){ return { x:this.x, y:this.y }; } };
};
window.Element.prototype.getBoundingClientRect = function () {
  return { width: 800, height: 1000, top: 0, left: 0, right: 800, bottom: 1000 };
};
window.HTMLCanvasElement.prototype.getContext = () => ({
  fillRect(){}, drawImage(){}, set fillStyle(v){}, get fillStyle(){ return ''; }
});
window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,AA';

const errors = [];
window.addEventListener('error', e => errors.push('window error: ' + e.message));
const origErr = console.error;

['schema','geom','store','units','render','interact','ui','tour','main'].forEach(name => {
  const code = fs.readFileSync(`${path}/js/${name}.js`, 'utf8');
  try {
    window.eval(code);
  } catch (e) {
    errors.push(`載入 ${name}.js 失敗: ${e.message}`);
  }
});

// 讓 jsdom 自己觸發 DOMContentLoaded，不手動補送

setTimeout(() => {
  const FP = window.FP;
  const d = window.document;

  function check(label, fn) {
    try {
      const r = fn();
      console.log((r ? '  OK  ' : ' FAIL ') + label + (r === true ? '' : '  → ' + r));
      if (!r) errors.push(label);
    } catch (e) {
      console.log(' FAIL ' + label + '  → ' + e.message);
      errors.push(label + ': ' + e.message);
    }
  }

  console.log('\n=== 啟動後狀態 ===');
  check('載入了範例房間', () => FP.store.S.doc.rooms.length === 6 || FP.store.S.doc.rooms.length);
  check('畫布有內容', () => d.getElementById('board').childNodes.length > 3);
  check('文字摘要有產出', () => d.getElementById('summary-text').value.indexOf('客廳') >= 0);
  check('房間計數有更新', () => d.getElementById('room-count').textContent.length > 0);

  console.log('\n=== 分頁切換 ===');
  ['data','ai','guide','summary'].forEach(t => {
    d.querySelector(`[data-tab="${t}"]`).dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
    check(`切到「${t}」分頁`, () => !d.querySelector(`[data-panel="${t}"]`).hidden);
  });

  console.log('\n=== 資料頁 ===');
  d.querySelector('[data-tab="data"]').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  check('JSON 可被解析回來', () => {
    const parsed = JSON.parse(d.getElementById('json-text').value);
    return parsed.rooms.length > 0;
  });

  console.log('\n=== AI 提示詞 ===');
  d.querySelector('[data-tab="ai"]').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  const prompt = d.getElementById('ai-prompt').value;
  check('提示詞含輸出規則', () => prompt.indexOf('只輸出 JSON') >= 0);
  check('提示詞含完整範例', () => prompt.indexOf('"openings"') >= 0);
  check('提示詞範例本身是合法 JSON', () => {
    const s = prompt.indexOf('{'), e = prompt.lastIndexOf('}');
    JSON.parse(prompt.slice(s, e + 1));
    return true;
  });
  check('備註會併進提示詞', () => {
    const box = d.getElementById('ai-notes');
    box.value = '我家有一間客廳';
    box.dispatchEvent(new window.Event('input', {bubbles:true}));
    return d.getElementById('ai-prompt').value.indexOf('我家有一間客廳') >= 0;
  });

  console.log('\n=== 匯入流程 ===');
  check('貼上 AI 回覆可匯入', () => {
    const reply = '好的，這是資料：\n```json\n{"version":1,"name":"測試屋","rooms":[{"name":"書房","w":300,"h":250,"x":0,"y":0,"openings":[{"type":"window","wall":"N","offset":50,"length":120}]}]}\n```\n希望有幫助！';
    d.getElementById('ai-reply').value = reply;
    d.getElementById('btn-paste-ai').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
    return FP.store.S.doc.rooms.length === 1 && FP.store.S.doc.rooms[0].name === '書房';
  });
  check('匯入後摘要跟著更新', () => d.getElementById('summary-text').value.indexOf('書房') >= 0);

  console.log('\n=== 復原重做 ===');
  check('復原可回到匯入前', () => { FP.store.undo(); return FP.store.S.doc.rooms.length === 6; });
  check('重做可回到匯入後', () => { FP.store.redo(); return FP.store.S.doc.rooms[0].name === '書房'; });

  console.log('\n=== 存檔 ===');
  FP.store.saveNow();
  check('已寫入 localStorage', () => !!window.localStorage.getItem('fp.doc.v1'));
  check('存檔內容可還原', () => {
    const saved = JSON.parse(window.localStorage.getItem('fp.doc.v1'));
    return saved.rooms[0].name === '書房';
  });

  console.log('\n=== 工具切換 ===');
  ['window','door','area','label','select'].forEach(t => {
    d.querySelector(`[data-tool="${t}"]`).dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
    check(`切到「${t}」工具`, () => FP.store.S.tool === t);
  });

  console.log('\n=== 加房間與屬性面板 ===');
  check('可新增房間', () => {
    const before = FP.store.S.doc.rooms.length;
    d.getElementById('btn-add-room').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
    return FP.store.S.doc.rooms.length === before + 1;
  });
  check('屬性面板出現名稱欄位', () => !!d.getElementById('p-name'));
  check('改寬度會生效', () => {
    const inp = d.getElementById('p-w');
    inp.value = '420';
    inp.dispatchEvent(new window.Event('change', {bubbles:true}));
    return FP.store.selectedObject().w === 420;
  });
  check('旋轉按鈕會生效', () => {
    d.getElementById('btn-rot-cw').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
    return FP.store.selectedObject().rot === 90;
  });

  console.log('\n=== 導覽 ===');
  check('導覽可開啟', () => {
    d.getElementById('btn-help').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
    return !!d.querySelector('.tour') && !d.querySelector('.tour').hidden;
  });
  check('導覽可前進到最後一步', () => {
    for (let i=0;i<6;i++) d.getElementById('tour-next').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
    return d.querySelector('.tour').hidden;
  });

  console.log('\n=== 結果 ===');
  if (errors.length) {
    console.log('有 ' + errors.length + ' 項問題：');
    errors.forEach(e => console.log('  ✗ ' + e));
    process.exit(1);
  } else {
    console.log('全部通過');
  }
}, 700);
