const STORAGE_KEY = "financeiro-planilha-base-v1";

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const PAYMENT_METHODS = [
  "Débito",
  "Pix",
  "Boleto",
  "Dinheiro",
  "Crédito 1",
  "Crédito 2",
  "Crédito 3",
  "Crédito 4",
  "Crédito 5",
  "Crédito 6",
];

const CATEGORIES = [
  "Contas",
  "Saúde",
  "Lazer",
  "Transporte",
  "Vestuário",
  "Despesas eventuais",
  "Ifood",
  "Mercado",
  "Assinaturas",
  "Academia",
  "Presentes",
  "Desenvolvimento",
];

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const typeFields = {
  income: [
    ["description", "Descrição", "text"],
    ["date", "Data", "date"],
    ["amount", "Valor", "number"],
  ],
  fixed: [
    ["description", "Nome", "text"],
    ["date", "Data", "date"],
    ["category", "Categoria", "category"],
    ["paymentMethod", "Pagamento", "payment"],
    ["amount", "Valor", "number"],
  ],
  expense: [
    ["description", "Descrição", "text"],
    ["date", "Data", "date"],
    ["installments", "Parcela", "text"],
    ["category", "Categoria", "category"],
    ["paymentMethod", "Pagamento", "payment"],
    ["amount", "Valor", "number"],
  ],
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyMonth() {
  return {
    incomes: [],
    fixedCosts: [],
    expenses: [],
    investments: [],
  };
}

function createDefaultState() {
  return {
    settings: {
      ownerName: "",
      activeYear: new Date().getFullYear(),
      initialBalance: 0,
      headlineGoal: "",
      investmentsAffectBalance: true,
      supabaseProfile: "principal",
      supabaseAutoSync: true,
    },
    selectedMonth: MONTHS[0],
    months: Object.fromEntries(MONTHS.map((month) => [month, emptyMonth()])),
    goals: [],
  };
}

function looksLikeLegacyTestState(parsed = {}) {
  const settings = parsed.settings || {};
  if (
    settings.ownerName !== "Mateus" ||
    settings.headlineGoal !== "Teste Supabase" ||
    Number(settings.initialBalance || 0) !== 1000
  ) {
    return false;
  }

  if (Array.isArray(parsed.goals) && parsed.goals.length > 0) {
    return false;
  }

  return MONTHS.every((month) => {
    const bucket = parsed.months?.[month];
    if (!bucket) {
      return true;
    }
    return (
      (bucket.incomes || []).length === 0 &&
      (bucket.fixedCosts || []).length === 0 &&
      (bucket.expenses || []).length === 0 &&
      (bucket.investments || []).length === 0
    );
  });
}

function normalizeState(parsed = {}) {
  if (looksLikeLegacyTestState(parsed)) {
    return createDefaultState();
  }

  const defaults = createDefaultState();
  return {
    ...defaults,
    ...parsed,
    settings: { ...defaults.settings, ...parsed.settings },
    months: MONTHS.reduce((acc, month) => {
      acc[month] = {
        ...emptyMonth(),
        ...(parsed.months?.[month] || {}),
      };
      return acc;
    }, {}),
    goals: Array.isArray(parsed.goals) ? parsed.goals : defaults.goals,
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createDefaultState();
  }

  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return createDefaultState();
  }
}

let state = loadState();

const summaryCards = document.querySelector("#summary-cards");
const monthSelect = document.querySelector("#month-select");
const monthOverview = document.querySelector("#month-overview");
const sheetHero = document.querySelector("#sheet-hero");
const calendarNote = document.querySelector("#calendar-note");
const calendarGrid = document.querySelector("#calendar-grid");
const paymentBreakdown = document.querySelector("#payment-breakdown");
const categoryBreakdown = document.querySelector("#category-breakdown");
const recentActivity = document.querySelector("#recent-activity");
const goalSnapshot = document.querySelector("#goal-snapshot");
const incomeList = document.querySelector("#income-list");
const fixedList = document.querySelector("#fixed-list");
const expenseList = document.querySelector("#expense-list");
const goalsGrid = document.querySelector("#goals-grid");
const annualTableBody = document.querySelector("#annual-table-body");
const settingsForm = document.querySelector("#settings-form");
const seedDemoButton = document.querySelector("#seed-demo");
const importExcelButton = document.querySelector("#import-excel");
const resetButton = document.querySelector("#reset-data");
const addGoalButton = document.querySelector("#add-goal");
const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = document.querySelectorAll(".tab-panel");
const supabaseProfileInput = document.querySelector("#supabase-profile");
const supabaseAutoSyncInput = document.querySelector("#supabase-auto-sync");
const checkRemoteButton = document.querySelector("#check-remote");
const pullRemoteButton = document.querySelector("#pull-remote");
const pushRemoteButton = document.querySelector("#push-remote");
const remoteStatus = document.querySelector("#remote-status");

let categoryChart = null;
let flowChart = null;

let remoteAvailable = false;
let remoteSyncTimer = null;
const runningOnGithubPages = /github\.io$/i.test(window.location.hostname);

function saveState(options = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (
    options.triggerRemote !== false &&
    state.settings.supabaseAutoSync &&
    !runningOnGithubPages
  ) {
    scheduleRemotePush();
  }
}

