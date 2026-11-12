// Shared date/time helpers for the TwoDoo UI.

export function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

/** Monday-start week containing d. */
export function startOfWeek(d: Date): Date {
  const c = startOfDay(d);
  return addDays(c, -((c.getDay() + 6) % 7));
}

export function isOverdue(startAt: string | null, status: string): boolean {
  if (!startAt || status !== "open") return false;
  return new Date(startAt).getTime() < startOfDay(new Date()).getTime();
}
