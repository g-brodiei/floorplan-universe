/* 端對端測試：以真瀏覽器走過主要使用流程 */
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  // 略過首次導覽，測試聚焦在功能本身
  await page.addInitScript(() => {
    localStorage.setItem('fp.tourSeen.v1', '1');
  });
  await page.goto('/');
});

test.describe('啟動', () => {
  test('載入範例並畫出平面圖', async ({ page }) => {
    await expect(page).toHaveTitle(/格局編輯器/);
    await expect(page.locator('#board [data-room]')).toHaveCount(6);
    await expect(page.locator('#room-count')).toContainText('6 間房');
    // textarea 的內容在 value，不在 textContent
    await expect(page.locator('#summary-text')).toHaveValue(/客廳/);
  });

  test('主要控制項都在', async ({ page }) => {
    for (const id of ['btn-start', 'btn-help', 'btn-add-room', 'btn-undo',
      'unit-cm', 'unit-ftin', 'btn-fit', 'compass-select']) {
      await expect(page.locator('#' + id)).toBeVisible();
    }
  });
});

test.describe('分頁', () => {
  test('資料頁的 JSON 合法且單位是公分', async ({ page }) => {
    await page.locator('[data-tab="data"]').click();
    const raw = await page.locator('#json-text').inputValue();
    const parsed = JSON.parse(raw);
    expect(parsed.unit).toBe('cm');
    expect(parsed.rooms.length).toBeGreaterThan(0);
  });

  test('AI 頁的提示詞含格式規則', async ({ page }) => {
    await page.locator('[data-tab="ai"]').click();
    const prompt = await page.locator('#ai-prompt').inputValue();
    expect(prompt).toContain('只輸出 JSON');
    expect(prompt).toContain('"openings"');
  });
});

test.describe('編輯', () => {
  test('加房間後屬性面板出現、可改寬度', async ({ page }) => {
    await page.locator('#btn-add-room').click();
    await expect(page.locator('#board [data-room]')).toHaveCount(7);
    await expect(page.locator('#p-name')).toBeVisible();
    await page.locator('#p-w').fill('420');
    await page.locator('#p-w').press('Enter');
    await expect(page.locator('#board')).toContainText('420 × 300');
  });

  test('復原可回到加房間之前', async ({ page }) => {
    await page.locator('#btn-add-room').click();
    await expect(page.locator('#board [data-room]')).toHaveCount(7);
    await page.locator('#btn-undo').click();
    await expect(page.locator('#board [data-room]')).toHaveCount(6);
  });
});

test.describe('顯示單位', () => {
  test('切到呎吋：畫布、刻度、摘要一起換，JSON 仍是公分', async ({ page }) => {
    await page.locator('#unit-ftin').click();
    await expect(page.locator('#board')).toContainText("13'9\" × 11'10\"");
    await expect(page.locator('#board')).toContainText('ft');
    await expect(page.locator('#summary-text')).toHaveValue(/呎/);
    await page.locator('[data-tab="data"]').click();
    const parsed = JSON.parse(await page.locator('#json-text').inputValue());
    expect(parsed.unit).toBe('cm');
    expect(parsed.rooms[0].w).toBe(420);
  });

  test('呎吋模式下可輸入 12\'6" 這種長度', async ({ page }) => {
    await page.locator('#unit-ftin').click();
    await page.locator('#board [data-room]').first().click();
    await expect(page.locator('#p-w')).toBeVisible();
    await page.locator('#p-w').fill(`12'6"`);
    await page.locator('#p-w').press('Enter');
    await page.locator('[data-tab="data"]').click();
    const parsed = JSON.parse(await page.locator('#json-text').inputValue());
    const widths = parsed.rooms.map(r => r.w);
    expect(widths).toContain(381); // 12'6" = 381 公分
  });

  test('單位偏好會記住', async ({ page }) => {
    await page.locator('#unit-ftin').click();
    await page.reload();
    await expect(page.locator('#unit-ftin')).toHaveClass(/is-active/);
    await expect(page.locator('#board')).toContainText("'");
    await page.locator('#unit-cm').click();
    await expect(page.locator('#board')).toContainText('420 × 360');
  });
});

test.describe('存檔', () => {
  test('重新整理後內容還在', async ({ page }) => {
    await page.locator('#btn-add-room').click();
    await expect(page.locator('#board [data-room]')).toHaveCount(7);
    // 自動存檔有 400ms 的節流
    await page.waitForTimeout(700);
    await page.reload();
    await expect(page.locator('#board [data-room]')).toHaveCount(7);
  });
});
