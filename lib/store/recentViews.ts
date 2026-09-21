/**
 * Client-side recent-view tracking for guests.
 *
 * Signed-in users get their history stored on the `User` document server-side
 * (see app/api/products/[slug]/route.ts); guests use localStorage so the AI
 * "Recommended for You" shelf can still personalize with real signals.
 */

const KEY = 'noor_recently_viewed';
export const MAX_RECENT_VIEWS = 12;

export function getRecentViewIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function recordRecentView(productId: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const next = [productId, ...getRecentViewIds().filter((id) => id !== productId)].slice(
      0,
      MAX_RECENT_VIEWS
    );
    window.localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export function clearRecentViews() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}