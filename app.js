import { initRealtime, setCurrentView, onViewChange } from './realtime.js';
import { renderList, initListFab } from './views/list.js';
import { renderPantry, initPantryFab } from './views/pantry.js';
import { renderMeals } from './views/meals.js';
import { renderSettings } from './views/settings.js';

// ── Toast ─────────────────────────────────────────────────────────────────────
let _toastTimer = null;
export function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ── View map ──────────────────────────────────────────────────────────────────
const VIEWS = {
  list: { render: renderList },
  pantry: { render: renderPantry },
  meals: { render: renderMeals },
  settings: { render: renderSettings }
};

let _activeView = '';

async function navigateTo(view) {
  if (!VIEWS[view]) view = 'list';
  if (_activeView === view) return;

  _activeView = view;
  setCurrentView(view);

  // Update view visibility
  for (const key of Object.keys(VIEWS)) {
    const el = document.getElementById(`view-${key}`);
    if (el) {
      el.classList.toggle('active', key === view);
    }
  }

  // Update nav active state
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  // Show/hide FABs
  document.getElementById('list-fab')?.style.setProperty('display', view === 'list' ? 'flex' : 'none');
  document.getElementById('pantry-fab')?.style.setProperty('display', view === 'pantry' ? 'flex' : 'none');

  // Render
  await VIEWS[view].render();
}

// ── Routing ───────────────────────────────────────────────────────────────────
function getViewFromHash() {
  const hash = location.hash.replace('#', '').toLowerCase();
  return VIEWS[hash] ? hash : 'list';
}

function handleHashChange() {
  navigateTo(getViewFromHash());
}

// ── iOS install banner ────────────────────────────────────────────────────────
function maybeShowIOSBanner() {
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const dismissed = localStorage.getItem('pantry-ios-banner-dismissed');

  if (isIOS && isSafari && !isStandalone && !dismissed) {
    const banner = document.getElementById('ios-banner');
    if (banner) banner.style.display = 'flex';
  }
}

// ── Register service worker ───────────────────────────────────────────────────
async function registerSW() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/pantry/sw.js', { scope: '/pantry/' });
      console.log('[SW] Registered:', reg.scope);
    } catch (e) {
      console.warn('[SW] Registration failed:', e);
    }
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
async function init() {
  // Nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      location.hash = view;
    });
  });

  // iOS banner dismiss
  const dismissBtn = document.getElementById('ios-banner-dismiss');
  dismissBtn?.addEventListener('click', () => {
    localStorage.setItem('pantry-ios-banner-dismissed', '1');
    document.getElementById('ios-banner').style.display = 'none';
  });

  // Hash routing
  window.addEventListener('hashchange', handleHashChange);

  // Init FABs
  initListFab();
  initPantryFab();

  // Register realtime callbacks
  onViewChange('list', renderList);
  onViewChange('pantry', renderPantry);
  onViewChange('meals', renderMeals);

  // Init realtime
  initRealtime();

  // Initial route
  const view = getViewFromHash();
  location.hash = view;
  await navigateTo(view);

  // iOS banner
  maybeShowIOSBanner();

  // Register service worker
  registerSW();
}

document.addEventListener('DOMContentLoaded', init);
