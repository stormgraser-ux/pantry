import {
  getRecipes, getRecipeWithIngredients, addRecipe, deleteRecipe,
  addIngredient, removeIngredient, addMealToList,
  getMealPlan, addToPlan, removeFromPlan,
  getPantryItems, getSections
} from '../db.js';
import { showToast } from '../app.js';

let _recipes = [];
let _mealPlan = [];
let _expandedRecipe = null;
let _pendingPlanRecipe = null;
let _currentWeekStart = getMonday(new Date());

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export async function renderMeals() {
  const container = document.getElementById('view-meals');
  if (!container) return;

  try {
    [_recipes, _mealPlan] = await Promise.all([
      getRecipes(),
      getMealPlan(_currentWeekStart)
    ]);
  } catch (e) {
    console.error('Meals load error:', e);
    container.textContent = '';
    const err = document.createElement('div');
    err.className = 'empty-state';
    const t = document.createElement('div'); t.className = 'empty-title'; t.textContent = 'Connection error';
    err.append(t);
    container.append(err);
    return;
  }

  container.textContent = '';

  // Week header
  const weekHeader = document.createElement('div');
  weekHeader.className = 'toolbar';
  const weekLabel = document.createElement('span');
  weekLabel.className = 'toolbar-title';
  weekLabel.style.fontSize = '16px';
  const start = new Date(_currentWeekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  weekLabel.textContent = `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn btn-ghost';
  prevBtn.style.padding = '6px 10px';
  prevBtn.textContent = '‹';
  prevBtn.addEventListener('click', () => {
    const d = new Date(_currentWeekStart + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    _currentWeekStart = d.toISOString().split('T')[0];
    renderMeals();
  });

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-ghost';
  nextBtn.style.padding = '6px 10px';
  nextBtn.textContent = '›';
  nextBtn.addEventListener('click', () => {
    const d = new Date(_currentWeekStart + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    _currentWeekStart = d.toISOString().split('T')[0];
    renderMeals();
  });

  weekHeader.append(prevBtn, weekLabel, nextBtn);
  container.append(weekHeader);

  // Week grid
  const grid = document.createElement('div');
  grid.className = 'week-grid';

  for (let i = 0; i < 7; i++) {
    const plan = _mealPlan.filter(m => m.day_of_week === i + 1);
    const slot = document.createElement('div');
    slot.className = 'day-slot';

    const dayLbl = document.createElement('div');
    dayLbl.className = 'day-label';
    dayLbl.textContent = DAYS[i];
    slot.append(dayLbl);

    if (plan.length > 0) {
      for (const p of plan) {
        const rName = document.createElement('div');
        rName.className = 'day-recipe';
        rName.textContent = p.recipe_name;
        slot.append(rName);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'day-remove';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', async e => {
          e.stopPropagation();
          await removeFromPlan(p.id);
          renderMeals();
        });
        slot.append(removeBtn);
      }
    } else {
      const plus = document.createElement('div');
      plus.style.cssText = 'font-size:20px;color:var(--text2);margin-top:auto';
      plus.textContent = '+';
      slot.append(plus);

      slot.style.cursor = 'pointer';
      slot.addEventListener('click', () => {
        if (_pendingPlanRecipe) {
          addToPlan(_pendingPlanRecipe, _currentWeekStart, i + 1).then(() => {
            _pendingPlanRecipe = null;
            renderMeals();
          });
        } else {
          showToast('Tap "Plan this week" on a recipe first');
        }
      });
    }

    grid.append(slot);
  }

  container.append(grid);

  // Recipe library header
  const libHeader = document.createElement('div');
  libHeader.className = 'toolbar';
  libHeader.style.marginTop = '8px';
  const libTitle = document.createElement('span');
  libTitle.className = 'toolbar-title';
  libTitle.textContent = 'Recipes';
  const addRecipeBtn = document.createElement('button');
  addRecipeBtn.className = 'btn btn-accent';
  addRecipeBtn.textContent = '+ Recipe';
  addRecipeBtn.style.padding = '8px 14px';
  addRecipeBtn.addEventListener('click', openAddRecipeSheet);
  libHeader.append(libTitle, addRecipeBtn);
  container.append(libHeader);

  if (_recipes.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const icon = document.createElement('div'); icon.className = 'empty-icon'; icon.textContent = '🍽️';
    const t = document.createElement('div'); t.className = 'empty-title'; t.textContent = 'No recipes yet';
    const d = document.createElement('div'); d.className = 'empty-desc'; d.textContent = 'Add recipes to plan your meals and auto-populate your grocery list.';
    empty.append(icon, t, d);
    container.append(empty);
    return;
  }

  for (const recipe of _recipes) {
    container.append(await buildRecipeCard(recipe));
  }
}

async function buildRecipeCard(recipe) {
  const isExpanded = _expandedRecipe === recipe.id;

  const card = document.createElement('div');
  card.className = 'recipe-card' + (isExpanded ? ' expanded' : '');
  card.dataset.id = recipe.id;

  const header = document.createElement('div');
  header.className = 'recipe-card-header';

  const name = document.createElement('div');
  name.className = 'recipe-card-name';
  name.textContent = recipe.name;

  const chevron = document.createElement('div');
  chevron.className = 'recipe-card-chevron';
  chevron.textContent = '▾';

  header.append(name, chevron);
  header.addEventListener('click', async () => {
    if (_expandedRecipe === recipe.id) {
      _expandedRecipe = null;
    } else {
      _expandedRecipe = recipe.id;
    }
    await renderMeals();
    // Scroll to this card
    const updated = document.querySelector(`.recipe-card[data-id="${recipe.id}"]`);
    updated?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  card.append(header);

  if (isExpanded) {
    const body = document.createElement('div');
    body.className = 'recipe-card-body';

    let full;
    try {
      full = await getRecipeWithIngredients(recipe.id);
    } catch (e) {
      const err = document.createElement('div');
      err.style.cssText = 'padding:12px;color:var(--text2);font-size:14px';
      err.textContent = 'Could not load ingredients';
      body.append(err);
      card.append(body);
      return card;
    }

    if (full.ingredients.length === 0) {
      const none = document.createElement('div');
      none.style.cssText = 'padding:12px;color:var(--text2);font-size:14px';
      none.textContent = 'No ingredients yet.';
      body.append(none);
    } else {
      for (const ing of full.ingredients) {
        const row = document.createElement('div');
        row.className = 'ingredient-row';

        const dot = document.createElement('div');
        dot.className = 'ingredient-stock';
        if (ing.in_stock === true) dot.classList.add('in-stock');
        else if (ing.in_stock === false) dot.classList.add('out-of-stock');
        else dot.classList.add('unknown');

        const ingName = document.createElement('div');
        ingName.className = 'ingredient-name';
        ingName.textContent = ing.name;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-ghost';
        removeBtn.style.cssText = 'padding:2px 8px;font-size:16px;color:var(--text2)';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', async () => {
          await removeIngredient(ing.id);
          renderMeals();
        });

        row.append(dot, ingName);
        if (ing.quantity) {
          const qty = document.createElement('div');
          qty.className = 'ingredient-qty';
          qty.textContent = ing.quantity;
          row.append(qty);
        }
        row.append(removeBtn);
        body.append(row);
      }
    }

    // Add ingredient form
    const addIngRow = document.createElement('div');
    addIngRow.style.cssText = 'padding:12px 0 4px;display:flex;gap:8px;align-items:center';
    const ingInput = document.createElement('input');
    ingInput.className = 'text-input';
    ingInput.placeholder = 'Add ingredient…';
    ingInput.style.flex = '1';
    const qtyInput = document.createElement('input');
    qtyInput.className = 'text-input';
    qtyInput.placeholder = 'Qty';
    qtyInput.style.width = '60px';
    const addIngBtn = document.createElement('button');
    addIngBtn.className = 'btn btn-accent';
    addIngBtn.style.padding = '10px 12px';
    addIngBtn.textContent = '+';
    addIngBtn.addEventListener('click', async () => {
      const text = ingInput.value.trim();
      if (!text) return;
      await addIngredient(recipe.id, null, text, qtyInput.value.trim() || null);
      ingInput.value = '';
      qtyInput.value = '';
      renderMeals();
    });
    addIngRow.append(ingInput, qtyInput, addIngBtn);
    body.append(addIngRow);

    // Action buttons
    const actionRow = document.createElement('div');
    actionRow.style.cssText = 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap';

    const addToListBtn = document.createElement('button');
    addToListBtn.className = 'btn btn-warning';
    addToListBtn.textContent = '+ Missing to list';
    addToListBtn.addEventListener('click', async () => {
      try {
        const count = await addMealToList(recipe.id);
        showToast(count > 0 ? `${count} item${count !== 1 ? 's' : ''} added to list` : 'All ingredients in stock!');
      } catch (e) {
        showToast('Error adding to list');
      }
    });

    const planBtn = document.createElement('button');
    planBtn.className = 'btn btn-success';
    planBtn.textContent = _pendingPlanRecipe === recipe.id ? '✓ Tap a day' : 'Plan this week';
    planBtn.addEventListener('click', () => {
      if (_pendingPlanRecipe === recipe.id) {
        _pendingPlanRecipe = null;
        planBtn.textContent = 'Plan this week';
        showToast('Cancelled');
      } else {
        _pendingPlanRecipe = recipe.id;
        planBtn.textContent = '✓ Tap a day';
        showToast('Now tap a day slot above');
      }
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`Delete "${recipe.name}"?`)) return;
      await deleteRecipe(recipe.id);
      _expandedRecipe = null;
      renderMeals();
    });

    actionRow.append(addToListBtn, planBtn, deleteBtn);
    body.append(actionRow);

    card.append(body);
  }

  return card;
}

async function openAddRecipeSheet() {
  const backdrop = document.getElementById('meals-add-sheet');
  backdrop.textContent = '';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const handle = document.createElement('div'); handle.className = 'sheet-handle';

  const titleRow = document.createElement('div');
  titleRow.className = 'sheet-title';
  titleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between';
  const titleText = document.createElement('span');
  titleText.textContent = 'New Recipe';
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
  const nameLbl = document.createElement('div'); nameLbl.className = 'input-label'; nameLbl.textContent = 'Recipe name';
  const nameInput = document.createElement('input');
  nameInput.className = 'text-input';
  nameInput.placeholder = 'e.g. Chicken Stir Fry';
  nameGroup.append(nameLbl, nameInput);

  const notesGroup = document.createElement('div');
  notesGroup.className = 'input-group';
  const notesLbl = document.createElement('div'); notesLbl.className = 'input-label'; notesLbl.textContent = 'Notes (optional)';
  const notesInput = document.createElement('textarea');
  notesInput.className = 'text-input';
  notesInput.rows = 3;
  notesInput.style.resize = 'vertical';
  notesInput.placeholder = 'Instructions, links, tips…';
  notesGroup.append(notesLbl, notesInput);

  const footer = document.createElement('div');
  footer.className = 'sheet-footer';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    backdrop.classList.remove('open');
    backdrop.textContent = '';
  });
  const createBtn = document.createElement('button');
  createBtn.className = 'btn btn-accent';
  createBtn.textContent = 'Create Recipe';
  createBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    try {
      const recipe = await addRecipe(name, notesInput.value.trim() || null);
      _expandedRecipe = recipe.id;
      backdrop.classList.remove('open');
      backdrop.textContent = '';
      await renderMeals();
    } catch (e) {
      showToast('Error creating recipe');
    }
  });
  footer.append(cancelBtn, createBtn);

  sheet.append(handle, titleRow, nameGroup, notesGroup, footer);
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
