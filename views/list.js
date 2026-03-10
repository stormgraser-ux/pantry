import {
  getGroceryList, checkItem, uncheckItem, removeFromList, clearChecked,
  addToList, addAdHocToList, getPantryItems, getSections
} from '../db.js';
import { showToast } from '../app.js';

let _items = [];
let _pantryItems = [];
let _sections = [];
let _isAddingItem = false;
let _searchQuery = '';

export async function renderList() {
  const container = document.getElementById('view-list');
  if (!container) return;

  try {
    _items = await getGroceryList();
  } catch (e) {
    console.error('Failed to load grocery list:', e);
    const msg = document.createElement('div');
    msg.className = 'empty-state';
    msg.innerHTML = '';
    const icon = document.createElement('div');
    icon.className = 'empty-icon';
    icon.textContent = '⚠️';
    const title = document.createElement('div');
    title.className = 'empty-title';
    title.textContent = 'Connection error';
    const desc = document.createElement('div');
    desc.className = 'empty-desc';
    desc.textContent = 'Check your Supabase credentials in config.js';
    msg.append(icon, title, desc);
    container.textContent = '';
    container.append(msg);
    return;
  }

  updateClearBar();
  renderListContent(container);
}

function updateClearBar() {
  const bar = document.getElementById('clear-checked-bar');
  if (!bar) return;
  const checkedCount = _items.filter(i => i.checked).length;
  if (checkedCount > 0) {
    bar.classList.add('visible');
    bar.querySelector('.label').textContent = `${checkedCount} item${checkedCount !== 1 ? 's' : ''} checked`;
  } else {
    bar.classList.remove('visible');
  }
}

function renderListContent(container) {
  const unchecked = _items.filter(i => !i.checked);
  const checked = _items.filter(i => i.checked);

  container.textContent = '';

  if (_items.length === 0) {
    const empty = createEmptyState('🛒', 'Your list is empty', 'Tap + to add items from your pantry or something new.');
    container.append(empty);
    return;
  }

  // Spacer when clear bar is visible
  if (checked.length > 0) {
    const spacer = document.createElement('div');
    spacer.style.height = '48px';
    container.append(spacer);
  }

  const groups = groupBySection(unchecked);
  for (const [sectionName, sectionItems] of groups) {
    container.append(createSectionHeader(sectionName));
    for (const item of sectionItems) {
      container.append(createListItemEl(item));
    }
  }

  if (checked.length > 0) {
    const h = createSectionHeader('Checked');
    h.style.opacity = '0.5';
    container.append(h);
    for (const item of checked) {
      container.append(createListItemEl(item));
    }
  }
}

function createEmptyState(icon, title, desc) {
  const el = document.createElement('div');
  el.className = 'empty-state';
  const i = document.createElement('div'); i.className = 'empty-icon'; i.textContent = icon;
  const t = document.createElement('div'); t.className = 'empty-title'; t.textContent = title;
  const d = document.createElement('div'); d.className = 'empty-desc'; d.textContent = desc;
  el.append(i, t, d);
  return el;
}

function createSectionHeader(name) {
  const el = document.createElement('div');
  el.className = 'section-header';
  el.textContent = name;
  return el;
}

