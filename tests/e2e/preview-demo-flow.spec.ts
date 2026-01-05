import { test, expect } from '@playwright/test';
import {
  clickFaucetAndWaitForSuccess,
  requirePreviewBaseUrl,
  signInWithEmailOtpViaMailSlurp,
  waitForBalanceAtLeast,
} from './helpers/demo';

test.describe('Preview demo flow (email OTP + faucet + proof-gated denial)', () => {
  test('end-to-end demo: sign in, fund, attempt proof-gated content (expected deny), verify QR renders', async ({
    page,
  }) => {
    requirePreviewBaseUrl();

    await signInWithEmailOtpViaMailSlurp(page);

    await clickFaucetAndWaitForSuccess(page);
    await waitForBalanceAtLeast(page, 0.01);

    await page.getByRole('button', { name: /access proof-gated content/i }).click();

    const errorBox = page.locator('.error');
    await expect(errorBox).toBeVisible({ timeout: 60_000 });
    await expect(errorBox).toContainText(/proofs_required|access denied|proof[_ -]?gated/i);

    await expect(page.getByText(/ACCESS GRANTED/i)).toHaveCount(0);

    await page.getByRole('button', { name: /^verify$/i }).click();
    await expect(page.getByRole('heading', { name: /scan with self app/i })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole('button', { name: /regenerate qr code/i })).toBeVisible();
  });
});


