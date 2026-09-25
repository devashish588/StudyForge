// Study windows — the user's configured available study time per day.
//
// Source of truth: UserSettings.preferredSittings (JSON string array).
// Format: [{ label: "Morning", start: "10:30", end: "13:30" }, ...]
//         label is one of Morning / Afternoon / Midday / Evening / Night (freeform allowed)
//         start/end are "HH:MM" in local time, start < end.
// If the setting is empty / unparsable, sensible defaults are returned that
// sum to the user's dailyTargetMinutes (6h floor / 7h good / 8h stretch).
//
// The planner divides a day's fitted work across these windows sequentially.
// Hard topics get longer contiguous blocks; light topics are packed.

export interface StudyWindow {
  id: string;
  label: "Morning" | "Afternoon" | "Midday" | "Evening" | "Night" | string;
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  minutes: number;
}

const LABEL_ORDER: Record<string, number> = {
  Morning: 0, Midday: 1, Afternoon: 2, Evening: 3, Night: 4,
};

function parseMinutesOfDay(t: string): number | null {
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

export function windowMinutes(w: { start: string; end: string }): number {
  const a = parseMinutesOfDay(w.start);
  const b = parseMinutesOfDay(w.end);
  if (a == null || b == null) return 0;
  const d = b - a;
  return d > 0 ? d : d + 1440; // allow overnight, though not expected
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20) || "window";
}

function defaultWindowsForCapacity(capacityMinutes: number): StudyWindow[] {
  // Canonical default mirrors the spec example: one long morning deep block,
  // then afternoon / evening / night. Total is forced to capacity.
  const raw: { label: string; start: string; minutes: number }[] =
    capacityMinutes <= 360
      ? [
          { label: "Morning", start: "10:30", minutes: 180 },
          { label: "Afternoon", start: "15:00", minutes: 60 },
          { label: "Evening", start: "18:00", minutes: 60 },
          { label: "Night", start: "21:00", minutes: 60 },
        ]
      : capacityMinutes <= 420
        ? [
            { label: "Morning", start: "10:30", minutes: 180 },
            { label: "Afternoon", start: "15:00", minutes: 75 },
            { label: "Evening", start: "18:00", minutes: 105 },
            { label: "Night", start: "21:00", minutes: 60 },
          ]
        : [
            { label: "Morning", start: "10:30", minutes: 180 },
            { label: "Afternoon", start: "15:00", minutes: 90 },
            { label: "Evening", start: "18:00", minutes: 120 },
            { label: "Night", start: "21:00", minutes: 90 },
          ];
  // Trim or scale to exactly capacityMinutes
  let sum = raw.reduce((a, w) => a + w.minutes, 0);
  if (sum !== capacityMinutes) {
    // Scale evening/night to absorb the difference, keeping morning deep block stable
    const fixed = raw[0].minutes; // morning stays 180
    const remainder = capacityMinutes - fixed;
    const others = raw.slice(1);
    const otherSum = others.reduce((a, w) => a + w.minutes, 0) || 1;
    for (const w of others) w.minutes = Math.round((w.minutes / otherSum) * remainder);
    // Fix rounding drift
    let check = fixed + others.reduce((a, w) => a + w.minutes, 0);
    let i = others.length - 1;
    while (check !== capacityMinutes && i >= 0) {
      const delta = capacityMinutes - check;
      others[i].minutes += Math.sign(delta);
      check += Math.sign(delta);
      i = (i - 1 + others.length) % others.length;
    }
  }
  const out: StudyWindow[] = [];
  for (const w of raw) {
    if (w.minutes <= 0) continue;
    const startMin = parseMinutesOfDay(w.start) ?? 0;
    const endMin = startMin + w.minutes;
    const endH = Math.floor((endMin % 1440) / 60);
    const endM = endMin % 60;
    out.push({
      id: slug(w.label),
      label: w.label,
      start: w.start,
      end: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
      minutes: w.minutes,
    });
  }
  return out.filter((w) => w.minutes >= 30);
}

export function parseStudyWindows(
  raw: string | null | undefined,
  capacityMinutes = 360
): StudyWindow[] {
  if (!raw || raw.trim() === "" || raw.trim() === "[]") {
    return defaultWindowsForCapacity(capacityMinutes);
  }
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return defaultWindowsForCapacity(capacityMinutes);
    const out: StudyWindow[] = [];
    for (let i = 0; i < arr.length; i++) {
      const w = arr[i] as { label?: string; start?: string; end?: string; minutes?: number };
      const label = String(w.label || w["label"] || `Block ${i + 1}`).trim() || `Block ${i + 1}`;
      const start = String(w.start || "").trim();
      const end = String(w.end || "").trim();
      let minutes = typeof w.minutes === "number" ? Math.round(w.minutes) : windowMinutes({ start, end });
      if (!start || !end) continue;
      if (parseMinutesOfDay(start) == null || parseMinutesOfDay(end) == null) continue;
      if (minutes < 15) continue;
      minutes = Math.min(480, Math.max(15, minutes));
      out.push({ id: `${slug(label)}-${i}`, label, start, end, minutes });
    }
    if (out.length === 0) return defaultWindowsForCapacity(capacityMinutes);
    out.sort((a, b) => {
      const ao = LABEL_ORDER[a.label] ?? 99;
      const bo = LABEL_ORDER[b.label] ?? 99;
      if (ao !== bo) return ao - bo;
      return (parseMinutesOfDay(a.start) ?? 0) - (parseMinutesOfDay(b.start) ?? 0);
    });
    return out;
  } catch {
    return defaultWindowsForCapacity(capacityMinutes);
  }
}

export function getStudyWindowsForCapacity(capacityMinutes: number): StudyWindow[] {
  return defaultWindowsForCapacity(capacityMinutes);
}

export function totalWindowMinutes(windows: StudyWindow[]): number {
  return windows.reduce((a, w) => a + w.minutes, 0);
}

export function windowEndTime(start: string, durationMinutes: number): string {
  const s = parseMinutesOfDay(start);
  if (s == null) return start;
  const end = (s + durationMinutes) % 1440;
  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

export function windowLabelToPart(label: string): "MORNING" | "AFTERNOON" | "MIDDAY" | "EVENING" | "NIGHT" {
  const l = label.toLowerCase();
  if (l.includes("morning")) return "MORNING";
  if (l.includes("midday")) return "MIDDAY";
  if (l.includes("afternoon")) return "AFTERNOON";
  if (l.includes("evening")) return "EVENING";
  return "NIGHT";
}
