/**
 * In-app history for the Back button: a per-tab stack of visited URLs (path + query) kept in
 * sessionStorage, so Back only uses router.back() when the previous entry is one of ours.
 */
export const NAV_HISTORY_KEY = "ssa.nav.stack";
const MAX = 50;

/** Next stack after visiting url: a visit to the previous entry is a Back (pop); same url is a reload. */
export function nextStack(stack: string[], url: string): string[] {
  if (stack[stack.length - 1] === url) return stack;
  if (stack.length > 1 && stack[stack.length - 2] === url) return stack.slice(0, -1);
  return [...stack, url].slice(-MAX);
}

export function canGoBack(stack: string[]): boolean {
  return stack.length > 1;
}

/** Parent page when there is no in-app history: the section's first tab, else Overview, else home. */
export function fallbackParent(pathname: string, sectionFirstTab?: string): string {
  if (sectionFirstTab && sectionFirstTab !== pathname) return sectionFirstTab;
  return pathname === "/overview" ? "/" : "/overview";
}

export function readStack(): string[] {
  try {
    const raw = sessionStorage.getItem(NAV_HISTORY_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function recordVisit(url: string): string[] {
  const next = nextStack(readStack(), url);
  try {
    sessionStorage.setItem(NAV_HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: Back falls back to the parent page */
  }
  return next;
}
