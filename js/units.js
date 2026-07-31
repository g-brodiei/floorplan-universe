/* 顯示單位：公分或呎吋。資料一律以公分儲存，這裡只管顯示與輸入的換算 */
window.FP = window.FP || {};

(function (FP) {
  "use strict";

  var IN = 2.54;      // 1 吋 = 2.54 公分
  var FT = 30.48;     // 1 呎 = 30.48 公分

  var mode = "cm";    // "cm" | "ftin"

  function init(saved) {
    mode = saved === "ftin" ? "ftin" : "cm";
  }

  function get() { return mode; }

  function set(next) {
    mode = next === "ftin" ? "ftin" : "cm";
    if (FP.store && FP.store.setPref) FP.store.setPref("unit", mode);
  }

  /* 公分 -> 顯示字串。呎吋取到整吋：360 -> 11'10" */
  function fmtLen(cm) {
    if (mode === "cm") return String(Math.round(cm));
    var totalIn = Math.round(cm / IN);
    var neg = totalIn < 0;
    totalIn = Math.abs(totalIn);
    var ft = Math.floor(totalIn / 12);
    var inch = totalIn % 12;
    var s;
    if (ft === 0) s = inch + '"';
    else if (inch === 0) s = ft + "'";
    else s = ft + "'" + inch + '"';
    return (neg ? "-" : "") + s;
  }

  function fmtDim(wCm, hCm, compact) {
    return fmtLen(wCm) + (compact ? "×" : " × ") + fmtLen(hCm);
  }

  function fmtPoint(xCm, yCm) {
    return fmtLen(xCm) + ", " + fmtLen(yCm);
  }

  /*
   * 使用者輸入 -> 公分。回傳 NaN 表示看不懂。
   * 接受：純數字（依目前單位解讀）、12'6"、12' 6"、12ft 6in、
   * 12呎6吋、76"、76in、12.5'、360cm、360公分
   */
  function parseLen(input) {
    if (typeof input === "number") return mode === "ftin" ? input * IN : input;
    var s = String(input == null ? "" : input).trim()
      .replace(/[′’]/g, "'")
      .replace(/[″”]/g, '"');
    if (!s) return NaN;

    var m = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:'|ft|呎|英尺)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|吋|英吋)?)?\s*$/i);
    if (m) {
      var ft = parseFloat(m[1]);
      var inch = m[2] ? parseFloat(m[2]) : 0;
      var sign = ft < 0 ? -1 : 1;
      return (Math.abs(ft) * 12 + inch) * sign * IN;
    }
    m = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:"|in|吋|英吋)\s*$/i);
    if (m) return parseFloat(m[1]) * IN;
    m = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:cm|公分)\s*$/i);
    if (m) return parseFloat(m[1]);

    var n = parseFloat(s);
    if (!isNaN(n) && /^-?\d+(?:\.\d+)?$/.test(s)) {
      return mode === "ftin" ? n * IN : n;
    }
    return NaN;
  }

  /* 刻度尺設定：間距選項、主刻度倍率、刻度文字 */
  function rulerConfig() {
    if (mode === "cm") {
      return {
        unitLabel: "cm",
        steps: [10, 25, 50, 100, 250, 500, 1000, 2500],
        majorOf: function (minor) {
          return minor * (minor === 25 || minor === 250 || minor === 2500 ? 4 : 5);
        },
        fmtTick: function (v) { return String(Math.round(v)); }
      };
    }
    return {
      unitLabel: "ft",
      steps: [IN, 3 * IN, 6 * IN, FT, 2 * FT, 5 * FT, 10 * FT, 25 * FT, 50 * FT, 100 * FT],
      majorOf: function (minor) {
        if (minor < FT) return minor === IN ? FT : minor * 4;
        return minor * 5;
      },
      fmtTick: function (v) {
        var inches = Math.round(v / IN);
        if (inches !== 0 && inches % 12 === 0) return (inches / 12) + "'";
        return inches + '"';
      }
    };
  }

  /* 面積合計文字。cm² 進來 */
  function fmtAreaTotal(cm2) {
    var m2 = cm2 / 10000;
    if (mode === "cm") {
      return m2.toFixed(1) + " 平方公尺（約 " + (m2 / 3.305).toFixed(1) +
        " 坪，不含牆體與額外區域）";
    }
    var sqft = cm2 / 929.0304;
    return Math.round(sqft) + " 平方英尺 sq ft（約 " + m2.toFixed(1) +
      " ㎡，不含牆體與額外區域）";
  }

  function summaryUnitLine() {
    return mode === "ftin"
      ? "單位：呎（'）與吋（\"）。JSON 資料仍以公分儲存。"
      : "單位：公分";
  }

  FP.units = {
    IN: IN,
    FT: FT,
    init: init,
    get: get,
    set: set,
    fmtLen: fmtLen,
    fmtDim: fmtDim,
    fmtPoint: fmtPoint,
    parseLen: parseLen,
    rulerConfig: rulerConfig,
    fmtAreaTotal: fmtAreaTotal,
    summaryUnitLine: summaryUnitLine
  };
})(window.FP);
