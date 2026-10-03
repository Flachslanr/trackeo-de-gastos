import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAmountToCents, centsToPlain, isValidISODate, todayISO, formatDateLong, daysInMonth,
} from './format.js';
import { buildCSV, escapeField, csvFilename } from './csv.js';
import { createStore, filterByPeriod, groupByDay, sumCents } from './store.js';

test('parseAmountToCents: formatos argentino y estándar', () => {
  const cases = {
    '1500': 150000, '1.500': 150000, '1.250.000': 125000000, '1.234,56': 123456,
    '1500,5': 150050, '0,99': 99, '1234.56': 123456, '12.5': 1250, '$ 2.000': 200000, ' 75 ': 7500,
  };
  for (const [inp, out] of Object.entries(cases)) assert.equal(parseAmountToCents(inp), out, inp);
  for (const bad of ['', 'abc', '0', '-5', '1,2,3', '1.2.3', '1,234', '1,999,00', null])
    assert.equal(parseAmountToCents(bad), null, String(bad)); // "1,234" es ambiguo → se rechaza
});

test('centsToPlain y fechas', () => {
  assert.equal(centsToPlain(123456, ','), '1234,56');
  assert.equal(centsToPlain(5, '.'), '0.05');
  assert.ok(isValidISODate('2024-02-29'));
  assert.ok(!isValidISODate('2026-02-30'));
  assert.ok(!isValidISODate('2026-1-01'));
  assert.equal(todayISO(new Date(2026, 9, 3, 23, 30)), '2026-10-03'); // sin desfase UTC
  assert.equal(formatDateLong('2026-10-03'), 'sábado 3 de octubre');
  assert.equal(daysInMonth('2026-02'), 28);
});

test('CSV: escape, BOM, total y formato AR', () => {
  assert.equal(escapeField('a;b', ';'), '"a;b"');
  assert.equal(escapeField('dijo "hola"', ','), '"dijo ""hola"""');
  assert.equal(escapeField('=SUMA(A1)', ';'), "'=SUMA(A1)");
  const csv = buildCSV([
    { date: '2026-10-02', concept: 'Café; medialunas', amount: 350000, createdAt: 2 },
    { date: '2026-10-01', concept: 'Nafta', amount: 4500050, createdAt: 1 },
  ], 'ar');
  assert.ok(csv.startsWith('﻿'));
  assert.deepEqual(csv.slice(1).trim().split('\r\n'), [
    'Fecha;Concepto;Importe',
    '01/10/2026;Nafta;45000,50',
    '02/10/2026;"Café; medialunas";3500,00',
    ';TOTAL;48500,50',
  ]);
  const std = buildCSV([{ date: '2026-10-01', concept: 'X', amount: 100 }], 'std');
  assert.match(std, /01\/10\/2026,X,1\.00/);
  assert.equal(csvFilename('range', { from: '2026-10-01', to: '2026-10-15' }), 'gastos_2026-10-01_a_2026-10-15.csv');
});

test('store: alta, edición, baja, filtros y backup', () => {
  const mem = new Map();
  const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const s = createStore(storage);
  const a = s.add({ date: '2026-10-01', concept: ' Super ', amount: 1000 }).expense;
  s.add({ date: '2026-10-03', concept: 'Taxi', amount: 2000 });
  s.add({ date: '2026-09-30', concept: 'Luz', amount: 3000 });
  assert.equal(a.concept, 'Super');
  assert.throws(() => s.add({ date: '2026-10-01', concept: '', amount: 10 }));

  const all = s.all();
  assert.equal(filterByPeriod(all, 'day', { day: '2026-10-03' }).length, 1);
  assert.equal(sumCents(filterByPeriod(all, 'month', { month: '2026-10' })), 3000);
  assert.equal(filterByPeriod(all, 'range', { from: '2026-10-01', to: '2026-09-30' }).length, 2); // rango invertido
  assert.equal(groupByDay(all)[0].date, '2026-10-03');

  s.update(a.id, { amount: 1500 });
  assert.equal(createStore(storage).all().find(e => e.id === a.id).amount, 1500); // persistió

  const { removed } = s.remove(a.id);
  assert.equal(s.all().length, 2);
  s.restore(removed);
  assert.equal(s.all().length, 3);

  const backup = JSON.parse(JSON.stringify(s.exportBackup()));
  const s2 = createStore({ getItem: () => 'basura{', setItem() {} }); // datos corruptos → vacío
  assert.equal(s2.all().length, 0);
  assert.equal(s2.importBackup(backup), 3);
  assert.equal(s2.importBackup(backup), 3); // no duplica
  assert.equal(s2.all().length, 3);
});
