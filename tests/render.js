const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path').join(__dirname, '..');
const dom = new JSDOM(fs.readFileSync(path + '/index.html','utf8'),
  { runScripts:'outside-only', pretendToBeVisual:true, url:'http://localhost/' });
const { window } = dom;
window.SVGElement.prototype.getScreenCTM = () => ({ inverse: () => ({}) });
window.SVGSVGElement.prototype.createSVGPoint = function(){ return {x:0,y:0,matrixTransform(){return{x:0,y:0};}}; };
window.Element.prototype.getBoundingClientRect = () => ({width:800,height:1000,top:0,left:0});
['schema','geom','store','units','render','interact','ui','tour','main'].forEach(n =>
  window.eval(fs.readFileSync(`${path}/js/${n}.js`,'utf8')));

setTimeout(() => {
  const d = window.document, FP = window.FP;
  const svg = d.getElementById('board');
  const m = svg.innerHTML;
  let fail = 0;
  function check(label, cond, extra) {
    console.log((cond?'  OK  ':' FAIL ') + label + (cond?'':'  → '+extra));
    if(!cond) fail++;
  }
  console.log('=== SVG 結構 ===');
  check('有方眼紙格線 pattern', m.includes('grid-fine') && m.includes('grid-bold'));
  check('有房間圖層', svg.querySelectorAll('[data-room]').length === 6,
    svg.querySelectorAll('[data-room]').length);
  check('有開口圖層', svg.querySelectorAll('[data-opening]').length === 11,
    svg.querySelectorAll('[data-opening]').length);
  check('有額外區域', svg.querySelectorAll('[data-extra]').length === 2,
    svg.querySelectorAll('[data-extra]').length);
  check('有刻度尺圖層', !!svg.querySelector('[data-layer="ruler"]'));
  check('刻度尺有數字標記',
    svg.querySelector('[data-layer="ruler"]').querySelectorAll('text').length > 3,
    svg.querySelector('[data-layer="ruler"]').querySelectorAll('text').length);
  check('有指北針「北」字', m.includes('>北<'));
  check('房名有出現', m.includes('客廳') && m.includes('主臥室') && m.includes('浴室'));
  check('viewBox 已設定', /^-?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+$/.test(svg.getAttribute('viewBox')),
    svg.getAttribute('viewBox'));

  console.log('\n=== 選取後的把手 ===');
  FP.store.S.sel = { kind:'room', roomId: FP.store.S.doc.rooms[0].id };
  FP.render.render();
  check('選取後出現旋轉把手', !!svg.querySelector('[data-rotate]'));
  check('開口有兩端控點', svg.querySelectorAll('[data-grip]').length >= 2,
    svg.querySelectorAll('[data-grip]').length);

  console.log('\n=== 匯出 SVG ===');
  const out = FP.render.toStandaloneSVG(1600, 2000);
  check('已換掉所有 CSS 變數', !out.includes('var(--'),
    (out.match(/var\(--[a-z0-9-]+\)/g)||[]).slice(0,3).join(','));
  check('字型屬性沒有被雙引號截斷', !/font-family="[^"]*"[A-Za-z]/.test(out));
  check('是合法的 XML', (() => {
    const p = new window.DOMParser().parseFromString(out, 'image/svg+xml');
    return !p.querySelector('parsererror');
  })());
  check('含 xmlns 宣告', out.includes('xmlns="http://www.w3.org/2000/svg"'));

  console.log('\n' + (fail ? '有 '+fail+' 項失敗' : '繪製測試全部通過'));
  process.exit(fail?1:0);
}, 500);
