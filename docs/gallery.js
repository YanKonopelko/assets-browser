const filters = document.querySelector('#filters');
const allFilter = document.querySelector('#all-filter');
const gallery = document.querySelector('#gallery');
const template = document.querySelector('#asset-template');
const resultCount = document.querySelector('#result-count');
const emptyState = document.querySelector('#empty-state');
const exportButton = document.querySelector('#export-button');
const dialog = document.querySelector('#asset-dialog');
const detailImage = document.querySelector('#detail-image');
const detailTitle = document.querySelector('#detail-title');
const detailTags = document.querySelector('#detail-tags');
const detailDescription = document.querySelector('#detail-description');
const detailLink = document.querySelector('#detail-link');
const detailStoreLink = document.querySelector('#detail-store-link');
const activeTags = new Set();
const selectedAssets = new Set();
const pluralRules = new Intl.PluralRules('ru');
const assetForms = { one: 'ассет', few: 'ассета', many: 'ассетов', other: 'ассета' };

function tagLabels(tags) {
  return tags.map((tag) => {
    const label = document.createElement('span');
    label.className = 'tag-label';
    label.textContent = tag;
    return label;
  });
}

function openDetails(asset, tags) {
  detailImage.src = asset.image;
  detailImage.alt = asset.imageAlt;
  detailTitle.textContent = asset.title;
  detailTags.replaceChildren(...tagLabels(tags));
  detailDescription.textContent = asset.description;
  detailLink.href = asset.postUrl;
  detailStoreLink.hidden = !asset.storeUrl;
  if (asset.storeUrl) {
    detailStoreLink.href = asset.storeUrl;
  } else {
    detailStoreLink.removeAttribute('href');
  }
  dialog.showModal();
}

const cards = assetCatalog.map((asset, index) => {
  const card = template.content.firstElementChild.cloneNode(true);
  const button = card.querySelector('.asset-button');
  const selectButton = card.querySelector('.asset-select');
  const title = card.querySelector('.asset-title');
  const image = card.querySelector('.asset-image');
  const tagsContainer = card.querySelector('.asset-tags');
  const tagEntries = Object.entries(asset.tags);
  const tagNames = tagEntries.flatMap(([, labels]) => labels);
  title.id = `asset-title-${index + 1}`;
  tagsContainer.id = `asset-tags-${index + 1}`;
  title.textContent = asset.title;
  button.setAttribute('aria-labelledby', title.id);
  button.setAttribute('aria-describedby', tagsContainer.id);
  selectButton.setAttribute('aria-label', `Выбрать для экспорта «${asset.title}»`);
  image.src = asset.image;
  image.loading = 'lazy';
  card.querySelector('.asset-preview-text').textContent = asset.description;
  tagsContainer.append(...tagLabels(tagNames));
  button.addEventListener('click', () => openDetails(asset, tagNames));
  button.addEventListener('mouseleave', () => button.removeAttribute('data-preview-dismissed'));
  button.addEventListener('blur', () => button.removeAttribute('data-preview-dismissed'));
  selectButton.addEventListener('click', () => {
    const selected = !selectedAssets.delete(asset);
    if (selected) selectedAssets.add(asset);
    selectButton.setAttribute('aria-pressed', String(selected));
    selectButton.title = selected ? 'Убрать из экспорта' : 'Выбрать для экспорта';
    exportButton.hidden = selectedAssets.size === 0;
    exportButton.textContent = `Экспорт (${selectedAssets.size})`;
  });
  gallery.append(card);
  return {
    card,
    tagKeys: new Set(tagEntries.flatMap(([category, labels]) => labels.map((label) => `${category}:${label}`))),
  };
});

exportButton.addEventListener('click', () => {
  if (selectedAssets.size === 0) return;

  const entries = Array.from(selectedAssets, (asset, index) => {
    const tags = Object.values(asset.tags).flat().join(', ');
    const sections = [`## ${index + 1}. ${asset.title}`];
    if (tags) sections.push(`Теги — ${tags}`);
    sections.push(asset.description);

    const links = [];
    if (asset.storeUrl) links.push(`- [Unity Asset Store](${asset.storeUrl})`);
    if (asset.postUrl) links.push(`- [Пост в Telegram](${asset.postUrl})`);
    if (links.length) sections.push(links.join('\n'));

    return sections.join('\n\n');
  });
  const contents = ['# Выбранные ассеты', ...entries].join('\n\n');
  const file = new Blob([contents, '\n'], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'selected-assets.md';
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

allFilter.addEventListener('click', () => {
  activeTags.clear();
  updateGallery();
});
const filterButtons = new Map();
for (const [category, name] of Object.entries(tagCategories)) {
  const labels = new Set(assetCatalog.flatMap((asset) => asset.tags[category] ?? []));
  if (labels.size === 0) continue;

  const group = document.createElement('div');
  group.className = 'filter-group';
  group.setAttribute('role', 'group');
  const heading = document.createElement('span');
  heading.className = 'filter-heading';
  heading.id = `filter-category-${category}`;
  heading.textContent = name;
  group.setAttribute('aria-labelledby', heading.id);

  const options = document.createElement('div');
  options.className = 'filter-options';
  for (const label of labels) {
    const key = `${category}:${label}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter';
    button.textContent = label;
    button.addEventListener('click', () => {
      if (!activeTags.delete(key)) activeTags.add(key);
      updateGallery();
    });
    options.append(button);
    filterButtons.set(key, button);
  }
  group.append(heading, options);
  filters.append(group);
}

function updateGallery() {
  allFilter.setAttribute('aria-pressed', String(activeTags.size === 0));
  for (const [tag, button] of filterButtons) {
    button.setAttribute('aria-pressed', String(activeTags.has(tag)));
  }

  const selectedTags = [...activeTags];
  let visible = 0;
  for (const { card, tagKeys } of cards) {
    card.hidden = !selectedTags.every((tag) => tagKeys.has(tag));
    if (!card.hidden) visible += 1;
  }
  resultCount.textContent = `${visible} ${assetForms[pluralRules.select(visible)]}`;
  emptyState.hidden = visible > 0;
}

dialog.querySelector('.detail-close').addEventListener('click', () => dialog.close());
let pointerStartedOutside = false;
dialog.addEventListener('pointerdown', (event) => {
  pointerStartedOutside = event.target === dialog;
});
dialog.addEventListener('click', (event) => {
  if (pointerStartedOutside && event.target === dialog) dialog.close();
  pointerStartedOutside = false;
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || dialog.open) return;
  for (const button of gallery.querySelectorAll('.asset-button:hover, .asset-button:focus-visible')) {
    button.setAttribute('data-preview-dismissed', '');
  }
});

updateGallery();
