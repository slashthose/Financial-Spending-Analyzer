// ── FinWise Dashboard JS ──────────────────────────────────────────
const COLORS = {
  blush: '#F4A7B9', butter: '#F5E642', sage: '#B8D4A8',
  lavender: '#C9B8E8', peach: '#FFD9A0', teal: '#A8D4D4',
  ink: '#1A1A2E', muted: '#7A7A9A', white: '#FEFEFE',
};

let _charts = {};        // store Chart.js instances
let _calData = {};       // {date: amount}
let _calYear, _calMonth; // currently displayed month
let _txPage = 1;
let _monthlyType = 'stacked';
let _monthlyData = null;

const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtDec = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

function destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

// ── Navigation ───────────────────────────────────────────────────
document.querySelectorAll('.nav-item[data-section]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    const sec = el.dataset.section;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
    document.getElementById('section-' + sec)?.classList.add('active');
    document.getElementById('pageTitle').textContent = el.textContent.trim();
  });
});

// ── Load all data ────────────────────────────────────────────────
async function loadAllData() {
  const [overview, categories, ie, monthly, weekly, trends, anomalies, insights, calendar, health] =
    await Promise.all([
      fetch('/api/overview').then(r=>r.json()),
      fetch('/api/categories').then(r=>r.json()),
      fetch('/api/income-expense').then(r=>r.json()),
      fetch('/api/monthly').then(r=>r.json()),
      fetch('/api/weekly').then(r=>r.json()),
      fetch('/api/trends').then(r=>r.json()),
      fetch('/api/anomalies').then(r=>r.json()),
      fetch('/api/insights').then(r=>r.json()),
      fetch('/api/calendar').then(r=>r.json()),
      fetch('/api/health').then(r=>r.json()),
    ]);

  renderOverview(overview);
  renderCategories(categories);
  renderIncomeExpense(ie);
  renderMonthly(monthly);
  renderWeekly(weekly);
  renderTrends(trends);
  renderAnomalies(anomalies);
  renderInsights(insights);
  renderHealth(health, insights.tips);
  renderCalendar(calendar);
  renderSidebar(overview, health, anomalies);
  loadTransactions(1);
}

// ── Overview stats ───────────────────────────────────────────────
function renderOverview(d) {
  document.getElementById('statIncome').textContent = fmt(d.total_income);
  document.getElementById('statExpenses').textContent = fmt(d.total_expenses);
  document.getElementById('statSavings').textContent = fmt(d.net_savings);
  document.getElementById('statSavingsRate').textContent = d.savings_rate + '% savings rate';
  document.getElementById('statSpendingRate').textContent = (100 - d.savings_rate).toFixed(1) + '%';
  document.getElementById('statTxCount').textContent = d.total_transactions + ' transactions';
  document.getElementById('statIncomeRange').textContent = d.date_range.start + ' – ' + d.date_range.end;
  document.getElementById('pageSub').textContent =
    `${d.date_range.start} → ${d.date_range.end} · ${d.total_transactions} transactions`;
  document.getElementById('dateBadge').textContent =
    new Date().toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'});
  document.getElementById('pageTitle').textContent = getGreeting() + ' ✦';
}

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

