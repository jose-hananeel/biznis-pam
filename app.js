// ==========================================================================
// Suivi des Ventes — logique de l'application
// ==========================================================================
 
const EPSILON = 0.01; // tolérance pour les comparaisons de montants (flottants)
 
function configIsPlaceholder() {
  const url = window.SUPABASE_URL || '';
  const key = window.SUPABASE_ANON_KEY || '';
  return url.includes('TON-PROJET') || key.includes('TA_CLE_ANON_PUBLIC') || !url || !key;
}
 
const supa = configIsPlaceholder() ? null : window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
 
const state = {
  user: null,
  ventes: [],
  paiements: [],
  period: 'month',        // 'today' | 'week' | 'month' | 'all'
  filterFrom: null,
  filterTo: null,
  loading: false,
};
 
let currentPayVente = null;
let currentDeleteAction = null;
 
// -------------------------------------------------------------------------
// Helpers : dates
// -------------------------------------------------------------------------
function pad2(n) { return String(n).padStart(2, '0'); }
 
function toLocalDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
 
function todayStr() {
  return toLocalDateStr(new Date());
}
 
function startOfWeekStr() {
  const d = new Date();
  const day = d.getDay(); // 0 = dimanche
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  return toLocalDateStr(monday);
}
 
function startOfMonthStr() {
  const d = new Date();
  return toLocalDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
}
 
function periodStart(period) {
  if (period === 'today') return todayStr();
  if (period === 'week') return startOfWeekStr();
  if (period === 'month') return startOfMonthStr();
  return null; // 'all'
}
 
function formatDateDisplay(dateStr) {
  // dateStr: 'YYYY-MM-DD' -> 'JJ/MM/AAAA'
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
 
function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}
 
// -------------------------------------------------------------------------
// Helpers : argent
// -------------------------------------------------------------------------
const moneyFormatter = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
 
function formatMoney(n) {
  return `${moneyFormatter.format(n || 0)} HTG`;
}
 
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
 
// -------------------------------------------------------------------------
// Helpers : calculs métier
// -------------------------------------------------------------------------
function paidMapByVente() {
  const map = new Map();
  for (const p of state.paiements) {
    map.set(p.vente_id, round2((map.get(p.vente_id) || 0) + Number(p.montant)));
  }
  return map;
}
 
function soldeFor(vente, paidMap) {
  const paid = paidMap.get(vente.id) || 0;
  return round2(Number(vente.montant) - paid);
}
 
function statusFor(vente, paidMap) {
  // Basé uniquement sur le solde réel (et non sur le type) : une vente cash
  // est "Payée" parce que son encaissement automatique couvre tout le
  // montant — si cet encaissement avait échoué, le statut le refléterait
  // au lieu de masquer le problème.
  const solde = soldeFor(vente, paidMap);
  if (solde <= EPSILON) return { label: 'Payé', tone: 'success' };
  const paid = paidMap.get(vente.id) || 0;
  if (paid <= EPSILON) return { label: 'Impayé', tone: 'danger' };
  return { label: 'Partiel', tone: 'warning' };
}
 
// -------------------------------------------------------------------------
// Toasts
// -------------------------------------------------------------------------
function toast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success'
    ? '<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>'
    : '<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>';
  el.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 200);
  }, 3200);
}
 
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}
 
// -------------------------------------------------------------------------
// Modals génériques
// -------------------------------------------------------------------------
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.getAttribute('data-close')));
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(o => o.classList.add('hidden'));
  }
});
 
function askConfirm({ title, body, confirmLabel = 'Supprimer', onConfirm }) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-body').textContent = body;
  const btn = document.getElementById('confirm-action-btn');
  btn.textContent = confirmLabel;
  currentDeleteAction = onConfirm;
  openModal('modal-confirm');
}
document.getElementById('confirm-action-btn').addEventListener('click', async () => {
  if (currentDeleteAction) {
    await currentDeleteAction();
  }
  closeModal('modal-confirm');
});
 
// -------------------------------------------------------------------------
// Authentification
// -------------------------------------------------------------------------
function showLogin() {
  document.getElementById('login-view').classList.remove('hidden');
  document.getElementById('app-view').classList.add('hidden');
}
 
function showApp() {
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('app-view').classList.remove('hidden');
  document.getElementById('user-chip').textContent = state.user?.email || '';
}
 
