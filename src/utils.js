export function fmtDate(dt) {
  if (!dt) return '—';
  try {
    const d = new Date(dt);
    return d.toLocaleString('uz-UZ', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(dt);
  }
}

export function fmtDateShort(dt) {
  if (!dt) return '—';
  try {
    const d = new Date(dt);
    return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return String(dt);
  }
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
