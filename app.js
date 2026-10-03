import {
  todayISO, currentMonth, isValidISODate, parseAmountToCents, formatMoney, centsToPlain,
  formatDateShort, formatDateLong, formatMonth, daysInMonth,
} from './format.js';
import { createStore, filterByPeriod, sumCents, groupByDay } from './store.js';
import { buildCSV, csvFilename, CSV_FORMATS } from './csv.js';

const $ = sel => document.querySelector(sel);
const store = createStore();

// Estado de los selectores de período (lista y exportación son independientes)
const state = {
  tab: 'registrar',
  list: { mode: 'month', day: todayISO(), month: currentMonth(), from: firstOfMonth(), to: todayISO(), q: '' },
  exp: { mode: 'month', day: todayISO(), month: currentMonth(), from: firstOfMonth(), to: todayISO(), format: 'ar' },
  editingId: null,
};

function firstOfMonth() { return currentMonth() + '-01'; }

// ---------------- Pestañas ----------------
const TABS = ['registrar', 'movimientos', 'exportar'];
function showTab(name) {
  state.tab = name;
  for (const t of TABS) {
    $(`#tab-${t}`).setAttribute('aria-selected', String(t === name));
    $(`#view-${t}`).hidden = t !== name;
  }
  render();
  window.scrollTo({ top: 0 });
}
for (const t of TABS) $(`#tab-${t}`).addEventListener('click', () => showTab(t));
document.querySelectorAll('[data-goto]').forEach(b =>
  b.addEventListener('click', () => showTab(b.dataset.goto)));

// ---------------- Alta de gastos ----------------
const form = $('#expenseForm');
$('#fDate').value = todayISO();

form.addEventListener('submit', e => {
  e.preventDefault();
  const date = $('#fDate').value;
  const concept = $('#fConcept').value.trim();
  const amount = parseAmountToCents($('#fAmount').value);
  const err = validate(date, concept, amount);
  showError('#formError', err);
  if (err) return;

  const { saved } = store.add({ date, concept, amount });
  form.reset();
  $('#fDate').value = date; // conserva la fecha para cargar varios del mismo día
  toast(saved ? `Guardado: ${concept} · ${formatMoney(amount)}`
              : 'No se pudo guardar en el dispositivo (¿modo privado?)');
  render();
  $('#fConcept').focus();
});

function validate(date, concept, amount) {
  if (!isValidISODate(date)) return 'Elegí una fecha válida.';
  if (!concept) return 'Escribí un concepto o referencia.';
  if (amount == null) return 'Ingresá un importe válido mayor a cero (ej.: 1.250,50).';
  return null;
}
function showError(sel, msg) {
  const el = $(sel);
  el.textContent = msg ?? '';
  el.hidden = !msg;
}

// ---------------- Edición ----------------
const dlg = $('#editDialog');
function openEdit(id) {
  const exp = store.all().find(e => e.id === id);
  if (!exp) return;
  state.editingId = id;
  $('#eDate').value = exp.date;
  $('#eConcept').value = exp.concept;
  $('#eAmount').value = centsToPlain(exp.amount, ',');
  showError('#editError', null);
  dlg.showModal();
}
$('#editForm').addEventListener('submit', e => {
  e.preventDefault();
  const date = $('#eDate').value;
  const concept = $('#eConcept').value.trim();
  const amount = parseAmountToCents($('#eAmount').value);
  const err = validate(date, concept, amount);
  showError('#editError', err);
  if (err) return;
  store.update(state.editingId, { date, concept, amount });
  dlg.close();
  toast('Cambios guardados');
  render();
});
$('#btnCancel').addEventListener('click', () => dlg.close());
$('#btnDelete').addEventListener('click', () => {
  const { removed } = store.remove(state.editingId);
  dlg.close();
  render();
  if (removed) toast(`Eliminado: ${removed.concept}`, 'Deshacer', () => { store.restore(removed); render(); });
});

// Delegación: click / Enter sobre un ítem abre la edición
document.addEventListener('click', e => {
  const li = e.target.closest('.item[data-id]');
  if (li) openEdit(li.dataset.id);
});
document.addEventListener('keydown', e => {
  const li = e.target.closest?.('.item[data-id]');
  if (li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openEdit(li.dataset.id); }
});

