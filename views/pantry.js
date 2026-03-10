import {
  getPantryItems, getSections, addPantryItem,
  markRunningLow, markInStock, updateItemSection, deleteItem
} from '../db.js';
import { showToast } from '../app.js';

let _items = [];
let _sections = [];
let _filter = 'all'; // 'all' | 'low'

export async function renderPantry() {
  const container = document.getElementById('view-pantry');
  if (!container) return;

  try {
    [_items, _sections] = await Promise.all([getPantryItems(), getSections()]);
  } catch (e) {
    console.error('Pantry load error:', e);
    container.textContent = '';
    container.append(makeErrorState());
    return;
  }

  container.textContent = '';
  container.append(buildPantryContent());
}

function makeErrorState() {
  const el = document.createElement('div');
  el.className = 'empty-state';
  const icon = document.createElement('div'); icon.className = 'empty-icon'; icon.textContent = '⚠️';
  const t = document.createElement('div'); t.className = 'empty-title'; t.textContent = 'Connection error';
  el.append(icon, t);
  return el;
}

function buildPantryContent() {
  const frag = document.createDocumentFragment();

  // Toggle
  const toggleGroup = document.createElement('div');
  toggleGroup.className = 'toggle-group';

  const allBtn = document.createElement('button');
  allBtn.className = 'toggle-btn' + (_filter === 'all' ? ' active' : '');
  allBtn.textContent = 'All';
  allBtn.addEventListener('click', () => { _filter = 'all'; renderPantry(); });

  const lowBtn = document.createElement('button');
  lowBtn.className = 'toggle-btn' + (_filter === 'low' ? ' active' : '');
  lowBtn.textContent = 'Out & Low';
  lowBtn.addEventListener('click', () => { _filter = 'low'; renderPantry(); });

  toggleGroup.append(allBtn, lowBtn);
  frag.append(toggleGroup);

  const display = _filter === 'low' ? _items.filter(i => !i.in_stock) : _items;

  if (display.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const icon = document.createElement('div'); icon.className = 'empty-icon'; icon.textContent = '🏪';
    const t = document.createElement('div'); t.className = 'empty-title';
    t.textContent = _filter === 'low' ? 'Nothing out or low' : 'Pantry is empty';
    const d = document.createElement('div'); d.className = 'empty-desc';
    d.textContent = _filter === 'low' ? 'All stocked up!' : 'Tap + to add your first item.';
    empty.append(icon, t, d);
    frag.append(empty);
    return frag;
  }

  // Group by section
  const sorted = [...display].sort((a, b) => {
    if (a.section_sort !== b.section_sort) return a.section_sort - b.section_sort;
    return a.name.localeCompare(b.name);
  });

  const groups = new Map();
  for (const item of sorted) {
    const key = item.section_name;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  for (const [sectionName, items] of groups) {
    const header = document.createElement('div');
    header.className = 'section-header';
    header.textContent = sectionName;
    frag.append(header);

    for (const item of items) {
      frag.append(buildPantryRow(item));
    }
  }

  return frag;
}

function buildPantryRow(item) {
  const row = document.createElement('div');
  row.className = 'pantry-item';
  row.dataset.id = item.id;

  const name = document.createElement('span');
  name.className = 'pantry-item-name';
  name.textContent = item.name;

  const chip = document.createElement('span');
  chip.className = 'item-section-chip';
  chip.style.cursor = 'pointer';
  chip.title = 'Tap to change section';
  chip.textContent = item.section_name;
  chip.addEventListener('click', () => openSectionPicker(item));

  const actions = document.createElement('div');
  actions.className = 'pantry-actions';

  const lowBtn = document.createElement('button');
  lowBtn.className = 'pantry-btn pantry-btn-low';
  lowBtn.textContent = 'Low';
  lowBtn.style.display = item.in_stock ? 'inline-flex' : 'none';
  lowBtn.addEventListener('click', async () => {
    try {
      await markRunningLow(item.id, item.section_id);
      showToast(`${item.name} added to list`);
      await renderPantry();
    } catch (e) {
      showToast('Error marking low');
    }
  });

  const stockBtn = document.createElement('button');
  stockBtn.className = 'pantry-btn pantry-btn-stock';
  stockBtn.textContent = 'In Stock';
  stockBtn.style.display = !item.in_stock ? 'inline-flex' : 'none';
  stockBtn.addEventListener('click', async () => {
    try {
      await markInStock(item.id);
      showToast(`${item.name} marked in stock`);
      await renderPantry();
    } catch (e) {
      showToast('Error marking in stock');
    }
  });

  // Status indicator dot
  const dot = document.createElement('span');
  dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${item.in_stock ? 'var(--accent)' : 'var(--warning)'};flex-shrink:0`;

  actions.append(lowBtn, stockBtn);
  row.append(dot, name, chip, actions);
  return row;
}

function openSectionPicker(item) {
  const backdrop = document.getElementById('pantry-section-sheet');
  backdrop.textContent = '';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const handle = document.createElement('div'); handle.className = 'sheet-handle';

  const title = document.createElement('div');
  title.className = 'sheet-title';
  title.textContent = `Section for "${item.name}"`;

  const body = document.createElement('div');
  body.className = 'sheet-body';

  for (const s of _sections) {
    const row = document.createElement('div');
    row.className = 'list-item';
    row.style.cursor = 'pointer';
    if (s.id === item.section_id) row.style.color = 'var(--accent)';

    const check = document.createElement('span');
    check.textContent = s.id === item.section_id ? '✓' : '';
    check.style.cssText = 'width:24px;color:var(--accent);font-size:14px';

    const n = document.createElement('span');
    n.className = 'item-name';
    n.textContent = s.name;

    row.append(check, n);
    row.addEventListener('click', async () => {
      try {
        await updateItemSection(item.id, s.id);
        backdrop.classList.remove('open');
        backdrop.textContent = '';
        await renderPantry();
      } catch (e) {
        showToast('Error updating section');
      }
    });
    body.append(row);
  }

  sheet.append(handle, title, body);
  backdrop.append(sheet);
  backdrop.classList.add('open');

  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) {
      backdrop.classList.remove('open');
      backdrop.textContent = '';
    }
  }, { once: true });
}

export function initPantryFab() {
  const fab = document.getElementById('pantry-fab');
  fab?.addEventListener('click', openAddPantrySheet);
}

async function openAddPantrySheet() {
  const sections = await getSections();
  const backdrop = document.getElementById('pantry-add-sheet');
  backdrop.textContent = '';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const handle = document.createElement('div'); handle.className = 'sheet-handle';

  const titleRow = document.createElement('div');
  titleRow.className = 'sheet-title';
  titleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between';
  const titleText = document.createElement('span');
  titleText.textContent = 'Add Pantry Item';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-ghost';
  closeBtn.style.padding = '4px 8px';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => {
    backdrop.classList.remove('open');
    backdrop.textContent = '';
  });
  titleRow.append(titleText, closeBtn);

  const nameGroup = document.createElement('div');
  nameGroup.className = 'input-group';
  nameGroup.style.marginTop = '16px';
  const nameLbl = document.createElement('div'); nameLbl.className = 'input-label'; nameLbl.textContent = 'Item name';
  const nameInput = document.createElement('input');
  nameInput.className = 'text-input';
  nameInput.placeholder = 'e.g. Oat milk';
  nameGroup.append(nameLbl, nameInput);

  const secGroup = document.createElement('div');
  secGroup.className = 'input-group';
  const secLbl = document.createElement('div'); secLbl.className = 'input-label'; secLbl.textContent = 'Section';
  const secSelect = document.createElement('select');
  secSelect.className = 'select-input';
  for (const s of sections) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    secSelect.append(opt);
  }
  const unsorted = sections.find(s => s.name === 'Unsorted');
  if (unsorted) secSelect.value = unsorted.id;
  secGroup.append(secLbl, secSelect);

  const footer = document.createElement('div');
  footer.className = 'sheet-footer';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    backdrop.classList.remove('open');
    backdrop.textContent = '';
  });
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-accent';
  addBtn.textContent = 'Add Item';
  addBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    const sectionId = secSelect.value || null;
    try {
      await addPantryItem(name, sectionId);
      showToast('Item added');
      backdrop.classList.remove('open');
      backdrop.textContent = '';
      await renderPantry();
    } catch (e) {
      showToast('Error adding item');
    }
  });
  footer.append(cancelBtn, addBtn);

  sheet.append(handle, titleRow, nameGroup, secGroup, footer);
  backdrop.append(sheet);
  backdrop.classList.add('open');

  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) {
      backdrop.classList.remove('open');
      backdrop.textContent = '';
    }
  }, { once: true });

  nameInput.focus();
}
