/* 首次使用導覽 */
window.FP = window.FP || {};

(function (FP) {
  "use strict";

  var STEPS = [
    {
      target: null,
      title: "這是一塊製圖板",
      body: "你手上有各個房間的長寬，這個工具幫你把它排成平面圖，" +
            "再變成別人（或 AI）看得懂的資料。全程存在你自己的瀏覽器裡，關掉再開還在。"
    },
    {
      target: "#toolbar",
      title: "先把房間排好",
      body: "拖動房間排出你家的形狀。相鄰時會自動吸附，" +
            "分別對應「共用一道牆」和「完全貼齊」兩種距離。"
    },
    {
      target: "#tool-rotate-group",
      title: "轉向用把手",
      body: "選起房間後，上方會出現一個圓形把手，拖它就能轉到任意角度。" +
            "旁邊的按鈕是 90 度快轉，鍵盤的中括號可以做 15 度微調。"
    },
    {
      target: "#tool-openings",
      title: "在牆上開窗和門",
      body: "點「加窗戶」或「加門」，然後點房間的牆線。" +
            "加好後拖兩端的圓點可以調寬度，下方欄位可以選種類。"
    },
    {
      target: "#compass-select",
      title: "設定方位",
      body: "選一個方位當作畫面上方。設定好之後，" +
            "每個窗戶會自動標出它朝哪個方位——要討論通風、日照時就靠這個。"
    },
    {
      target: "#tabs",
      title: "做好了就帶走",
      body: "下方可以複製文字摘要、下載 JSON 或圖片。" +
            "「用 AI 匯入」那一頁有一段提示詞，把你家用講的描述給 AI，" +
            "它會回一份資料，貼回來就整份匯入，不用一個一個排。"
    }
  ];

  var index = 0;
  var overlay = null;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.className = "tour";
    overlay.innerHTML =
      '<div class="tour-spot" id="tour-spot" hidden></div>' +
      '<div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title">' +
      '<p class="tour-step" id="tour-step"></p>' +
      '<h2 class="tour-title" id="tour-title"></h2>' +
      '<p class="tour-body" id="tour-body"></p>' +
      '<div class="tour-actions">' +
      '<button class="btn btn-quiet" id="tour-skip">略過</button>' +
      '<span class="tour-spacer"></span>' +
      '<button class="btn" id="tour-prev">上一步</button>' +
      '<button class="btn btn-primary" id="tour-next">下一步</button>' +
      "</div></div>";
    document.body.appendChild(overlay);

    document.getElementById("tour-skip").addEventListener("click", finish);
    document.getElementById("tour-prev").addEventListener("click", function () { go(index - 1); });
    document.getElementById("tour-next").addEventListener("click", function () {
      if (index >= STEPS.length - 1) finish(); else go(index + 1);
    });
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", reposition);
    return overlay;
  }

  function onKey(e) {
    if (!overlay || overlay.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); finish(); }
    if (e.key === "ArrowRight") { e.preventDefault(); if (index < STEPS.length - 1) go(index + 1); else finish(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
  }

  function go(i) {
    index = Math.max(0, Math.min(i, STEPS.length - 1));
    var step = STEPS[index];
    document.getElementById("tour-step").textContent = (index + 1) + " / " + STEPS.length;
    document.getElementById("tour-title").textContent = step.title;
    document.getElementById("tour-body").textContent = step.body;
    document.getElementById("tour-prev").disabled = index === 0;
    document.getElementById("tour-next").textContent =
      index >= STEPS.length - 1 ? "開始使用" : "下一步";
    reposition();
  }

  function reposition() {
    if (!overlay || overlay.hidden) return;
    var step = STEPS[index];
    var spot = document.getElementById("tour-spot");
    var card = overlay.querySelector(".tour-card");
    if (!step.target) {
      spot.hidden = true;
      card.style.top = "";
      card.style.left = "";
      card.classList.add("is-centered");
      return;
    }
    var node = document.querySelector(step.target);
    if (!node) {
      spot.hidden = true;
      card.classList.add("is-centered");
      return;
    }
    var r = node.getBoundingClientRect();
    var pad = 8;
    spot.hidden = false;
    spot.style.top = (r.top - pad) + "px";
    spot.style.left = (r.left - pad) + "px";
    spot.style.width = (r.width + pad * 2) + "px";
    spot.style.height = (r.height + pad * 2) + "px";

    card.classList.remove("is-centered");
    var cardH = card.offsetHeight || 200;
    var cardW = card.offsetWidth || 340;
    var top = r.bottom + 14;
    if (top + cardH > window.innerHeight - 12) top = Math.max(12, r.top - cardH - 14);
    var left = Math.min(
      Math.max(12, r.left + r.width / 2 - cardW / 2),
      window.innerWidth - cardW - 12
    );
    card.style.top = top + "px";
    card.style.left = left + "px";
  }

  function start(force) {
    if (!force && FP.store.tourSeen()) return;
    ensureOverlay();
    overlay.hidden = false;
    document.body.classList.add("tour-open");
    go(0);
  }

  function finish() {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("tour-open");
    FP.store.markTourSeen();
  }

  FP.tour = { start: start, finish: finish };
})(window.FP);
