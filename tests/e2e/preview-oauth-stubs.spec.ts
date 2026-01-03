import { test, expect } from '@playwright/test';
import { requirePreviewBaseUrl } from './helpers/demo';

test.describe('Preview OAuth stubs', () => {
  test('demo sign-in sheet shows social providers', async ({ page }) => {
    requirePreviewBaseUrl();
    await page.goto('/demo', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^sign in$/i }).first().click();

    await expect(page.getByRole('button', { name: /^google$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^x$/i })).toBeVisible();
  });

  for (const provider of ['google', 'x', 'apple'] as const) {
    test(`oauth page renders for provider=${provider}`, async ({ page }) => {
      requirePreviewBaseUrl();
      await page.goto(`/oauth?provider=${provider}&next=%2Fdemo`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.getByText(new RegExp(`Provider:\\s*${provider}`, 'i'))).toBeVisible();
    });
  }
});


