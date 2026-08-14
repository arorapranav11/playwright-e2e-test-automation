import { test, expect } from '@fixtures/base';
import { addDaysToToday } from '@utils/dateHelper';
import { scenario1Data } from '@test-data/scenario1.data';

test('Scenario 1', async ({ homePage, searchResultsPage }) => {
  await test.step('Select language as English US', async () => {
    await homePage.selectLanguage(scenario1Data.languageCode, scenario1Data.languageLabel);
  });

  await test.step('Enter destination', async () => {
    await homePage.enterDestination(scenario1Data.destination);
  });

  await test.step('Select 2 adults and 1 children, select age as 8', async () => {
    await homePage.setOccupancy(scenario1Data.adults, scenario1Data.childrenAges);
  });

  await test.step('Select check-in and check-out dates', async () => {
    const checkIn = addDaysToToday(scenario1Data.checkInOffsetDays);
    const checkOut = addDaysToToday(scenario1Data.checkOutOffsetDays);
    await homePage.selectDateRange(checkIn, checkOut);
  });

  await test.step('Click search and verify results are displayed without registration', async () => {
    await homePage.clickSearch();
    await expect(searchResultsPage.mainHeading).toContainText(scenario1Data.destination, {
      ignoreCase: true,
    });
    await expect(homePage.page).not.toHaveURL(/\/sign|\/register/i);
  });
});
