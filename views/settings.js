import {
  getSections, addSection, updateSectionOrder, deleteSection
} from '../db.js';
import { showToast } from '../app.js';

let _sections = [];

export async function renderSettings() {
  const container = document.getElementById('view-settings');
  if (!container) return;

  try {
    _sections = await getSections();
  } catch (e) {
    container.textContent = '';
    const err = document.createElement('div');
    err.className = 'empty-state';
    const t = document.createElement('div'); t.className = 'empty-title'; t.textContent = 'Connection error';
    err.append(t);
    container.append(err);
    return;
  }

  container.textContent = '';
  container.append(buildSettingsContent());
}

function buildSettingsContent() {
  const frag = document.createDocumentFragment();

  const header = document.createElement('div');
  header.className = 'toolbar';
  const title = document.createElement('span');
  title.className = 'toolbar-title';
  title.textContent = 'Settings';
  header.append(title);
  frag.append(header);

  const sectionsDiv = document.createElement('div');
  sectionsDiv.className = 'settings-section';

  const sTitle = document.createElement('div');
  sTitle.className = 'settings-title';
  sTitle.textContent = 'Store Sections';

  const sNote = document.createElement('div');
  sNote.style.cssText = 'font-size:13px;color:var(--text2);margin-bottom:12px;line-height:1.5';
  sNote.textContent = 'Sections are sorted by their order number. Default sections match WinCo Foods store layout. Reorder them to match your store.';

  sectionsDiv.append(sTitle, sNote);

  for (let i = 0; i < _sections.length; i++) {
    sectionsDiv.append(buildSectionRow(_sections[i], i));
  }

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-accent w-full';
  addBtn.style.marginTop = '12px';
  addBtn.textContent = '+ Add Section';
  addBtn.addEventListener('click', openAddSectionSheet);
  sectionsDiv.append(addBtn);

  frag.append(sectionsDiv);

  // About section
  const aboutDiv = document.createElement('div');
  aboutDiv.className = 'settings-section';
  aboutDiv.style.borderTop = '1px solid var(--border)';

  const aTitle = document.createElement('div');
  aTitle.className = 'settings-title';
  aTitle.textContent = 'About';

  const aText = document.createElement('div');
  aText.style.cssText = 'font-size:14px;color:var(--text2);line-height:1.6';
  aText.textContent = 'Pantry — shared household grocery & meal planning. Data syncs in real time across devices via Supabase.';

  aboutDiv.append(aTitle, aText);
  frag.append(aboutDiv);

  return frag;
}

function buildSectionRow(section, index) {
  const row = document.createElement('div');
  row.className = 'section-row';
  row.dataset.id = section.id;

  const name = document.createElement('div');
  name.className = 'section-row-name';
  name.textContent = `${section.name}`;

  const order = document.createElement('div');
  order.style.cssText = 'font-size:12px;color:var(--text2);min-width:28px;text-align:center';
  order.textContent = section.sort_order;

  const btnGroup = document.createElement('div');
  btnGroup.style.display = 'flex';
  btnGroup.style.gap = '4px';

  const upBtn = document.createElement('button');
  upBtn.className = 'section-order-btn';
  upBtn.textContent = '↑';
  upBtn.disabled = index === 0;
  upBtn.addEventListener('click', async () => {
    if (index === 0) return;
    try {
      const above = _sections[index - 1];
      const current = _sections[index];
      const tmpOrder = above.sort_order;
      await Promise.all([
        updateSectionOrder(above.id, current.sort_order),
        updateSectionOrder(current.id, tmpOrder)
      ]);
      showToast('Reordered');
      await renderSettings();
    } catch (e) {
      showToast('Error reordering');
    }
  });

  const downBtn = document.createElement('button');
  downBtn.className = 'section-order-btn';
  downBtn.textContent = '↓';
  downBtn.disabled = index === _sections.length - 1;
  downBtn.addEventListener('click', async () => {
    if (index === _sections.length - 1) return;
    try {
      const below = _sections[index + 1];
      const current = _sections[index];
      const tmpOrder = below.sort_order;
      await Promise.all([
        updateSectionOrder(below.id, current.sort_order),
        updateSectionOrder(current.id, tmpOrder)
      ]);
      showToast('Reordered');
      await renderSettings();
    } catch (e) {
      showToast('Error reordering');
    }
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'section-order-btn';
  delBtn.style.cssText = 'color:var(--danger);border-color:var(--danger)';
  delBtn.textContent = '🗑';
  delBtn.title = 'Delete section';
  delBtn.addEventListener('click', async () => {
    if (!confirm(`Delete section "${section.name}"? Items in this section will move to Unsorted.`)) return;
    try {
      await deleteSection(section.id);
      await renderSettings();
    } catch (e) {
      showToast('Error deleting section');
    }
  });

  btnGroup.append(upBtn, downBtn, delBtn);
  row.append(name, order, btnGroup);
  return row;
}

function openAddSectionSheet() {
  const backdrop = document.getElementById('settings-add-sheet');
  backdrop.textContent = '';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const handle = document.createElement('div'); handle.className = 'sheet-handle';

  const titleRow = document.createElement('div');
  titleRow.className = 'sheet-title';
  titleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between';
  const titleText = document.createElement('span');
  titleText.textContent = 'Add Section';
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
  const nameLbl = document.createElement('div'); nameLbl.className = 'input-label'; nameLbl.textContent = 'Section name';
  const nameInput = document.createElement('input');
  nameInput.className = 'text-input';
  nameInput.placeholder = 'e.g. Frozen Foods';
  nameGroup.append(nameLbl, nameInput);

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
  addBtn.textContent = 'Add Section';
  addBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    try {
      await addSection(name);
      backdrop.classList.remove('open');
      backdrop.textContent = '';
      await renderSettings();
      showToast('Section added');
    } catch (e) {
      showToast('Error adding section');
    }
  });
  footer.append(cancelBtn, addBtn);

  sheet.append(handle, titleRow, nameGroup, footer);
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
