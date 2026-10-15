// Tableau de bord par catégories (Propreté, Circulation, …).
// La page définit window.DASH = { dataFile, prefix, notifKey } avant d'inclure ce script ;
// le fichier de données expose <prefix>_REF_MONTH, _CATS, _MONTHS et _DATA.
let REF_MONTH, CATS, MONTHS_LIST, DATA;

// ── Helpers ───────────────────────────────────────────────────────────────────
const MONTHS_FR = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
function fmtMonth(ym) {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  return `${MONTHS_FR[+m - 1]} ${y}`;
}
function fmt(n) { return n == null ? "—" : Number(n).toLocaleString("fr-CA"); }

function offsetMonth(base, offset) {
  const [y, m] = base.split("-").map(Number);
  let nm = m + offset, ny = y;
  while (nm <= 0) { nm += 12; ny--; }
  while (nm > 12) { nm -= 12; ny++; }
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

function getData(month, catId) {
  return DATA[month]?.[catId] ?? null;
}

// Somme des requêtes d'une catégorie pour une année, jusqu'au mois uptoMM inclus (12 = année complète)
function yearTotal(year, catId, uptoMM = 12) {
  let t = 0;
  for (let mm = 1; mm <= uptoMM; mm++) {
    const d = getData(`${year}-${String(mm).padStart(2, "0")}`, catId);
    if (d) t += d.t;
  }
  return t;
}

function trendPct(curr, prevVal) {
  if (prevVal == null || prevVal === 0) return null;
  return (curr - prevVal) / prevVal * 100;
}

function trendBadge(pct) {
  if (pct === null) return `<span class="trend neutral">—</span>`;
  const sign = pct >= 0 ? "+" : "";
  const cls   = pct > 5 ? "worse" : pct < -5 ? "better" : "neutral";
  const arrow  = pct > 5 ? "↑" : pct < -5 ? "↓" : "→";
  return `<span class="trend ${cls}">${arrow} ${sign}${pct.toFixed(1)}&thinsp;%</span>`;
}

// ── Chart setup ───────────────────────────────────────────────────────────────
Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
Chart.defaults.color = "#64748b";
Object.assign(Chart.defaults.plugins.tooltip, {
  backgroundColor: "rgba(15,23,42,0.88)",
  titleColor: "#e2e8f0", bodyColor: "#94a3b8",
  borderColor: "rgba(255,255,255,.08)", borderWidth: 1,
  padding: 12, cornerRadius: 10, boxPadding: 5, usePointStyle: true,
});

let charts = {};
function destroyAll() { Object.values(charts).forEach(c => c.destroy()); charts = {}; }

// ── Build KPI cards ───────────────────────────────────────────────────────────
function buildKpiCards(ref, m1, m2, y1, y2) {
  const grid = document.getElementById("kpi-grid");
  grid.dataset.n = CATS.length;
  grid.innerHTML = CATS.map(cat => {
    const dRef = getData(ref, cat.id);
    const dM1  = getData(m1,  cat.id);
    const dM2  = getData(m2,  cat.id);
    const dY1  = getData(y1,  cat.id);
    const dY2  = getData(y2,  cat.id);
    const curr = dRef ? dRef.t : 0;
    const compl = dRef && dRef.t ? (dRef.d / dRef.t * 100).toFixed(1) + " %" : "—";

    const rows = [
      { label: `vs ${fmtMonth(m1)} (−1 mois)`,  d: dM1 },
      { label: `vs ${fmtMonth(m2)} (−2 mois)`,  d: dM2 },
      { label: `vs ${fmtMonth(y1)} (−1 an)`,    d: dY1 },
      { label: `vs ${fmtMonth(y2)} (−2 ans)`,   d: dY2 },
    ].map(({ label, d }) => `
      <div class="kpi-comp-row">
        <span class="kpi-comp-label">${label}</span>
        ${trendBadge(trendPct(curr, d ? d.t : null))}
        <span class="kpi-comp-abs">${d ? fmt(d.t) : "—"}</span>
      </div>`).join("");

    return `
      <div class="kpi-card" style="--cat-color:${cat.color}">
        <div class="kpi-cat-header">
          <span class="kpi-icon">${cat.icon}</span>
          <span class="kpi-cat-label">${cat.label}</span>
        </div>
        <div class="kpi-main">${fmt(curr)}</div>
        <div class="kpi-sub-label">requêtes — ${fmtMonth(ref)}</div>
        <div class="kpi-comparisons">${rows}</div>
        ${yearBlock(ref, cat.id)}
        <div class="kpi-completion">Complétion : <strong>${compl}</strong></div>
      </div>`;
  }).join("");
}

// Totaux annuels : année du mois de référence (cumul) vs année précédente
function yearBlock(ref, catId) {
  const [y, m] = ref.split("-").map(Number);
  const ytd      = yearTotal(y, catId, m);
  const prevSame = yearTotal(y - 1, catId, m);
  const prevFull = yearTotal(y - 1, catId);
  const period   = m === 12 ? "" : ` (${MONTHS_FR[0]}–${MONTHS_FR[m - 1]})`;
  return `
    <div class="kpi-years">
      <div class="kpi-year">
        <span class="kpi-year-label">Total ${y}${period}</span>
        <strong class="kpi-year-val">${fmt(ytd)}</strong>
        ${m === 12 ? trendBadge(trendPct(ytd, prevFull)) : trendBadge(trendPct(ytd, prevSame))}
      </div>
      <div class="kpi-year">
        <span class="kpi-year-label">Total ${y - 1}</span>
        <strong class="kpi-year-val">${fmt(prevFull)}</strong>
        <span class="kpi-year-note">${m === 12 ? "" : `${fmt(prevSame)} à pareille date`}</span>
      </div>
    </div>`;
}

// ── Timeline chart ────────────────────────────────────────────────────────────
let timelineIndexed = false;
function buildTimeline() {
  if (charts.timeline) charts.timeline.destroy();
  const last24 = MONTHS_LIST.slice(-24);

  // Estimation du mois en cours
  const _now = new Date();
  const _nowYM = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,"0")}`;
  const _lastM = last24[last24.length - 1];
  const _isPartial = _lastM === _nowYM;
  const _factor = _isPartial
    ? new Date(_now.getFullYear(), _now.getMonth()+1, 0).getDate() / _now.getDate() : 1;
  const _lastIdx = last24.length - 1;

  const datasets = CATS.map(cat => {
    const raw = last24.map((m, i) => {
      const d = getData(m, cat.id);
      if (!d) return 0;
      return (_isPartial && i === _lastIdx) ? Math.round(d.t * _factor) : d.t;
    });
    const base = raw.find(v => v > 0) || 1;
    const data = timelineIndexed ? raw.map(v => +(v / base * 100).toFixed(1)) : raw;
    return {
      label: cat.label,
      data,
      borderColor: cat.color,
      backgroundColor: cat.color + "18",
      borderWidth: 2.5,
      pointRadius: data.map((_, i) => (_isPartial && i === _lastIdx) ? 6 : 2),
      pointHoverRadius: 7,
      pointBackgroundColor: data.map((_, i) => (_isPartial && i === _lastIdx) ? "#f59e0b" : cat.color),
      pointBorderColor:     data.map((_, i) => (_isPartial && i === _lastIdx) ? "#f59e0b" : cat.color),
      pointHoverBackgroundColor: "#fff",
      pointHoverBorderWidth: 2,
      tension: .35,
      fill: false,
    };
  });

  charts.timeline = new Chart(document.getElementById("chart-timeline"), {
    type: "line",
    data: { labels: last24.map(fmtMonth), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, padding: 16 } },
        tooltip: { callbacks: {
          title: ([ctx]) => ctx.label,
          label: ctx => {
            const isEst = _isPartial && ctx.dataIndex === _lastIdx;
            return ` ${ctx.dataset.label} : ${fmt(ctx.parsed.y)}${timelineIndexed ? " (indice)" : ""}${isEst ? " *" : ""}`;
          },
          footer: (items) => {
            if (_isPartial && items.some(c => c.dataIndex === _lastIdx))
              return "* estimation — mois en cours incomplet";
            return "";
          },
        }},
      },
      scales: {
        x: { grid: { display: false }, ticks: { autoSkip: true, maxTicksLimit: 12, maxRotation: 35 } },
        y: {
          grid: { color: "rgba(100,116,139,.12)" }, beginAtZero: false,
          title: { display: true, text: timelineIndexed ? "Indice (base 100 = 1er mois)" : "Nombre de requêtes", font: { size: 11 } },
        },
      },
    },
  });
}

// ── Period comparison chart ───────────────────────────────────────────────────
function buildComparison(ref, m1, m2, y1, y2) {
  if (charts.comparison) charts.comparison.destroy();
  const periods = [
    { key: y2, label: `${fmtMonth(y2)}\n(−2 ans)` },
    { key: y1, label: `${fmtMonth(y1)}\n(−1 an)` },
    { key: m2, label: `${fmtMonth(m2)}\n(−2 mois)` },
    { key: m1, label: `${fmtMonth(m1)}\n(−1 mois)` },
    { key: ref, label: `${fmtMonth(ref)}\n(actuel)` },
  ];

  const datasets = CATS.map((cat, ci) => ({
    label: cat.label,
    data: periods.map(p => {
      const d = getData(p.key, cat.id);
      return d ? d.t : 0;
    }),
    backgroundColor: periods.map((_, pi) => {
      // darken the most recent bar
      const opacity = 0.45 + pi * 0.14;
      return cat.color + Math.round(opacity * 255).toString(16).padStart(2, "0");
    }),
    borderColor: cat.color,
    borderWidth: 1,
    borderRadius: 4,
  }));

  charts.comparison = new Chart(document.getElementById("chart-comparison"), {
    type: "bar",
    data: { labels: periods.map(p => p.label), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, padding: 14 } },
        tooltip: { callbacks: {
          title: ([ctx]) => ctx.label.replace("\n", " "),
          label: ctx => ` ${ctx.dataset.label} : ${fmt(ctx.parsed.y)} req.`,
        }},
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: "rgba(100,116,139,.12)" }, beginAtZero: true },
      },
    },
  });
}

// ── Completion rate chart ─────────────────────────────────────────────────────
function buildCompletion() {
  if (charts.completion) charts.completion.destroy();
  const last24 = MONTHS_LIST.slice(-24);
  const datasets = CATS.map(cat => {
    const data = last24.map(m => {
      const d = getData(m, cat.id);
      if (!d || !d.t) return null;
      return +(d.d / d.t * 100).toFixed(1);
    });
    return {
      label: cat.label,
      data,
      borderColor: cat.color,
      backgroundColor: cat.color + "15",
      borderWidth: 2,
      pointRadius: 2,
      pointHoverRadius: 5,
      tension: .35,
      spanGaps: true,
    };
  });

  // Plancher de l'axe : arrondi à la dizaine sous le plus bas taux observé
  const allRates = datasets.flatMap(ds => ds.data).filter(v => v != null);
  const yMin = allRates.length ? Math.max(0, Math.floor(Math.min(...allRates) / 10) * 10) : 0;

  charts.completion = new Chart(document.getElementById("chart-completion"), {
    type: "line",
    data: { labels: last24.map(fmtMonth), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, padding: 16 } },
        tooltip: { callbacks: {
          title: ([ctx]) => ctx.label,
          label: ctx => ctx.parsed.y != null ? ` ${ctx.dataset.label} : ${ctx.parsed.y} %` : "",
        }},
      },
      scales: {
        x: { grid: { display: false }, ticks: { autoSkip: true, maxTicksLimit: 12, maxRotation: 35 } },
        y: { grid: { color: "rgba(100,116,139,.12)" }, min: yMin, max: 100, ticks: { callback: v => v + " %" } },
      },
    },
  });
}

// ── Period banner ─────────────────────────────────────────────────────────────
function buildBanner(ref, m1, m2, y1, y2) {
  document.getElementById("pb-ref").innerHTML = `Réf : <strong>${fmtMonth(ref)}</strong>`;
  document.getElementById("pb-m1").innerHTML  = `vs <strong>${fmtMonth(m1)}</strong>`;
  document.getElementById("pb-m2").innerHTML  = `vs <strong>${fmtMonth(m2)}</strong>`;
  document.getElementById("pb-y1").innerHTML  = `vs <strong>${fmtMonth(y1)}</strong> (−1 an)`;
  document.getElementById("pb-y2").innerHTML  = `vs <strong>${fmtMonth(y2)}</strong> (−2 ans)`;
}

// ── Period state ──────────────────────────────────────────────────────────────

const PERIOD_KEY = "311_periods_v1";
let pRef, pM1, pM2, pY1, pY2;           // current selection
let pDefRef, pDefM1, pDefM2, pDefY1, pDefY2;  // data defaults

function loadSavedPeriods() {
  try {
    const raw = localStorage.getItem(PERIOD_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const valid = new Set(MONTHS_LIST);
    if (s.ref && valid.has(s.ref)) return s;
  } catch {}
  return null;
}

function savePeriods() {
  localStorage.setItem(PERIOD_KEY, JSON.stringify({ ref: pRef, m1: pM1, m2: pM2, y1: pY1, y2: pY2 }));
}

function renderAll() {
  buildBanner(pRef, pM1, pM2, pY1, pY2);
  buildKpiCards(pRef, pM1, pM2, pY1, pY2);
  destroyAll();
  buildTimeline();
  buildComparison(pRef, pM1, pM2, pY1, pY2);
  buildCompletion();
  checkAlerts(pRef);
}

function togglePeriodEdit() {
  const banner = document.getElementById("period-banner");
  banner.classList.toggle("editing");
  if (banner.classList.contains("editing")) {
    const months = [...MONTHS_LIST].reverse();
    const opts = months.map(m => `<option value="${m}">${fmtMonth(m)}</option>`).join("");
    [["ref", pRef], ["m1", pM1], ["m2", pM2], ["y1", pY1], ["y2", pY2]].forEach(([key, cur]) => {
      const sel = document.getElementById(`sel-${key}`);
      sel.innerHTML = opts;
      sel.value = cur;
    });
  }
}

function applyPeriods() {
  pRef = document.getElementById("sel-ref").value;
  pM1  = document.getElementById("sel-m1").value;
  pM2  = document.getElementById("sel-m2").value;
  pY1  = document.getElementById("sel-y1").value;
  pY2  = document.getElementById("sel-y2").value;
  savePeriods();
  document.getElementById("period-banner").classList.remove("editing");
  renderAll();
}

function resetPeriods() {
  pRef = pDefRef; pM1 = pDefM1; pM2 = pDefM2; pY1 = pDefY1; pY2 = pDefY2;
  localStorage.removeItem(PERIOD_KEY);
  document.getElementById("period-banner").classList.remove("editing");
  renderAll();
}

// ── Notification system ───────────────────────────────────────────────────────

const NOTIF_KEY  = DASH.notifKey;
const COOLDOWN   = 23 * 60 * 60 * 1000;  // 23 h between repeat browser notifs

const METRIC_LABELS = {
  count:      "requêtes",
  pct_m1:     "% vs mois préc.",
  pct_y1:     "% vs an passé",
  completion: "% complétion",
};

function defaultSettings() {
  const s = {};
  for (const cat of CATS)
    s[cat.id] = { enabled: false, metric: "count", direction: "above", threshold: 50, lastNotified: null };
  return s;
}

function loadNotifSettings() {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (!raw) return defaultSettings();
    const saved = JSON.parse(raw);
    const d = defaultSettings();
    for (const [k, v] of Object.entries(saved)) if (k in d) d[k] = { ...d[k], ...v };
    return d;
  } catch { return defaultSettings(); }
}

function saveNotifSettings(s) { localStorage.setItem(NOTIF_KEY, JSON.stringify(s)); }

function getMetricValue(catId, metric, ref) {
  const dRef = getData(ref, catId);
  const curr = dRef ? dRef.t : 0;
  if (metric === "count") return curr;
  if (metric === "completion") return dRef && dRef.t ? dRef.d / dRef.t * 100 : null;
  const cmp  = getData(offsetMonth(ref, metric === "pct_m1" ? -1 : -12), catId);
  if (!cmp || !cmp.t) return null;
  return (curr - cmp.t) / cmp.t * 100;
}

function fmtMetric(value, metric) {
  if (value === null) return "—";
  if (metric === "count") return Math.round(value).toLocaleString("fr-CA");
  return (value >= 0 ? "+" : "") + value.toFixed(1) + " %";
}

// Check alerts on page load — shows banners and fires browser notifs
function checkAlerts(ref) {
  const settings = loadNotifSettings();
  const now      = Date.now();
  const container = document.getElementById("alert-banners");
  container.innerHTML = "";
  let anyActive = false;

  for (const cat of CATS) {
    const s = settings[cat.id];
    if (!s || !s.enabled) continue;
    anyActive = true;

    const value = getMetricValue(cat.id, s.metric, ref);
    if (value === null) continue;

    const triggered = s.direction === "above" ? value > s.threshold : value < s.threshold;
    if (!triggered) continue;

    const dir  = s.direction === "above" ? "supérieur" : "inférieur";
    const vFmt = fmtMetric(value, s.metric);
    const tFmt = fmtMetric(s.threshold, s.metric);

    // In-page banner
    const div = document.createElement("div");
    div.className = "alert-banner";
    div.style.setProperty("--cat-color", cat.color);
    div.innerHTML = `
      <span>${cat.icon}</span>
      <span class="alert-text">
        <strong>${cat.label}</strong> — ${vFmt} (${METRIC_LABELS[s.metric]}) est ${dir} au seuil de ${tFmt}
      </span>
      <button class="alert-close" onclick="this.closest('.alert-banner').remove()">✕</button>`;
    container.appendChild(div);

    // Browser notification (once per 23 h per category)
    const lastMs = s.lastNotified ? new Date(s.lastNotified).getTime() : 0;
    if (now - lastMs > COOLDOWN && typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(`Seuil dépassé — ${cat.label}`, {
        body: `${cat.icon} ${vFmt} (${METRIC_LABELS[s.metric]}) — ${dir} au seuil de ${tFmt}`,
      });
      settings[cat.id].lastNotified = new Date().toISOString();
    }
  }

  saveNotifSettings(settings);
  document.getElementById("notif-btn").classList.toggle("has-alerts", anyActive);
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal() {
  const ref = pRef;
  const settings = loadNotifSettings();
  const body = document.getElementById("modal-body");

  // Notification permission notice
  const permNote = typeof Notification === "undefined"
    ? `<p class="notif-note">⚠️ Les notifications navigateur ne sont pas supportées sur cet appareil.</p>`
    : Notification.permission === "denied"
      ? `<p class="notif-note">🚫 Les notifications sont bloquées dans votre navigateur. Autorisez-les dans les réglages du site pour recevoir des alertes hors de la page.</p>`
      : Notification.permission === "default"
        ? `<p class="notif-note">💡 En enregistrant une alerte, votre navigateur vous demandera la permission d'envoyer des notifications.</p>`
        : `<p class="notif-note">✅ Notifications navigateur autorisées.</p>`;

  body.innerHTML = permNote + CATS.map(cat => {
    const s   = settings[cat.id];
    const cur = fmtMetric(getMetricValue(cat.id, s.metric, ref), s.metric);
    return `
      <div class="alert-card" style="--cat-color:${cat.color}" data-cat="${cat.id}">
        <div class="alert-card-header">
          <span class="alert-cat-icon">${cat.icon}</span>
          <span class="alert-cat-label">${cat.label}</span>
          <span class="alert-cur-val" id="acv-${cat.id}">Actuel : ${cur}</span>
          <label class="toggle-sw">
            <input type="checkbox" class="cat-toggle" data-cat="${cat.id}" ${s.enabled ? "checked" : ""}>
            <span class="toggle-track"></span>
          </label>
        </div>
        <div class="alert-card-body ${s.enabled ? "" : "disabled"}" id="acb-${cat.id}">
          <div class="field-row">
            <div class="alert-field">
              <label>Indicateur</label>
              <select class="f-metric" data-cat="${cat.id}">
                <option value="count"      ${s.metric==="count"      ? "selected":""}>Nbre de requêtes</option>
                <option value="pct_m1"     ${s.metric==="pct_m1"     ? "selected":""}>Var. % vs mois préc.</option>
                <option value="pct_y1"     ${s.metric==="pct_y1"     ? "selected":""}>Var. % vs an passé</option>
                <option value="completion" ${s.metric==="completion"  ? "selected":""}>% complétion</option>
              </select>
            </div>
            <div class="alert-field">
              <label>Condition</label>
              <select class="f-direction" data-cat="${cat.id}">
                <option value="above" ${s.direction==="above" ? "selected":""}>Supérieur à</option>
                <option value="below" ${s.direction==="below" ? "selected":""}>Inférieur à</option>
              </select>
            </div>
          </div>
          <div class="alert-field">
            <label>Seuil</label>
            <input type="number" class="f-threshold" data-cat="${cat.id}"
              value="${s.threshold}" min="0" step="1" placeholder="ex : 50">
          </div>
        </div>
      </div>`;
  }).join("");

  // Live preview: update "Actuel" when metric changes
  body.querySelectorAll(".f-metric").forEach(sel => {
    sel.addEventListener("change", () => {
      const v = getMetricValue(sel.dataset.cat, sel.value, ref);
      document.getElementById(`acv-${sel.dataset.cat}`).textContent = `Actuel : ${fmtMetric(v, sel.value)}`;
    });
  });

  // Toggle enable/disable card body
  body.querySelectorAll(".cat-toggle").forEach(chk => {
    chk.addEventListener("change", () => {
      document.getElementById(`acb-${chk.dataset.cat}`).classList.toggle("disabled", !chk.checked);
    });
  });

  document.getElementById("notif-modal").classList.add("open");
}

