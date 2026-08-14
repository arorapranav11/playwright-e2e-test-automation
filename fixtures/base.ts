import { test as base, expect } from '@playwright/test';
import { HomePage } from '@pages/HomePage';
import { SearchResultsPage } from '@pages/SearchResultsPage';

type Fixtures = {
  homePage: HomePage;
  searchResultsPage: SearchResultsPage;
};

export const test = base.extend<Fixtures>({
  homePage: async ({ page }, use) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    await homePage.dismissCookieConsent();
    await use(homePage);
  },
  searchResultsPage: async ({ page }, use) => {
    await use(new SearchResultsPage(page));
  },
});

export { expect };