function sumBy(items, key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function formatMoney(value) {
  return currency.format(Number(value || 0));
}

function formatCompactMoney(value) {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return formatMoney(amount);
}

function formatDateLabel(value) {
  if (!value) {
    return "Sem data";
  }
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) {
    return String(value);
  }
  return `${day}/${month}/${year}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setRemoteStatus(message, tone = "info") {
  remoteStatus.textContent = message;
  remoteStatus.classList.remove("is-error", "is-ok", "is-info");
  if (tone === "error") {
    remoteStatus.classList.add("is-error");
  }
  if (tone === "ok") {
    remoteStatus.classList.add("is-ok");
  }
  if (tone === "info") {
    remoteStatus.classList.add("is-info");
  }
}

function setRemoteControlsDisabled(isDisabled) {
  checkRemoteButton.disabled = isDisabled;
  pullRemoteButton.disabled = isDisabled;
  pushRemoteButton.disabled = isDisabled;
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Falha na requisição (${response.status}).`);
  }
  return data;
}

async function checkRemoteConnection(showSuccess = true) {
  if (runningOnGithubPages) {
    remoteAvailable = false;
    setRemoteControlsDisabled(true);
    setRemoteStatus(
      "Versao online em modo estatico. A sincronizacao com Supabase continua disponivel na execucao local com node server.js.",
      "info"
    );
    return false;
  }

  try {
    const result = await apiRequest("/api/health", { method: "GET" });
    remoteAvailable = Boolean(result.connected);
    setRemoteControlsDisabled(false);
    if (result.connected) {
      setRemoteStatus(
        showSuccess
          ? `Servidor conectado ao Supabase. Tabela ativa: ${result.table}.`
          : `Supabase conectado e pronto. Tabela ativa: ${result.table}.`,
        showSuccess ? "ok" : "info"
      );
    } else {
      setRemoteStatus(
        "Servidor local ativo, mas as credenciais do Supabase ainda não foram configuradas em .env.local.",
        "error"
      );
    }
    return remoteAvailable;
  } catch (error) {
    remoteAvailable = false;
    setRemoteStatus(
      "Servidor local não encontrado. Inicie com `node server.js` para usar o Supabase.",
      "error"
    );
    return false;
  }
}

function scheduleRemotePush() {
  clearTimeout(remoteSyncTimer);
  remoteSyncTimer = setTimeout(() => {
    pushStateToRemote(true);
  }, 800);
}

async function pushStateToRemote(isSilent = false) {
  if (runningOnGithubPages) {
    setRemoteStatus(
      "A versao publicada no GitHub Pages funciona em modo local no navegador. Para sincronizar com o Supabase, use a execucao local com node server.js.",
      "info"
    );
    return;
  }

  try {
    await apiRequest("/api/state", {
      method: "PUT",
      body: JSON.stringify({
        profile: state.settings.supabaseProfile || "principal",
        payload: state,
      }),
    });
    remoteAvailable = true;
    if (!isSilent) {
      setRemoteStatus("Dados enviados para o Supabase com sucesso.", "ok");
    }
  } catch (error) {
    remoteAvailable = false;
    setRemoteStatus(`Falha ao salvar no Supabase: ${error.message}`, "error");
  }
}

async function pullStateFromRemote() {
  if (runningOnGithubPages) {
    setRemoteStatus(
      "A leitura remota nao esta habilitada na versao estatica do GitHub Pages. Use a execucao local com node server.js.",
      "info"
    );
    return;
  }

  try {
    const result = await apiRequest(
      `/api/state?profile=${encodeURIComponent(state.settings.supabaseProfile || "principal")}`,
      { method: "GET" }
    );

    if (!result.data || !result.data.payload) {
      setRemoteStatus("Nenhum registro remoto encontrado para esse perfil.", "error");
      return;
    }

    state = normalizeState(result.data.payload);
    saveState({ triggerRemote: false });
    renderAll();
    remoteAvailable = true;
    setRemoteStatus("Dados carregados do Supabase com sucesso.", "ok");
  } catch (error) {
    remoteAvailable = false;
    setRemoteStatus(`Falha ao carregar do Supabase: ${error.message}`, "error");
  }
}

function getMonthStats(monthName) {
  const month = state.months[monthName];
  const incomes = sumBy(month.incomes, "amount");
  const fixed = sumBy(month.fixedCosts, "amount");
  const expenses = sumBy(month.expenses, "amount");
  const investments = sumBy(month.investments, "amount");
  const outputs = fixed + expenses;
  const balance = incomes - outputs - (state.settings.investmentsAffectBalance ? investments : 0);
  return { incomes, fixed, expenses, investments, outputs, balance };
}

