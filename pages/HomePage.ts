import { expect, Locator, Page } from '@playwright/test';
import { toCalendarDateAttr } from '@utils/dateHelper';

export class HomePage {
  readonly page: Page;
  readonly cookieAcceptButton: Locator;
  readonly languagePickerTrigger: Locator;
  readonly currencyPickerTrigger: Locator;
  readonly destinationInput: Locator;
  readonly autocompleteOptions: Locator;
  readonly occupancyConfigButton: Locator;
  readonly datesContainer: Locator;
  readonly calendarNextMonthButton: Locator;
  readonly searchButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cookieAcceptButton = page.getByRole('button', { name: /Accept/i });
    this.languagePickerTrigger = page.locator('[data-testid="header-language-picker-trigger"]');
    this.currencyPickerTrigger = page.locator('[data-testid="header-currency-picker-trigger"]');
    this.destinationInput = page.locator('#searchbox-horizontal-destination-input');
    this.autocompleteOptions = page.locator('[data-testid="autocomplete-result"]');
    this.occupancyConfigButton = page.locator('[data-testid="occupancy-config"]');
    this.datesContainer = page.locator('[data-testid="searchbox-dates-container"]');
    this.calendarNextMonthButton = page.getByRole('button', { name: 'Next month' });
    this.searchButton = page.getByRole('button', { name: 'Search', exact: true });
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async dismissCookieConsent(): Promise<void> {
    try {
      await this.cookieAcceptButton.click({ timeout: 5000 });
    } catch {
      // banner not shown for this session/region
    }
    // A sign-in promo overlay can be present in the DOM and intercept clicks
    // even when not obviously visible; Escape closes it if it exists.
    await this.page.keyboard.press('Escape');
  }

  async selectLanguage(languageCode: string, languageLabel: string): Promise<void> {
    // The picker can list the target language in both a "Suggested" group
    // and the full alphabetical list, so scope to the first match.
    const languageOption = this.page
      .locator(`[data-testid="selection-item"][lang="${languageCode}"]`)
      .first();
    await this.selectHeaderPickerOption(
      this.languagePickerTrigger,
      languageOption,
      `Language: ${languageLabel}`
    );
  }

  async selectCurrency(currencyCode: string): Promise<void> {
    // Currency labels are localized, but the currency code itself (e.g. "SEK")
    // is always rendered in Latin script, so match on that instead.
    const currencyOption = this.page
      .locator('[data-testid="selection-item"]')
      .filter({ hasText: currencyCode })
      .first();
    await this.selectHeaderPickerOption(this.currencyPickerTrigger, currencyOption, new RegExp(currencyCode));
  }

  // Applying a language/currency redirects through an intermediate
  // confirmation page before landing back on the target locale, so the
  // trigger and picker can momentarily detach/re-attach or fail to open
  // mid-flight. Retry the full open-select-confirm interaction as one unit
  // until the trigger reports the expected value on a settled DOM.
  private async selectHeaderPickerOption(
    trigger: Locator,
    option: Locator,
    expectedAriaLabel: string | RegExp
  ): Promise<void> {
    await expect(async () => {
      // An empty focus-trap portal div can sit over the header and fail
      // Playwright's pointer-event interception check even though it has no
      // click handler of its own (most noticeable on Firefox); force past
      // that check rather than waiting on a dialog that isn't really there.
      await this.page.keyboard.press('Escape');
      await trigger.click({ timeout: 5_000, force: true });
      await option.click({ timeout: 5_000, force: true });
      await expect(trigger).toHaveAttribute('aria-label', expectedAriaLabel, { timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    await this.page.waitForLoadState('load');
    await this.destinationInput.waitFor({ state: 'visible' });
  }

  async enterDestination(destination: string): Promise<void> {
    // A trailing redirect from the language switch can land at any point and
    // silently wipe the field mid-type. Retry the whole type-then-select
    // interaction as one unit until a suggestion actually matching what was
    // typed is clicked, rather than guessing how many reloads to wait out.
    const matchingOption = this.autocompleteOptions.filter({ hasText: destination });
    await expect(async () => {
      // A timed sign-in overlay can appear between steps and intercept
      // clicks; clear it on every attempt, same as the header pickers.
      await this.page.keyboard.press('Escape');
      await this.destinationInput.click();
      await this.destinationInput.fill('');
      // fill() bypasses the app's keystroke listeners that trigger suggestion
      // fetching, so type it out to get real suggestions instead of defaults.
      await this.destinationInput.pressSequentially(destination);
      await matchingOption.first().click({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
  }

  async setOccupancy(adults: number, childrenAges: number[]): Promise<void> {
    await this.occupancyConfigButton.click();
    await this.setStepperValue('group_adults', adults);
    await this.setStepperValue('group_children', childrenAges.length);

    const ageSelects = this.page.locator('[data-testid="kids-ages-select"] select');
    for (let i = 0; i < childrenAges.length; i++) {
      await ageSelects.nth(i).selectOption(String(childrenAges[i]));
    }

    await this.occupancyConfigButton.click();
  }

  async selectDateRange(checkIn: Date, checkOut: Date): Promise<void> {
    await this.datesContainer.click();
    await this.selectCalendarDate(checkIn);
    await this.selectCalendarDate(checkOut);
  }

  async clickSearch(): Promise<void> {
    const urlBeforeSearch = this.page.url();
    await this.searchButton.click();
    await this.page.waitForURL((url) => url.toString() !== urlBeforeSearch, { timeout: 20000 });
    await this.page.waitForLoadState('load');
  }

  private async setStepperValue(inputId: string, targetValue: number): Promise<void> {
    const input = this.page.locator(`#${inputId}`);
    const stepperContainer = input.locator('xpath=..');
    const decrementButton = stepperContainer.locator('button').first();
    const incrementButton = stepperContainer.locator('button').last();

    let currentValue = Number(await input.getAttribute('aria-valuenow'));
    while (currentValue < targetValue) {
      await incrementButton.click();
      currentValue++;
    }
    while (currentValue > targetValue) {
      await decrementButton.click();
      currentValue--;
    }
  }

  private async selectCalendarDate(date: Date): Promise<void> {
    const dateCell = this.page.locator(`span[data-date="${toCalendarDateAttr(date)}"]`);
    const maxMonthsToAdvance = 24;
    for (let attempt = 0; attempt < maxMonthsToAdvance; attempt++) {
      if (await dateCell.isVisible()) {
        break;
      }
      await this.calendarNextMonthButton.click();
    }
    await dateCell.click();
  }
}
