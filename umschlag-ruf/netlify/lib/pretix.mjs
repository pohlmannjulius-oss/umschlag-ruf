// Zugriff auf die pretix-API und Zuordnung der Check-in-Listen
import { readJSON, update } from "./store.mjs";

const base = () => (process.env.PRETIX_URL || "https://pretix.eu").replace(/\/$/, "");
const headers = () => ({ Authorization: `Token ${process.env.PRETIX_TOKEN}` });
const enc = encodeURIComponent;

export async function fetchOrder(org, event, code) {
  const res = await fetch(`${base()}/api/v1/organizers/${enc(org)}/events/${enc(event)}/orders/${enc(code)}/`, { headers: headers() });
  if (!res.ok) throw new Error(`pretix antwortet ${res.status}`);
  return res.json();
}

export async function fetchLists(org, event) {
  const res = await fetch(`${base()}/api/v1/organizers/${enc(org)}/events/${enc(event)}/checkinlists/`, { headers: headers() });
  if (!res.ok) throw new Error(`pretix antwortet ${res.status}`);
  return (await res.json()).results || [];
}

export async function fetchList(org, event, id) {
  const res = await fetch(`${base()}/api/v1/organizers/${enc(org)}/events/${enc(event)}/checkinlists/${enc(id)}/`, { headers: headers() });
  if (!res.ok) throw new Error(`pretix antwortet ${res.status}`);
  return res.json();
}

export const EMPTY_CONFIG = { lists: {}, events: {} };
export const ROLES = ["umschlag", "tombola", "ignorieren"];

// Rolle aus dem Listennamen raten
export function guessRole(name) {
  return /tombola|verlosung|gewinn/i.test(name || "") ? "tombola" : null;
}

// Rolle einer Liste bestimmen; unbekannte Listen werden einmalig eingetragen
export async function resolveList(org, event, listId) {
  const id = String(listId ?? "");
  const { data: cfg } = await readJSON("config", EMPTY_CONFIG);
  const evKey = `${org}/${event}`;
  const known = cfg.lists?.[id];
  const needEvent = org && event && !cfg.events?.[evKey];
  if (known && !needEvent) return { role: known.role, cfg };
  if (!id) return { role: "umschlag", cfg };

  let name = known?.name || "";
  let role = known?.role;
  if (!role) {
    if (process.env.TOMBOLA_LIST_ID && String(process.env.TOMBOLA_LIST_ID) === id) role = "tombola";
    if (!role) {
      try { name = (await fetchList(org, event, id)).name || ""; } catch {}
      role = guessRole(name);
    }
    if (!role) {
      // Erste Liste ohne Zuordnung = Umschläge (bisheriges Verhalten); weitere bleiben offen
      const hasEnvelope = Object.values(cfg.lists || {}).some((l) => l.role === "umschlag");
      role = hasEnvelope ? "offen" : "umschlag";
    }
  }
  const next = await update("config", EMPTY_CONFIG, (c) => {
    c.lists ||= {}; c.events ||= {};
    if (org && event) c.events[evKey] = { org, event };
    if (!c.lists[id]) c.lists[id] = { id, name, role, event: evKey, seenAt: new Date().toISOString() };
    return c;
  });
  return { role: next.lists[id].role, cfg: next };
}

// Zählt bei Umschlägen nur Check-ins auf Umschlag-Listen
export function envelopeListFilter(cfg) {
  const lists = Object.values(cfg?.lists || {});
  const env = lists.filter((l) => l.role === "umschlag").map((l) => Number(l.id));
  if (env.length) return (listId) => env.includes(Number(listId));
  if (process.env.CHECKIN_LIST_ID) return (listId) => Number(listId) === Number(process.env.CHECKIN_LIST_ID);
  const excluded = lists.filter((l) => l.role !== "umschlag").map((l) => Number(l.id));
  return (listId) => !excluded.includes(Number(listId));
}