// ── Categories ───────────────────────────────────────────────────
function renderCategories(d) {
  // Donut (overview)
  destroyChart('donut');
  const ctx = document.getElementById('donutChart').getContext('2d');
  _charts['donut'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: d.labels,
      datasets: [{ data: d.values, backgroundColor: d.colors, borderWidth: 2, borderColor: COLORS.white }]
    },
    options: {
      cutout: '68%', plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => ` ₹${ctx.raw.toLocaleString('en-IN')} (${d.percentages[ctx.dataIndex]}%)` }
      }},
      animation: { animateRotate: true, duration: 800 }
    }
  });

  document.getElementById('donutTopCat').textContent = d.labels[0] || '–';

  // Legend
  const leg = document.getElementById('catLegend');
  leg.innerHTML = d.labels.slice(0, 5).map((label, i) =>
    `<div class="legend-item"><div class="legend-dot" style="background:${d.colors[i]}"></div>${label}</div>`
  ).join('');

  // Category bar chart (categories section)
  destroyChart('catBar');
  const ctx2 = document.getElementById('catBarChart').getContext('2d');
  _charts['catBar'] = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: d.labels,
      datasets: [{
        label: 'Amount (₹)',
        data: d.values,
        backgroundColor: d.colors,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: c => ' ' + fmtDec(c.raw) }
      }},
      scales: {
        x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { callback: v => '₹' + (v/1000).toFixed(0) + 'k' }},
        y: { grid: { display: false } }
      },
      animation: { duration: 700 }
    }
  });

  // Category detail table
  const table = document.getElementById('catTable');
  const maxVal = Math.max(...d.values);
  table.innerHTML = d.labels.map((label, i) => `
    <div class="cat-table-row">
      <div class="cat-color-bar" style="background:${d.colors[i]}"></div>
      <div class="cat-name">${label}</div>
      <div class="cat-bar-wrap"><div class="cat-bar-fill" style="background:${d.colors[i]};width:${(d.values[i]/maxVal*100).toFixed(0)}%"></div></div>
      <div class="cat-amount">${fmtDec(d.values[i])}</div>
      <div class="cat-pct">${d.percentages[i]}%</div>
    </div>
  `).join('');
}

// ── Income vs Expense ────────────────────────────────────────────
function renderIncomeExpense(d) {
  // Mini version on overview
  destroyChart('ie');
  const ctx = document.getElementById('incomeExpenseChart').getContext('2d');
  _charts['ie'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: d.months,
      datasets: [
        { label: 'Income', data: d.income, borderColor: COLORS.sage, backgroundColor: 'rgba(184,212,168,0.15)', fill: true, tension: 0.4, pointRadius: 3 },
        { label: 'Expense', data: d.expense, borderColor: COLORS.ink, backgroundColor: 'rgba(26,26,46,0.05)', fill: true, tension: 0.4, pointRadius: 3 },
        { label: 'Savings', data: d.savings, borderColor: COLORS.lavender, borderDash: [5,3], fill: false, tension: 0.4, pointRadius: 2 },
      ]
    },
    options: {
      plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 } }}},
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 6 }},
        y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { callback: v => '₹' + (v/1000).toFixed(0) + 'k', font: { size: 9 }}}
      },
      animation: { duration: 700 }
    }
  });

  // Full version in trends section
  destroyChart('ieFull');
  const ctx2 = document.getElementById('ieChartFull').getContext('2d');
  _charts['ieFull'] = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: d.months,
      datasets: [
        { label: 'Income', data: d.income, backgroundColor: COLORS.sage, borderRadius: 6 },
        { label: 'Expense', data: d.expense, backgroundColor: COLORS.blush, borderRadius: 6 },
        { label: 'Savings', data: d.savings, backgroundColor: COLORS.lavender, borderRadius: 6 },
      ]
    },
    options: {
      plugins: { legend: { labels: { boxWidth: 12, font: { size: 11 }}}},
      scales: {
        x: { grid: { display: false }},
        y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { callback: v => '₹' + (v/1000).toFixed(0) + 'k' }}
      }
    }
  });
}

// ── Monthly ──────────────────────────────────────────────────────
function renderMonthly(d) {
  _monthlyData = d;
  switchMonthly(_monthlyType);

  // Mini spend chart (sessions card)
  const totals = d.months.map((_, mi) => d.series.reduce((sum, s) => sum + (s.data[mi] || 0), 0));
  const avg = totals.reduce((a, b) => a + b, 0) / (totals.length || 1);
  const min = Math.min(...totals);
  const max = Math.max(...totals);
  document.getElementById('sessAvg').textContent = fmt(avg);
  document.getElementById('sessMin').textContent = fmt(min);
  document.getElementById('sessMax').textContent = fmt(max);

  destroyChart('miniSpend');
  const ctx = document.getElementById('miniSpendChart').getContext('2d');
  _charts['miniSpend'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: d.months,
      datasets: [{ data: totals, backgroundColor: 'rgba(26,26,46,0.15)', borderRadius: 4 }]
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + fmt(c.raw) }}},
      scales: { x: { display: false }, y: { display: false }},
      animation: { duration: 500 }
    }
  });
}

