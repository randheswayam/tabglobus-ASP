// E2E tests for the SiteFlow web app against a real API on a throwaway SQLite database.
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

// Test ports 8001 (API) and 8090 (web) stay clear of run_local.py on 8000 and 8080.
const PY = JSON.stringify(path.join(__dirname, 'backend', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'));

module.exports = defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8090',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: `${PY} ${JSON.stringify(path.join(__dirname, 'tests', 'e2e', 'serve_api.py'))}`,
      url: 'http://127.0.0.1:8001/health',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `${PY} ${JSON.stringify(path.join(__dirname, 'web-src', 'build.py'))} && ${PY} -m http.server 8090 --bind 127.0.0.1 --directory ${JSON.stringify(path.join(__dirname, 'www'))}`,
      url: 'http://localhost:8090/index.html',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
