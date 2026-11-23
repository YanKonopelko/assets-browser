const filters = document.querySelector('#filters');
const allFilter = document.querySelector('#all-filter');
const searchForm = document.querySelector('#asset-search-form');
const searchInput = document.querySelector('#asset-search');
const clearSearch = document.querySelector('#clear-search');
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
const detailRelated = document.querySelector('#detail-related');
const detailRelatedLinks = document.querySelector('#detail-related-links');
const activeTags = new Set();
const selectedAssets = new Set();
const pluralRules = new Intl.PluralRules('ru');
const assetForms = { one: 'ассет', few: 'ассета', many: 'ассетов', other: 'ассета' };
const defaultStoreLabel = 'Unity Asset Store';

function normalizeSearch(text) {
  return text.normalize('NFKC').toLowerCase().replaceAll('ё', 'е');
}

function tagLabels(tags) {
  return tags.map((tag) => {
    const label = document.createElement('span');
    label.className = 'tag-label';
    label.textContent = tag;
    return label;
  });
}

function relatedPostUrl(asset, id) {
  return new URL(String(id), asset.postUrl).href;
}

function openDetails(asset, tags) {
  detailImage.toggleAttribute('hidden', !asset.image);
  if (asset.image) {
    detailImage.src = asset.image;
    detailImage.alt = asset.imageAlt ?? `Превью ${asset.title}`;
  } else {
    detailImage.removeAttribute('src');
    detailImage.alt = '';
  }
  detailTitle.textContent = asset.title;
  detailTags.replaceChildren(...tagLabels(tags));
  detailDescription.textContent = asset.description;
  detailLink.href = asset.postUrl;
  detailStoreLink.hidden = !asset.storeUrl;
  if (asset.storeUrl) {
    detailStoreLink.href = asset.storeUrl;
    detailStoreLink.textContent = asset.storeLabel ?? defaultStoreLabel;
  } else {
    detailStoreLink.removeAttribute('href');
  }
  const relatedPosts = asset.relatedPosts ?? [];
  detailRelated.hidden = relatedPosts.length === 0;
  detailRelated.open = false;
  detailRelatedLinks.replaceChildren(...relatedPosts.map((id) => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = relatedPostUrl(asset, id);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `Пост №${id}`;
    item.append(link);
    return item;
  }));
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
  if (asset.image) {
    image.loading = 'lazy';
    image.src = asset.image;
  } else {
    image.remove();
    card.querySelector('.asset-no-preview').hidden = false;
  }
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
  const searchFields = [asset.title, asset.description, asset.imageAlt, ...tagNames];
  if (asset.postUrl) searchFields.push(detailLink.textContent, asset.postUrl);
  if (asset.storeUrl) searchFields.push(asset.storeLabel ?? defaultStoreLabel, asset.storeUrl);
  if (asset.relatedPosts?.length) {
    searchFields.push(detailRelated.querySelector('summary').textContent);
    for (const id of asset.relatedPosts) {
      searchFields.push(`Пост №${id}`, relatedPostUrl(asset, id));
    }
  }
  return {
    card,
    searchText: normalizeSearch(searchFields.join('\n')),
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
    if (asset.storeUrl) links.push(`- [${asset.storeLabel ?? defaultStoreLabel}](${asset.storeUrl})`);
    if (asset.postUrl) links.push(`- [Пост в Telegram](${asset.postUrl})`);
    for (const id of asset.relatedPosts ?? []) {
      links.push(`- [Пост №${id} в Telegram](${relatedPostUrl(asset, id)})`);
    }
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

searchInput.addEventListener('input', updateGallery);
searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  updateGallery();
});
clearSearch.addEventListener('click', () => {
  searchInput.value = '';
  searchInput.focus();
  updateGallery();
});

allFilter.addEventListener('click', () => {
  searchInput.value = '';
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
  const terms = normalizeSearch(searchInput.value).match(/\S+/g) ?? [];
  clearSearch.hidden = searchInput.value.length === 0;
  allFilter.setAttribute('aria-pressed', String(activeTags.size === 0 && terms.length === 0));
  for (const [tag, button] of filterButtons) {
    button.setAttribute('aria-pressed', String(activeTags.has(tag)));
  }

  const selectedTags = [...activeTags];
  let visible = 0;
  for (const { card, tagKeys, searchText } of cards) {
    card.hidden = !selectedTags.every((tag) => tagKeys.has(tag)) ||
      !terms.every((term) => searchText.includes(term));
    if (!card.hidden) visible += 1;
  }
  resultCount.textContent = `${visible} ${assetForms[pluralRules.select(visible)]}`;
  emptyState.hidden = visible > 0;
  emptyState.textContent = terms.length ? 'По запросу ничего не найдено.' : 'По выбранным тегам ничего не найдено.';
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
