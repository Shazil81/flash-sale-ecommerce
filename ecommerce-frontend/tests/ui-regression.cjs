// Local browser regression: all API/payment responses are fixtures; no real charges.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    let detailMissing = false;
    page.on('pageerror', error => errors.push(error.message));
    const product = { id: 1, name: 'Everyday cotton shirt with a full product name', description: 'Full cotton product description for shoppers.', price: '1299.00', stock: 5, category_name: 'Clothing', image_url: '/missing.png' };
    let ordersFail = true;
    await context.route('**/api/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      let body = {}, status = 200;
      if (pathname.endsWith('/products/')) body = [product];
      else if (pathname.endsWith('/products/1/')) { body = detailMissing ? { error: 'Product not found' } : product; status = detailMissing ? 404 : 200; }
      else if (pathname.endsWith('/products/2/')) body = { ...product, id: 2 };
      else if (pathname.endsWith('/me/')) body = { username: 'qa', profile: { role: 'USER' } };
      else if (pathname.endsWith('/cart/')) body = { items: [{ id: 1, product, quantity: 1 }], total_price: '1299.00' };
      else if (pathname.endsWith('/orders/')) { body = ordersFail ? { error: 'Temporary outage' } : []; status = ordersFail ? 503 : 200; }
      else if (pathname.endsWith('/payments/')) body = [];
      else if (pathname.endsWith('/register/')) { body = { message: 'Registered' }; status = 201; }
      else if (pathname.endsWith('/payment/create-order/')) body = { order_id: 'order_fixture', amount: 129900, currency: 'INR', key: 'fixture' };
      else if (pathname.endsWith('/payment/status/order_fixture/')) body = { payment_status: 'FULFILLED' };
      else if (pathname.endsWith('/payment/verify/')) { body = { payment_status: 'PENDING' }; status = 202; }
      await route.fulfill({ status, json: body, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    });
    await context.route('https://checkout.razorpay.com/**', route => route.fulfill({ contentType: 'text/javascript', body: `window.Razorpay = function(options) { this.on = function() {}; this.open = function() { window.qaCheckout = options; const d = document.createElement('dialog'); d.textContent = 'Test checkout'; document.body.append(d); d.showModal(); d.addEventListener('cancel', () => { options.modal.ondismiss(); d.remove(); }); }; };` }));
    const origin = process.env.UI_TEST_URL || 'http://127.0.0.1:5174';
    await page.goto(origin);
    await page.getByRole('link', { name: product.name, exact: true }).waitFor();
    await page.getByRole('button', { name: 'Toggle navigation' }).tap();
    assert.equal(await page.getByRole('button', { name: 'Toggle navigation' }).getAttribute('aria-expanded'), 'true');
    await page.getByLabel('Search', { exact: true }).fill('cotton');
    assert(await page.getByLabel('Search', { exact: true }).isVisible());
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.goto(origin + '/products/1');
    await page.getByRole('heading', { name: product.name }).waitFor();
    assert(await page.getByText(product.description).isVisible());
    await page.waitForFunction(() => document.querySelector('.product-detail-image').src.endsWith('/product-placeholder.svg'));
    detailMissing = true;
    await page.reload();
    await page.getByRole('button', { name: 'Try again' }).waitFor();
    // Same mounted detail component must clear a previous request's error on URL change.
    await page.evaluate(() => { history.pushState({}, '', '/products/2'); dispatchEvent(new PopStateEvent('popstate')); });
    await page.getByRole('heading', { name: product.name }).waitFor();
    await page.goto(origin + '/login');
    await page.getByLabel('Username', { exact: true }).fill('qa');
    await page.getByLabel('Password', { exact: true }).fill('fixture-password');
    await page.getByRole('button', { name: 'Show password' }).click();
    assert.equal(await page.getByLabel('Password', { exact: true }).getAttribute('type'), 'text');
    await page.goto(origin + '/register');
    await page.getByRole('button', { name: 'Delivery Partner', exact: true }).click();
    await page.getByLabel('Username', { exact: true }).fill('qa');
    await page.getByLabel('Email', { exact: true }).fill('qa@example.com');
    await page.getByLabel('Mobile Number', { exact: true }).fill('9999999999');
    await page.getByLabel('Password', { exact: true }).fill('fixture-password');
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await page.waitForURL('**/delivery-login');
    await page.evaluate(() => { sessionStorage.setItem('access_token', 'fixture'); sessionStorage.setItem('username', 'qa'); sessionStorage.setItem('role', 'USER'); });
    await page.goto(origin + '/orders');
    await page.getByRole('button', { name: 'Try again' }).waitFor();
    assert.equal(await page.getByText("You haven't placed any orders yet.").count(), 0);
    ordersFail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByText("You haven't placed any orders yet.").waitFor();
    await page.goto(origin + '/cart');
    for (const [label, value] of [['House or building', '12'], ['Street or area', 'Test Street'], ['Town or city', 'Delhi'], ['Pincode', '110001'], ['Mobile number', '9999999999']]) await page.getByLabel(label, { exact: true }).fill(value);
    const checkout = page.getByRole('button', { name: 'Proceed to Checkout' });
    await checkout.click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    await page.getByText('Checkout closed. Your cart has been kept.').waitFor();
    assert(await checkout.isEnabled());
    assert.equal(await page.evaluate(() => sessionStorage.getItem('pending_payment_order')), null);
    await checkout.click();
    await page.getByRole('dialog').waitFor();
    await page.evaluate(async () => { document.querySelector('dialog').remove(); await window.qaCheckout.handler({ razorpay_order_id: 'order_fixture', razorpay_payment_id: 'pay_fixture', razorpay_signature: 'fixture' }); });
    assert(new URL(page.url()).pathname === '/cart', '202 must not claim a completed order');
    await page.getByRole('button', { name: /Check payment status/i }).click();
    await page.waitForURL('**/orders');
    const folder = path.resolve(__dirname, '../../.integration/fixed-ui');
    fs.mkdirSync(folder, { recursive: true });
    await page.goto(origin);
    await page.getByRole('link', { name: product.name, exact: true }).waitFor();
    await page.screenshot({ path: path.join(folder, 'mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(folder, 'desktop.png'), fullPage: true });
    const contrast = await page.locator('.category-pill.active').evaluate(element => {
      const style = getComputedStyle(element);
      const luminance = color => color.match(/\d+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
      const a = luminance(style.color), b = luminance(style.backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    assert(contrast >= 4.5, `Category text contrast ${contrast}`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.category-pill').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    assert.deepEqual(errors, []);
    console.log('PASS: mobile navigation, search, product details, login labels/password, delivery registration, order error/retry, checkout cancellation, pending capture and payment recovery; no uncaught browser errors.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