async function initAuth() {
  const { data } = await supa.auth.getSession();
  if (data.session) {
    state.user = data.session.user;
    showApp();
    await bootApp();
  } else {
    showLogin();
  }
 
  supa.auth.onAuthStateChange((_event, session) => {
    if (session) {
      state.user = session.user;
      showApp();
      bootApp();
    } else {
      state.user = null;
      showLogin();
    }
  });
}
 
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');
  const submitLabel = document.getElementById('login-submit-label');
  errEl.textContent = '';
  submitBtn.disabled = true;
  submitLabel.innerHTML = '<span class="spinner"></span>';
  const { error } = await supa.auth.signInWithPassword({ email, password });
  submitBtn.disabled = false;
  submitLabel.textContent = 'Se connecter';
  if (error) {
    // Message renvoyé tel quel par Supabase (site à un seul utilisateur :
    // pas besoin de le masquer, ça aide à diagnostiquer le vrai problème
    // — ex. "Email not confirmed" si le compte n'a pas été confirmé).
    errEl.textContent = error.message || "Connexion impossible.";
  }
});
 
document.getElementById('logout-btn').addEventListener('click', async () => {
  await supa.auth.signOut();
});
 
// -------------------------------------------------------------------------
// Chargement des données
// -------------------------------------------------------------------------
async function bootApp() {
  document.getElementById('today-label').textContent = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const today = todayStr();
  document.getElementById('sale-date').value = today;
  document.getElementById('pay-date').value = today;
  await fetchAll();
}
 
async function fetchAll() {
  state.loading = true;
  renderSkeletons();
 
  const [{ data: ventes, error: e1 }, { data: paiements, error: e2 }] = await Promise.all([
    supa.from('ventes').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
    supa.from('paiements').select('*').order('date', { ascending: true }),
  ]);
 
  state.loading = false;
 
  if (e1 || e2) {
    toast((e1 || e2).message || "Erreur de chargement des données.", 'error');
    return;
  }
 
  state.ventes = ventes || [];
  state.paiements = paiements || [];
  renderAll();
}
 
function renderSkeletons() {
  const skRow = () => `
    <tr class="skeleton-row">
      <td colspan="6"><div class="skeleton skeleton-bar"></div></td>
    </tr>`;
  document.getElementById('debts-table-wrap').innerHTML =
    `<table class="data-table"><tbody>${skRow()}${skRow()}</tbody></table>`;
  document.getElementById('sales-table-wrap').innerHTML =
    `<table class="data-table"><tbody>${skRow()}${skRow()}${skRow()}</tbody></table>`;
}
 
// -------------------------------------------------------------------------
// Rendu
// -------------------------------------------------------------------------
function renderAll() {
  const paidMap = paidMapByVente();
  renderTodayKpis(paidMap);
  renderPeriodKpis(paidMap);
  renderChart();
  renderDebts(paidMap);
  renderHistory(paidMap);
}
 
function renderTodayKpis(paidMap) {
  const today = todayStr();
  const ventesToday = state.ventes.filter(v => v.date === today);
  const sumVentesToday = ventesToday.reduce((s, v) => s + Number(v.montant), 0);
  const paiementsToday = state.paiements.filter(p => p.date === today);
  const sumEncaisseToday = paiementsToday.reduce((s, p) => s + Number(p.montant), 0);
 
  document.getElementById('kpi-ventes-jour').textContent = formatMoney(sumVentesToday);
  document.getElementById('kpi-ventes-jour-count').textContent =
    ventesToday.length ? `${ventesToday.length} vente${ventesToday.length > 1 ? 's' : ''}` : 'Aucune vente aujourd\'hui';
  document.getElementById('kpi-encaisse-jour').textContent = formatMoney(sumEncaisseToday);
 
  const debts = state.ventes.filter(v => v.type === 'credit' && soldeFor(v, paidMap) > EPSILON);
  const totalDettes = debts.reduce((s, v) => s + soldeFor(v, paidMap), 0);
  document.getElementById('kpi-dettes').textContent = formatMoney(totalDettes);
  document.getElementById('kpi-dettes-count').textContent =
    debts.length ? `${debts.length} client${debts.length > 1 ? 's' : ''} concerné${debts.length > 1 ? 's' : ''}` : 'Aucune dette en cours';
}
 