function switchMonthly(type) {
  _monthlyType = type;
  document.querySelectorAll('.toggle-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.toLowerCase() === type);
  });
  if (!_monthlyData) return;
  destroyChart('monthly');
  const ctx = document.getElementById('monthlyChart').getContext('2d');
  _charts['monthly'] = new Chart(ctx, {
    type: type === 'stacked' ? 'bar' : 'line',
    data: {
      labels: _monthlyData.months,
      datasets: _monthlyData.series.map(s => ({
        label: s.name,
        data: s.data,
        backgroundColor: type === 'stacked' ? s.color : s.color + '33',
        borderColor: s.color,
        fill: type === 'line',
        tension: 0.4,
        borderRadius: type === 'stacked' ? 4 : 0,
        pointRadius: type === 'line' ? 2 : 0,
      }))
    },
    options: {
      plugins: { legend: { labels: { boxWidth: 9, font: { size: 9 }}, position: 'bottom' }},
      scales: {
        x: { stacked: type === 'stacked', grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 6 }},
        y: { stacked: type === 'stacked', grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { callback: v => '₹' + (v/1000).toFixed(0) + 'k', font: { size: 9 }}}
      },
      animation: { duration: 500 }
    }
  });
}

// ── Weekly ───────────────────────────────────────────────────────
function renderWeekly(d) {
  document.getElementById('peakDayBadge').textContent = '📅 Peak: ' + d.peak_day;
  destroyChart('weekly');
  const ctx = document.getElementById('weeklyChart').getContext('2d');
  const peakIdx = d.days.indexOf(d.peak_day);
  const bgColors = d.days.map((_, i) => i === peakIdx ? COLORS.ink : 'rgba(168,212,212,0.7)');
  _charts['weekly'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: d.days.map(x => x.slice(0,3)),
      datasets: [{ data: d.amounts, backgroundColor: bgColors, borderRadius: 6 }]
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + fmt(c.raw) }}},
      scales: {
        x: { grid: { display: false }},
        y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { callback: v => '₹' + (v/1000).toFixed(0) + 'k' }}
      }
    }
  });
}

// ── Trends ───────────────────────────────────────────────────────
function renderTrends(d) {
  const trendOpts = (canvasId) => {
    destroyChart(canvasId);
    return document.getElementById(canvasId).getContext('2d');
  };

  const makeChart = (ctx) => new Chart(ctx, {
    type: 'line',
    data: {
      labels: d.dates,
      datasets: [{
        label: 'Daily Spend',
        data: d.daily,
        borderColor: COLORS.blush,
        backgroundColor: 'rgba(244,167,185,0.1)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
      }]
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + fmtDec(c.raw) }}},
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 9 }}},
        y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { callback: v => '₹' + (v/1000).toFixed(0) + 'k' }}
      }
    }
  });

  _charts['trend'] = makeChart(trendOpts('trendChart'));
  _charts['trendFull'] = makeChart(trendOpts('trendChartFull'));
}

// ── Anomalies ────────────────────────────────────────────────────
const CAT_COLORS = {
  'Food & Dining':'#F4A7B9','Shopping':'#F5E642','Transportation':'#B8D4A8',
  'Entertainment':'#C9B8E8','Utilities':'#FFD9A0','Healthcare':'#A8D4D4',
  'Education':'#D4A8C9','Housing':'#F4C7A7','Income':'#B8E8C9','Other':'#E8E8E8'
};

function renderAnomalies(d) {
  const el = document.getElementById('anomalyList');
  if (!d.anomalies.length) {
    el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:0.85rem">✦ No anomalies detected — your spending looks consistent!</div>';
    return;
  }
  el.innerHTML = d.anomalies.map(a => `
    <div class="anomaly-row">
      <div class="anomaly-cat-dot" style="background:${CAT_COLORS[a.category]||'#eee'}"></div>
      <div class="anomaly-desc">
        <div class="anomaly-desc-title">${a.description}</div>
        <div class="anomaly-desc-sub">${a.date} · ${a.category}</div>
      </div>
      <div class="anomaly-amount">${fmtDec(a.amount)}</div>
      <div class="anomaly-badge">×${a.z_score.toFixed(1)} avg</div>
    </div>
  `).join('');
}

