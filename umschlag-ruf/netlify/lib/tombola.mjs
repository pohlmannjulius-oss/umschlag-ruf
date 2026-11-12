// Tombola: Gewinne, scharf geschalteter Gewinn, Gewinnerliste
export const EMPTY_TOMBOLA = { prizes: [], armed: null, wins: [], lastWinId: null, seen: [] };

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function prizeLeft(t, prize) {
  if (!prize?.qty) return null;
  return prize.qty - t.wins.filter((w) => w.prizeId === prize.id).length;
}

// Scan auf der Tombola-Liste eintragen
export function applyTombolaScan(t, info) {
  t = { ...structuredClone(EMPTY_TOMBOLA), ...t };
  if (info.notificationId) {
    if (t.seen.includes(info.notificationId)) return t; // doppelte Zustellung
    t.seen = [info.notificationId, ...t.seen].slice(0, 300);
  }
  if (info.revert) {
    const idx = t.wins.findIndex((w) => info.positionId && w.positionId === info.positionId);
    if (idx >= 0) {
      const [w] = t.wins.splice(idx, 1);
      if (!t.armed && w.prizeId && t.prizes.some((p) => p.id === w.prizeId)) t.armed = w.prizeId;
      if (t.lastWinId === w.id) t.lastWinId = null;
    }
    return t;
  }
  const prize = t.prizes.find((p) => p.id === t.armed) || null;
  const repeat = t.wins.some((w) => (info.positionId && w.positionId === info.positionId) || (!info.positionId && w.code === info.code));
  const win = {
    id: newId(), t: new Date().toISOString(),
    prizeId: prize?.id || null, prizeName: prize?.name || "",
    code: info.code, positionId: info.positionId || null, nr: info.nr ?? null,
    name: info.name || "", email: info.email || "", note: info.note || "",
    repeat, contacted: false, test: !!info.test,
  };
  t.wins.unshift(win);
  t.lastWinId = win.id;
  t.armed = null;
  return t;
}
