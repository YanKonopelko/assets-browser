document.addEventListener('DOMContentLoaded', () => {
  for (const image of document.querySelectorAll('.asset-image')) image.loading = 'eager';
});

window.addEventListener('load', async () => {
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const cards = [...document.querySelectorAll('.asset')];
  const visible = () => cards.filter((card) => !card.hidden);
  const reset = () => document.querySelector('#all-filter').click();
  const options = [...document.querySelectorAll('.filter-group .filter')].map((button) => ({
    button,
    category: button.closest('.filter-group').getAttribute('aria-labelledby').replace('filter-category-', ''),
    label: button.textContent,
  }));
  const matches = (asset, option) => asset.tags[option.category]?.includes(option.label) ?? false;
  const exportButton = document.querySelector('#export-button');
  const dialog = document.querySelector('#asset-dialog');
  const search = document.querySelector('#asset-search');
  const searchForm = document.querySelector('#asset-search-form');
  const submitSearch = searchForm.querySelector('button[type="submit"]');
  const clearSearch = document.querySelector('#clear-search');
  const searchFor = (text) => {
    search.value = text;
    search.dispatchEvent(new Event('input', { bubbles: true }));
  };

  let result = 'passed';
  try {
    check(cards.length === assetCatalog.length && cards.length >= 2, 'catalog did not render');
    await Promise.all(cards.map(async (card) => {
      const preview = card.querySelector('img[src]');
      if (preview) await preview.decode();
    }));
    check(document.querySelectorAll('.filter-group').length === 3, 'filter groups are missing');

    const asset = assetCatalog[0];
    const [firstFilter, secondFilter] = options.filter((option) => matches(asset, option));
    firstFilter.button.click();
    secondFilter.button.click();
    const expected = cards.filter((card, index) => [firstFilter, secondFilter]
      .every((option) => matches(assetCatalog[index], option)));
    check(visible().length === expected.length && visible().every((card, index) => card === expected[index]),
      'filter intersection did not match the catalog');
    for (const { button } of options) {
      if (button.getAttribute('aria-pressed') === 'false') button.click();
      if (!visible().length) break;
    }
    check(visible().length === 0 && !document.querySelector('#empty-state').hidden, 'empty state is missing');
    reset();
    check(visible().length === cards.length, 'filters did not reset');

    searchFor('FPS');
    const fpsCards = visible();
    check(fpsCards.length > 0 && fpsCards.length < cards.length, 'typing FPS did not narrow the catalog');
    reset();
    search.value = 'FPS';
    submitSearch.click();
    check(visible().length === fpsCards.length && visible().every((card, index) => card === fpsCards[index]),
      'the magnifier did not run the search');
    check(parseInt(document.querySelector('#result-count').textContent, 10) === fpsCards.length,
      'the magnifier did not update the count');

    searchFor(asset.title.slice(0, 7).toUpperCase());
    check(!cards[0].hidden && visible().length < cards.length, 'title search did not match a partial query');
    searchFor(`  ${asset.title.split(' ')[0]}   ${asset.description.match(/[а-яё]{10,}/i)[0]}  `);
    check(!cards[0].hidden && visible().length < cards.length, 'search did not combine title and description');
    searchFor(firstFilter.label.toUpperCase());
    check(!cards[0].hidden && visible().length < cards.length, 'search did not match a tag');
    searchFor(asset.storeUrl);
    check(visible().length === 1 && visible()[0] === cards[0], 'search did not match the store URL');
    searchFor(asset.postUrl);
    check(visible().length === 1 && visible()[0] === cards[0], 'search did not match the Telegram URL');

    const conflictingFilter = options.find((option) => !matches(asset, option));
    conflictingFilter.button.click();
    check(visible().length === 0 && !document.querySelector('#empty-state').hidden,
      'search did not combine with the tag filter');
    clearSearch.click();
    check(clearSearch.hidden && document.activeElement === search && conflictingFilter.button.getAttribute('aria-pressed') === 'true' &&
      visible().length > 0 && cards[0].hidden, 'clearing search changed the tag filter or lost focus');
    searchFor('zz-no-asset-match-123');
    reset();
    check(search.value === '' && visible().length === cards.length, 'reset did not clear search and filters');

    cards[0].querySelector('.asset-button').click();
    check(dialog.open && dialog.querySelector('#detail-description').textContent === asset.description,
      'card details did not open');
    const storeLink = dialog.querySelector('#detail-store-link');
    check(dialog.querySelector('#detail-link').href === asset.postUrl &&
      (asset.storeUrl ? storeLink.href === asset.storeUrl : storeLink.hidden), 'card links are incorrect');
    dialog.querySelector('.detail-close').click();
    check(!dialog.open, 'card details did not close');

    const noPreviewIndex = assetCatalog.findIndex((item) => !item.image);
    if (noPreviewIndex >= 0) {
      const card = cards[noPreviewIndex];
      check(!card.querySelector('.asset-no-preview').hidden && !card.querySelector('img'),
        'card without a preview is missing its placeholder');
      card.querySelector('.asset-button').click();
      check(dialog.querySelector('#detail-image').hidden, 'detail dialog retained another card’s preview');
      dialog.querySelector('.detail-close').click();
    }

    const relatedIndex = assetCatalog.findIndex((item) => item.relatedPosts?.length);
    if (relatedIndex >= 0) {
      const relatedAsset = assetCatalog[relatedIndex];
      const relatedUrl = new URL(String(relatedAsset.relatedPosts[0]), relatedAsset.postUrl).href;
      searchFor(relatedUrl);
      check(!cards[relatedIndex].hidden, 'search did not match a related Telegram post');
      reset();
      cards[relatedIndex].querySelector('.asset-button').click();
      const related = dialog.querySelector('#detail-related');
      const actual = [...related.querySelectorAll('a')].map((link) => link.href);
      check(!related.hidden && actual.length === relatedAsset.relatedPosts.length &&
        actual.every((url, index) => url === new URL(String(relatedAsset.relatedPosts[index]), relatedAsset.postUrl).href),
      'detail dialog omitted related Telegram posts');
      dialog.querySelector('.detail-close').click();
    }

    check(exportButton.hidden, 'export is visible with an empty selection');
    const first = cards[0].querySelector('.asset-select');
    const second = cards[1].querySelector('.asset-select');
    first.click();
    second.click();
    check(first.getAttribute('aria-pressed') === 'true' && !dialog.open, 'card selection did not toggle');
    conflictingFilter.button.click();
    check(cards[0].hidden && exportButton.textContent === 'Экспорт (2)', 'filtering cleared the selection');
    searchFor('zz-no-asset-match-123');
    check(visible().length === 0 && exportButton.textContent === 'Экспорт (2)', 'search cleared the selection');

    let markdown;
    let filename;
    window.Blob = class extends Blob {
      constructor(parts, options) {
        super(parts, options);
        markdown = parts.join('');
      }
    };
    HTMLAnchorElement.prototype.click = function () { filename = this.download; };
    exportButton.click();
    check(filename === 'selected-assets.md' && markdown.startsWith('# Выбранные ассеты'),
      'export did not create a Markdown file');
    check(assetCatalog.slice(0, 2).every((item) =>
      markdown.includes(item.title) && markdown.includes(item.postUrl) &&
      (!item.storeUrl || markdown.includes(item.storeUrl))),
      'export omitted selected assets or their links');
    check(assetCatalog.slice(2).every((item) => !markdown.includes(item.postUrl)),
      'export included an unselected asset');

    reset();
    first.click();
    second.click();
    check(exportButton.hidden, 'export stayed visible after deselection');
    check(document.documentElement.scrollWidth <= innerWidth, 'page overflows the viewport');
    const searchBox = search.getBoundingClientRect();
    const submitBox = submitSearch.getBoundingClientRect();
    const resetBox = document.querySelector('#all-filter').getBoundingClientRect();
    const countBox = document.querySelector('#result-count').getBoundingClientRect();
    check(searchBox.height >= 48 && submitBox.left > searchBox.right &&
      submitBox.width === submitBox.height && getComputedStyle(submitSearch).borderRadius === '50%',
    'the search button is not a circle to the right of the large field');
    if (innerWidth > 640) {
      check(searchBox.width > 480 && resetBox.right < searchBox.left && submitBox.right < countBox.left &&
        resetBox.top < searchBox.bottom && resetBox.bottom > searchBox.top,
      'the search is not between the reset button and the count');
    } else {
      check(resetBox.bottom < searchBox.top && searchBox.left === resetBox.left,
        'the search did not wrap to a full-width row');
    }
    const columns = getComputedStyle(document.querySelector('#gallery')).gridTemplateColumns.split(' ').length;
    check(columns === (innerWidth <= 560 ? 1 : 3), 'unexpected gallery layout');
  } catch (error) {
    result = error.message;
  }
  await fetch('/gallery-check', { method: 'POST', body: result });
});
