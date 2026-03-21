import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Sections ──────────────────────────────────────────────────────────────────

export async function getSections() {
  const { data, error } = await supabase
    .from('sections')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function addSection(name) {
  const sections = await getSections();
  const maxOrder = sections.reduce((m, s) => Math.max(m, s.sort_order), 0);
  const { data, error } = await supabase
    .from('sections')
    .insert({ name, sort_order: maxOrder + 1 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSectionOrder(id, newOrder) {
  const { error } = await supabase
    .from('sections')
    .update({ sort_order: newOrder })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSection(id) {
  const { error } = await supabase
    .from('sections')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Grocery List ──────────────────────────────────────────────────────────────

export async function getGroceryList() {
  // Fetch grocery_list rows joined with sections for sort order
  const { data, error } = await supabase
    .from('grocery_list')
    .select(`
      id,
      item_id,
      ad_hoc_name,
      section_id,
      checked,
      added_at,
      items (
        id,
        name,
        in_stock,
        notes
      ),
      sections (
        id,
        name,
        sort_order
      )
    `)
    .order('added_at');
  if (error) throw error;

  // Normalize: resolve display name and section
  return data.map(row => ({
    id: row.id,
    item_id: row.item_id,
    name: row.items?.name || row.ad_hoc_name,
    notes: row.items?.notes || null,
    section_id: row.section_id,
    section_name: row.sections?.name || 'Unsorted',
    section_sort: row.sections?.sort_order ?? 99,
    checked: row.checked,
    added_at: row.added_at
  }));
}

export async function addToList(itemId, sectionId) {
  // Don't add if already on list
  const { data: existing } = await supabase
    .from('grocery_list')
    .select('id')
    .eq('item_id', itemId)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from('grocery_list')
    .insert({ item_id: itemId, section_id: sectionId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addAdHocToList(name, sectionId) {
  const { data, error } = await supabase
    .from('grocery_list')
    .insert({ ad_hoc_name: name, section_id: sectionId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function checkItem(id, itemId) {
  // Set list row checked
  const { error: listError } = await supabase
    .from('grocery_list')
    .update({ checked: true })
    .eq('id', id);
  if (listError) throw listError;

  // If linked to pantry item, mark it in_stock immediately
  if (itemId) {
    const { error: itemError } = await supabase
      .from('items')
      .update({ in_stock: true })
      .eq('id', itemId);
    if (itemError) throw itemError;
  }
}

export async function uncheckItem(id, itemId) {
  const { error: listError } = await supabase
    .from('grocery_list')
    .update({ checked: false })
    .eq('id', id);
  if (listError) throw listError;

  // If linked to pantry item, mark out of stock
  if (itemId) {
    const { error: itemError } = await supabase
      .from('items')
      .update({ in_stock: false })
      .eq('id', itemId);
    if (itemError) throw itemError;
  }
}

export async function removeFromList(id) {
  const { error } = await supabase
    .from('grocery_list')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function clearChecked() {
  const { error } = await supabase
    .from('grocery_list')
    .delete()
    .eq('checked', true);
  if (error) throw error;
}

// ── Pantry Items ──────────────────────────────────────────────────────────────

export async function getPantryItems() {
  const { data, error } = await supabase
    .from('items')
    .select(`
      id,
      name,
      section_id,
      in_stock,
      notes,
      created_at,
      sections (
        id,
        name,
        sort_order
      )
    `)
    .order('name');
  if (error) throw error;

  return data.map(item => ({
    ...item,
    section_name: item.sections?.name || 'Unsorted',
    section_sort: item.sections?.sort_order ?? 99
  }));
}

export async function addPantryItem(name, sectionId) {
  const { data, error } = await supabase
    .from('items')
    .insert({ name, section_id: sectionId, in_stock: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateItemSection(itemId, sectionId) {
  const { error } = await supabase
    .from('items')
    .update({ section_id: sectionId })
    .eq('id', itemId);
  if (error) throw error;
}

export async function markRunningLow(itemId, sectionId) {
  // Mark item out of stock
  const { error: itemError } = await supabase
    .from('items')
    .update({ in_stock: false })
    .eq('id', itemId);
  if (itemError) throw itemError;

  // Add to grocery list
  await addToList(itemId, sectionId);
}

export async function markInStock(itemId) {
  // Mark in stock
  const { error: itemError } = await supabase
    .from('items')
    .update({ in_stock: true })
    .eq('id', itemId);
  if (itemError) throw itemError;

  // Remove from grocery list if present
  const { error: listError } = await supabase
    .from('grocery_list')
    .delete()
    .eq('item_id', itemId);
  if (listError) throw listError;
}

export async function deleteItem(itemId) {
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', itemId);
  if (error) throw error;
}

// ── Recipes ───────────────────────────────────────────────────────────────────

export async function getRecipes() {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

export async function getRecipeWithIngredients(id) {
  const { data: recipe, error: rError } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .single();
  if (rError) throw rError;

  const { data: ingredients, error: iError } = await supabase
    .from('recipe_ingredients')
    .select(`
      id,
      recipe_id,
      item_id,
      free_text,
      quantity,
      items (
        id,
        name,
        in_stock
      )
    `)
    .eq('recipe_id', id);
  if (iError) throw iError;

  return {
    ...recipe,
    ingredients: ingredients.map(ing => ({
      id: ing.id,
      item_id: ing.item_id,
      name: ing.items?.name || ing.free_text,
      quantity: ing.quantity,
      in_stock: ing.items ? ing.items.in_stock : null,
      free_text: ing.free_text
    }))
  };
}

export async function addRecipe(name, notes) {
  const { data, error } = await supabase
    .from('recipes')
    .insert({ name, notes })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRecipe(id) {
  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function addIngredient(recipeId, itemId, freeText, quantity) {
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .insert({
      recipe_id: recipeId,
      item_id: itemId || null,
      free_text: freeText || null,
      quantity: quantity || null
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeIngredient(id) {
  const { error } = await supabase
    .from('recipe_ingredients')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function addMealToList(recipeId) {
  const recipe = await getRecipeWithIngredients(recipeId);
  const missing = recipe.ingredients.filter(ing => ing.in_stock === false || ing.in_stock === null);

  // For items linked to pantry, get their section
  const inserts = [];
  for (const ing of missing) {
    if (ing.item_id) {
      const { data: item } = await supabase
        .from('items')
        .select('id, section_id')
        .eq('id', ing.item_id)
        .single();
      if (item) {
        // Check if already on list
        const { data: existing } = await supabase
          .from('grocery_list')
          .select('id')
          .eq('item_id', item.id)
          .maybeSingle();
        if (!existing) {
          inserts.push({ item_id: item.id, section_id: item.section_id });
        }
      }
    } else if (ing.free_text) {
      inserts.push({ ad_hoc_name: ing.free_text });
    }
  }

  if (inserts.length > 0) {
    const { error } = await supabase
      .from('grocery_list')
      .insert(inserts);
    if (error) throw error;
  }

  return inserts.length;
}

// ── Meal Plan ─────────────────────────────────────────────────────────────────

export async function getMealPlan(weekStart) {
  const { data, error } = await supabase
    .from('meal_plan')
    .select(`
      id,
      recipe_id,
      week_start,
      day_of_week,
      recipes (
        id,
        name
      )
    `)
    .eq('week_start', weekStart)
    .order('day_of_week');
  if (error) throw error;
  return data.map(row => ({
    ...row,
    recipe_name: row.recipes?.name
  }));
}

export async function addToPlan(recipeId, weekStart, dayOfWeek) {
  const { data, error } = await supabase
    .from('meal_plan')
    .insert({ recipe_id: recipeId, week_start: weekStart, day_of_week: dayOfWeek })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeFromPlan(id) {
  const { error } = await supabase
    .from('meal_plan')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
