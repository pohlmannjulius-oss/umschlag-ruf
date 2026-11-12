// Tombola-Aktionen und Zuordnung der Check-in-Listen
import { readJSON, update, json, checkPin } from "../lib/store.mjs";
import { EMPTY_TOMBOLA, applyTombolaScan, newId, prizeLeft } from "../lib/tombola.mjs";
import { EMPTY_CONFIG, ROLES, fetchLists, guessRole } from "../lib/pretix.mjs";

const T = (fn) => update("tombola", EMPTY_TOMBOLA, (t) => fn({ ...structuredClone(EMPTY_TOMBOLA), ...t }));

export default async (req) => {
  if (!checkPin(req)) return json({ error: "pin" }, 401);
  if (req.method !== "POST") return json({ error: "nur POST" }, 405);
  const b = await req.json().catch(() => ({}));

  switch (b.action) {
    case "addPrize": {
      const name = String(b.name || "").trim().slice(0, 80);
      if (!name) return json({ error: "Name fehlt" }, 400);
      const qty = parseInt(b.qty) > 0 ? parseInt(b.qty) : null;
      await T((t) => { t.prizes.push({ id: newId(), name, qty }); return t; });
      return json({ ok: true });
    }
    case "importPrizes": {
      const rows = (Array.isArray(b.prizes) ? b.prizes : [])
        .map((r) => ({ name: String(r.name || "").trim().slice(0, 80), qty: parseInt(r.qty) > 0 ? parseInt(r.qty) : null }))
        .filter((r) => r.name).slice(0, 1000);
      if (!rows.length) return json({ error: "Keine Gewinne in der Datei gefunden" }, 400);
      let added = 0, updated = 0, removed = 0;
      await T((t) => {
        const key = (s) => s.toLocaleLowerCase("de").replace(/\s+/g, " ");
        const inFile = new Set(rows.map((r) => key(r.name)));
        if (b.replace) {
          const before = t.prizes.length;
          // Gewinne, die schon vergeben wurden, bleiben erhalten
          t.prizes = t.prizes.filter((p) => inFile.has(key(p.name)) || t.wins.some((w) => w.prizeId === p.id));
          removed = before - t.prizes.length;
          if (t.armed && !t.prizes.some((p) => p.id === t.armed)) t.armed = null;
        }
        for (const r of rows) {
          const p = t.prizes.find((x) => key(x.name) === key(r.name));
          if (p) { if (p.qty !== r.qty) { p.qty = r.qty; updated++; } }
          else { t.prizes.push({ id: newId(), name: r.name, qty: r.qty }); added++; }
        }
        return t;
      });
      return json({ ok: true, added, updated, removed });
    }
    case "removePrize":
      await T((t) => { t.prizes = t.prizes.filter((p) => p.id !== b.id); if (t.armed === b.id) t.armed = null; return t; });
      return json({ ok: true });
    case "arm": {
      let err = null;
      await T((t) => {
        const p = t.prizes.find((x) => x.id === b.id);
        if (!p) { err = "Gewinn nicht gefunden"; return t; }
        const left = prizeLeft(t, p);
        if (left !== null && left <= 0) { err = "Gewinn ist schon vergeben"; return t; }
        t.armed = p.id; return t;
      });
      return err ? json({ error: err }, 400) : json({ ok: true });
    }
    case "disarm":
      await T((t) => { t.armed = null; return t; });
      return json({ ok: true });
    case "assign":
      await T((t) => {
        const w = t.wins.find((x) => x.id === b.winId); const p = t.prizes.find((x) => x.id === b.prizeId);
        if (w) { w.prizeId = p?.id || null; w.prizeName = p?.name || ""; }
        return t;
      });
      return json({ ok: true });
    case "contacted":
      await T((t) => { const w = t.wins.find((x) => x.id === b.winId); if (w) w.contacted = !!b.value; return t; });
      return json({ ok: true });
    case "deleteWin":
      await T((t) => { t.wins = t.wins.filter((w) => w.id !== b.winId); if (t.lastWinId === b.winId) t.lastWinId = null; return t; });
      return json({ ok: true });
    case "dismiss":
      await T((t) => { t.lastWinId = null; return t; });
      return json({ ok: true });
    case "test": {
      const code = String(b.code || "").trim().toUpperCase();
      if (!code) return json({ error: "Bestellnummer fehlt" }, 400);
      const { data: mapping } = await readJSON("mapping", { rows: {} });
      const m = mapping.rows?.[code] || {};
      await T((t) => applyTombolaScan(t, { code, nr: m.nr, name: m.name || "Testscan", email: "", test: true }));
      return json({ ok: true, found: !!mapping.rows?.[code] });
    }
    case "reset":
      await T((t) => ({ ...t, wins: [], armed: null, lastWinId: null }));
      return json({ ok: true });

    // ---- Check-in-Listen ----
    case "setRole": {
      if (!ROLES.includes(b.role)) return json({ error: "Rolle unbekannt" }, 400);
      const id = String(b.id || "").trim();
      if (!/^\d+$/.test(id)) return json({ error: "Listen-ID muss eine Zahl sein" }, 400);
      await update("config", EMPTY_CONFIG, (c) => {
        c.lists ||= {};
        c.lists[id] = { ...(c.lists[id] || { id, name: "" }), role: b.role };
        return c;
      });
      return json({ ok: true });
    }
    case "loadLists": {
      const { data: cfg } = await readJSON("config", EMPTY_CONFIG);
      const events = Object.values(cfg.events || {});
      if (!events.length) return json({ error: "Noch kein Scan empfangen – erst ein Ticket scannen, dann kennt die Seite das Event." }, 400);
      const found = [];
      for (const ev of events) {
        try { (await fetchLists(ev.org, ev.event)).forEach((l) => found.push({ ...l, evKey: `${ev.org}/${ev.event}` })); }
        catch (e) { return json({ error: `Listen konnten nicht geladen werden (${e.message}). Hat das pretix-Team das Recht, Check-in-Listen zu sehen?` }, 400); }
      }
      await update("config", EMPTY_CONFIG, (c) => {
        c.lists ||= {};
        const hasEnvelope = Object.values(c.lists).some((l) => l.role === "umschlag");
        for (const l of found) {
          const id = String(l.id); const prev = c.lists[id];
          c.lists[id] = { id, name: l.name || "", event: l.evKey, role: prev?.role && prev.role !== "offen" ? prev.role : guessRole(l.name) || (hasEnvelope ? "offen" : "umschlag") };
        }
        return c;
      });
      return json({ ok: true, count: found.length });
    }
    default:
      return json({ error: "unbekannte Aktion" }, 400);
  }
};

export const config = { path: "/api/tombola" };
