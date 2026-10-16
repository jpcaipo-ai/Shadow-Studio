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
  const nextPurchaseValue = new Map();
  const nextPurchaseRow = new Map();
  const purchasesByCustomer = new Map();
  data.transactions.forEach(row => {
    if (!purchasesByCustomer.has(row[TX.customer])) purchasesByCustomer.set(row[TX.customer], []);
    purchasesByCustomer.get(row[TX.customer]).push(row);
  });
  purchasesByCustomer.forEach(rows => rows.sort((a, b) => a[TX.date].localeCompare(b[TX.date])).forEach((row, index) => {
    purchaseIndex.set(row, index);
    nextPurchaseValue.set(row, rows[index + 1]?.[TX.value] || 0);
    nextPurchaseRow.set(row, rows[index + 1] || null);
  }));

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
    const currentMonth = data.generatedAt.slice(0, 7);
    const months = Array.from({ length: 24 }, (_, index) => shiftMonth(currentMonth, index - 23));

    const dimensionMatch = row => (currentFilters.discipline === "Todos" || row[TX.disciplines].includes(currentFilters.discipline))
      && (currentFilters.instructor === "Todos" || row[TX.instructor] === currentFilters.instructor)
      && (currentFilters.family === "Todos" || row[TX.family] === currentFilters.family);

    const bandOf = row => { const index = purchaseIndex.get(row) || 0; return index === 0 ? 0 : index === 1 ? 1 : 2; };
    const historicRates = [0, 1, 2].map(band => {
      const base = data.transactions.filter(row => row[TX.effectiveMature30] && bandOf(row) === band);
      return base.length ? base.filter(row => row[TX.effectiveRenew30]).length / base.length : 0;
    });
    const cohorts = new Map(months.map(month => [month, []]));
    months.forEach(month => {
      const latestByCustomer = new Map();
      data.transactions.forEach(row => {
        if (!row[TX.effectiveDue]?.startsWith(month) || !dimensionMatch(row)) return;
        const existing = latestByCustomer.get(row[TX.customer]);
        if (!existing || row[TX.date] > existing[TX.date]) latestByCustomer.set(row[TX.customer], row);
      });
      cohorts.set(month, [...latestByCustomer.values()]);
    });
    const stats = (rows, band) => {
      const selected = rows.filter(row => bandOf(row) === band);
      const gross = sumValues(selected, TX.value);
      return {
        due: selected.length,
        renewed: selected.filter(row => row[TX.effectiveRenew30]).length,
        gross,
        expected: gross * historicRates[band],
        actual: selected.filter(row => row[TX.effectiveRenew30]).reduce((total, row) => total + nextPurchaseValue.get(row), 0),
      };
    };
    function sumValues(rows, index) { return rows.reduce((total, row) => total + Number(row[index] || 0), 0); }

    const latest = [0, 1, 2].map(band => stats(cohorts.get(latestFullMonth), band));
    const labels = ["Primera renovación", "Segunda renovación", "Tercera o más"];
    const coverage = data.effectiveRenewal ? percent.format(data.effectiveRenewal.knownClassLimitCoverage) : "—";
    $("renewalDepthContext").textContent = `Último mes completo: ${monthLabel(latestFullMonth)}. Fecha efectiva = fin contractual o clases agotadas. Cupo identificable en ${coverage}. Tasas modelo: 1.ª ${percent.format(historicRates[0])}, 2.ª ${percent.format(historicRates[1])}, 3.ª+ ${percent.format(historicRates[2])}.`;

    const currentRows = cohorts.get(currentMonth);
    const currentStats = [0, 1, 2].map(band => stats(currentRows, band));
    const currentGross = currentStats.reduce((total, value) => total + value.gross, 0);
    const currentExpected = currentStats.reduce((total, value) => total + value.expected, 0);
    const currentActual = currentStats.reduce((total, value) => total + value.actual, 0);
    const currentRenewed = currentStats.reduce((total, value) => total + value.renewed, 0);
    const forecast = [
      ["Clientes por renovar", integer.format(currentRows.length), monthLabel(currentMonth)],
      ["Valor bruto", currency.format(currentGross), "Última membresía comprada"],
      ["Valor esperado", currency.format(currentExpected), "Probabilidad por profundidad"],
      ["Valor real capturado", currency.format(currentActual), "Compras efectivamente realizadas"],
      ["Ya renovaron al corte", integer.format(currentRenewed), `${percent.format(currentRows.length ? currentRenewed / currentRows.length : 0)} de la cartera`],
    ];
    $("renewalForecastCards").replaceChildren(...forecast.map(([label, value, note]) => {
      const card = document.createElement("article"); card.className = "renewal-forecast-card";
      const title = document.createElement("span"); title.textContent = label;
      const amount = document.createElement("strong"); amount.textContent = value;
      const detail = document.createElement("p"); detail.textContent = note;
      card.append(title, amount, detail); return card;
    }));

    $("renewalDepthCards").replaceChildren(...labels.map((label, index) => {
      const value = latest[index];
      const card = document.createElement("article");
      card.className = "renewal-depth-card";
      const title = document.createElement("span");
      title.textContent = `${label} · ${monthLabel(latestFullMonth)}`;
      const rate = document.createElement("strong");
      rate.textContent = value.due ? percent.format(value.renewed / value.due) : "Sin casos";
      const detail = document.createElement("p");
      detail.textContent = `${integer.format(value.renewed)} de ${integer.format(value.due)} · bruto ${currency.format(value.gross)} · esperado ${currency.format(value.expected)} · real ${currency.format(value.actual)}`;
      card.append(title, rate, detail);
      return card;
    }));

    const rows = [...months].reverse().map(month => {
      const row = document.createElement("tr");
      cell(row, monthLabel(month));
      const complete = monthEnd(month) <= cutoffIso;
      const status = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `renewal-status${complete ? "" : " provisional"}`;
      badge.textContent = complete ? "Maduro" : "Provisional";
      status.appendChild(badge); row.appendChild(status);
      [0, 1, 2].map(band => stats(cohorts.get(month), band)).forEach(value => {
        cell(row, integer.format(value.due));
        cell(row, integer.format(value.renewed));
        cell(row, value.due ? percent.format(value.renewed / value.due) : "—");
        cell(row, currency.format(value.gross));
        cell(row, currency.format(value.expected));
        cell(row, currency.format(value.actual));
      });
      return row;
    });
    $("renewalDepthTable").replaceChildren(...rows);
  }

  function renderReturnTiming(currentFilters) {
    const currentMonth = data.generatedAt.slice(0, 7);
    const focusMonth = shiftMonth(currentMonth, -1);
    const months = Array.from({ length: 24 }, (_, index) => shiftMonth(currentMonth, index - 23));
    const cutoff = new Date(`${data.generatedAt}T00:00:00Z`);
    const dayGap = (after, before) => Math.round((new Date(`${after}T00:00:00Z`) - new Date(`${before}T00:00:00Z`)) / 86400000);
    const addDays = (value, amount) => { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return date; };
    const dimensionMatch = row => (currentFilters.discipline === "Todos" || row[TX.disciplines].includes(currentFilters.discipline))
      && (currentFilters.instructor === "Todos" || row[TX.instructor] === currentFilters.instructor)
      && (currentFilters.family === "Todos" || row[TX.family] === currentFilters.family);

    function timing(month) {
      const latest = new Map();
      data.transactions.forEach(row => {
        if (!row[TX.effectiveDue]?.startsWith(month) || !dimensionMatch(row)) return;
        const existing = latest.get(row[TX.customer]);
        if (!existing || row[TX.date] > existing[TX.date]) latest.set(row[TX.customer], row);
      });
      const keys = ["early", "same", "next", "reactivation", "resurrection", "none"];
      const buckets = Object.fromEntries(keys.map(key => [key, { count: 0, revenue: 0 }]));
      latest.forEach(row => {
        const next = nextPurchaseRow.get(row);
        if (!next) { buckets.none.count += 1; return; }
        const gap = dayGap(next[TX.date], row[TX.effectiveDue]);
        let key;
        if (gap < 0) key = "early";
        else if (next[TX.date].slice(0, 7) === month) key = "same";
        else if (next[TX.date].slice(0, 7) === shiftMonth(month, 1) && gap <= 30) key = "next";
        else if (gap <= 365) key = "reactivation";
        else key = "resurrection";
        buckets[key].count += 1;
        buckets[key].revenue += Number(next[TX.value] || 0);
      });
      const returned = keys.filter(key => key !== "none").reduce((total, key) => total + buckets[key].count, 0);
      const revenue = keys.filter(key => key !== "none").reduce((total, key) => total + buckets[key].revenue, 0);
      const end = monthEnd(month);
      const maturity = addDays(end, 365) <= cutoff ? "365d cerrada" : addDays(end, 30) <= cutoff ? "30d cerrada" : "Abierta";
      return { month, total: latest.size, buckets, returned, revenue, maturity };
    }

    const results = months.map(timing);
    const focus = results.find(result => result.month === focusMonth);
    const immediate = { count: focus.buckets.early.count + focus.buckets.same.count, revenue: focus.buckets.early.revenue + focus.buckets.same.revenue };
    const cards = [
      ["Antes o mismo mes", immediate.count, immediate.revenue],
      ["Mes siguiente ≤30d", focus.buckets.next.count, focus.buckets.next.revenue],
      ["Reactivación 31–365d", focus.buckets.reactivation.count, focus.buckets.reactivation.revenue],
      ["Sin retorno observado", focus.buckets.none.count, 0],
      ["Ingreso recuperado", focus.returned, focus.revenue],
    ];
    $("returnTimingCards").replaceChildren(...cards.map(([label, count, revenue]) => {
      const card = document.createElement("article"); card.className = "return-timing-card";
      const title = document.createElement("span"); title.textContent = `${label} · ${monthLabel(focusMonth)}`;
      const value = document.createElement("strong"); value.textContent = integer.format(count);
      const detail = document.createElement("p"); detail.textContent = revenue ? currency.format(revenue) : label.includes("Sin retorno") ? "Cohorte todavía abierta" : "Sin ingreso observado";
      card.append(title, value, detail); return card;
    }));

    $("returnTimingTable").replaceChildren(...[...results].reverse().map(result => {
      const row = document.createElement("tr");
      const bucketCell = key => `${integer.format(result.buckets[key].count)} · ${currency.format(result.buckets[key].revenue)}`;
      cell(row, monthLabel(result.month)); cell(row, result.maturity); cell(row, integer.format(result.total));
      cell(row, bucketCell("early")); cell(row, bucketCell("same")); cell(row, bucketCell("next"));
      cell(row, bucketCell("reactivation")); cell(row, bucketCell("resurrection")); cell(row, integer.format(result.buckets.none.count));
      cell(row, result.total ? percent.format(result.returned / result.total) : "—"); cell(row, currency.format(result.revenue));
      return row;
    }));
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
    renderReturnTiming(currentFilters);
  }

  ["periodFilter", "startDate", "endDate", "lifecycleFilter", "disciplineFilter", "instructorFilter", "familyFilter"]
    .forEach(id => $(id).addEventListener("change", render));
  $("resetFilters").addEventListener("click", render);
  window.addEventListener("resize", render);
  render();
})();