function getAnnualStats() {
  const monthStats = MONTHS.map((month) => ({ month, ...getMonthStats(month) }));
  const populatedMonths = monthStats.filter((item) => item.outputs > 0);
  const incomes = monthStats.reduce((total, item) => total + item.incomes, 0);
  const outputs = monthStats.reduce((total, item) => total + item.outputs, 0);
  const investments = monthStats.reduce((total, item) => total + item.investments, 0);
  const balances = monthStats.reduce((total, item) => total + item.balance, 0);
  const balanceWithInitial = Number(state.settings.initialBalance || 0) + balances;

  const categoryTotals = {};
  const paymentTotals = {};

  MONTHS.forEach((month) => {
    for (const item of [...state.months[month].fixedCosts, ...state.months[month].expenses]) {
      categoryTotals[item.category] = (categoryTotals[item.category] || 0) + Number(item.amount || 0);
      paymentTotals[item.paymentMethod] =
        (paymentTotals[item.paymentMethod] || 0) + Number(item.amount || 0);
    }
  });

  return {
    monthStats,
    incomes,
    outputs,
    investments,
    balanceWithInitial,
    topCategory: Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0],
    topPayment: Object.entries(paymentTotals).sort((a, b) => b[1] - a[1])[0],
    highestMonth: [...populatedMonths].sort((a, b) => b.outputs - a.outputs)[0],
    lowestMonth: [...populatedMonths].sort((a, b) => a.outputs - b.outputs)[0],
  };
}

function createField(field, value = "") {
  const [key, label, type] = field;

  if (type === "payment") {
    return `
      <label class="field-block">
        ${label}
        <select data-field="${key}">
          ${PAYMENT_METHODS.map(
            (item) => `<option value="${item}" ${item === value ? "selected" : ""}>${item}</option>`
          ).join("")}
        </select>
      </label>
    `;
  }

  if (type === "category") {
    return `
      <label class="field-block">
        ${label}
        <select data-field="${key}">
          ${CATEGORIES.map(
            (item) => `<option value="${item}" ${item === value ? "selected" : ""}>${item}</option>`
          ).join("")}
        </select>
      </label>
    `;
  }

  return `
    <label class="field-block">
      ${label}
      <input data-field="${key}" type="${type}" value="${value ?? ""}" ${type === "number" ? 'step="0.01"' : ""} />
    </label>
  `;
}

function renderMonthSelect() {
  monthSelect.innerHTML = MONTHS.map(
    (month) => `<option value="${month}" ${month === state.selectedMonth ? "selected" : ""}>${month}</option>`
  ).join("");
}

function renderSettings() {
  document.querySelector("#owner-name").value = state.settings.ownerName;
  document.querySelector("#active-year").value = state.settings.activeYear;
  document.querySelector("#initial-balance").value = state.settings.initialBalance;
  document.querySelector("#headline-goal").value = state.settings.headlineGoal;
  document.querySelector("#investments-affect-balance").value = String(
    state.settings.investmentsAffectBalance
  );
  supabaseProfileInput.value = state.settings.supabaseProfile;
  supabaseAutoSyncInput.value = String(state.settings.supabaseAutoSync);
}

function renderSummary() {
  const annual = getAnnualStats();
  
  // Calcular progresso baseado nas metas totais se houver
  const totalGoalsTarget = state.goals.reduce((acc, g) => acc + Number(g.target || 0), 0);
  const totalInvested = annual.investments;
  const goalProgress = totalGoalsTarget > 0 ? Math.min((totalInvested / totalGoalsTarget) * 100, 100) : 0;

  summaryCards.innerHTML = [
    ["Entradas no ano", formatMoney(annual.incomes), "positive", "💰"],
    ["Saídas no ano", formatMoney(annual.outputs), "warn", "📉"],
    ["Investimentos", formatMoney(annual.investments), "primary", "🏦"],
    ["Saldo projetado", formatMoney(annual.balanceWithInitial), annual.balanceWithInitial >= 0 ? "positive" : "warn", "⚖️"],
    [
      "Categoria líder",
      annual.topCategory ? `${annual.topCategory[0]} - ${formatMoney(annual.topCategory[1])}` : "Sem dados",
      "", "🏆"
    ],
    [
      "Pagamento mais usado",
      annual.topPayment ? `${annual.topPayment[0]} - ${formatMoney(annual.topPayment[1])}` : "Sem dados",
      "", "💳"
    ],
    [
      "Mês que mais gastou",
      annual.highestMonth ? `${annual.highestMonth.month} - ${formatMoney(annual.highestMonth.outputs)}` : "Sem dados",
      "", "🔥"
    ],
    [
      "Meta de Investimento",
      totalGoalsTarget > 0 ? `${goalProgress.toFixed(1)}% de ${formatMoney(totalGoalsTarget)}` : "Sem metas",
      "", "🎯"
    ],
  ]
    .map(
      ([label, value, tone, icon]) => `
        <article class="summary-tile ${tone || ""}">
          <div class="tile-icon">${icon}</div>
          <div class="tile-content">
            <span>${label}</span>
            <strong>${value}</strong>
          </div>
          ${label === "Meta de Investimento" && totalGoalsTarget > 0 ? `<div class="mini-progress"><span style="width:${goalProgress}%"></span></div>` : ""}
        </article>
      `
    )
    .join("");
}

function renderMonthOverview() {
  const stats = getMonthStats(state.selectedMonth);
  monthOverview.innerHTML = [
    ["Entradas", stats.incomes],
    ["Gastos fixos", stats.fixed],
    ["Saídas variáveis", stats.expenses],
    ["Investimentos", stats.investments],
    ["Saldo do mês", stats.balance],
  ]
    .map(
      ([label, value]) => `
        <article class="metric-chip">
          <p>${label}</p>
          <strong>${formatMoney(value)}</strong>
        </article>
      `
    )
    .join("");
}

