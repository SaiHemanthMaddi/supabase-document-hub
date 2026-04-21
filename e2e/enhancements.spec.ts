import { expect, test } from '@playwright/test';

test.describe('Enhancements Verification', () => {
  test('verifies dashboard enhancements and dark mode', async ({ page }) => {
    // Navigate to homepage (will redirect to auth if not logged in)
    await page.goto('/');

    // Since we're in a fresh browser, we need to sign in
    // With DEMO mode enabled, we can use any credentials
    if (page.url().includes('/auth')) {
      await page.getByLabel('Email').fill('demo@example.com');
      await page.getByLabel('Password').fill('password123');
      await page.getByRole('button', { name: 'Sign In' }).click();
    }

    // Wait for dashboard to load with a longer timeout
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible({
      timeout: 15000,
    });

    // Verify stat cards exist (look for specific titles)
    await expect(page.getByText('Total Documents')).toBeVisible();
    await expect(page.getByText('Storage Used')).toBeVisible();

    // Verify Theme Toggle exists and works
    const themeToggle = page.getByRole('button', { name: 'Toggle theme' });
    await expect(themeToggle).toBeVisible();

    // Open theme menu
    await themeToggle.click();
    await page.getByRole('menuitem', { name: 'Dark' }).click();

    // Wait for dark class to be added to html
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'), {
      timeout: 5000,
    });

    // Switch back to light
    await themeToggle.click();
    await page.getByRole('menuitem', { name: 'Light' }).click();
  });

  test('verifies documents page search and preview', async ({ page }) => {
    await page.goto('/documents');

    // Login if needed
    if (page.url().includes('/auth')) {
      await page.getByLabel('Email').fill('demo@example.com');
      await page.getByLabel('Password').fill('password123');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.goto('/documents');
    }

    // Wait for lazy loading
    await page.waitForLoadState('networkidle');

    // Verify search input
    await expect(page.getByTestId('search-documents')).toBeVisible({ timeout: 15000 });

    // Verify filter buttons
    await expect(page.getByRole('button', { name: 'All Files' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'PDFs' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Images' })).toBeVisible();

    // Check for preview button
    const firstRow = page.locator('.group').first();
    if ((await firstRow.count()) > 0) {
      await firstRow.hover();
      const previewButton = firstRow
        .locator('button')
        .filter({ has: page.locator('svg.lucide-eye') });
      await previewButton.click({ force: true });
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });
      await page.getByRole('button', { name: 'Close' }).click();
    }
  });

  test('verifies bookmarks page polish and preview', async ({ page }) => {
    await page.goto('/bookmarks');

    // Login if needed
    if (page.url().includes('/auth')) {
      await page.getByLabel('Email').fill('demo@example.com');
      await page.getByLabel('Password').fill('password123');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.goto('/bookmarks');
    }

    await expect(page.getByRole('heading', { name: 'Bookmarks' })).toBeVisible();

    // Check for preview button in bookmarks
    const previewButtons = page.locator('button').filter({ has: page.locator('svg.lucide-eye') });
    if ((await previewButtons.count()) > 0) {
      await previewButtons.first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: 'Close' }).click();
    }
  });
});
