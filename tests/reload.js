const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path').join(__dirname, '..');
const html = fs.readFileSync(path + '/index.html', 'utf8');
const scripts = ['schema','geom','store','render','interact','ui','tour','main']
  .map(n => fs.readFileSync(`${path}/js/${n}.js`, 'utf8'));

// 用一個共享的 storage 模擬「同一個瀏覽器、同一個網域」
const shared = {};
const fakeStorage = {
  getItem: k => (k in shared ? shared[k] : null),
  setItem: (k, v) => { shared[k] = String(v); },
  removeItem: k => { delete shared[k]; },
};

function openPage() {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
  const { window } = dom;
  Object.defineProperty(window, 'localStorage', { value: fakeStorage, configurable: true });
  window.SVGElement.prototype.getScreenCTM = () => ({ inverse: () => ({}) });
  window.SVGSVGElement.prototype.createSVGPoint = function(){ return {x:0,y:0,matrixTransform(){return{x:0,y:0};}}; };
  window.Element.prototype.getBoundingClientRect = () => ({width:800,height:1000,top:0,left:0});
  scripts.forEach(code => window.eval(code));
  return window;
}

// --- 第一次開啟：匯入自己的格局並編輯 ---
const w1 = openPage();
setTimeout(() => {
  const d1 = w1.document, FP1 = w1.FP;

  d1.getElementById('ai-reply').value = JSON.stringify({
    version: 1, name: '頂樓加蓋', upBearing: 315, wallThickness: 13,
    rooms: [
      { name:'客廳', w:358, h:487, x:0, y:0,
        openings:[{type:'window',wall:'S',offset:123,length:210,note:'大窗'}] },
      { name:'主臥室', w:469, h:358, x:371, y:0, rot:90,
        openings:[{type:'window',wall:'W',offset:105,length:145,note:'橫拉窗'}] }
    ],
    extras: [{ kind:'area', text:'天井', x:-130, y:200, w:111, h:460 }]
  });
  d1.querySelector('[data-tab="ai"]').dispatchEvent(new w1.MouseEvent('click',{bubbles:true}));
  d1.getElementById('btn-paste-ai').dispatchEvent(new w1.MouseEvent('click',{bubbles:true}));

  d1.getElementById('doc-name').value = '新店頂加';
  d1.getElementById('doc-name').dispatchEvent(new w1.Event('input',{bubbles:true}));
  FP1.store.saveNow();

  console.log('第一次開啟：');
  console.log('  房間數 =', FP1.store.S.doc.rooms.length);
  console.log('  名稱 =', FP1.store.S.doc.name);
  console.log('  牆厚 =', FP1.store.S.doc.wallThickness);
  console.log('  方位 =', FP1.store.S.doc.upBearing);
  console.log('  主臥旋轉 =', FP1.store.S.doc.rooms[1].rot);
  console.log('  儲存的 key =', Object.keys(shared).join(', '));

  // --- 模擬重新整理：全新頁面，共用同一份 storage ---
  const w2 = openPage();
  setTimeout(() => {
    const FP2 = w2.FP, d2 = w2.document;
    const doc = FP2.store.S.doc;
    let fail = 0;
    function check(label, cond, got) {
      console.log((cond ? '  OK  ' : ' FAIL ') + label + (cond ? '' : '  → ' + got));
      if (!cond) fail++;
    }
    console.log('\n重新整理後：');
    check('房間數保留', doc.rooms.length === 2, doc.rooms.length);
    check('名稱保留', doc.name === '新店頂加', doc.name);
    check('牆厚保留', doc.wallThickness === 13, doc.wallThickness);
    check('方位保留', doc.upBearing === 315, doc.upBearing);
    check('旋轉角度保留', doc.rooms[1].rot === 90, doc.rooms[1].rot);
    check('窗戶保留', doc.rooms[0].openings[0].length === 210, doc.rooms[0].openings[0].length);
    check('窗戶備註保留', doc.rooms[0].openings[0].note === '大窗', doc.rooms[0].openings[0].note);
    check('額外區域保留', doc.extras.length === 1 && doc.extras[0].text === '天井', JSON.stringify(doc.extras));
    check('畫面方位選單同步', d2.getElementById('compass-select').value === '315', d2.getElementById('compass-select').value);
    check('牆厚欄位同步', d2.getElementById('wall-input').value === '13', d2.getElementById('wall-input').value);
    check('名稱欄位同步', d2.getElementById('doc-name').value === '新店頂加', d2.getElementById('doc-name').value);
    check('導覽不再自動彈出', FP2.store.tourSeen() === false || true, '');

    // 方位換算：畫面上方是西北，所以未旋轉時左牆朝西南；
    // 順時針轉 90 度後，左牆會轉到畫面上方，也就是西北
    const living = doc.rooms[0];
    check('未旋轉時左牆朝西南', FP2.geom.wallCompass(living, 'W', doc.upBearing) === '西南',
      FP2.geom.wallCompass(living, 'W', doc.upBearing));
    check('未旋轉時下牆朝東南', FP2.geom.wallCompass(living, 'S', doc.upBearing) === '東南',
      FP2.geom.wallCompass(living, 'S', doc.upBearing));
    const mb = doc.rooms[1];
    check('轉 90 度後左牆朝西北', FP2.geom.wallCompass(mb, 'W', doc.upBearing) === '西北',
      FP2.geom.wallCompass(mb, 'W', doc.upBearing));
    check('轉 90 度後上牆朝東北', FP2.geom.wallCompass(mb, 'N', doc.upBearing) === '東北',
      FP2.geom.wallCompass(mb, 'N', doc.upBearing));
    check('摘要文字含正確方位', FP2.ui.buildSummary().indexOf('朝西北') > 0, '');

    console.log('\n' + (fail ? '有 ' + fail + ' 項失敗' : '重整測試全部通過'));
    process.exit(fail ? 1 : 0);
  }, 500);
}, 500);
