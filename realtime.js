import { supabase } from './db.js';

let currentView = 'list';
const listeners = {};

export function setCurrentView(view) {
  currentView = view;
}

export function onViewChange(view, callback) {
  listeners[view] = callback;
}

export function initRealtime() {
  supabase.channel('pantry-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'grocery_list' }, () => {
      if (currentView === 'list' && listeners['list']) {
        listeners['list']();
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
      if (currentView === 'pantry' && listeners['pantry']) {
        listeners['pantry']();
      }
      // List may show section labels derived from items
      if (currentView === 'list' && listeners['list']) {
        listeners['list']();
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'recipes' }, () => {
      if (currentView === 'meals' && listeners['meals']) {
        listeners['meals']();
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_plan' }, () => {
      if (currentView === 'meals' && listeners['meals']) {
        listeners['meals']();
      }
    })
    .subscribe(status => {
      console.log('[Realtime] Status:', status);
    });
}
