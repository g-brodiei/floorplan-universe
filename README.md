# 格局編輯器

把各個房間的長寬，排成一張看得懂的平面圖。

**線上使用：https://g-brodiei.github.io/floorplan-universe/**

量過家裡之後，你手上通常是一串數字：客廳 358×487、主臥 469×358、廁所 183×277。這些數字自己看得懂，但要講給設計師、師傅或 AI 聽，就得比手畫腳。這個工具讓你把數字拖成平面圖，標上窗戶和門的方位，再匯出成別人能直接讀的文字或資料。

純靜態網頁，沒有後端，資料存在使用者自己的瀏覽器裡。

## 特色

- **拖曳排版**：房間相鄰時會吸附到兩個位置，分別對應「共用一道牆」和「完全貼齊」
- **任意角度旋轉**：拖把手轉，靠近 15 度的倍數會吸附；房名和尺寸永遠保持正向可讀
- **方位自動換算**：設定畫面上方朝哪個方位，每扇窗戶會自動標出實際朝向（含房間自身旋轉）
- **公制／英制切換**：顯示與輸入可在公分和呎吋（ft/in）之間切換，資料一律以公分儲存
- **刻度尺**：畫布邊緣有跟著縮放的刻度（公分或呎吋），可直接讀出位置
- **自動存檔**：每次改動存進 localStorage，重新整理不會消失
- **三種起始方式**：打房間清單、貼上 JSON、或把平面圖照片放到底層描
- **AI 匯入**：內建提示詞，用講的描述你家給任何 AI，回覆貼回來就整份匯入
- **首次導覽**：第一次開啟會有六步驟的操作說明

## 直接使用

把整個資料夾丟到任何靜態主機就能跑，或本機直接開 `index.html` 也可以。沒有建置步驟、沒有相依套件。

### GitHub Pages

1. 建一個 repository，把這些檔案推上去
2. Settings → Pages → Source 選 `main` 分支的根目錄
3. 等一兩分鐘，網址會是 `https://<你的帳號>.github.io/<repo 名稱>/`

倉庫裡附了 `.github/workflows/pages.yml`，推上 main 就會自動部署。

### 本機預覽

```bash
python3 -m http.server 8000
# 開 http://localhost:8000
```

用 `file://` 直接開也能運作（腳本刻意不用 ES modules），只有「載入範例」會退回內建副本，因為 `fetch` 在 `file://` 下會被擋。

## 檔案結構

```
├── index.html              介面骨架
├── css/app.css             樣式與設計 token
├── js/
│   ├── schema.js           資料格式定義、驗證、寬鬆解析
│   ├── geom.js             旋轉、外框、貼齊、方位換算
│   ├── store.js            狀態、自動存檔、復原重做
│   ├── units.js            顯示單位（公分／呎吋）換算與解析
│   ├── render.js           SVG 繪製
│   ├── interact.js         指標事件、拖曳、縮放
│   ├── ui.js               面板、對話框、匯入匯出
│   ├── tour.js             首次使用導覽
│   └── main.js             啟動與事件綁定
├── examples/
│   ├── sample-home.json    範例格局
│   └── ai-prompt.md        獨立的 AI 提示詞範本
├── tests/                  jsdom 測試
└── build-single.js         打包成單檔（選用）
```

腳本用傳統的 `<script>` 標籤依序載入，共用 `window.FP` 命名空間。這是刻意的選擇：不用打包工具，`file://` 也能跑。

## 資料格式

單位一律公分（顯示單位切成呎吋時也一樣，只有畫面與輸入框跟著換算）。
座標系 x 往右增加、y 往下增加，每個房間的 `x, y` 是它左上角的位置。

