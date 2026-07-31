/* 手機版檢查：只在 mobile 專案（Pixel 7 模擬）跑 */
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page, isMobile }) => {
  test.skip(!isMobile, '只在手機模擬下檢查');
  await page.addInitScript(() => {
    localStorage.setItem('fp.tourSeen.v1', '1');
  });
  await page.goto('/');
});

test('頁面不會左右捲動', async ({ page }) => {
  const { scrollW, innerW } = await page.evaluate(() => ({
    scrollW: document.scrollingElement.scrollWidth,
    innerW: window.innerWidth
  }));
  expect(scrollW).toBeLessThanOrEqual(innerW + 1);
});

test('觸控目標夠大（主要 44px、次要 40px）', async ({ page }) => {
  for (const sel of ['#btn-start', '#btn-zoom-in']) {
    const h = await page.locator(sel).evaluate(el => el.getBoundingClientRect().height);
    expect(h, sel + ' 高度').toBeGreaterThanOrEqual(44);
  }
  const slim = await page.locator('#btn-add-room')
    .evaluate(el => el.getBoundingClientRect().height);
  expect(slim, '#btn-add-room 高度').toBeGreaterThanOrEqual(40);
});

test('輸入框字級至少 16px（避免 iOS 對焦時放大）', async ({ page }) => {
  const size = await page.locator('#doc-name')
    .evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(16);
});

test('工具列可以橫向捲動拿到所有工具', async ({ page }) => {
  const tb = page.locator('#toolbar');
  const { scrollable } = await tb.evaluate(el => ({
    scrollable: el.scrollWidth > el.clientWidth
  }));
  expect(scrollable).toBe(true);
  // 單位切換在最右端，捲過去點得到
  await page.locator('#unit-ftin').scrollIntoViewIfNeeded();
  await page.locator('#unit-ftin').click();
  await expect(page.locator('#board')).toContainText("'");
});

test('點擊畫布上的房間會出現屬性面板', async ({ page }) => {
  await page.locator('#board [data-room]').first().click();
  await expect(page.locator('#p-name')).toBeVisible();
});
