# Changelog

本專案的重要變更都記錄在這裡。
格式依 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，
版號依 [Semantic Versioning](https://semver.org/lang/zh-TW/)。

## [Unreleased]

## [1.1.0] - 2026-07-31

### Added
- 公制／英制顯示單位切換（cm ↔ ft/in）：畫布標示、刻度尺、輸入欄位、
  文字摘要全部跟著換；長度欄位可輸入 `12'6"`、`76"`、`12呎6吋` 等格式。
  JSON 資料一律以公分儲存，交換檔案不受影響
- SEO 與可發現性：canonical、Open Graph／Twitter 卡片與預覽圖、
  Schema.org WebApplication 結構化資料、favicon、robots.txt（明確歡迎
  搜尋與 AI 爬蟲）、sitemap.xml、llms.txt
- e2e 測試（Playwright，桌機＋手機模擬各一輪）與單位換算純邏輯測試
- CI：Pull Request 與 main 推送都先跑完整測試，通過才部署 GitHub Pages
- `docs/GO-LIVE-GUIDE.md`：上線最後一哩的人工步驟清單

### Changed
- 行動版體驗：16px 表單字級（避免 iOS 對焦自動放大）、觸控目標放大到
  44px 等級、safe-area 內距、svh 單位避免網址列收合時跳動
- GitHub Actions 全面升級到 Node 24 世代（checkout v7、setup-node v7、
  configure-pages v6、upload-pages-artifact v5、deploy-pages v5）

### Fixed
- 畫布在橫向手機或短視窗下縮成貼左的窄欄（aspect-ratio 與 max-height
  的約束轉移），改為置中、橫向時吃滿寬度

## [1.0.0] - 2026-07-31

### Added
- 初版：拖曳排版、任意角度旋轉、窗戶與門、方位換算、刻度尺、
  自動存檔、復原重做、文字摘要／JSON／PNG 匯出、AI 匯入、
  底圖描圖、首次導覽
- GitHub Pages 自動部署 workflow

[Unreleased]: https://github.com/g-brodiei/floorplan-universe/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/g-brodiei/floorplan-universe/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/g-brodiei/floorplan-universe/releases/tag/v1.0.0
