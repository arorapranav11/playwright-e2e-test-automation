import { test, expect } from '@fixtures/base';
import { addDaysToToday } from '@utils/dateHelper';
import { scenario1Data } from '@test-data/scenario1.data';
import { scenario2Data } from '@test-data/scenario2.data';

test('Scenario 3', async ({ homePage, searchResultsPage }) => {
  await test.step('Reach filtered results (precondition from Scenario 1 and 2)', async () => {
    await homePage.selectLanguage(scenario1Data.languageCode, scenario1Data.languageLabel);
    await homePage.selectCurrency(scenario2Data.currencyCode);
    await homePage.enterDestination(scenario1Data.destination);
    await homePage.setOccupancy(scenario1Data.adults, scenario1Data.childrenAges);
    const checkIn = addDaysToToday(scenario1Data.checkInOffsetDays);
    const checkOut = addDaysToToday(scenario1Data.checkOutOffsetDays);
    await homePage.selectDateRange(checkIn, checkOut);
    await homePage.clickSearch();
    await searchResultsPage.setBudgetRange(scenario2Data.minBudgetSek, scenario2Data.maxBudgetSek);
    await searchResultsPage.filterByBreakfastIncluded();
    await searchResultsPage.clickShowResults();
  });

  await test.step('Find the lowest rated property without using the sort-by dropdown', async () => {
    // Reads every visible property card's rating directly and reduces to the
    // minimum in-memory, deliberately avoiding the "Property rating" sort control.
    const lowestRated = await searchResultsPage.findLowestRatedProperty();

    expect(lowestRated).toBeDefined();
    expect(lowestRated.rating).toBeGreaterThan(0);
    console.log(`Lowest rated property: ${lowestRated.name} (${lowestRated.rating})`);
  });
});
