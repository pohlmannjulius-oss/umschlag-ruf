// Speicher: Netlify Blobs (live) oder Arbeitsspeicher (lokaler Test)
import { getStore } from "@netlify/blobs";

const mem = globalThis.__memStore || (globalThis.__memStore = new Map());

function memStore() {
  return {
    async getWithMetadata(key) {
      const e = mem.get(key);
      return e ? { data: JSON.parse(e.v), etag: e.etag } : null;
    },
    async setJSON(key, value, opts = {}) {
      const e = mem.get(key);
      if (opts.onlyIfNew && e) return { modified: false };
      if (opts.onlyIfMatch && (!e || e.etag !== opts.onlyIfMatch)) return { modified: false };
      const etag = String(Math.random());
      mem.set(key, { v: JSON.stringify(value), etag });
      return { modified: true, etag };
    },
  };
}

export function store() {
  if (process.env.MEMORY_STORE === "1") return memStore();
  return getStore({ name: "umschlag-ruf", consistency: "strong" });
}

export async function readJSON(key, fallback) {
  const r = await store().getWithMetadata(key, { type: "json" });
  if (!r) return { data: fallback, etag: null };
  return { data: r.data ?? fallback, etag: r.etag };
}

// Lesen-Ändern-Schreiben mit Konfliktschutz (zwei Scans gleichzeitig)
export async function update(key, fallback, fn) {
  for (let i = 0; i < 8; i++) {
    const { data, etag } = await readJSON(key, fallback);
    const next = fn(structuredClone(data));
    const opts = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
    const res = await store().setJSON(key, next, opts);
    if (res.modified !== false) return next;
    await new Promise((r) => setTimeout(r, 50 + Math.random() * 150));
  }
  throw new Error("Speichern fehlgeschlagen (zu viele gleichzeitige Änderungen)");
}

export const EMPTY_STATE = { orders: {}, feed: [] };

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export function checkPin(req) {
  const pin = process.env.APP_PIN;
  if (!pin) return true;
  return req.headers.get("x-pin") === pin;
}

// Eintrag für eine Bestellung aktualisieren (gemeinsam für Webhook und Testscan)
export function applyScan(state, info, action) {
  const now = new Date().toISOString();
  const o = state.orders[info.code];
  if (!o) {
    if (info.inCount <= 0) return state;
    state.orders[info.code] = {
      code: info.code, nr: info.nr ?? null, name: info.name || "", total: info.total,
      inCount: info.inCount, status: "offen", firstAt: now, lastAt: now, note: info.note || "",
    };
  } else {
    Object.assign(o, {
      nr: info.nr ?? o.nr, name: info.name || o.name, total: info.total ?? o.total,
      inCount: info.inCount, lastAt: now, note: info.note || "",
    });
    if (info.inCount <= 0 && o.status === "offen") delete state.orders[info.code];
  }
  state.feed.unshift({ t: now, code: info.code, nr: info.nr ?? null, name: info.name || "", action, inCount: info.inCount, total: info.total });
  state.feed = state.feed.slice(0, 60);
  return state;
}
