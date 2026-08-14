const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://www.booking.com', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3000);
  // dismiss cookie banner if present
  try {
    await page.getByRole('button', { name: /Accept/i }).click({ timeout: 5000 });
  } catch (e) { console.log('no cookie banner'); }
  try {
    await page.keyboard.press('Escape'); // dismiss sign-in modal
  } catch (e) {}
  await page.waitForTimeout(1000);
  const snapshot = await page.locator('form').first().innerHTML().catch(()=>null);
  console.log('---FORM HTML (truncated 4000)---');
  console.log(snapshot ? snapshot.slice(0,4000) : 'NO FORM FOUND');
  await browser.close();
})();
