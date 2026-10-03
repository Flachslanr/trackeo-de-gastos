// Generación de CSV (sin DOM → testeable en Node)
import { centsToPlain, formatDateShort } from './format.js';

export const CSV_FORMATS = {
  // Excel en configuración regional Argentina abre directo con ";" y coma decimal
  ar: { sep: ';', decimal: ',', label: 'Excel Argentina ( ; y coma decimal )' },
  std: { sep: ',', decimal: '.', label: 'Estándar ( , y punto decimal )' },
};

/** Escapa un campo: comillas si hace falta y neutraliza fórmulas (=, +, -, @). */
export function escapeField(value, sep) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (s.includes(sep) || s.includes('"') || /[\r\n]/.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Arma el contenido CSV. Incluye BOM para que Excel respete tildes y ñ.
 * @param {Array<{date:string, concept:string, amount:number}>} items (amount en centavos)
 */
export function buildCSV(items, formatKey = 'ar', { withTotal = true } = {}) {
  const { sep, decimal } = CSV_FORMATS[formatKey] ?? CSV_FORMATS.ar;
  const rows = [['Fecha', 'Concepto', 'Importe']];
  const sorted = [...items].sort((a, b) =>
    a.date.localeCompare(b.date) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
  let total = 0;
  for (const it of sorted) {
    total += it.amount;
    rows.push([formatDateShort(it.date), it.concept, centsToPlain(it.amount, decimal)]);
  }
  if (withTotal && sorted.length) rows.push(['', 'TOTAL', centsToPlain(total, decimal)]);
  return '﻿' + rows.map(r => r.map(f => escapeField(f, sep)).join(sep)).join('\r\n') + '\r\n';
}

/** Nombre de archivo según el período elegido. */
export function csvFilename(mode, { day, month, from, to } = {}) {
  switch (mode) {
    case 'day': return `gastos_${day}.csv`;
    case 'month': return `gastos_${month}.csv`;
    case 'range': return `gastos_${from}_a_${to}.csv`;
    default: return 'gastos_completo.csv';
  }
}
