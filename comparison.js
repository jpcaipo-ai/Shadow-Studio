(() => {
  "use strict";

  const data = window.SHADOW_GROWTH_DATA;
  if (!data) return;

  const TX = { date: 0, customer: 1, value: 2, family: 4, lifecycle: 5, end: 7, disciplines: 8, instructor: 9, renew30: 12, mature30: 13, effectiveDue: 15, effectiveRenew30: 16, effectiveMature30: 17, dueBasis: 18, classLimit: 19 };
  const statuses = ["Nuevo", "Renovación continua", "Reactivación", "Resurrección"];
  const currency = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 0 });
  const integer = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });
  const percent = new Intl.NumberFormat("es-PE", { style: "percent", maximumFractionDigits: 1 });
  const monthFormat = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "UTC" });
  const $ = id => document.getElementById(id);

  const purchaseIndex = new Map();
  const purchasesByCustomer = new Map();
  data.transactions.forEach(row => {
    if (!purchasesByCustomer.has(row[TX.customer])) purchasesByCustomer.set(row[TX.customer], []);
    purchasesByCustomer.get(row[TX.customer]).push(row);
  });
  purchasesByCustomer.forEach(rows => rows.sort((a, b) => a[TX.date].localeCompare(b[TX.date])).forEach((row, index) => purchaseIndex.set(row, index)));

  const addYears = (value, years) => {
    const date = new Date(`${value}T00:00:00Z`);
    date.setUTCFullYear(date.getUTCFullYear() + years);
    return date.toISOString().slice(0, 10);
  };

  const monthLabel = value => monthFormat.format(new Date(`${value.slice(0, 7)}-01T00:00:00Z`));
  const signedCurrency = value => `${value > 0 ? "+" : ""}${currency.format(value)}`;
  const signedPercent = value => value == null ? "Sin base" : `${value >= 0 ? "+" : ""}${percent.format(value)}`;
  const monthEnd = month => {
    const [year, value] = month.split("-").map(Number);
    return `${month}-${String(new Date(Date.UTC(year, value, 0)).getUTCDate()).padStart(2, "0")}`;
  };
  const shiftMonth = (month, amount) => {
    const date = new Date(`${month}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + amount);
    return date.toISOString().slice(0, 7);
  };

  function filters() {
    return {
      start: $("startDate").value,
      end: $("endDate").value,
      lifecycle: $("lifecycleFilter").value,
      discipline: $("disciplineFilter").value,
      instructor: $("instructorFilter").value,
      family: $("familyFilter").value,
    };
  }

  function matchesDimensions(row, current) {
    return (current.lifecycle === "Todos" || row[TX.lifecycle] === current.lifecycle)
      && (current.discipline === "Todos" || row[TX.disciplines].includes(current.discipline))
      && (current.instructor === "Todos" || row[TX.instructor] === current.instructor)
      && (current.family === "Todos" || row[TX.family] === current.family);
  }

  function rowsBetween(start, end, current) {
    return data.transactions.filter(row => row[TX.date] >= start && row[TX.date] <= end && matchesDimensions(row, current));
  }

  function aggregate(rows, status) {
    const selected = status === "Total" ? rows : rows.filter(row => row[TX.lifecycle] === status);
    return { purchases: selected.length, revenue: selected.reduce((total, row) => total + Number(row[TX.value] || 0), 0) };
  }

  function cell(row, value, className = "") {
    const item = document.createElement("td");
    item.textContent = value;
    if (className) item.className = className;
    row.appendChild(item);
  }

  function comparisonRow(label, current, prior, total = false) {
    const row = document.createElement("tr");
    if (total) row.className = "total-row";
    const revenueChange = current.revenue - prior.revenue;
    const revenueRate = prior.revenue ? current.revenue / prior.revenue - 1 : null;
    const purchaseRate = prior.purchases ? current.purchases / prior.purchases - 1 : null;
    const direction = revenueChange >= 0 ? "positive" : "negative";

    cell(row, label);
    cell(row, integer.format(current.purchases));
    cell(row, integer.format(prior.purchases));
    cell(row, signedPercent(purchaseRate), purchaseRate == null ? "" : purchaseRate >= 0 ? "positive" : "negative");
    cell(row, currency.format(current.revenue));
    cell(row, currency.format(prior.revenue));
    cell(row, signedCurrency(revenueChange), `delta-amount ${direction}`);
    cell(row, signedPercent(revenueRate), revenueRate == null ? "" : direction);
    return row;
  }

  function renderRenewalDepth(currentFilters) {
    const maturityCutoff = new Date(`${data.generatedAt}T00:00:00Z`);
    maturityCutoff.setUTCDate(maturityCutoff.getUTCDate() - 30);
    const cutoffIso = maturityCutoff.toISOString().slice(0, 10);
    let latestFullMonth = cutoffIso.slice(0, 7);
    if (monthEnd(latestFullMonth) > cutoffIso) latestFullMonth = shiftMonth(latestFullMonth, -1);
    const months = Array.from({ length: 24 }, (_, index) => shiftMonth(latestFullMonth, index - 23));

    const dimensionMatch = row => (currentFilters.discipline === "Todos" || row[TX.disciplines].includes(currentFilters.discipline))
      && (currentFilters.instructor === "Todos" || row[TX.instructor] === currentFilters.instructor)
      && (currentFilters.family === "Todos" || row[TX.family] === currentFilters.family);

    const cohorts = new Map(months.map(month => [month, Array.from({ length: 3 }, () => ({ due: 0, renewed: 0 }))]));
    data.transactions.forEach(row => {
      if (!row[TX.effectiveDue] || !row[TX.effectiveMature30] || !dimensionMatch(row)) return;
      const month = row[TX.effectiveDue].slice(0, 7);
      if (!cohorts.has(month)) return;
      const index = purchaseIndex.get(row) || 0;
      const band = index === 0 ? 0 : index === 1 ? 1 : 2;
      const result = cohorts.get(month)[band];
      result.due += 1;
      result.renewed += row[TX.effectiveRenew30] ? 1 : 0;
    });

    const latest = cohorts.get(latestFullMonth);
    const labels = ["Primera renovación", "Segunda renovación", "Tercera o más"];
    const coverage = data.effectiveRenewal ? percent.format(data.effectiveRenewal.knownClassLimitCoverage) : "—";
    $("renewalDepthContext").textContent = `Último mes completo: ${monthLabel(latestFullMonth)}. Fecha efectiva = fin contractual o clases agotadas. Cupo identificable en ${coverage} de ciclos.`;
    $("renewalDepthCards").replaceChildren(...labels.map((label, index) => {
      const value = latest[index];
      const card = document.createElement("article");
      card.className = "renewal-depth-card";
      const title = document.createElement("span");
      title.textContent = `${label} · ${monthLabel(latestFullMonth)}`;
      const rate = document.createElement("strong");
      rate.textContent = value.due ? percent.format(value.renewed / value.due) : "Sin casos";
      const detail = document.createElement("p");
      detail.textContent = `${integer.format(value.renewed)} renovaron de ${integer.format(value.due)} que vencieron`;
      card.append(title, rate, detail);
      return card;
    }));

    const rows = [...months].reverse().map(month => {
      const row = document.createElement("tr");
      cell(row, monthLabel(month));
      cohorts.get(month).forEach(value => {
        cell(row, integer.format(value.due));
        cell(row, integer.format(value.renewed));
        cell(row, value.due ? percent.format(value.renewed / value.due) : "—");
      });
      return row;
    });
    $("renewalDepthTable").replaceChildren(...rows);
  }

  function render() {
    const currentFilters = filters();
    if (!currentFilters.start || !currentFilters.end) return;

    const priorStart = addYears(currentFilters.start, -1);
    const priorEnd = addYears(currentFilters.end, -1);
    const currentRows = rowsBetween(currentFilters.start, currentFilters.end, currentFilters);
    const priorRows = rowsBetween(priorStart, priorEnd, currentFilters);
    const visibleStatuses = currentFilters.lifecycle === "Todos" ? statuses : [currentFilters.lifecycle];

    const singleMonth = currentFilters.start.slice(0, 7) === currentFilters.end.slice(0, 7);
    $("lifecycleComparisonTitle").textContent = singleMonth
      ? `${monthLabel(currentFilters.start)} vs. ${monthLabel(priorStart)}`
      : "Lifecycle contra el mismo periodo del año anterior";
    $("lifecycleComparisonContext").textContent = `${currentFilters.start} a ${currentFilters.end} vs. ${priorStart} a ${priorEnd}`;

    const cards = $("lifecycleComparisonCards");
    cards.replaceChildren(...visibleStatuses.map(status => {
      const current = aggregate(currentRows, status);
      const prior = aggregate(priorRows, status);
      const change = current.revenue - prior.revenue;
      const rate = prior.revenue ? current.revenue / prior.revenue - 1 : null;
      const card = document.createElement("article");
      card.className = "lifecycle-compare-card";
      const label = document.createElement("span");
      label.textContent = status;
      const amount = document.createElement("strong");
      amount.textContent = currency.format(current.revenue);
      const detail = document.createElement("p");
      detail.textContent = `Año anterior ${currency.format(prior.revenue)} · ${integer.format(current.purchases)} vs. ${integer.format(prior.purchases)} compras`;
      const delta = document.createElement("b");
      delta.textContent = `${signedCurrency(change)} · ${signedPercent(rate)}`;
      delta.className = change >= 0 ? "positive" : "negative";
      card.append(label, amount, detail, delta);
      return card;
    }));

    const body = $("lifecycleComparisonTable");
    const lifecycleRows = visibleStatuses.map(status => comparisonRow(status, aggregate(currentRows, status), aggregate(priorRows, status)));
    lifecycleRows.push(comparisonRow("Total", aggregate(currentRows, "Total"), aggregate(priorRows, "Total"), true));
    body.replaceChildren(...lifecycleRows);
    renderRenewalDepth(currentFilters);
  }

  ["periodFilter", "startDate", "endDate", "lifecycleFilter", "disciplineFilter", "instructorFilter", "familyFilter"]
    .forEach(id => $(id).addEventListener("change", render));
  $("resetFilters").addEventListener("click", render);
  window.addEventListener("resize", render);
  render();
})();