function createListItemEl(item) {
  const row = document.createElement('div');
  row.className = 'list-item' + (item.checked ? ' checked' : '');
  row.dataset.id = item.id;
  row.dataset.itemId = item.item_id || '';
  row.dataset.checked = String(item.checked);

  const cb = document.createElement('div');
  cb.className = 'checkbox' + (item.checked ? ' checked' : '');
  cb.textContent = item.checked ? '✓' : '';

  const name = document.createElement('span');
  name.className = 'item-name';
  name.textContent = item.name;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn btn-ghost list-remove';
  removeBtn.dataset.id = item.id;
  removeBtn.textContent = '×';
  removeBtn.style.cssText = 'padding:4px 8px;color:var(--text2);font-size:18px;';

  row.append(cb, name, removeBtn);

  row.addEventListener('click', async e => {
    if (e.target.closest('.list-remove')) return;
    const id = row.dataset.id;
    const itemId = row.dataset.itemId || null;
    const isChecked = row.dataset.checked === 'true';

    row.dataset.checked = String(!isChecked);
    if (!isChecked) {
      row.classList.add('checked');
      cb.classList.add('checked');
      cb.textContent = '✓';
    } else {
      row.classList.remove('checked');
      cb.classList.remove('checked');
      cb.textContent = '';
    }

    try {
      if (!isChecked) {
        await checkItem(id, itemId || null);
      } else {
        await uncheckItem(id, itemId || null);
      }
      updateClearBar();
    } catch (err) {
      console.error('Check error:', err);
      showToast('Error updating item');
      await renderList();
    }
  });

  removeBtn.addEventListener('click', async e => {
    e.stopPropagation();
    try {
      await removeFromList(item.id);
      _items = _items.filter(i => i.id !== item.id);
      const container = document.getElementById('view-list');
      renderListContent(container);
      updateClearBar();
    } catch (err) {
      showToast('Error removing item');
    }
  });

  return row;
}

function groupBySection(items) {
  const map = new Map();
  const sorted = [...items].sort((a, b) => {
    if (a.section_sort !== b.section_sort) return a.section_sort - b.section_sort;
    return a.name.localeCompare(b.name);
  });
  for (const item of sorted) {
    const key = item.section_name;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

// ── FAB / Add sheet ───────────────────────────────────────────────────────────

export function initListFab() {
  const fab = document.getElementById('list-fab');
  fab?.addEventListener('click', openAddSheet);

  const clearBtn = document.getElementById('clear-checked-btn');
  clearBtn?.addEventListener('click', async () => {
    try {
      await clearChecked();
      showToast('Cleared checked items');
      await renderList();
    } catch (e) {
      showToast('Error clearing items');
    }
  });
}

async function openAddSheet() {
  if (_isAddingItem) return;
  _isAddingItem = true;
  _searchQuery = '';

  try {
    [_pantryItems, _sections] = await Promise.all([getPantryItems(), getSections()]);
  } catch (e) {
    showToast('Could not load pantry items');
    _isAddingItem = false;
    return;
  }

  const backdrop = document.getElementById('add-sheet-backdrop');
  backdrop.textContent = '';

  // Build sheet DOM
  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const handle = document.createElement('div'); handle.className = 'sheet-handle';

  const titleRow = document.createElement('div');
  titleRow.className = 'sheet-title';
  titleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between';
  const titleText = document.createElement('span');
  titleText.textContent = 'Add to List';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-ghost';
  closeBtn.style.cssText = 'padding:4px 8px';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', closeAddSheet);
  titleRow.append(titleText, closeBtn);

  const search = document.createElement('input');
  search.className = 'search-input';
  search.id = 'add-search';
  search.placeholder = 'Search pantry or type new item…';
  search.autocomplete = 'off';

  const resultsEl = document.createElement('div');
  resultsEl.className = 'sheet-body';
  resultsEl.id = 'add-results';

  sheet.append(handle, titleRow, search, resultsEl);
  backdrop.append(sheet);
  backdrop.classList.add('open');

  search.focus();
  search.addEventListener('input', () => {
    _searchQuery = search.value.trim().toLowerCase();
    renderAddResults(backdrop, resultsEl);
  });

  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) closeAddSheet();
  });

  renderAddResults(backdrop, resultsEl);
}

