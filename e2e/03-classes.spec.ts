import { test, expect } from '@playwright/test';

test.describe('Atria Fitness MVP E2E - Classes and Calendar', () => {

    test('Calendar page redirects to login when not authenticated', async ({ page }) => {
        await page.goto('/dashboard/calendar');
        await expect(page).toHaveURL(/.*\/login/);
    });

});
