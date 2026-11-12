// Goodie + Gewinn: Zufallsnummer 1..total ziehen (ohne Zurücklegen), Nummer → Zusatzgewinn
import { randomInt } from "node:crypto";
import { newId } from "./tombola.mjs";

export const EMPTY_GOODIE = { slots: {}, total: 0, used: [], draws: [], lastDrawId: null, seen: [], importedAt: null };

export function applyGoodieScan(g, info) {
  g = { ...structuredClone(EMPTY_GOODIE), ...g };
  if (info.notificationId) {
    if (g.seen.includes(info.notificationId)) return g; // doppelte Zustellung
    g.seen = [info.notificationId, ...g.seen].slice(0, 300);
  }
  const same = (d) => (info.positionId ? d.positionId === info.positionId : d.code === info.code && !d.positionId);

  if (info.revert) {
    const idx = g.draws.findIndex(same);
    if (idx >= 0) {
      const [d] = g.draws.splice(idx, 1);
      if (d.nr) g.used = g.used.filter((n) => n !== d.nr); // Nummer kommt zurück in die Trommel
      if (g.lastDrawId === d.id) g.lastDrawId = null;
    }
    return g;
  }

  // Ticket hat schon gezogen → altes Ergebnis erneut anzeigen, keine neue Ziehung
  const prev = info.test ? null : g.draws.find(same);
  if (prev) {
    prev.shownAgainAt = new Date().toISOString();
    g.lastDrawId = prev.id; g.lastShowKey = newId();
    return g;
  }

  const pool = [];
  for (let n = 1; n <= g.total; n++) if (!g.used.includes(n)) pool.push(n);
  const nr = pool.length ? pool[randomInt(pool.length)] : null;
  if (nr) g.used.push(nr);
  const prize = nr ? g.slots[String(nr)] || "" : "";
  const draw = {
    id: newId(), t: new Date().toISOString(), nr, prize, empty: !nr,
    code: info.code, positionId: info.positionId || null, envNr: info.envNr ?? null,
    name: info.name || "", email: info.email || "", note: info.note || "",
    contacted: false, test: !!info.test,
  };
  g.draws.unshift(draw);
  g.lastDrawId = draw.id; g.lastShowKey = draw.id;
  return g;
}
