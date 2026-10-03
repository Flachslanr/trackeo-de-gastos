// Utilidades de formato y parseo (sin dependencias del DOM → testeables en Node)

/** Fecha local de hoy en formato YYYY-MM-DD (evita el desfase UTC de toISOString). */
export function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Mes actual en formato YYYY-MM. */
export function currentMonth(d = new Date()) {
  return todayISO(d).slice(0, 7);
}

/** Valida una fecha YYYY-MM-DD real (rechaza 2026-02-30). */
export function isValidISODate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * Convierte lo que escribe el usuario a centavos (entero).
 * Acepta formato argentino ("1.234,56", "1500,5", "1.500") y estándar ("1234.56").
 * Devuelve null si no es un importe válido y positivo.
 */
export function parseAmountToCents(input) {
  if (input == null) return null;
  let s = String(input).trim().replace(/\s|\$/g, '');
  if (!s) return null;

  if (s.includes(',')) {
    // Coma decimal: los puntos son separadores de miles
    if ((s.match(/,/g) || []).length > 1) return null;
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.500" o "1.250.000" → miles
    s = s.replace(/\./g, '');
  }

  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [ent, dec = ''] = s.split('.');
  const cents = Number(ent) * 100 + Number(dec.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}

const moneyFmt = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2,
});

/** Centavos → "$ 1.234,56" */
export function formatMoney(cents) {
  return moneyFmt.format(cents / 100);
}

/** Centavos → "1234,56" o "1234.56" (sin miles, para CSV/inputs). */
export function centsToPlain(cents, decimal = ',') {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const s = `${Math.floor(abs / 100)}${decimal}${String(abs % 100).padStart(2, '0')}`;
  return neg ? `-${s}` : s;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "2026-10-03" → "03/10/2026" */
export function formatDateShort(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** "2026-10-03" → "sábado 3 de octubre" */
export function formatDateLong(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DIAS[dt.getDay()]} ${d} de ${MESES[m - 1]}`;
}

/** "2026-10" → "octubre 2026" */
export function formatMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
}

/** Cantidad de días de un mes YYYY-MM. */
export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