// ── Insights ─────────────────────────────────────────────────────
function renderInsights(d) {
  const grid = document.getElementById('insightsGrid');
  grid.innerHTML = d.insights.map(i => `
    <div class="insight-card ${i.type}">
      <div class="insight-icon">${i.icon}</div>
      <div class="insight-text">${i.text}</div>
    </div>
  `).join('');
}

// ── Health Score ─────────────────────────────────────────────────
function renderHealth(h, tips) {
  // Big display
  document.getElementById('healthBigScore').textContent = h.score;
  document.getElementById('healthBigGrade').textContent = 'Grade ' + h.grade;
  document.getElementById('sidebarScore').textContent = h.score + ' / 100';
  document.getElementById('sidebarGrade').textContent = h.grade;

  // Progress bars
  const bars = [
    { label: 'Savings Rate', val: h.savings_rate * 2, color: COLORS.sage },
    { label: 'Spending Rate', val: 100 - h.spending_rate, color: COLORS.blush },
  ];
  document.getElementById('healthBars').innerHTML = bars.map(b => `
    <div class="health-bar-row">
      <div class="health-bar-label"><span>${b.label}</span><span>${b.val.toFixed(0)}%</span></div>
      <div class="health-bar-track"><div class="health-bar-fill" style="width:${Math.min(b.val,100)}%;background:${b.color}"></div></div>
    </div>
  `).join('');

  // Tips
  const tipsGrid = document.getElementById('tipsGrid');
  tipsGrid.innerHTML = tips.map(t => `
    <div class="tip-card">
      <div class="tip-icon">${t.icon}</div>
      <div class="tip-title">${t.title}</div>
      <div class="tip-text">${t.text}</div>
    </div>
  `).join('');

  // Ring charts
  drawHealthRing('healthRingSmall', h.score, 38, 10);
  drawHealthRing('healthRingBig', h.score, 72, 16);
}

function drawHealthRing(canvasId, score, radius, lineWidth) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (score / 100) * Math.PI * 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Track
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = lineWidth; ctx.stroke();

  // Fill
  const color = score >= 80 ? COLORS.sage : score >= 60 ? COLORS.butter : COLORS.blush;
  ctx.beginPath(); ctx.arc(cx, cy, radius, startAngle, endAngle);
  ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round'; ctx.stroke();
}

// ── Calendar Heatmap ─────────────────────────────────────────────
function renderCalendar(data) {
  _calData = {};
  data.dates.forEach((d, i) => { _calData[d] = data.amounts[i]; });
  const now = new Date();
  _calYear = now.getFullYear();
  _calMonth = now.getMonth();
  drawCalendar();
}