// ---------------- Selectores de período ----------------
function setupPeriod(segSel, boxSel, s, onChange) {
  const seg = $(segSel);
  seg.addEventListener('click', e => {
    const b = e.target.closest('button[data-mode]');
    if (!b) return;
    s.mode = b.dataset.mode;
    renderPeriod();
    onChange();
  });

  function renderPeriod() {
    seg.querySelectorAll('button').forEach(b =>
      b.setAttribute('aria-checked', String(b.dataset.mode === s.mode)));
    const box = $(boxSel);
    const id = boxSel.slice(1);
    const inp = (key, type, label) => `
      <div class="field"><label for="${id}-${key}">${label}</label>
      <input id="${id}-${key}" type="${type}" value="${s[key]}" data-key="${key}" required></div>`;
    box.innerHTML =
      s.mode === 'day' ? inp('day', 'date', 'Día') :
      s.mode === 'month' ? inp('month', 'month', 'Mes') :
      s.mode === 'range' ? `<div class="row2">${inp('from', 'date', 'Desde')}${inp('to', 'date', 'Hasta')}</div>` : '';
    box.querySelectorAll('input').forEach(i => i.addEventListener('change', () => {
      const k = i.dataset.key;
      const ok = k === 'month' ? /^\d{4}-(0[1-9]|1[0-2])$/.test(i.value) : isValidISODate(i.value);
      if (ok) s[k] = i.value; else i.value = s[k]; // descarta valores incompletos o inválidos
      onChange();
    }));
  }
  renderPeriod();
}

setupPeriod('#listModeSeg', '#listPeriod', state.list, () => renderList());
setupPeriod('#expModeSeg', '#expPeriod', state.exp, () => renderExport());
$('#listSearch').addEventListener('input', e => { state.list.q = e.target.value; renderList(); });

// ---------------- Exportación ----------------
const fmtSel = $('#expFormat');
fmtSel.innerHTML = Object.entries(CSV_FORMATS)
  .map(([k, f]) => `<option value="${k}">${f.label}</option>`).join('');
fmtSel.value = state.exp.format;
fmtSel.addEventListener('change', () => { state.exp.format = fmtSel.value; });

function exportItems() { return filterByPeriod(store.all(), state.exp.mode, state.exp); }
function exportFile() {
  const items = exportItems();
  const csv = buildCSV(items, state.exp.format);
  const name = csvFilename(state.exp.mode, state.exp);
  return { items, name, blob: new Blob([csv], { type: 'text/csv;charset=utf-8' }) };
}

$('#btnDownload').addEventListener('click', () => {
  const { items, name, blob } = exportFile();
  if (!items.length) return toast('No hay gastos en ese período');
  downloadBlob(blob, name);
  toast(`Descargado ${name}`);
});

// En iPhone "Compartir" permite mandar el CSV a Archivos, Mail, WhatsApp, etc.
const canShareFiles = (() => {
  try { return !!navigator.canShare?.({ files: [new File([''], 'a.csv', { type: 'text/csv' })] }); }
  catch { return false; }
})();
$('#btnShare').hidden = !canShareFiles;
$('#btnShare').addEventListener('click', async () => {
  const { items, name, blob } = exportFile();
  if (!items.length) return toast('No hay gastos en ese período');
  try {
    await navigator.share({ files: [new File([blob], name, { type: 'text/csv' })], title: name });
  } catch (err) {
    if (err?.name !== 'AbortError') toast('No se pudo compartir; usá Descargar');
  }
});

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------- Copia de seguridad ----------------
$('#btnBackup').addEventListener('click', () => {
  const data = JSON.stringify(store.exportBackup(), null, 2);
  downloadBlob(new Blob([data], { type: 'application/json' }), `gastos_backup_${todayISO()}.json`);
  toast('Copia descargada');
});
$('#backupFile').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const replace = store.all().length > 0 && confirm(
      'Aceptar: REEMPLAZAR todos los gastos actuales por la copia.\nCancelar: SUMAR los de la copia a los actuales.');
    const n = store.importBackup(data, { replace });
    toast(`Copia restaurada: ${n} gastos leídos`);
    render();
  } catch {
    toast('El archivo no es una copia válida');
  }
});

