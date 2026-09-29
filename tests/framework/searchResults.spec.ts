import { test, expect } from '@playwright/test';
import { SearchResultsPage } from '@pages/SearchResultsPage';

// Synthetic DOM checks isolate extraction logic from Booking.com's availability.
test('extracts scores without merging review counts and finds the first minimum', async ({ page }) => {
  await page.setContent(`
    <div data-testid="property-card"><h2 data-testid="title">Higher</h2><div data-testid="review-score">Scored 8.9 8.9Excellent 1,234 reviews</div></div>
    <div data-testid="property-card"><h2 data-testid="title"> Lower </h2><div data-testid="review-score">Scored 6.2 6.2Pleasant 500 reviews</div></div>
    <div data-testid="property-card"><h2 data-testid="title">Tied</h2><div data-testid="review-score">Scored 6.2</div></div>
    <div data-testid="property-card"><h2 data-testid="title">Perfect</h2><div data-testid="review-score">Scored 10</div></div>
    <div data-testid="property-card"><h2 data-testid="title">Unrated</h2></div>
    <div data-testid="property-card"><h2 data-testid="title">Invalid</h2><div data-testid="review-score">No score</div></div>
    <div data-testid="property-card"><h2 data-testid="title">Reviews only</h2><div data-testid="review-score">500 reviews</div></div>
    <div data-testid="property-card"><h2 data-testid="title">Zero</h2><div data-testid="review-score">0</div></div>
    <div data-testid="property-card"><h2 data-testid="title"> </h2><div data-testid="review-score">Scored 4.0</div></div>
  `);
  const results = new SearchResultsPage(page);
  expect(await results.getPropertyRatings()).toEqual([
    { name: 'Higher', rating: 8.9 },
    { name: 'Lower', rating: 6.2 },
    { name: 'Tied', rating: 6.2 },
    { name: 'Perfect', rating: 10 },
  ]);
  expect(await results.findLowestRatedProperty()).toEqual({ name: 'Lower', rating: 6.2 });
});

for (const [label, markup] of [
  ['empty results', ''],
  ['unrated results', '<div data-testid="property-card"><h2 data-testid="title">Unrated</h2></div>'],
]) {
  test(`reports a useful error for ${label}`, async ({ page }) => {
    await page.setContent(markup);
    await expect(new SearchResultsPage(page).findLowestRatedProperty()).rejects.toThrow(
      'No rated properties found in the currently loaded results.'
    );
  });
}