function renderAddResults(backdrop, resultsEl) {
  const q = _searchQuery;
  resultsEl.textContent = '';

  const filtered = q
    ? _pantryItems.filter(p => p.name.toLowerCase().includes(q))
    : _pantryItems;

  if (q) {
    const alreadyOn = _items.some(i => i.name.toLowerCase() === q);
    if (!alreadyOn) {
      const row = document.createElement('div');
      row.className = 'list-item';
      row.style.cursor = 'pointer';

      const plus = document.createElement('span');
      plus.style.cssText = 'font-size:20px;min-width:24px';
      plus.textContent = '+';

      const label = document.createElement('span');
      label.className = 'item-name';
      label.textContent = `Add "${q}" as new item`;

      row.append(plus, label);
      row.addEventListener('click', () => handleAddAdhoc(q, backdrop, resultsEl));
      resultsEl.append(row);
    }
  }

  if (filtered.length === 0 && !q) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.style.padding = '32px';
    const d = document.createElement('div');
    d.className = 'empty-desc';
    d.textContent = 'No pantry items yet. Type to add something new.';
    empty.append(d);
    resultsEl.append(empty);
    return;
  }

  for (const item of filtered.slice(0, 50)) {
    const onList = _items.some(i => i.item_id === item.id);
    const row = document.createElement('div');
    row.className = 'list-item' + (onList ? ' checked' : '');
    row.style.cssText = `opacity:${onList ? 0.5 : 1};cursor:pointer`;
    row.dataset.id = item.id;
    row.dataset.section = item.section_id || '';

    const dot = document.createElement('span');
    dot.style.cssText = `width:8px;height:8px;background:${item.in_stock ? 'var(--accent)' : 'var(--warning)'};border-radius:50%;display:inline-block;flex-shrink:0`;

    const name = document.createElement('span');
    name.className = 'item-name';
    name.textContent = item.name;

    const chip = document.createElement('span');
    chip.className = 'item-section-chip';
    chip.textContent = item.section_name;

    row.append(dot, name, chip);

    if (onList) {
      const onListLabel = document.createElement('span');
      onListLabel.style.cssText = 'color:var(--text2);font-size:12px';
      onListLabel.textContent = 'on list';
      row.append(onListLabel);
    }

    row.addEventListener('click', async () => {
      if (onList) { showToast('Already on list'); return; }
      await handleAddPantry(item.id, item.section_id);
    });

    resultsEl.append(row);
  }
}

async function handleAddPantry(itemId, sectionId) {
  try {
    await addToList(itemId, sectionId);
    closeAddSheet();
    await renderList();
  } catch (e) {
    showToast('Error adding item');
  }
}

async function handleAddAdhoc(name, backdrop, resultsEl) {
  resultsEl.textContent = '';

  const inputGroup = document.createElement('div');
  inputGroup.className = 'input-group';
  inputGroup.style.marginTop = '16px';

  const label = document.createElement('div');
  label.className = 'input-label';
  label.textContent = 'Section';

  const select = document.createElement('select');
  select.className = 'select-input';
  select.id = 'adhoc-section';

  for (const s of _sections) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    select.append(opt);
  }

  inputGroup.append(label, select);

  const footer = document.createElement('div');
  footer.className = 'sheet-footer';

  const backBtn = document.createElement('button');
  backBtn.className = 'btn';
  backBtn.textContent = 'Back';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn btn-accent';
  confirmBtn.textContent = `Add "${name}"`;

  footer.append(backBtn, confirmBtn);
  resultsEl.append(inputGroup, footer);

  // Default to Unsorted
  const unsorted = _sections.find(s => s.name === 'Unsorted');
  if (unsorted) select.value = unsorted.id;

  backBtn.addEventListener('click', () => renderAddResults(backdrop, resultsEl));

  confirmBtn.addEventListener('click', async () => {
    const sectionId = select.value || null;
    try {
      await addAdHocToList(name, sectionId);
      closeAddSheet();
      await renderList();
    } catch (e) {
      showToast('Error adding item');
    }
  });
}

function closeAddSheet() {
  const backdrop = document.getElementById('add-sheet-backdrop');
  backdrop.classList.remove('open');
  backdrop.textContent = '';
  _isAddingItem = false;
}
