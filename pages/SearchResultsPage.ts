import { Locator, Page } from '@playwright/test';

export class SearchResultsPage {
  readonly page: Page;
  readonly mainHeading: Locator;
  readonly propertyCards: Locator;
  readonly budgetGroup: Locator;
  readonly minBudgetSlider: Locator;
  readonly maxBudgetSlider: Locator;
  readonly mealsGroup: Locator;
  readonly breakfastIncludedCheckbox: Locator;
  readonly showResultsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mainHeading = page.locator('h1').first();
    this.propertyCards = page.locator('[data-testid="property-card"]');
    // Scoped via the filter group's own data attribute: "Budget" and
    // "Breakfast included" also appear duplicated under a "Popular filters"
    // shortcut group, so a role/name lookup alone would be ambiguous.
    this.budgetGroup = page.locator('[data-filters-group="price"]');
    this.minBudgetSlider = this.budgetGroup.getByRole('slider', { name: 'Min.', exact: true });
    this.maxBudgetSlider = this.budgetGroup.getByRole('slider', { name: 'Max.', exact: true });
    this.mealsGroup = page.locator('[data-filters-group="mealplan"]');
    this.breakfastIncludedCheckbox = this.mealsGroup.getByRole('checkbox', { name: /breakfast included/i });
    this.showResultsButton = page.getByRole('button', { name: /show results/i });
  }

  async setBudgetRange(min: number, max: number): Promise<void> {
    await this.setRangeSliderValue(this.minBudgetSlider, min);
    await this.setRangeSliderValue(this.maxBudgetSlider, max);
  }

  async filterByBreakfastIncluded(): Promise<void> {
    await this.breakfastIncludedCheckbox.check();
  }

  async clickShowResults(): Promise<void> {
    // Desktop layout applies filters live with no submit step; a "Show
    // results" button only appears on narrower/mobile-style filter drawers.
    if (await this.showResultsButton.isVisible()) {
      await this.showResultsButton.click();
    }
    await this.propertyCards.first().waitFor({ state: 'visible' });
  }

  async getPropertyRatings(): Promise<{ name: string; rating: number }[]> {
    const cards = await this.propertyCards.all();
    const results: { name: string; rating: number }[] = [];
    for (const card of cards) {
      const scoreLocator = card.locator('[data-testid="review-score"]');
      if ((await scoreLocator.count()) === 0) {
        continue;
      }
      const scoreText = await scoreLocator.first().textContent();
      const nameText = await card.locator('[data-testid="title"]').first().textContent();
      // Score text reads like "Scored 8.9 8.9Excellent 1,234 reviews"; take the
      // first decimal number rather than stripping non-digits (which would
      // concatenate the score and review count together).
      const match = (scoreText ?? '').match(/\d+(\.\d+)?/);
      const rating = match ? parseFloat(match[0]) : NaN;
      if (Number.isFinite(rating) && rating > 0 && rating <= 10 && nameText?.trim()) {
        results.push({ name: nameText.trim(), rating });
      }
    }
    return results;
  }

  async findLowestRatedProperty(): Promise<{ name: string; rating: number }> {
    const ratings = await this.getPropertyRatings();
    if (ratings.length === 0) {
      throw new Error('No rated properties found in the currently loaded results. Check result availability, review-score selectors, and locale.');
    }
    return ratings.reduce((lowest, current) => (current.rating < lowest.rating ? current : lowest));
  }

  private async setRangeSliderValue(slider: Locator, value: number): Promise<void> {
    await slider.evaluate((el: HTMLInputElement, targetValue: number) => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(el, String(targetValue));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }
}
