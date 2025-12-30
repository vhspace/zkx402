import { test, expect } from '@playwright/test';

async function pageDebugSummary(page: import('@playwright/test').Page) {
  const url = page.url();
  const title = await page.title().catch(() => '<no title>');
  const bodyText = await page
    .locator('body')
    .innerText()
    .catch(() => '<no body>');
  return {
    url,
    title,
    bodySnippet: bodyText.replace(/\s+/g, ' ').trim().slice(0, 600),
  };
}

test.describe('OTP send UX (preview)', () => {
  test('demo page: clicking send OTP should advance to OTP step OR show an error', async ({
    page,
  }) => {
    // In CI we *must* have a deployed Preview URL.
    if (process.env.CI && !process.env.PLAYWRIGHT_BASE_URL) {
      throw new Error('Missing PLAYWRIGHT_BASE_URL in CI (preview URL wiring failed).');
    }

    await page.goto('/demo', { waitUntil: 'domcontentloaded' });
    // Give client-side rendering a moment to settle.
    await page.waitForLoadState('networkidle').catch(() => {});

    // In Preview deployments, CDP env vars may not be set. The app should render a
    // visible error message instead of silently no-oping or crashing.
    const missingEnv = page.getByText(/Missing environment variable/i);

    // Otherwise, we should be able to start the auth flow.
    const signIn = page.getByRole('button', { name: /^sign in$/i }).first();

    // Also watch for common Preview failure modes so logs are actionable.
    const appError = page.getByText(/Application error: a client-side exception has occurred/i);
    const notFound = page.getByText(/404\s*:\s*NOT_FOUND|DEPLOYMENT_NOT_FOUND/i);
    const authRequired = page.getByText(/Authentication Required/i);

    await expect(async () => {
      const ok =
        (await missingEnv.isVisible().catch(() => false)) ||
        (await signIn.isVisible().catch(() => false));

      const fatal =
        (await appError.isVisible().catch(() => false)) ||
        (await notFound.isVisible().catch(() => false)) ||
        (await authRequired.isVisible().catch(() => false));

      if (ok) return;

      if (fatal) {
        const d = await pageDebugSummary(page);
        throw new Error(
          `Preview rendered an error screen (not an OTP UX regression). url=${d.url} title=${d.title} body=${d.bodySnippet}`,
        );
      }

      // Neither expected UI nor a known error yet; keep polling.
      throw new Error('Preview not in expected state yet');
    }).toPass({ timeout: 30_000 });

    if (await missingEnv.isVisible().catch(() => false)) {
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

    await expect(otpPrompt.or(errorBox).or(missingFlowIdHint)).toBeVisible({ timeout: 30_000 });
  });
});
