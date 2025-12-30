import { test, expect } from '@playwright/test';

test.describe('OTP send UX (preview)', () => {
  test('demo page: clicking send OTP should advance to OTP step OR show an error', async ({
    page,
  }) => {
    // If baseURL isn't configured, fail loudly (misconfigured workflow).
    await page.goto('/demo', { waitUntil: 'domcontentloaded' });

    const cta = page.locator('.cta-section');

    // Start auth flow
    await cta.getByRole('button', { name: /^sign in$/i }).click();
    await cta.getByRole('button', { name: /^email$/i }).click();

    await cta.getByPlaceholder('enter your email').fill('e2e@example.com');
    await cta.getByRole('button', { name: /send otp/i }).click();

    // We accept either outcome:
    // - OTP screen renders (meaning flow advanced)
    // - An error message is shown (meaning it failed, but not silently)
    const otpPrompt = cta.getByText(/enter the 6-digit code sent to/i);
    const errorBox = cta.locator('.error');

    await expect(otpPrompt.or(errorBox)).toBeVisible();
  });
});


