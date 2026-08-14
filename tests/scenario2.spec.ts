import { test, expect } from '@fixtures/base';
import { addDaysToToday } from '@utils/dateHelper';
import { scenario1Data } from '@test-data/scenario1.data';
import { scenario2Data } from '@test-data/scenario2.data';

test('Scenario 2', async ({ homePage, searchResultsPage }) => {
  await test.step('Search Stockholm to reach results (precondition from Scenario 1)', async () => {
    await homePage.selectLanguage(scenario1Data.languageCode, scenario1Data.languageLabel);
    await homePage.selectCurrency(scenario2Data.currencyCode);
    await homePage.enterDestination(scenario1Data.destination);
    await homePage.setOccupancy(scenario1Data.adults, scenario1Data.childrenAges);
    const checkIn = addDaysToToday(scenario1Data.checkInOffsetDays);
    const checkOut = addDaysToToday(scenario1Data.checkOutOffsetDays);
    await homePage.selectDateRange(checkIn, checkOut);
    await homePage.clickSearch();
  });

  await test.step('Set Budget per night Min 2000 SEK - Max 10000 SEK', async () => {
    await searchResultsPage.setBudgetRange(scenario2Data.minBudgetSek, scenario2Data.maxBudgetSek);
  });

  await test.step('Use Meals filter box and select Breakfast included checkbox', async () => {
    await searchResultsPage.filterByBreakfastIncluded();
  });

  await test.step('Click show results', async () => {
    await searchResultsPage.clickShowResults();
    await expect(searchResultsPage.propertyCards.first()).toBeVisible();
  });
});