function renderPeriodKpis(paidMap) {
  const start = periodStart(state.period);
  const ventesIn = start ? state.ventes.filter(v => v.date >= start) : state.ventes;
  const paiementsIn = start ? state.paiements.filter(p => p.date >= start) : state.paiements;
 
  const ca = ventesIn.reduce((s, v) => s + Number(v.montant), 0);
  const encaisse = paiementsIn.reduce((s, p) => s + Number(p.montant), 0);
 
  document.getElementById('kpi-ca').textContent = formatMoney(ca);
  document.getElementById('kpi-ca-count').textContent =
    ventesIn.length ? `${ventesIn.length} vente${ventesIn.length > 1 ? 's' : ''}` : 'Aucune vente sur la période';
  document.getElementById('kpi-encaisse-total').textContent = formatMoney(encaisse);
}
 
document.querySelectorAll('.period-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.period = tab.getAttribute('data-period');
    renderPeriodKpis(paidMapByVente());
  });
});
 
let salesChart = null;
function renderChart() {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(toLocalDateStr(d));
  }
  const totals = days.map(day =>
    round2(state.ventes.filter(v => v.date === day).reduce((s, v) => s + Number(v.montant), 0))
  );
 
  const ctx = document.getElementById('sales-chart').getContext('2d');
  const rootStyles = getComputedStyle(document.documentElement);
  const primary = `hsl(${rootStyles.getPropertyValue('--primary').trim()})`;
  const border = `hsl(${rootStyles.getPropertyValue('--border').trim()})`;
  const muted = `hsl(${rootStyles.getPropertyValue('--muted-foreground').trim()})`;
 
  const data = {
    labels: days.map(formatDateShort),
    datasets: [{
      label: 'Ventes',
      data: totals,
      backgroundColor: primary,
      borderRadius: 5,
      maxBarThickness: 28,
    }],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (ctx) => formatMoney(ctx.parsed.y) },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: muted, font: { size: 11 } } },
      y: {
        grid: { color: border },
        ticks: {
          color: muted, font: { size: 11 },
          callback: (v) => v >= 1000 ? `${v / 1000}k` : v,
        },
        beginAtZero: true,
      },
    },
  };
 
  if (salesChart) {
    salesChart.data = data;
    salesChart.options = options;
    salesChart.update();
  } else {
    salesChart = new Chart(ctx, { type: 'bar', data, options });
  }
}
 
function emptyStateHtml(iconSvg, title, subtitle) {
  return `
    <div class="empty-state">
      <div class="empty-icon">${iconSvg}</div>
      <strong>${title}</strong>
      <span>${subtitle}</span>
    </div>`;
}
 
const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>';
const ICON_INBOX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></svg>';
 
function renderDebts(paidMap) {
  const wrap = document.getElementById('debts-table-wrap');
  const debts = state.ventes
    .filter(v => v.type === 'credit' && soldeFor(v, paidMap) > EPSILON)
    .sort((a, b) => a.date.localeCompare(b.date));
 
  if (!debts.length) {
    wrap.innerHTML = emptyStateHtml(ICON_CHECK, 'Aucune dette en cours', 'Toutes les ventes à crédit ont été encaissées. Bien joué !');
    return;
  }
 
  const rows = debts.map(v => {
    const solde = soldeFor(v, paidMap);
    const paid = paidMap.get(v.id) || 0;
    return `
      <tr>
        <td class="cell-strong">${escapeHtml(v.client_name)}</td>
        <td class="cell-muted">${escapeHtml(v.description)}</td>
        <td class="cell-muted">${formatDateDisplay(v.date)}</td>
        <td class="mono-num">${formatMoney(v.montant)}</td>
        <td class="mono-num cell-strong" style="color:hsl(var(--destructive));">${formatMoney(solde)}</td>
        <td>
          <div class="cell-actions">
            ${paid > EPSILON ? `<button class="btn btn-ghost btn-sm" data-action="history" data-id="${v.id}">Historique</button>` : ''}
            <button class="btn btn-soft btn-sm" data-action="pay" data-id="${v.id}">Encaisser</button>
          </div>
        </td>
      </tr>`;
  }).join('');
 
  wrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Client</th><th>Description</th><th>Date vente</th>
          <th>Montant</th><th>Reste à payer</th><th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
 
  wrap.querySelectorAll('[data-action="pay"]').forEach(btn =>
    btn.addEventListener('click', () => openPayModal(btn.getAttribute('data-id'))));
  wrap.querySelectorAll('[data-action="history"]').forEach(btn =>
    btn.addEventListener('click', () => openHistoryModal(btn.getAttribute('data-id'))));
}
 