```json
{
  "version": 1,
  "name": "我家",
  "unit": "cm",
  "upBearing": 315,
  "wallThickness": 13,
  "rooms": [
    {
      "name": "客廳",
      "w": 358, "h": 487,
      "x": 0, "y": 0,
      "rot": 0,
      "fill": "#F2DFC6",
      "openings": [
        { "type": "window", "wall": "S", "offset": 123, "length": 210, "note": "大窗" },
        { "type": "door", "wall": "W", "offset": 40, "length": 85, "note": "開口（無門）" }
      ]
    }
  ],
  "extras": [
    { "kind": "area", "text": "天井", "x": -130, "y": 200, "w": 111, "h": 460, "rot": 0 },
    { "kind": "label", "text": "電表在這面牆", "x": 60, "y": -60 }
  ]
}
```

| 欄位 | 說明 |
|---|---|
| `upBearing` | 畫面上方對應的方位角。北 0、東北 45、東 90、東南 135、南 180、西南 225、西 270、西北 315 |
| `wallThickness` | 牆厚。房間的 `w`、`h` 是室內淨寬，相鄰房間之間留這個距離就代表共用一道牆 |
| `rot` | 順時針旋轉角度。開口會跟著房間一起轉，方位換算會自動納入 |
| `openings[].wall` | `N` 上、`E` 右、`S` 下、`W` 左，指房間自己的四面牆（未旋轉時） |
| `openings[].offset` | 開口起點距該面牆起點的距離。上下牆從左端算，左右牆從上端算 |
| `openings[].type` | `window` 或 `door`。沒有門扇的通道用 `door`，`note` 寫「開口（無門）」 |

匯入時會經過 `FP.schema.normalize()`，缺漏欄位補預設值、不合法的值會被略過並列出提醒，所以 AI 產生的資料就算不完美也讀得進來。

## AI 匯入怎麼運作

「用 AI 匯入」分頁會組出一段提示詞，包含格式規格和一份完整範例。使用者把它連同自家描述貼給任何 AI，AI 回覆的內容整段貼回來即可——`parseLoose()` 會自動剝掉 markdown 圍籬和前後的客套話，只取出 JSON 的部分。

`examples/ai-prompt.md` 是同一份提示詞的獨立檔案，方便直接引用。

## 瀏覽器支援

需要支援 Pointer Events、CSS 自訂屬性和 `aspect-ratio` 的瀏覽器。實務上是 2021 年之後的 Chrome、Firefox、Safari、Edge。

觸控裝置支援雙指捏合縮放與單指拖曳。

## 開發

沒有建置流程。改完直接重新整理。

```bash
npm install            # 只有測試需要相依套件
npm test               # 單位換算 + jsdom 測試（啟動、匯入匯出、持久化、方位、SVG）
npm run test:e2e       # Playwright 端對端測試（桌機與手機模擬各一輪）
```

jsdom 沒有 SVG 幾何 API，測試檔開頭補了最小可用的替身。
第一次跑 e2e 前先 `npx playwright install chromium`。

### 流程與版本

- main 受保護：改動一律開分支、發 Pull Request，CI（測試）過了才能合併
- 合併進 main 會自動跑測試並部署到 GitHub Pages
- 版號依語意化版本（SemVer），變更記錄在 `CHANGELOG.md`；
  發版時更新 changelog、把 `package.json` 版號調上去、打 `vX.Y.Z` 標籤並發 GitHub Release

## 已知限制

- 只支援矩形房間。L 型或不規則空間要用兩個矩形拼，或用「畫區域」標註
- localStorage 有容量上限（多數瀏覽器約 5MB）。放了底圖之後可能接近上限，程式會自動退回不含底圖的存檔，並提示你下載備份
- 隱私模式、清除瀏覽資料、換裝置都會讓本機存檔消失。重要的圖請到「資料」頁下載 JSON

## 授權

MIT

## 單檔版本

想用 `file://` 直接開，或丟到不方便放多個檔案的地方，可以打包成單一 HTML：

```bash
node build-single.js
# 產出 dist/floorplan-editor.html
```

平常開發不需要跑這支，改完原始碼重新整理即可。
