const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

// Requires the isolated browser fixture/database and test-key backend.
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('http://localhost:5173/cart');
    await page.waitForURL('**/login');
    console.log('PASS: logged-out cart redirects to login');
    await page.locator('input[placeholder="Enter username"]').fill('browser_verify_1012');
    await page.locator('input[placeholder="Enter password"]').fill('VerificationOnly123!');
    await page.locator('form button[type=submit]').click();
    await page.waitForURL('http://localhost:5173/');
    await page.getByRole('searchbox').fill('Browser Test');
    await page.getByRole('searchbox').press('Enter');
    await page.getByText('Browser Test Product', { exact: true }).waitFor();
    assert.match(page.url(), /search=Browser/);
    console.log('PASS: product search');
    await page.goto('http://localhost:5173/cart');
    await page.getByText('Browser Test Product', { exact: true }).waitFor();
    for (const [name, value] of Object.entries({ flat: 'Test Building 1', street: 'Example Street', city: 'Test City', pincode: '560001', mobile: '9000090000' })) {
      await page.locator(`input[name=${name}]`).fill(value);
    }
    const created = page.waitForResponse(response => response.url().endsWith('/payment/create-order/') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Proceed to Checkout' }).click();
    const response = await created;
    assert.equal(response.status(), 200);
    assert.ok((await response.json()).key.startsWith('rzp_test_'));
    const checkout = page.locator('iframe[src*="/checkout/public"]');
    await checkout.waitFor({ state: 'visible', timeout: 30000 });
    await page.getByText('Test Mode', { exact: true }).waitFor({ timeout: 30000 });
    const checkoutFrame = page.frameLocator('iframe[src*="/checkout/public"]');
    await checkoutFrame.getByText('Payment Options', { exact: true }).waitFor({ timeout: 30000 });
    await checkoutFrame.locator('input[name="card.number"]').waitFor({ state: 'visible' });
    await checkoutFrame.locator('button[data-testid="checkout-close"] [slot="pending"]').waitFor({ state: 'hidden', timeout: 30000 });
    await checkoutFrame.locator('button[data-testid="checkout-close"]').click();
    await checkout.waitFor({ state: 'hidden', timeout: 15000 });
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.includes('Proceed to Checkout') && !button.disabled));
    console.log('PASS: checkout cancellation dismisses modal and enables retry');
    await page.getByText('Browser Test Product', { exact: true }).waitFor();
    await page.screenshot({ path: path.resolve('../.integration/shopping-cancelled.png'), fullPage: true });
    const removed = page.waitForResponse(response => response.url().endsWith('/cart/remove/') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Remove' }).click();
    assert.equal((await removed).status(), 200);
    await page.getByText('Your cart is empty', { exact: true }).waitFor();
    console.log('PASS: cart removal and empty-cart display');
    await page.goto('http://localhost:5173/orders');
    await page.getByText('Browser Test Product', { exact: true }).waitFor();
    await page.screenshot({ path: path.resolve('../.integration/shopping-order-final.png'), fullPage: true });
    assert.deepEqual(pageErrors, []);
    console.log('PASS: existing order history remains visible; no page JavaScript errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
