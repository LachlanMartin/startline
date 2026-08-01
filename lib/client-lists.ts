const REGISTERED_KEY = "startline_registered_interest";

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
}

function notifyListsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("startline-lists-changed"));
}

function setRegisteredEventIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REGISTERED_KEY, JSON.stringify(ids));
  notifyListsChanged();
}

export function getRegisteredEventIds(): string[] {
  if (typeof window === "undefined") return [];
  return parseIds(localStorage.getItem(REGISTERED_KEY));
}

export function addRegisteredInterest(eventId: string): boolean {
  const ids = getRegisteredEventIds();
  if (ids.includes(eventId)) return false;
  ids.push(eventId);
  setRegisteredEventIds(ids);
  return true;
}

// Saved events are DB-backed (per-user). These helpers call the API so the
// heart button and activity page stay in sync across devices.
export async function fetchSavedEventIds(): Promise<string[]> {
  try {
    const res = await fetch("/api/user/saved-events");
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.eventIds) ? data.eventIds.map(String) : [];
  } catch {
    return [];
  }
}

export async function saveEventId(eventId: string): Promise<boolean> {
  try {
    const res = await fetch("/api/user/saved-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function unsaveEventId(eventId: string): Promise<boolean> {
  try {
    const res = await fetch("/api/user/saved-events", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
