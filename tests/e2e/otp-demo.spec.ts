import { test, expect } from '@playwright/test';

test.describe('OTP send UX (preview)', () => {
  test('demo page: clicking send OTP should advance to OTP step OR show an error', async ({
    page,
  }) => {
    await page.goto('/demo', { waitUntil: 'domcontentloaded' });

    // /demo currently bails out to client-side rendering in the HTML, so we avoid
    // strict scoping to a server-rendered container and instead look for the
    // first visible "sign in" button anywhere on the page.
    await expect(page.getByText(/zkx402 demo/i)).toBeVisible();

    // Start auth flow
    await page.getByRole('button', { name: /^sign in$/i }).first().click();
    await page.getByRole('button', { name: /^email$/i }).first().click();

    await page.getByPlaceholder('enter your email').fill('e2e@example.com');
    await page.getByRole('button', { name: /send otp/i }).click();

    // We accept either outcome:
    // - OTP screen renders (meaning flow advanced)
    // - An error message is shown (meaning it failed, but not silently)
    const otpPrompt = page.getByText(/enter the 6-digit code sent to/i);
    const errorBox = page.locator('.error');
    const missingFlowIdHint = page.getByText(/Missing flow id/i);

    await expect(otpPrompt.or(errorBox).or(missingFlowIdHint)).toBeVisible();
  });
});
