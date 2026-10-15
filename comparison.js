(() => {
  "use strict";

  const data = window.SHADOW_GROWTH_DATA;
  if (!data) return;

  const TX = { date: 0, value: 2, family: 4, lifecycle: 5, disciplines: 8, instructor: 9 };
  const statuses = ["Nuevo", "Renovación continua", "Reactivación", "Resurrección"];
  const currency = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 0 });
  const integer = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });
  const percent = new Intl.NumberFormat("es-PE", { style: "percent", maximumFractionDigits: 1 });
  const monthFormat = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "UTC" });
  const $ = id => document.getElementById(id);

  const addYears = (value, years) => {
    const date = new Date(`${value}T00:00:00Z`);
    date.setUTCFullYear(date.getUTCFullYear() + years);
    return date.toISOString().slice(0, 10);
  };

  const monthLabel = value => monthFormat.format(new Date(`${value.slice(0, 7)}-01T00:00:00Z`));
  const signedCurrency = value => `${value > 0 ? "+" : ""}${currency.format(value)}`;
  const signedPercent = value => value == null ? "Sin base" : `${value >= 0 ? "+" : ""}${percent.format(value)}`;

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
  }

  ["periodFilter", "startDate", "endDate", "lifecycleFilter", "disciplineFilter", "instructorFilter", "familyFilter"]
    .forEach(id => $(id).addEventListener("change", render));
  $("resetFilters").addEventListener("click", render);
  window.addEventListener("resize", render);
  render();
})();