function getMonthEntries(monthName) {
  const month = state.months[monthName];
  return [
    ...month.incomes.map((item) => ({ ...item, type: "income", label: "Entrada" })),
    ...month.fixedCosts.map((item) => ({ ...item, type: "fixed", label: "Fixo" })),
    ...month.expenses.map((item) => ({ ...item, type: "expense", label: "Saída" })),
  ].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
}

function getBreakdown(items, key) {
  const map = new Map();
  for (const item of items) {
    const name = item[key] || "Sem classificação";
    map.set(name, (map.get(name) || 0) + Number(item.amount || 0));
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function renderBreakdown(container, rows, emptyLabel) {
  if (!rows.length) {
    container.innerHTML = `<p class="empty-state">${emptyLabel}</p>`;
    return;
  }

  const maxValue = rows[0][1] || 1;
  container.innerHTML = rows
    .map(([name, value]) => {
      const width = Math.max((value / maxValue) * 100, 6);
      return `
        <article class="breakdown-row">
          <div class="breakdown-head">
            <strong>${escapeHtml(name)}</strong>
            <span>${formatMoney(value)}</span>
          </div>
          <div class="breakdown-bar"><span style="width:${width}%"></span></div>
        </article>
      `;
    })
    .join("");
}

function renderRecentActivity(entries) {
  if (!entries.length) {
    recentActivity.innerHTML = `<p class="empty-state">Sem movimentações no mês ativo.</p>`;
    return;
  }

  const latestEntries = [...entries]
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, 6);

  recentActivity.innerHTML = latestEntries
    .map(
      (entry) => `
        <article class="activity-row">
          <div class="activity-head">
            <strong>${escapeHtml(entry.description || "Lançamento")}</strong>
            <span class="activity-type ${entry.type}">${entry.label}</span>
          </div>
          <div class="activity-meta">
            <span>${formatDateLabel(entry.date)}</span>
            <strong>${formatMoney(entry.amount)}</strong>
          </div>
        </article>
      `
    )
    .join("");
}

function renderGoalSnapshot() {
  if (!state.goals.length) {
    goalSnapshot.innerHTML = `<p class="empty-state">Adicione metas para acompanhar aportes do mês.</p>`;
    return;
  }

  const investedThisMonth = Object.fromEntries(
    state.months[state.selectedMonth].investments.map((item) => [item.goalId, Number(item.amount || 0)])
  );
  const investedAllMonths = {};

  MONTHS.forEach((month) => {
    state.months[month].investments.forEach((item) => {
      investedAllMonths[item.goalId] = (investedAllMonths[item.goalId] || 0) + Number(item.amount || 0);
    });
  });

  goalSnapshot.innerHTML = state.goals
    .slice(0, 4)
    .map((goal) => {
      const total = investedAllMonths[goal.id] || 0;
      const monthValue = investedThisMonth[goal.id] || 0;
      const target = Number(goal.target || 0);
      const progress = target > 0 ? Math.min((total / target) * 100, 100) : 0;
      return `
        <article class="goal-strip">
          <div class="breakdown-head">
            <strong>${escapeHtml(goal.name)}</strong>
            <span>${formatMoney(monthValue)} no mês</span>
          </div>
          <div class="goal-strip-bar"><span style="width:${progress}%"></span></div>
          <div class="goal-strip-meta">
            <span>${formatMoney(total)} acumulado</span>
            <span>${target > 0 ? `${progress.toFixed(0)}% da meta` : "Defina um alvo"}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSheetHero(entries) {
  const stats = getMonthStats(state.selectedMonth);
  const year = state.settings.activeYear || new Date().getFullYear();
  const monthIndex = MONTHS.indexOf(state.selectedMonth);
  const outputs = stats.outputs + stats.investments;
  const highlightedDay = [...entries]
    .reduce((best, item) => {
      if (!item.date) {
        return best;
      }
      const day = item.date.split("-")[2];
      if (!day) {
        return best;
      }
      best[day] = (best[day] || 0) + Number(item.amount || 0);
      return best;
    }, {});
  const topDay = Object.entries(highlightedDay).sort((a, b) => b[1] - a[1])[0];

  sheetHero.innerHTML = `
    <article class="sheet-banner">
      <div class="sheet-badge-row">
        <span class="sheet-badge">${escapeHtml(state.selectedMonth)} ${year}</span>
        <span class="sheet-badge">${entries.length} lançamentos</span>
      </div>
      <h2>${formatMoney(stats.balance)}</h2>
      <p>
        Saldo projetado do mês com base em entradas, saídas, gastos fixos e investimentos.
        A interface foi redesenhada para lembrar os blocos visuais da planilha original.
      </p>
    </article>
    <article class="sheet-status">
      <div class="sheet-card-header compact">
        <div>
          <p class="section-kicker">Fechamento do mês</p>
          <h3>Resumo rápido</h3>
        </div>
      </div>
      <div class="sheet-status-grid">
        <div class="sheet-status-block">
          <span>Entradas</span>
          <strong>${formatCompactMoney(stats.incomes)}</strong>
        </div>
        <div class="sheet-status-block">
          <span>Saídas totais</span>
          <strong>${formatCompactMoney(outputs)}</strong>
        </div>
        <div class="sheet-status-block">
          <span>Meta principal</span>
          <strong>${escapeHtml(state.settings.headlineGoal || "Sem meta definida")}</strong>
        </div>
        <div class="sheet-status-block">
          <span>Dia mais intenso</span>
          <strong>${topDay ? `${topDay[0]}/${String(monthIndex + 1).padStart(2, "0")}` : "Sem dados"}</strong>
        </div>
      </div>
    </article>
  `;
}

function renderCalendar(entries) {
  const year = Number(state.settings.activeYear || new Date().getFullYear());
  const monthIndex = MONTHS.indexOf(state.selectedMonth);
  const firstDay = new Date(year, monthIndex, 1);
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const leading = firstDay.getDay();
  const today = new Date();

  const groupedEntries = new Map();
  for (const entry of entries) {
    if (!entry.date) {
      continue;
    }
    const [, month, day] = String(entry.date).split("-");
    if (Number(month) !== monthIndex + 1) {
      continue;
    }
    const key = Number(day);
    if (!groupedEntries.has(key)) {
      groupedEntries.set(key, []);
    }
    groupedEntries.get(key).push(entry);
  }

  const cells = [];
  for (let i = 0; i < leading; i += 1) {
    cells.push(`<article class="calendar-cell is-empty"></article>`);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const dayEntries = groupedEntries.get(day) || [];
    const total = dayEntries.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const isToday =
      today.getFullYear() === year &&
      today.getMonth() === monthIndex &&
      today.getDate() === day;

    const badges = dayEntries
      .slice(0, 2)
      .map(
        (entry) => `
          <div class="calendar-event ${entry.type}">
            <span>${escapeHtml(entry.description || entry.label)}</span>
            <strong>${formatCompactMoney(entry.amount)}</strong>
          </div>
        `
      )
      .join("");

    cells.push(`
      <article class="calendar-cell ${isToday ? "is-today" : ""}">
        <div class="calendar-day">
          <strong>${String(day).padStart(2, "0")}</strong>
          ${dayEntries.length ? `<span class="calendar-total">${formatCompactMoney(total)}</span>` : ""}
        </div>
        <div class="calendar-events">
          ${badges}
          ${dayEntries.length > 2 ? `<div class="calendar-overflow">+${dayEntries.length - 2} lançamentos</div>` : ""}
        </div>
      </article>
    `);
  }

  calendarNote.textContent = `${entries.length} movimentações registradas`;
  calendarGrid.innerHTML = cells.join("");
}

function renderEntryList(container, type, entries) {
  if (!entries.length) {
    container.innerHTML = `<p>Nenhum lançamento neste bloco.</p>`;
    return;
  }

  const fields =
    type === "income" ? typeFields.income : type === "fixed" ? typeFields.fixed : typeFields.expense;

  container.innerHTML = entries
    .map(
      (entry) => `
        <article class="entry-row" data-type="${type}" data-id="${entry.id}">
          <div class="entry-grid">
            ${fields.map((field) => createField(field, entry[field[0]])).join("")}
          </div>
          <button class="danger-link" type="button" data-remove="${entry.id}" data-remove-type="${type}">
            Remover
          </button>
        </article>
      `
    )
    .join("");
}

function findInvestmentValue(month, goalId) {
  const entry = state.months[month].investments.find((item) => item.goalId === goalId);
  return entry ? entry.amount : "";
}

function renderGoals() {
  const totalsByGoal = Object.fromEntries(state.goals.map((goal) => [goal.id, 0]));

  MONTHS.forEach((month) => {
    state.months[month].investments.forEach((investment) => {
      totalsByGoal[investment.goalId] = (totalsByGoal[investment.goalId] || 0) + Number(investment.amount || 0);
    });
  });

  goalsGrid.innerHTML = state.goals
    .map((goal) => {
      const current = totalsByGoal[goal.id] || 0;
      const target = Number(goal.target || 0);
      const progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
      return `
        <article class="goal-card" data-goal-id="${goal.id}">
          <label class="field-block">
            Nome da meta
            <input type="text" data-goal-field="name" value="${goal.name}" />
          </label>
          <label class="field-block">
            Valor alvo
            <input type="number" step="0.01" data-goal-field="target" value="${goal.target}" />
          </label>
          <div class="goal-progress"><span style="width: ${progress}%"></span></div>
          <div class="goal-meta">
            <span>Acumulado: ${formatMoney(current)}</span>
            <span>${progress.toFixed(0)}%</span>
          </div>
          <div class="field-block">
            <span>Aporte em ${state.selectedMonth}</span>
            <input
              type="number"
              step="0.01"
              data-goal-investment="${goal.id}"
              value="${findInvestmentValue(state.selectedMonth, goal.id)}"
            />
          </div>
          <button class="danger-link" type="button" data-delete-goal="${goal.id}">Remover meta</button>
        </article>
      `;
    })
    .join("");
}

function renderAnnualTable() {
  annualTableBody.innerHTML = getAnnualStats()
    .monthStats.map(
      (item) => `
        <tr>
          <td>${item.month}</td>
          <td>${formatMoney(item.incomes)}</td>
          <td>${formatMoney(item.outputs)}</td>
          <td>${formatMoney(item.investments)}</td>
          <td>${formatMoney(item.balance)}</td>
        </tr>
      `
    )
    .join("");
}

function renderDashboard() {
  const selectedEntries = getMonthEntries(state.selectedMonth);
  const breakdownSource = [
    ...state.months[state.selectedMonth].fixedCosts,
    ...state.months[state.selectedMonth].expenses,
  ];

  renderSheetHero(selectedEntries);
  renderSummary();
  renderMonthOverview();
  renderCharts();
  renderCalendar(selectedEntries);
  renderBreakdown(
    paymentBreakdown,
    getBreakdown(breakdownSource, "paymentMethod"),
    "Nenhuma saída classificada por pagamento ainda."
  );
  renderBreakdown(
    categoryBreakdown,
    getBreakdown(breakdownSource, "category"),
    "Nenhuma saída classificada por categoria ainda."
  );
  renderRecentActivity(selectedEntries);
  renderGoalSnapshot();
  renderAnnualTable();
}

function renderCharts() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const textColor = isDark ? "#f8fbff" : "#162334";
  const gridColor = isDark ? "rgba(248, 251, 255, 0.1)" : "rgba(22, 35, 52, 0.1)";

  // 1. Gráfico de Categorias (Mês Atual)
  const breakdownSource = [
    ...state.months[state.selectedMonth].fixedCosts,
    ...state.months[state.selectedMonth].expenses,
  ];
  const categoryData = getBreakdown(breakdownSource, "category");
  
  const categoryCtx = document.getElementById('category-chart').getContext('2d');
  if (categoryChart) categoryChart.destroy();
  
  categoryChart = new Chart(categoryCtx, {
    type: 'doughnut',
    data: {
      labels: categoryData.map(d => d[0]),
      datasets: [{
        data: categoryData.map(d => d[1]),
        backgroundColor: [
          '#2f5d8c', '#d87b4d', '#157f5b', '#b44d32', '#5e6a78', 
          '#4ade80', '#60a5fa', '#fb923c', '#f87171', '#94a3b8'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: textColor, font: { family: 'Manrope', weight: 'bold' } }
        }
      }
    }
  });

  // 2. Gráfico de Fluxo de Caixa (Anual)
  const annualStats = getAnnualStats();
  const flowCtx = document.getElementById('flow-chart').getContext('2d');
  if (flowChart) flowChart.destroy();

  flowChart = new Chart(flowCtx, {
    type: 'line',
    data: {
      labels: MONTHS.map(m => m.substring(0, 3)),
      datasets: [
        {
          label: 'Entradas',
          data: annualStats.monthStats.map(m => m.incomes),
          borderColor: '#157f5b',
          backgroundColor: 'rgba(21, 127, 91, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Saídas',
          data: annualStats.monthStats.map(m => m.outputs),
          borderColor: '#b44d32',
          backgroundColor: 'rgba(180, 77, 50, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Manrope' } }
        },
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { family: 'Manrope' } }
        }
      },
      plugins: {
        legend: {
          labels: { color: textColor, font: { family: 'Manrope', weight: 'bold' } }
        }
      }
    }
  });
}

function renderAll() {
  renderMonthSelect();
  renderSettings();
  renderDashboard();
  renderEntryList(incomeList, "income", state.months[state.selectedMonth].incomes);
  renderEntryList(fixedList, "fixed", state.months[state.selectedMonth].fixedCosts);
  renderEntryList(expenseList, "expense", state.months[state.selectedMonth].expenses);
  renderGoals();
}

function activateTab(tabName) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabName);
  });
}

function addEntry(type) {
  const base = { id: uid(), description: "", date: "", amount: "" };
  if (type === "income") {
    state.months[state.selectedMonth].incomes.push(base);
  } else if (type === "fixed") {
    state.months[state.selectedMonth].fixedCosts.push({
      ...base,
      category: CATEGORIES[0],
      paymentMethod: PAYMENT_METHODS[0],
    });
  } else {
    state.months[state.selectedMonth].expenses.push({
      ...base,
      category: CATEGORIES[0],
      paymentMethod: PAYMENT_METHODS[0],
    });
  }
  saveState();
  renderAll();
}

function removeEntry(type, id) {
  const key = type === "income" ? "incomes" : type === "fixed" ? "fixedCosts" : "expenses";
  state.months[state.selectedMonth][key] = state.months[state.selectedMonth][key].filter(
    (item) => item.id !== id
  );
  saveState();
  renderAll();
}

function updateEntry(type, id, field, value) {
  const key = type === "income" ? "incomes" : type === "fixed" ? "fixedCosts" : "expenses";
  const item = state.months[state.selectedMonth][key].find((entry) => entry.id === id);
  if (!item) {
    return;
  }
  item[field] = field === "amount" ? Number(value || 0) : value;
  saveState();
  renderDashboard();
}

function updateSettings() {
  state.settings.ownerName = document.querySelector("#owner-name").value;
  state.settings.activeYear = Number(document.querySelector("#active-year").value || new Date().getFullYear());
  state.settings.initialBalance = Number(document.querySelector("#initial-balance").value || 0);
  state.settings.headlineGoal = document.querySelector("#headline-goal").value;
  state.settings.investmentsAffectBalance =
    document.querySelector("#investments-affect-balance").value === "true";
  state.settings.supabaseProfile = supabaseProfileInput.value || "principal";
  state.settings.supabaseAutoSync = supabaseAutoSyncInput.value === "true";
  saveState();
  renderDashboard();
}

function addGoal() {
  state.goals.push({ id: uid(), name: "Nova meta", target: 0 });
  saveState();
  renderAll();
}

function updateGoal(goalId, field, value) {
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) {
    return;
  }
  goal[field] = field === "target" ? Number(value || 0) : value;
  saveState();
  renderGoalSnapshot();
}

function deleteGoal(goalId) {
  state.goals = state.goals.filter((goal) => goal.id !== goalId);
  MONTHS.forEach((month) => {
    state.months[month].investments = state.months[month].investments.filter(
      (investment) => investment.goalId !== goalId
    );
  });
  saveState();
  renderAll();
}

function updateInvestment(goalId, value) {
  const monthInvestments = state.months[state.selectedMonth].investments;
  const amount = Number(value || 0);
  const existing = monthInvestments.find((item) => item.goalId === goalId);

  if (amount <= 0) {
    state.months[state.selectedMonth].investments = monthInvestments.filter(
      (item) => item.goalId !== goalId
    );
  } else if (existing) {
    existing.amount = amount;
  } else {
    monthInvestments.push({ id: uid(), goalId, amount });
  }

  saveState();
  renderDashboard();
}

function seedDemoData() {
  state = createDefaultState();
  state.settings.ownerName = "Mateus";
  state.settings.initialBalance = 3500;
  state.settings.activeYear = 2026;
  state.settings.headlineGoal = "Reserva e investimentos";
  state.goals.push(
    { id: uid(), name: "Reserva de emergência", target: 12000 },
    { id: uid(), name: "Viagem", target: 5000 }
  );

  state.months.Janeiro.incomes.push(
    { id: uid(), description: "Salário", date: "2026-01-05", amount: 5200 },
    { id: uid(), description: "Freelance", date: "2026-01-18", amount: 900 }
  );
  state.months.Janeiro.fixedCosts.push(
    {
      id: uid(),
      description: "Aluguel",
      date: "2026-01-10",
      category: "Contas",
      paymentMethod: "Pix",
      amount: 1600,
    },
    {
      id: uid(),
      description: "Academia",
      date: "2026-01-12",
      category: "Academia",
      paymentMethod: "Crédito 1",
      amount: 120,
    }
  );
  state.months.Janeiro.expenses.push(
    {
      id: uid(),
      description: "Mercado do mês",
      date: "2026-01-14",
      category: "Mercado",
      paymentMethod: "Débito",
      amount: 680,
    },
    {
      id: uid(),
      description: "Streaming",
      date: "2026-01-16",
      category: "Assinaturas",
      paymentMethod: "Crédito 2",
      amount: 49.9,
    },
    {
      id: uid(),
      description: "Jantar",
      date: "2026-01-20",
      category: "Ifood",
      paymentMethod: "Pix",
      amount: 74,
    }
  );

  const firstGoalId = state.goals[0].id;
  const secondGoalId = state.goals[1].id;
  state.months.Janeiro.investments.push(
    { id: uid(), goalId: firstGoalId, amount: 500 },
    { id: uid(), goalId: secondGoalId, amount: 200 }
  );

  state.months.Fevereiro.incomes.push({ id: uid(), description: "Salário", date: "2026-02-05", amount: 5200 });
  state.months.Fevereiro.fixedCosts.push({
    id: uid(),
    description: "Aluguel",
    date: "2026-02-10",
    category: "Contas",
    paymentMethod: "Pix",
    amount: 1600,
  });
  state.months.Fevereiro.expenses.push({
    id: uid(),
    description: "Farmácia",
    date: "2026-02-13",
    category: "Saúde",
    paymentMethod: "Débito",
    amount: 180,
  });
  state.months.Fevereiro.investments.push({ id: uid(), goalId: firstGoalId, amount: 450 });

  saveState();
  renderAll();
}

monthSelect.addEventListener("change", (event) => {
  state.selectedMonth = event.target.value;
  saveState();
  renderAll();
});

settingsForm.addEventListener("input", updateSettings);

document.body.addEventListener("click", (event) => {
  const tabName = event.target.dataset.tab;
  if (tabName) {
    activateTab(tabName);
    return;
  }

  const addType = event.target.dataset.add;
  if (addType) {
    addEntry(addType);
    return;
  }

  const removeId = event.target.dataset.remove;
  if (removeId) {
    removeEntry(event.target.dataset.removeType, removeId);
    return;
  }

  const deleteGoalId = event.target.dataset.deleteGoal;
  if (deleteGoalId) {
    deleteGoal(deleteGoalId);
  }
});

document.body.addEventListener("input", (event) => {
  const entryRow = event.target.closest(".entry-row");
  if (entryRow && event.target.dataset.field) {
    updateEntry(entryRow.dataset.type, entryRow.dataset.id, event.target.dataset.field, event.target.value);
    return;
  }

  const goalCard = event.target.closest(".goal-card");
  if (goalCard && event.target.dataset.goalField) {
    updateGoal(goalCard.dataset.goalId, event.target.dataset.goalField, event.target.value);
    return;
  }

  const goalInvestmentId = event.target.dataset.goalInvestment;
  if (goalInvestmentId) {
    updateInvestment(goalInvestmentId, event.target.value);
  }
});

document.body.addEventListener("change", (event) => {
  const goalCard = event.target.closest(".goal-card");
  if (goalCard && (event.target.dataset.goalField || event.target.dataset.goalInvestment)) {
    renderGoals();
    renderDashboard();
  }
});

async function importFromExcel() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".xlsx";

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      const newState = createDefaultState();
      
      // Mapeamento de abas para meses
      const monthMap = {
        "janeiro": "Janeiro", "february": "Fevereiro", "march": "Março", "april": "Abril",
        "may": "Maio", "june": "Junho", "july": "Julho", "august": "Agosto",
        "september": "Setembro", "october": "Outubro", "november": "Novembro", "december": "Dezembro",
        "fevereiro": "Fevereiro", "março": "Março", "abril": "Abril", "maio": "Maio", "junho": "Junho",
        "julho": "Julho", "agosto": "Agosto", "setembro": "Setembro", "outubro": "Outubro", 
        "novembro": "Novembro", "dezembro": "Dezembro"
      };

      workbook.SheetNames.forEach(sheetName => {
        const normalizedName = sheetName.toLowerCase();
        let monthName = null;
        for (const [key, value] of Object.entries(monthMap)) {
          if (normalizedName.includes(key)) {
            monthName = value;
            break;
          }
        }

        if (monthName) {
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          // Lógica de importação baseada na estrutura do arquivo 3.0
          // Entradas: Col 9 (J), Valor: Col 12 (M)
          // Gastos Fixos: Col 14 (O), Valor: Col 18 (S)
          // Débito: Col 22 (W), Valor: Col 26 (AA)
          // Crédito: Col 29 (AD), Parcela: Col 31 (AF), Valor: Col 34 (AI)
          
          for (let i = 19; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            // Incomes
            if (row[9] && row[12] > 0) {
              newState.months[monthName].incomes.push({
                id: uid(),
                description: String(row[9]),
                date: "", 
                amount: Number(row[12])
              });
            }

            // Fixed Costs
            if (row[14] && row[18] > 0) {
              newState.months[monthName].fixedCosts.push({
                id: uid(),
                description: String(row[14]),
                date: row[15] ? String(row[15]) : "",
                category: row[16] || CATEGORIES[0],
                paymentMethod: row[17] || PAYMENT_METHODS[0],
                amount: Number(row[18])
              });
            }

            // Debit (Expenses)
            if (row[22] && row[26] > 0) {
              newState.months[monthName].expenses.push({
                id: uid(),
                description: String(row[22]),
                date: row[23] ? String(row[23]) : "",
                category: row[24] || CATEGORIES[0],
                paymentMethod: "Débito",
                amount: Number(row[26])
              });
            }

            // Credit (Expenses)
            if (row[29] && row[34] > 0) {
              newState.months[monthName].expenses.push({
                id: uid(),
                description: String(row[29]),
                date: row[30] ? String(row[30]) : "",
                installments: row[31] ? String(row[31]) : "",
                category: row[32] || CATEGORIES[0],
                paymentMethod: "Crédito 1",
                amount: Number(row[34])
              });
            }
          }
        } else if (normalizedName.includes("investimentos")) {
          // Importar metas da aba investimentos
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          // Meta 1 está em [3, 6], Meta 2 em [3, 10], etc (pulo de 4 colunas)
          if (rows[3]) {
            for (let col = 6; col <= 42; col += 4) {
              const name = rows[3][col];
              if (name && name.startsWith("Meta")) {
                newState.goals.push({ id: uid(), name: name, target: 0 });
              }
            }
          }
        }
      });

      state = newState;
      saveState();
      renderAll();
      alert("Planilha importada com sucesso!");
    };
    reader.readAsArrayBuffer(file);
  };

  input.click();
}

seedDemoButton.addEventListener("click", seedDemoData);
importExcelButton.addEventListener("click", importFromExcel);
resetButton.addEventListener("click", () => {
  state = createDefaultState();
  saveState();
  renderAll();
});
addGoalButton.addEventListener("click", addGoal);
checkRemoteButton.addEventListener("click", () => {
  checkRemoteConnection(true);
});
pullRemoteButton.addEventListener("click", () => {
  pullStateFromRemote();
});
pushRemoteButton.addEventListener("click", () => {
  pushStateToRemote(false);
});

const toggleThemeButton = document.querySelector("#toggle-theme");

toggleThemeButton.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("financeiro-theme", next);
  renderCharts(); // Atualizar cores dos gráficos
});

// Carregar tema salvo
const savedTheme = localStorage.getItem("financeiro-theme");
if (savedTheme) {
  document.documentElement.setAttribute("data-theme", savedTheme);
}

renderAll();
activateTab("painel");
checkRemoteConnection(false);