function renderHistory(paidMap) {
  const wrap = document.getElementById('sales-table-wrap');
  let list = state.ventes.slice();
  if (state.filterFrom) list = list.filter(v => v.date >= state.filterFrom);
  if (state.filterTo) list = list.filter(v => v.date <= state.filterTo);
 
  if (!list.length) {
    wrap.innerHTML = emptyStateHtml(ICON_INBOX, 'Aucune vente à afficher', 'Enregistre ta première vente avec le bouton « Nouvelle vente » ci-dessus.');
    return;
  }
 
  const rows = list.map(v => {
    const status = statusFor(v, paidMap);
    const typeLabel = v.type === 'cash' ? 'Cash' : 'Crédit';
    return `
      <tr>
        <td class="cell-muted">${formatDateDisplay(v.date)}</td>
        <td class="cell-strong">${escapeHtml(v.client_name)}</td>
        <td class="cell-muted">${escapeHtml(v.description)}</td>
        <td class="mono-num">${formatMoney(v.montant)}</td>
        <td><span class="badge badge-muted">${typeLabel}</span></td>
        <td><span class="badge badge-${status.tone}"><span class="badge-dot"></span>${status.label}</span></td>
        <td>
          <div class="cell-actions">
            <button class="btn btn-ghost btn-icon" data-action="delete" data-id="${v.id}" aria-label="Supprimer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
 
  wrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Date</th><th>Client</th><th>Description</th><th>Montant</th><th>Type</th><th>Statut</th><th></th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
 
  wrap.querySelectorAll('[data-action="delete"]').forEach(btn =>
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const vente = state.ventes.find(v => v.id === id);
      confirmDeleteSale(id, vente ? vente.client_name : 'ce client');
    }));
}
 
document.getElementById('filter-from').addEventListener('change', (e) => {
  state.filterFrom = e.target.value || null;
  renderHistory(paidMapByVente());
});
document.getElementById('filter-to').addEventListener('change', (e) => {
  state.filterTo = e.target.value || null;
  renderHistory(paidMapByVente());
});
document.getElementById('filter-clear').addEventListener('click', () => {
  state.filterFrom = null;
  state.filterTo = null;
  document.getElementById('filter-from').value = '';
  document.getElementById('filter-to').value = '';
  renderHistory(paidMapByVente());
});
 
// -------------------------------------------------------------------------
// Modal : nouvelle vente
// -------------------------------------------------------------------------
let saleType = 'cash';
 
document.getElementById('new-sale-btn').addEventListener('click', () => {
  document.getElementById('sale-form').reset();
  document.getElementById('sale-client').value = '';
  document.getElementById('sale-montant').value = '';
  document.getElementById('sale-description').value = 'Fournitures scolaires';
  document.getElementById('sale-date').value = todayStr();
  document.getElementById('sale-error').textContent = '';
  setSaleType('cash');
  openModal('modal-sale');
  document.getElementById('sale-client').focus();
});
 
document.getElementById('sale-type-segmented').querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => setSaleType(btn.getAttribute('data-value')));
});
function setSaleType(value) {
  saleType = value;
  document.getElementById('sale-type-segmented').querySelectorAll('button').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-value') === value);
  });
}
 
document.getElementById('sale-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('sale-error');
  errEl.textContent = '';
 
  const client_name = document.getElementById('sale-client').value.trim();
  const montant = parseFloat(document.getElementById('sale-montant').value);
  const description = document.getElementById('sale-description').value.trim() || 'Fournitures scolaires';
  const date = document.getElementById('sale-date').value;
 
  if (!client_name) { errEl.textContent = 'Le nom du client est requis.'; return; }
  if (!montant || montant <= 0) { errEl.textContent = 'Le montant doit être supérieur à 0.'; return; }
  if (!date) { errEl.textContent = 'La date est requise.'; return; }
 
  const submitBtn = document.getElementById('sale-submit');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span>';
 
  const { data: vente, error } = await supa.from('ventes')
    .insert({ client_name, montant, description, type: saleType, date })
    .select().single();
 
  if (error) {
    errEl.textContent = error.message;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enregistrer';
    return;
  }
 
  if (saleType === 'cash') {
    const { error: perr } = await supa.from('paiements').insert({ vente_id: vente.id, montant, date });
    if (perr) toast(`Vente enregistrée, mais l'encaissement automatique a échoué : ${perr.message}`, 'error');
  }
 
  submitBtn.disabled = false;
  submitBtn.textContent = 'Enregistrer';
  closeModal('modal-sale');
  toast('Vente enregistrée.', 'success');
  await fetchAll();
});
 