function closeModal() {
  document.getElementById("notif-modal").classList.remove("open");
}

function saveModal() {
  const settings = loadNotifSettings();
  document.querySelectorAll(".alert-card").forEach(card => {
    const id = card.dataset.cat;
    settings[id] = {
      ...settings[id],
      enabled:   card.querySelector(".cat-toggle").checked,
      metric:    card.querySelector(".f-metric").value,
      direction: card.querySelector(".f-direction").value,
      threshold: parseFloat(card.querySelector(".f-threshold").value) || 0,
    };
  });

  const anyEnabled = Object.values(settings).some(s => s.enabled);
  if (anyEnabled && typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission();
  }

  saveNotifSettings(settings);
  closeModal();
  checkAlerts(pRef);
}

function sendTestNotif() {
  if (typeof Notification === "undefined") { alert("Notifications non supportées."); return; }
  if (Notification.permission === "granted") {
    new Notification("🔔 Test — Requêtes 311", { body: "Les alertes de seuil fonctionnent correctement." });
  } else {
    Notification.requestPermission().then(p => {
      if (p === "granted")
        new Notification("🔔 Test — Requêtes 311", { body: "Les alertes de seuil fonctionnent correctement." });
    });
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const loadingEl = document.getElementById("loading");
  try {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = DASH.dataFile;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`${DASH.dataFile} introuvable`));
      document.head.appendChild(s);
    });

    REF_MONTH   = window[`${DASH.prefix}_REF_MONTH`];
    CATS        = window[`${DASH.prefix}_CATS`];
    MONTHS_LIST = window[`${DASH.prefix}_MONTHS`];
    DATA        = window[`${DASH.prefix}_DATA`];

    // Compute defaults from data
    pDefRef = REF_MONTH;
    pDefM1  = offsetMonth(pDefRef, -1);
    pDefM2  = offsetMonth(pDefRef, -2);
    pDefY1  = offsetMonth(pDefRef, -12);
    pDefY2  = offsetMonth(pDefRef, -24);

    // Load saved periods or fall back to defaults
    const saved = loadSavedPeriods();
    if (saved) {
      pRef = saved.ref; pM1 = saved.m1; pM2 = saved.m2; pY1 = saved.y1; pY2 = saved.y2;
    } else {
      pRef = pDefRef; pM1 = pDefM1; pM2 = pDefM2; pY1 = pDefY1; pY2 = pDefY2;
    }

    renderAll();

    // Notification modal
    document.getElementById("notif-btn").addEventListener("click", openModal);
    document.getElementById("btn-save-notif").addEventListener("click", saveModal);
    document.getElementById("btn-test-notif").addEventListener("click", sendTestNotif);

    // Toggle absolu / indexé
    document.getElementById("btn-abs").addEventListener("click", () => {
      timelineIndexed = false;
      document.getElementById("btn-abs").classList.add("active");
      document.getElementById("btn-idx").classList.remove("active");
      buildTimeline();
    });
    document.getElementById("btn-idx").addEventListener("click", () => {
      timelineIndexed = true;
      document.getElementById("btn-idx").classList.add("active");
      document.getElementById("btn-abs").classList.remove("active");
      buildTimeline();
    });

    loadingEl.style.display = "none";
  } catch (e) {
    loadingEl.innerHTML = `
      <div style="text-align:center;color:#64748b;padding:2rem">
        <div style="font-size:2rem;margin-bottom:.5rem">⚠️</div>
        <div style="font-weight:600;margin-bottom:.25rem">Impossible de charger les données</div>
        <div style="font-size:.85rem">${e.message}</div>
      </div>`;
  }
}

init();
