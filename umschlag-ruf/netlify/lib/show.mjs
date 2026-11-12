// Bühne: zieht einen Namen aus den eingecheckten Gästen (oder testweise aus der Nummernliste)
import { randomInt } from "node:crypto";
import { newId } from "./tombola.mjs";

const DEMO = ["Lena Hoffmann", "Jonas Becker", "Mia Schulte", "Lukas Wagner", "Emma Krüger", "Felix Brandt", "Hannah Vogel", "Paul Neumann",
  "Sophie Lange", "Tim Hartmann", "Clara Winter", "Noah Fischer", "Lea Schröder", "Ben Richter", "Marie Wolf", "Elias Koch", "Anna Schäfer",
  "Leon Bauer", "Lina Zimmermann", "Finn Schmitz", "Laura Braun", "Max Hofmann", "Julia Krause", "David Lehmann", "Sarah König",
  "Jan Peters", "Nele Walter", "Tom Möller", "Ida Busch", "Moritz Jansen", "Greta Kaiser", "Luca Fuchs", "Amelie Graf", "Niklas Vogt",
  "Johanna Berger", "Erik Sommer", "Charlotte Haas", "Henri Seidel", "Frieda Engel", "Oskar Lorenz"];

export const EMPTY_SHOW = { draws: [], currentId: null, playKey: null };

// "Penny, Jenny" → "Jenny Penny"
export function fullName(n) {
  const s = String(n || "").trim();
  if (s.includes(",")) { const [last, first] = s.split(",").map((x) => x.trim()); return `${first} ${last}`.trim(); }
  return s;
}
// Bühnenanzeige: Vorname + Initial des Nachnamens
export function stageName(n) {
  const parts = fullName(n).split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || "";
  return `${parts.slice(0, -1).join(" ")} ${parts.at(-1)[0].toUpperCase()}.`;
}

// Lostopf: jede eingecheckte Person einzeln
export function buildPool(state, mapping, { test = false } = {}) {
  const pool = [];
  if (test) {
    for (const [code, m] of Object.entries(mapping.rows || {})) {
      const people = String(m.people || "").split(",").map((x) => x.trim()).filter(Boolean);
      (people.length ? people : [m.name]).forEach((n, i) => pool.push({ key: `${code}#${i}`, name: fullName(n), code, nr: m.nr ?? null }));
    }
    // Testlostopf immer gut füllen: Nummernliste + Beispielnamen
    DEMO.forEach((n, i) => pool.push({ key: `DEMO#${i}`, name: n, code: "TEST", nr: null }));
    return pool;
  }
  for (const o of Object.values(state.orders || {})) {
    if (!o.inCount) continue;
    const m = mapping.rows?.[o.code] || {};
    const people = (o.present || []).filter(Boolean);
    (people.length ? people : [o.name || m.name]).forEach((n, i) => pool.push({ key: `${o.code}#${fullName(n)}`, name: fullName(n), code: o.code, nr: m.nr ?? o.nr ?? null }));
  }
  return pool;
}

export const ANIMS = ["piste", "gondel", "tafel", "yeti", "sturm", "schlitten"];

export function drawFrom(show, pool, { prize = "", prizeId = null, unique = true, test = false, anim = "auto" }) {
  show = { ...structuredClone(EMPTY_SHOW), ...show };
  const taken = new Set(show.draws.filter((d) => !d.test || test).map((d) => d.key));
  let eligible = unique ? pool.filter((p) => !taken.has(p.key)) : pool;
  if (!eligible.length && test) eligible = pool; // Testziehungen dürfen sich wiederholen
  if (!eligible.length) return { show, error: pool.length ? "Alle im Lostopf wurden schon gezogen." : "Der Lostopf ist leer – noch niemand eingecheckt." };
  const win = eligible[randomInt(eligible.length)];
  // Namen für die Walze: zufällige Auswahl aus dem Lostopf
  const others = pool.filter((p) => p.key !== win.key).map((p) => stageName(p.name)).filter(Boolean);
  const reel = [];
  for (let i = 0; i < Math.min(28, Math.max(others.length, 1) * 4) && others.length; i++) reel.push(others[randomInt(others.length)]);
  // Animation: fest gewählt oder reihum
  const a = ANIMS.includes(anim) ? anim : ANIMS[show.draws.length % ANIMS.length];
  const draw = {
    id: newId(), t: new Date().toISOString(), anim: a, key: win.key, name: win.name, display: stageName(win.name),
    code: win.code, nr: win.nr, prize, prizeId, reel, poolSize: eligible.length, test,
  };
  show.draws.unshift(draw);
  show.draws = show.draws.slice(0, 200);
  show.currentId = draw.id; show.playKey = draw.id;
  return { show, draw };
}
