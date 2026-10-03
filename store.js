// Persistencia en localStorage + operaciones sobre los gastos
import { isValidISODate } from './format.js';

const KEY = 'gastos.v1';

/** @typedef {{id:string, date:string, concept:string, amount:number, createdAt:number}} Expense */

export function createStore(storage = globalThis.localStorage) {
  let items = load();

  function load() {
    try {
      const raw = storage?.getItem(KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data.filter(isValidExpense) : [];
    } catch {
      return [];
    }
  }

  function save() {
    try {
      storage?.setItem(KEY, JSON.stringify(items));
      return true;
    } catch {
      return false; // almacenamiento lleno o bloqueado (modo privado)
    }
  }

  const newId = () =>
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    all: () => [...items],

    add({ date, concept, amount }) {
      const exp = { id: newId(), date, concept: concept.trim(), amount, createdAt: Date.now() };
      if (!isValidExpense(exp)) throw new Error('Gasto inválido');
      items.push(exp);
      return { expense: exp, saved: save() };
    },

    update(id, patch) {
      const i = items.findIndex(e => e.id === id);
      if (i === -1) return { saved: false };
      const next = { ...items[i], ...patch, concept: (patch.concept ?? items[i].concept).trim() };
      if (!isValidExpense(next)) throw new Error('Gasto inválido');
      items[i] = next;
      return { expense: next, saved: save() };
    },

    remove(id) {
      const removed = items.find(e => e.id === id);
      items = items.filter(e => e.id !== id);
      return { removed, saved: save() };
    },

    restore(exp) {
      if (isValidExpense(exp) && !items.some(e => e.id === exp.id)) items.push(exp);
      return save();
    },

    /** Reemplaza o fusiona con un backup JSON. Devuelve cuántos se importaron. */
    importBackup(data, { replace = false } = {}) {
      const incoming = (Array.isArray(data) ? data : data?.items ?? []).filter(isValidExpense);
      if (replace) items = incoming;
      else {
        const ids = new Set(items.map(e => e.id));
        for (const e of incoming) if (!ids.has(e.id)) items.push(e);
      }
      save();
      return incoming.length;
    },

    exportBackup: () => ({ app: 'gastos', version: 1, exportedAt: new Date().toISOString(), items }),
  };
}

export function isValidExpense(e) {
  return !!e && typeof e.id === 'string' && isValidISODate(e.date) &&
    typeof e.concept === 'string' && e.concept.trim().length > 0 && e.concept.length <= 120 &&
    Number.isSafeInteger(e.amount) && e.amount > 0;
}

/** Filtra por período. mode: day | month | range | all */
export function filterByPeriod(items, mode, { day, month, from, to } = {}) {
  switch (mode) {
    case 'day': return items.filter(e => e.date === day);
    case 'month': return items.filter(e => e.date.startsWith(month + '-'));
    case 'range': {
      const [a, b] = from <= to ? [from, to] : [to, from];
      return items.filter(e => e.date >= a && e.date <= b);
    }
    default: return [...items];
  }
}

export const sumCents = list => list.reduce((s, e) => s + e.amount, 0);

/** Agrupa por fecha, más reciente primero. */
export function groupByDay(list) {
  const map = new Map();
  for (const e of [...list].sort((a, b) =>
    b.date.localeCompare(a.date) || b.createdAt - a.createdAt)) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push(e);
  }
  return [...map.entries()].map(([date, items]) => ({ date, items, total: sumCents(items) }));
}
