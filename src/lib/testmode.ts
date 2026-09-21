"use client";
// Real-world test mode helpers (localStorage only — no server state).
// When enabled, AppLayout shows "DAY n OF 7" and logs route visits;
// the Reviews page renders the 7-day report from analytics + usage log.

export const TEST_DAYS = 7;

export function isTestMode(): boolean {
  try { return window.localStorage.getItem("sf:testmode") === "on"; } catch { return false; }
}

export function testStartMs(): number | null {
  try {
    const v = window.localStorage.getItem("sf:testmode-start");
    return v ? Number(v) : null;
  } catch { return null; }
}

export function startTestMode(): void {
  try {
    window.localStorage.setItem("sf:testmode", "on");
    window.localStorage.setItem("sf:testmode-start", String(Date.now()));
    window.localStorage.setItem("sf:usage", JSON.stringify([]));
  } catch { /* noop */ }
}

export function stopTestMode(): void {
  try { window.localStorage.setItem("sf:testmode", "off"); } catch { /* noop */ }
}

/** 1-indexed day within the 7-day window, null when inactive/expired. */
export function testDayNumber(now = Date.now()): number | null {
  if (!isTestMode()) return null;
  const start = testStartMs();
  if (!start) return null;
  const day = Math.floor((now - start) / 86400000) + 1;
  return day >= 1 && day <= TEST_DAYS ? day : null;
}

export interface UsageEntry { route: string; at: number }

export function readUsage(): UsageEntry[] {
  try {
    const raw = window.localStorage.getItem("sf:usage");
    const log = raw ? JSON.parse(raw) : [];
    return Array.isArray(log) ? log : [];
  } catch { return []; }
}
