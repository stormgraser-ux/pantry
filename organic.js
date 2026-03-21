/**
 * Build an organic guidance badge from the item's notes field.
 * Returns a DOM element or null.
 *
 * Notes containing "dirty dozen" or "buy organic" → green "Buy Organic" badge
 * Notes containing "clean 15" or "go conventional" → gold "Save $" badge
 */
export function buildOrganicBadge(notes) {
  if (!notes) return null;
  const lower = notes.toLowerCase();
  if (lower.includes('dirty dozen') || lower.includes('buy organic')) {
    const badge = document.createElement('span');
    badge.className = 'organic-badge organic-buy';
    badge.textContent = 'Buy Organic';
    badge.title = 'Dirty Dozen — higher pesticide residue when conventional';
    return badge;
  }
  if (lower.includes('clean 15') || lower.includes('go conventional') || lower.includes('save money')) {
    const badge = document.createElement('span');
    badge.className = 'organic-badge organic-save';
    badge.textContent = 'Save $';
    badge.title = 'Clean 15 — low pesticide, safe to buy conventional';
    return badge;
  }
  return null;
}
