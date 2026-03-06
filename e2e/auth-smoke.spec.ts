import { expect, test } from '@playwright/test';

test.describe('Auth page smoke', () => {
  test('renders sign-in defaults and forgot-password action', async ({ page }) => {
    await page.goto('/auth');

    await expect(page.getByRole('heading', { name: 'Document Hub' })).toBeVisible();
    await expect(page.getByText('Sign in to your account')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Forgot Password' })).toBeVisible();
  });

  test('toggles to sign-up mode and back to sign-in', async ({ page }) => {
    await page.goto('/auth');

    await page.getByRole('button', { name: "Don't have an account? Sign up" }).click();

    await expect(page.getByText('Create an account to get started')).toBeVisible();
    await expect(page.getByLabel('Display Name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();

    await page.getByRole('button', { name: 'Already have an account? Sign in' }).click();
    await expect(page.getByText('Sign in to your account')).toBeVisible();
  });
});
