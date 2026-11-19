document.addEventListener('DOMContentLoaded', () => {
  for (const image of document.querySelectorAll('.asset-image')) image.loading = 'eager';
});

window.addEventListener('load', () => {
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const cards = [...document.querySelectorAll('.asset')];
  const visible = () => cards.filter((card) => !card.hidden);
  const filter = (label) => [...document.querySelectorAll('.filter')]
    .find((button) => button.textContent === label);
  const exportButton = document.querySelector('#export-button');
  const dialog = document.querySelector('#asset-dialog');

  try {
    check(cards.length === assetCatalog.length && cards.length >= 2, 'catalog did not render');
    check(cards.every((card) => card.querySelector('img').naturalWidth > 0), 'preview failed to load');
    check(document.querySelectorAll('.filter-group').length === 3, 'filter groups are missing');

    filter('Окружение').click();
    filter('URP').click();
    check(visible().length === 1 && visible()[0].querySelector('.asset-title').textContent === 'City Adventure',
      'filter intersection did not match the sample');
    filter('Интерфейсы').click();
    check(visible().length === 0 && !document.querySelector('#empty-state').hidden, 'empty state is missing');
    filter('Все ассеты').click();
    check(visible().length === cards.length, 'filters did not reset');

    const asset = assetCatalog[0];
    cards[0].querySelector('.asset-button').click();
    check(dialog.open && dialog.querySelector('#detail-description').textContent === asset.description,
      'card details did not open');
    check(dialog.querySelector('#detail-link').href === asset.postUrl &&
      dialog.querySelector('#detail-store-link').href === asset.storeUrl, 'card links are incorrect');
    dialog.querySelector('.detail-close').click();
    check(!dialog.open, 'card details did not close');

    check(exportButton.hidden, 'export is visible with an empty selection');
    const first = cards[0].querySelector('.asset-select');
    const second = cards[1].querySelector('.asset-select');
    first.click();
    second.click();
    check(first.getAttribute('aria-pressed') === 'true' && !dialog.open, 'card selection did not toggle');
    filter('Окружение').click();
    check(cards[0].hidden && exportButton.textContent === 'Экспорт (2)', 'filtering cleared the selection');

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
      markdown.includes(item.title) && markdown.includes(item.postUrl) && markdown.includes(item.storeUrl)),
      'export omitted selected assets or their links');
    check(assetCatalog.slice(2).every((item) => !markdown.includes(item.postUrl)),
      'export included an unselected asset');

    filter('Все ассеты').click();
    first.click();
    second.click();
    check(exportButton.hidden, 'export stayed visible after deselection');
    check(document.documentElement.scrollWidth <= innerWidth, 'page overflows the viewport');
    const columns = getComputedStyle(document.querySelector('#gallery')).gridTemplateColumns.split(' ').length;
    check(columns === (innerWidth <= 560 ? 1 : 3), 'unexpected gallery layout');
    document.body.dataset.galleryCheck = 'passed';
  } catch (error) {
    document.body.dataset.galleryCheck = error.message;
  }
});
