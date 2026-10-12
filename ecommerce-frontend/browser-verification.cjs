// Standalone Playwright browser verification. No app/payment responses are mocked.
const path = require('node:path');
const fs = require('node:fs');
const readline = require('node:readline');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  let page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => console.log('PAGE_ERROR', error.message));
  await page.goto('http://localhost:5173');
  console.log('BROWSER_READY');
  // Commands use DOM-backed locators. Keep the session open for payment iframe inspection.
  const input = readline.createInterface({ input: process.stdin });
  for await (const line of input) {
    try {
      const action = JSON.parse(line);
      if (action.type === 'pages') console.log('PAGES', JSON.stringify(context.pages().map((p, index) => ({ index, url: p.url().split(/[?#]/)[0] }))));
      if (action.type === 'page') page = context.pages()[action.index];
      const target = action.frame === undefined ? page : page.frames()[action.frame];
      if (!target) throw new Error('Frame is unavailable');
      if (action.type === 'goto') await page.goto(action.url);
      if (action.type === 'fill') await target.locator(action.selector).fill(action.value);
      if (action.type === 'click') await target.locator(action.selector).click();
      if (action.type === 'textclick') await target.getByText(action.text, { exact: action.exact !== false }).click();
      if (action.type === 'snapshot') {
        console.log('URL', page.url());
        console.log('FRAMES', JSON.stringify(page.frames().map((frame, index) => ({ index, url: frame.url().split(/[?#]/)[0] }))));
        console.log('DOM', (await target.locator('body').innerText()).slice(0, 14000));
        console.log('CONTROLS', JSON.stringify(await target.locator('input,button,select').evaluateAll(elements => elements.map(e => ({ tag: e.tagName, type: e.type, name: e.name, placeholder: e.placeholder, label: e.getAttribute('aria-label'), text: e.innerText, id: e.id })))));
      }
      if (action.type === 'screenshot') {
        const output = path.resolve('../.integration', action.name || 'browser.png');
        fs.mkdirSync(path.dirname(output), { recursive: true });
        await page.screenshot({ path: output, fullPage: true });
        console.log('SCREENSHOT', output);
      }
      if (action.type === 'close') { await browser.close(); input.close(); break; }
      console.log('ACTION_OK', action.type);
    } catch (error) { console.log('ACTION_ERROR', error.message); }
  }
  await browser.close();
})().catch(error => { console.error(error.message); process.exitCode = 1; });