// ---------------- Render ----------------
const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function itemHTML(e, showDate) {
  return `<li class="item" data-id="${e.id}" tabindex="0" role="button" aria-label="Editar ${esc(e.concept)}">
    <span class="concept">${esc(e.concept)}</span>
    ${showDate ? `<span class="meta">${formatDateShort(e.date)}</span>` : ''}
    <span class="amount num">${formatMoney(e.amount)}</span></li>`;
}

function renderHeaderAndStats() {
  const all = store.all();
  const today = todayISO();
  const month = currentMonth();
  const monthItems = filterByPeriod(all, 'month', { month });
  const monthTotal = sumCents(monthItems);
  const elapsed = Math.min(Number(today.slice(8)), daysInMonth(month));

  $('#topMonthLabel').textContent = formatMonth(month);
  $('#topMonthTotal').textContent = formatMoney(monthTotal);
  $('#statToday').textContent = formatMoney(sumCents(filterByPeriod(all, 'day', { day: today })));
  $('#statMonth').textContent = formatMoney(monthTotal);
  $('#statAvg').textContent = formatMoney(Math.round(monthTotal / elapsed));

  // Sugerencias de conceptos ya usados (los más frecuentes primero)
  const freq = new Map();
  for (const e of all) freq.set(e.concept, (freq.get(e.concept) ?? 0) + 1);
  $('#conceptList').innerHTML = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)
    .map(([c]) => `<option value="${esc(c)}"></option>`).join('');
}

function renderRecent() {
  const recent = [...store.all()].sort((a, b) =>
    b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 6);
  $('#recentList').innerHTML = recent.length
    ? recent.map(e => itemHTML(e, true)).join('')
    : '<li class="empty">Todavía no cargaste gastos.</li>';
}

function renderList() {
  const q = state.list.q.trim().toLowerCase();
  let items = filterByPeriod(store.all(), state.list.mode, state.list);
  if (q) items = items.filter(e => e.concept.toLowerCase().includes(q));
  $('#listCount').textContent = `${items.length} ${items.length === 1 ? 'gasto' : 'gastos'}`;
  $('#listTotal').textContent = formatMoney(sumCents(items));
  const groups = groupByDay(items);
  $('#groupedList').innerHTML = groups.length ? groups.map(g => `
    <div class="day-group">
      <div class="day-head"><span class="day-name">${formatDateLong(g.date)}</span>
        <strong class="num">${formatMoney(g.total)}</strong></div>
      <div class="card"><ul class="list">${g.items.map(e => itemHTML(e, false)).join('')}</ul></div>
    </div>`).join('') : '<p class="empty card">No hay gastos en este período.</p>';
}

function renderExport() {
  const items = exportItems();
  const s = state.exp;
  const desc =
    s.mode === 'day' ? `el ${formatDateShort(s.day)}` :
    s.mode === 'month' ? `en ${formatMonth(s.month)}` :
    s.mode === 'range' ? `del ${formatDateShort(s.from <= s.to ? s.from : s.to)} al ${formatDateShort(s.from <= s.to ? s.to : s.from)}` :
    'en total';
  $('#expPreview').innerHTML = items.length
    ? `<strong>${items.length}</strong> ${items.length === 1 ? 'gasto' : 'gastos'} ${desc} · total <strong>${formatMoney(sumCents(items))}</strong><br><span class="muted">Archivo: ${esc(csvFilename(s.mode, s))}</span>`
    : `No hay gastos ${desc}.`;
  $('#btnDownload').disabled = !items.length;
  $('#btnShare').disabled = !items.length;
}

function render() {
  renderHeaderAndStats();
  if (state.tab === 'registrar') renderRecent();
  if (state.tab === 'movimientos') renderList();
  if (state.tab === 'exportar') renderExport();
}

// Si la app queda abierta y cambia el día, actualiza "hoy"
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

// Toast con acción opcional
let toastTimer;
function toast(msg, actionLabel, action) {
  const t = $('#toast'), btn = $('#toastAction');
  $('#toastMsg').textContent = msg;
  btn.hidden = !action;
  btn.textContent = actionLabel ?? '';
  btn.onclick = action ? () => { action(); t.hidden = true; } : null;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, action ? 6000 : 2800);
}

render();
