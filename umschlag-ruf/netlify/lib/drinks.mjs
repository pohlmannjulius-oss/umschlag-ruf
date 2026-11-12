// Getränke: zählt Scans pro Ticket auf der Getränke-Liste (Standard: 2 Heißgetränke pro Ticket)
import { newId } from "./tombola.mjs";

export const EMPTY_DRINKS = { limit: 2, perTicket: {}, feed: [], lastId: null, seen: [] };

export function applyDrinkScan(dr, info) {
  dr = { ...structuredClone(EMPTY_DRINKS), ...dr };
  if (info.notificationId) {
    if (dr.seen.includes(info.notificationId)) return dr; // doppelte Zustellung
    dr.seen = [info.notificationId, ...dr.seen].slice(0, 400);
  }
  const key = info.positionId ? `P${info.positionId}` : `C${info.code}`;
  const t = dr.perTicket[key] || { code: info.code, name: info.name || "", nr: info.nr ?? null, times: [] };
  t.name = info.name || t.name; t.nr = info.nr ?? t.nr;
  const now = new Date().toISOString();

  if (info.revert) {
    // zurückgenommener Check-in: letztes ausgegebenes Getränk wieder gutschreiben
    if (t.times.length) t.times.pop();
    dr.perTicket[key] = t;
    dr.feed.unshift({ id: newId(), t: now, key, code: t.code, name: t.name, nr: t.nr, count: Math.min(t.times.length, dr.limit), status: "zurück", test: !!info.test });
  } else {
    const before = t.times.length;
    const ok = before < dr.limit;
    if (ok) t.times.push(now);
    dr.perTicket[key] = t;
    dr.feed.unshift({
      id: newId(), t: now, key, code: t.code, name: t.name, nr: t.nr,
      count: ok ? before + 1 : before, status: ok ? (before + 1 === dr.limit ? "letztes" : "ok") : "abgelehnt",
      prev: ok ? [] : [...t.times], test: !!info.test,
    });
  }
  dr.feed = dr.feed.slice(0, 120);
  dr.lastId = dr.feed[0].id;
  return dr;
}
