/* e2e 設定：本機自動起靜態伺服器，桌機與手機（觸控）各跑一輪 */
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'e2e',
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'python3 -m http.server 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Pixel 7 走 chromium，CI 只需要裝一種瀏覽器；帶 touch → pointer:coarse 生效
    { name: 'mobile', use: { ...devices['Pixel 7'] } }
  ]
});