function drawCalendar() {
  const label = document.getElementById('calMonthLabel');
  const grid = document.getElementById('calGrid');
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  label.textContent = monthNames[_calMonth] + ' ' + _calYear;

  const allVals = Object.values(_calData);
  const maxVal = allVals.length ? Math.max(...allVals) : 1;

  const dayLabels = ['Mo','Tu','We','Th','Fr','Sa','Su'];
  let html = dayLabels.map(d => `<div class="cal-day-label">${d}</div>`).join('');

  const first = new Date(_calYear, _calMonth, 1);
  let startDow = first.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1; // Mon-based

  // blank cells
  for (let i = 0; i < startDow; i++) html += '<div class="cal-day"></div>';

  const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
  const today = new Date();

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${_calYear}-${String(_calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const amt = _calData[dateStr] || 0;
    const intensity = amt ? Math.max(0.1, amt / maxVal) : 0;
    const bg = amt ? `rgba(244,167,185,${intensity.toFixed(2)})` : 'rgba(26,26,46,0.04)';
    const isToday = (today.getFullYear()===_calYear && today.getMonth()===_calMonth && today.getDate()===d);
    const tooltip = amt ? `₹${Math.round(amt).toLocaleString('en-IN')}` : '';
    html += `<div class="cal-day ${amt?'has-data':''} ${isToday?'today':''}" style="background:${bg}">
      ${d}
      ${tooltip ? `<div class="cal-tooltip">${tooltip}</div>` : ''}
    </div>`;
  }

  grid.innerHTML = html;
}

function prevMonth() {
  _calMonth--;
  if (_calMonth < 0) { _calMonth = 11; _calYear--; }
  drawCalendar();
}
function nextMonth() {
  _calMonth++;
  if (_calMonth > 11) { _calMonth = 0; _calYear++; }
  drawCalendar();
}

// ── Right Sidebar (alerts + wins) ────────────────────────────────
function renderSidebar(overview, health, anomalies) {
  // AI alerts
  const alertsEl = document.getElementById('aiAlerts');
  const alerts = [];
  if (health.spending_rate > 80) alerts.push({ icon: '⚠️', text: `High spending rate: ${health.spending_rate}% of income spent this period.` });
  if (anomalies.anomalies.length > 0) alerts.push({ icon: '⚡', text: `${anomalies.anomalies.length} unusual transaction${anomalies.anomalies.length>1?'s':''} detected — check Anomalies tab.` });
  if (health.top_category_pct > 40) alerts.push({ icon: '🔍', text: `${health.top_category} is ${health.top_category_pct}% of expenses — consider a budget cap.` });
  if (!alerts.length) alerts.push({ icon: '✦', text: 'All clear! Spending patterns look healthy this period.' });

  alertsEl.innerHTML = alerts.map(a =>
    `<div class="alert-item"><span class="alert-icon">${a.icon}</span><span>${a.text}</span></div>`
  ).join('');

  // Savings wins
  const winsEl = document.getElementById('savingsWins');
  const wins = [];
  if (overview.savings_rate >= 20) wins.push({ icon: '🎯', text: 'Savings goal hit', val: overview.savings_rate + '%' });
  if (overview.net_savings > 0) wins.push({ icon: '🌱', text: 'Positive savings', val: fmt(overview.net_savings) });
  wins.push({ icon: '📊', text: 'Transactions tracked', val: overview.total_transactions });

  winsEl.innerHTML = wins.map(w =>
    `<div class="win-item"><span>${w.icon}</span><span>${w.text}</span><span class="win-val">${w.val}</span></div>`
  ).join('');
}

// ── Transactions ─────────────────────────────────────────────────
async function loadTransactions(page) {
  _txPage = page;
  const data = await fetch(`/api/transactions?page=${page}`).then(r => r.json());
  document.getElementById('txCount').textContent = data.total + ' total';

  const list = document.getElementById('txList');
  list.innerHTML = data.transactions.map(tx => `
    <div class="tx-row">
      <div class="tx-dot" style="background:${CAT_COLORS[tx.category]||'#eee'}"></div>
      <div>
        <div class="tx-desc">${tx.description}</div>
        <div class="tx-cat">${tx.category}</div>
      </div>
      <div class="tx-date">${tx.date}</div>
      <div class="tx-amount ${tx.type}">${tx.type==='income'?'+':'-'}${fmtDec(tx.amount)}</div>
    </div>
  `).join('');

  const totalPages = Math.ceil(data.total / 20);
  const pg = document.getElementById('pagination');
  let pgHtml = '';
  if (page > 1) pgHtml += `<button class="pg-btn" onclick="loadTransactions(${page-1})">← Prev</button>`;
  for (let p = Math.max(1, page-2); p <= Math.min(totalPages, page+2); p++) {
    pgHtml += `<button class="pg-btn ${p===page?'active':''}" onclick="loadTransactions(${p})">${p}</button>`;
  }
  if (page < totalPages) pgHtml += `<button class="pg-btn" onclick="loadTransactions(${page+1})">Next →</button>`;
  pg.innerHTML = pgHtml;
}

// ── Init ─────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadAllData();
});
