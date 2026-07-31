/* 顯示單位模組的純邏輯測試：換算、格式化、輸入解析。不需要 jsdom */
const fs = require('fs');
const path = require('path').join(__dirname, '..');

// units.js 只碰 window.FP（persist 時才碰 FP.store，有防呆），給個最小替身即可。
// eval 載入的是本倉庫自己的原始碼（傳統 script、非 ES module），跟其他測試同一種作法
const window = { FP: {} };
eval(fs.readFileSync(path + '/js/units.js', 'utf8'));
const U = window.FP.units;

const errors = [];
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
function close(a, b, tol) { return Math.abs(a - b) <= (tol || 0.01); }

console.log('\n=== 公分模式 ===');
U.init('cm');
check('fmtLen 直接取整', () => U.fmtLen(358.4) === '358');
check('fmtDim', () => U.fmtDim(358, 487) === '358 × 487');
check('parseLen 純數字視為公分', () => U.parseLen('300') === 300);
check('parseLen 接受 12\'6" 也換成公分', () => close(U.parseLen('12\'6"'), 381));
check('parseLen 空字串是 NaN', () => isNaN(U.parseLen('')));
check('parseLen 亂字是 NaN', () => isNaN(U.parseLen('abc')));
check('刻度設定單位是 cm', () => U.rulerConfig().unitLabel === 'cm');
check('面積字樣含平方公尺', () => U.fmtAreaTotal(500000).indexOf('平方公尺') >= 0);

console.log('\n=== 呎吋模式 ===');
U.init('ftin');
check('360cm 顯示為 11\'10"', () => U.fmtLen(360) === '11\'10"');
check('30.48cm 顯示為 1\'', () => U.fmtLen(30.48) === "1'");
check('15cm 顯示為 6"', () => U.fmtLen(15.24) === '6"');
check('0 顯示為 0"', () => U.fmtLen(0) === '0"');
check('負值加負號', () => U.fmtLen(-91.44) === "-3'");
check('parseLen 純數字視為吋', () => close(U.parseLen('76'), 193.04));
check('parseLen 12\'6"', () => close(U.parseLen('12\'6"'), 381));
check('parseLen 有空格 12\' 6"', () => close(U.parseLen("12' 6\""), 381));
check('parseLen 12ft 6in', () => close(U.parseLen('12ft 6in'), 381));
check('parseLen 12呎6吋', () => close(U.parseLen('12呎6吋'), 381));
check('parseLen 只有吋 76"', () => close(U.parseLen('76"'), 193.04));
check('parseLen 小數呎 12.5\'', () => close(U.parseLen("12.5'"), 381));
check('parseLen 全形引號 12′6″', () => close(U.parseLen('12′6″'), 381));
check('parseLen 明講 cm 就照 cm', () => U.parseLen('360cm') === 360);
check('parseLen 明講公分', () => U.parseLen('360公分') === 360);
check('刻度設定單位是 ft', () => U.rulerConfig().unitLabel === 'ft');
check('刻度 30.48 標成 1\'', () => U.rulerConfig().fmtTick(30.48) === "1'");
check('刻度 15.24 標成 6"', () => U.rulerConfig().fmtTick(15.24) === '6"');
check('面積字樣含 sq ft', () => U.fmtAreaTotal(500000).indexOf('sq ft') >= 0);

console.log('\n=== 來回換算 ===');
check('fmtLen -> parseLen 誤差在一吋內', () => {
  for (let cm = 20; cm <= 5000; cm += 37) {
    const back = U.parseLen(U.fmtLen(cm));
    if (Math.abs(back - cm) > 1.28) return 'cm=' + cm + ' back=' + back;
  }
  return true;
});
check('set/get 切換', () => { U.set('cm'); return U.get() === 'cm'; });
check('set 亂值退回公分', () => { U.set('banana'); return U.get() === 'cm'; });

console.log('\n=== 結果 ===');
if (errors.length) {
  console.log('有 ' + errors.length + ' 項問題：');
  errors.forEach(e => console.log('  ✗ ' + e));
  process.exit(1);
} else {
  console.log('全部通過');
}
