import { expect, type Page } from '@playwright/test';
import {
  extractSixDigitOtp,
  mailslurpCreateInbox,
  mailslurpDeleteInbox,
  mailslurpWaitForLatestEmail,
} from './mailslurp';

export function requirePreviewBaseUrl() {
  if (process.env.CI && !process.env.PLAYWRIGHT_BASE_URL) {
    throw new Error('Missing PLAYWRIGHT_BASE_URL in CI (preview URL wiring failed).');
  }
}

export async function signInWithEmailOtpViaMailSlurp(page: Page) {
  const inbox = await mailslurpCreateInbox({ expiresInMs: 15 * 60_000 });
  try {
    await page.goto('/demo', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    await page.getByRole('button', { name: /^sign in$/i }).first().click();
    await page.getByRole('button', { name: /^email$/i }).first().click();

    await page.getByPlaceholder('enter your email').fill(inbox.emailAddress);
    await page.getByRole('button', { name: /send otp/i }).click();

    await expect(page.getByText(/enter the 6-digit code sent to/i)).toBeVisible({
      timeout: 30_000,
    });

    const email = await mailslurpWaitForLatestEmail(inbox.id, { timeoutMs: 90_000 });
    const otp = extractSixDigitOtp(email);

    await page.getByPlaceholder('Enter OTP code').fill(otp);
    await page.getByRole('button', { name: /verify otp/i }).click();

    await expect(page.getByRole('button', { name: /^faucet$/i })).toBeVisible({
      timeout: 45_000,
    });
  } finally {
    await mailslurpDeleteInbox(inbox.id);
  }
}

export async function clickFaucetAndWaitForSuccess(page: Page) {
  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/faucet') && r.request().method() === 'POST' && r.status() === 200,
      { timeout: 90_000 },
    ),
    page.getByRole('button', { name: /^faucet$/i }).click(),
  ]);
  await resp.json().catch(() => {});
}

export async function waitForBalanceAtLeast(page: Page, amount: number) {
  await expect(async () => {
    const t = await page.locator('.balance-badge').innerText();
    const m = t.match(/([\d.]+)\s*USDC/i);
    const v = m ? Number(m[1]) : NaN;
    if (!Number.isFinite(v)) throw new Error(`Unparseable balance badge text: ${t}`);
    if (v < amount) throw new Error(`Balance ${v} < ${amount}`);
  }).toPass({ timeout: 120_000 });
}


