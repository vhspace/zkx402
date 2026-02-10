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

    try {
      await signInWithEmailOtpViaMailSlurp(page);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('OTP_SEND_FAILED')) {
        test.skip(true, 'OTP send failed in preview; skipping email OTP demo-flow E2E.');
        return;
      }
      if (msg.includes('MAILSLURP_CREATE_INBOX_QUOTA_EXCEEDED')) {
        test.skip(true, 'MailSlurp CreateInbox quota exceeded; skipping OTP sign-in E2E in preview.');
        return;
      }
      throw e;
    }

    await clickFaucetAndWaitForSuccess(page);
    await waitForBalanceAtLeast(page, 0.01);

    await page.getByRole('button', { name: /access proof-gated content/i }).click();

    const errorBox = page.locator('.error');
    await expect(errorBox).toBeVisible({ timeout: 60_000 });
    await expect(errorBox).toContainText(/proofs_required|access denied|proof[_ -]?gated|verification required/i);

    await expect(page.getByText(/ACCESS GRANTED/i)).toHaveCount(0);

    await page.goto('/verify', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    // QR may require manual generation in Preview if contracts aren't configured.
    const genBtn = page.getByRole('button', { name: /generate qr code/i });
    if (await genBtn.isVisible().catch(() => false)) {
      await genBtn.click();
    }
    await expect(page.getByRole('heading', { name: /scan with self app/i })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole('button', { name: /regenerate qr code/i })).toBeVisible();
  });
});


