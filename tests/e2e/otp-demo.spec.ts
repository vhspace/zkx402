import { test, expect } from '@playwright/test';

test.describe('OTP send UX (preview)', () => {
  test('demo page: clicking send OTP should advance to OTP step OR show an error', async ({
    page,
  }) => {
    await page.goto('/demo', { waitUntil: 'domcontentloaded' });

    // In Preview deployments, CDP env vars may not be set. The app should render a
    // visible error message instead of silently no-oping or crashing.
    const missingEnv = page.getByText(/Missing environment variable/i);

    // Otherwise, we should be able to start the auth flow.
    const signIn = page.getByRole('button', { name: /^sign in$/i }).first();

    // Wait for either a usable UI (sign in) OR a visible configuration error.
    await expect(missingEnv.or(signIn)).toBeVisible();

    if (await missingEnv.isVisible()) {
      // This counts as "UI reacts" for Preview E2E: no silent failure.
      return;
    }

    // Start auth flow
    await signIn.click();
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