// -------------------------------------------------------------------------
// Modal : encaisser
// -------------------------------------------------------------------------
function openPayModal(venteId) {
  const vente = state.ventes.find(v => v.id === venteId);
  if (!vente) return;
  const paidMap = paidMapByVente();
  const solde = soldeFor(vente, paidMap);
  currentPayVente = vente;
 
  document.getElementById('pay-client-info').textContent =
    `${vente.client_name} — reste à payer : ${formatMoney(solde)}`;
  document.getElementById('pay-montant').value = '';
  document.getElementById('pay-montant').max = solde;
  document.getElementById('pay-date').value = todayStr();
  document.getElementById('pay-error').textContent = '';
  openModal('modal-pay');
  document.getElementById('pay-montant').focus();
}
 
document.getElementById('pay-full-btn').addEventListener('click', () => {
  if (!currentPayVente) return;
  const solde = soldeFor(currentPayVente, paidMapByVente());
  document.getElementById('pay-montant').value = solde;
});
 
document.getElementById('pay-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('pay-error');
  errEl.textContent = '';
  if (!currentPayVente) return;
 
  const montant = parseFloat(document.getElementById('pay-montant').value);
  const date = document.getElementById('pay-date').value;
  const solde = soldeFor(currentPayVente, paidMapByVente());
 
  if (!montant || montant <= 0) { errEl.textContent = 'Le montant doit être supérieur à 0.'; return; }
  if (montant - solde > EPSILON) {
    errEl.textContent = `Le montant dépasse le solde restant (${formatMoney(solde)}).`;
    return;
  }
  if (!date) { errEl.textContent = 'La date est requise.'; return; }
 
  const submitBtn = document.getElementById('pay-submit');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span>';
 
  const { error } = await supa.from('paiements').insert({ vente_id: currentPayVente.id, montant, date });
 
  submitBtn.disabled = false;
  submitBtn.textContent = 'Confirmer';
 
  if (error) { errEl.textContent = error.message; return; }
 
  closeModal('modal-pay');
  const isFull = (solde - montant) <= EPSILON;
  toast(isFull ? 'Dette réglée intégralement.' : 'Paiement partiel enregistré.', 'success');
  currentPayVente = null;
  await fetchAll();
});
 
// -------------------------------------------------------------------------
// Modal : historique des paiements
// -------------------------------------------------------------------------
function openHistoryModal(venteId) {
  const vente = state.ventes.find(v => v.id === venteId);
  if (!vente) return;
  const paidMap = paidMapByVente();
  const paid = paidMap.get(vente.id) || 0;
  const solde = soldeFor(vente, paidMap);
 
  document.getElementById('history-client-info').textContent =
    `${vente.client_name} — vente du ${formatDateDisplay(vente.date)}`;
  document.getElementById('history-summary').innerHTML = `
    <span>Montant total : <b>${formatMoney(vente.montant)}</b></span>
    <span>Reste : <b>${formatMoney(solde)}</b></span>`;
 
  const payments = state.paiements
    .filter(p => p.vente_id === vente.id)
    .sort((a, b) => a.date.localeCompare(b.date));
 
  const list = document.getElementById('history-list');
  if (!payments.length) {
    list.innerHTML = `<p class="modal-subtitle" style="margin:0;">Aucun encaissement pour l'instant.</p>`;
  } else {
    list.innerHTML = payments.map(p => `
      <div class="history-item">
        <span class="h-date">${formatDateDisplay(p.date)}</span>
        <span class="h-amount">${formatMoney(p.montant)}</span>
      </div>`).join('');
  }
 
  openModal('modal-history');
}
 
// -------------------------------------------------------------------------
// Suppression d'une vente
// -------------------------------------------------------------------------
function confirmDeleteSale(venteId, clientName) {
  askConfirm({
    title: 'Supprimer cette vente ?',
    body: `La vente de ${clientName} et tous les encaissements associés seront définitivement supprimés. Cette action est irréversible.`,
    confirmLabel: 'Supprimer',
    onConfirm: async () => {
      const { error } = await supa.from('ventes').delete().eq('id', venteId);
      if (error) { toast(error.message, 'error'); return; }
      toast('Vente supprimée.', 'success');
      await fetchAll();
    },
  });
}
 
// -------------------------------------------------------------------------
// Démarrage
// -------------------------------------------------------------------------
if (configIsPlaceholder()) {
  document.getElementById('config-warning').classList.remove('hidden');
  document.getElementById('login-form').classList.add('hidden');
} else {
  initAuth();
}
