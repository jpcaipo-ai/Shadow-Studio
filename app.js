(() => {
  "use strict";

  const data = window.SHADOW_GROWTH_DATA;
  const $ = (id) => document.getElementById(id);
  const currency = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 0 });
  const integer = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });
  const percent = new Intl.NumberFormat("es-PE", { style: "percent", maximumFractionDigits: 1 });
  const shortMoney = (value) => value >= 1_000_000 ? `S/ ${(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `S/ ${(value / 1_000).toFixed(0)}k` : `S/ ${Math.round(value)}`;

  const summaryMap = new Map(data.summary.map(row => [row.slice(0, 4).join("¦"), row]));
  const monthlyMap = new Map(data.monthly.map(row => [row.slice(0, 4).join("¦"), row]));
  const lifecycleMonthlyMap = new Map(data.lifecycleMonthly.map(row => [row.slice(0, 4).join("¦"), row]));
  const periodMap = new Map(data.periods.map(row => [row.label, row]));
  const monthByLabel = new Map(data.months.map(month => [month.label, month]));
  const latestMonthLabel = data.months[data.months.length - 1].label;
  const state = { period: latestMonthLabel, family: "Todos", method: "Todos", type: "Todos", startDate: data.dateMin, endDate: data.dateMax };

  const controls = {
    period: $("periodFilter"), family: $("familyFilter"), method: $("methodFilter"), type: $("typeFilter"),
  };
  const dateControls = { start: $("startDateFilter"), end: $("endDateFilter") };

  function fillSelect(select, values, selected) {
    select.replaceChildren(...values.map(value => {
      const option = document.createElement("option");
      option.value = value.label || value;
      option.textContent = value.label || value;
      option.selected = option.value === selected;
      return option;
    }));
  }

  const monthLabels = new Set(data.months.map(month => month.label));
  const presetPeriods = data.periods.filter(period => !monthLabels.has(period.label));
  fillSelect(controls.period, [[...data.months].reverse(), presetPeriods, [{ label: "Personalizado" }]].flat(), state.period);
  fillSelect(controls.family, data.families, state.family);
  fillSelect(controls.method, data.methods, state.method);
  fillSelect(controls.type, data.types, state.type);
  Object.values(dateControls).forEach(control => { control.min = data.dateMin; control.max = data.dateMax; });
  dateControls.start.value = state.startDate;
  dateControls.end.value = state.endDate;

  const TX = { date: 0, amount: 1, method: 2, document: 3, documentNumber: 4, paymentNumber: 5, customer: 6, plan: 7, family: 8, type: 9, lifecycle: 10 };
  const lastDayOfMonth = monthKey => {
    const [year, month] = monthKey.split("-").map(Number);
    return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  };
  function currentDateRange() {
    if (state.period === "Personalizado") {
      const start = state.startDate || data.dateMin;
      const end = state.endDate || data.dateMax;
      return { start, end, valid: start <= end };
    }
    const period = periodMap.get(state.period);
    const start = period.start === data.dateMin.slice(0, 7) ? data.dateMin : `${period.start}-01`;
    const end = period.end === data.dateMax.slice(0, 7) ? data.dateMax : lastDayOfMonth(period.end);
    return { start, end, valid: true };
  }
  const rowsForSelection = (family = state.family, method = state.method, type = state.type) => {
    const range = currentDateRange();
    if (!range.valid) return [];
    return data.transactions.filter(row => row[TX.date] >= range.start && row[TX.date] <= range.end
      && (family === "Todos" || row[TX.family] === family)
      && (method === "Todos" || row[TX.method] === method)
      && (type === "Todos" || row[TX.type] === type));
  };
  function summarizeRows(rows, label, family, method, type) {
    const customerRevenue = new Map();
    const customerTransactions = new Map();
    const payers = new Set();
    const newPayers = new Set();
    let revenue = 0, newRevenue = 0;
    for (const row of rows) {
      const amount = Number(row[TX.amount] || 0), customer = row[TX.customer];
      revenue += amount; payers.add(customer);
      customerRevenue.set(customer, (customerRevenue.get(customer) || 0) + amount);
      customerTransactions.set(customer, (customerTransactions.get(customer) || 0) + 1);
      if (row[TX.type] === "Nuevo observado") { newPayers.add(customer); newRevenue += amount; }
    }
    const repeats = [...customerTransactions.values()].filter(count => count >= 2).length;
    const customerValues = [...customerRevenue.values()].sort((a, b) => b - a);
    const topCount = customerValues.length ? Math.max(1, Math.ceil(customerValues.length * .1)) : 0;
    const top10 = revenue && topCount ? customerValues.slice(0, topCount).reduce((sum, value) => sum + value, 0) / revenue : 0;
    return [label, family, method, type, revenue, rows.length, payers.size, newPayers.size, newRevenue, revenue - newRevenue, repeats, top10];
  }

  const getSummary = (period = state.period, family = state.family, method = state.method, type = state.type) => {
    if (period === "Personalizado") return summarizeRows(rowsForSelection(family, method, type), period, family, method, type);
    return summaryMap.get([period, family, method, type].join("¦")) || [period, family, method, type, 0, 0, 0, 0, 0, 0, 0, 0];
  };
  const getMonth = (month, family = state.family, method = state.method, type = state.type) => {
    if (state.period !== "Personalizado") return monthlyMap.get([month, family, method, type].join("¦")) || [month, family, method, type, 0, 0, 0, 0, 0, 0, 0, 0];
    const key = monthByLabel.get(month).key;
    const rows = rowsForSelection(family, method, type).filter(row => row[TX.date].slice(0, 7) === key);
    return summarizeRows(rows, month, family, method, type);
  };
  const getLifecycleMonth = (month, family = state.family, method = state.method, type = state.type) => {
    if (state.period !== "Personalizado") return lifecycleMonthlyMap.get([month, family, method, type].join("¦")) || [month, family, method, type, 0, 0, 0, 0, 0, 0];
    const key = monthByLabel.get(month).key;
    const rows = rowsForSelection(family, method, type).filter(row => row[TX.date].slice(0, 7) === key);
    const customers = { Nuevo: new Set(), Continuo: new Set(), Reactivado: new Set() };
    const revenue = { Nuevo: 0, Continuo: 0, Reactivado: 0 };
    rows.forEach(row => { customers[row[TX.lifecycle]].add(row[TX.customer]); revenue[row[TX.lifecycle]] += Number(row[TX.amount] || 0); });
    return [month, family, method, type, customers.Nuevo.size, customers.Continuo.size, customers.Reactivado.size, revenue.Nuevo, revenue.Continuo, revenue.Reactivado];
  };

  function visibleMonths() {
    const range = currentDateRange();
    if (!range.valid) return [];
    return data.months.filter(month => month.key >= range.start.slice(0, 7) && month.key <= range.end.slice(0, 7));
  }

  function setText(id, value) { $(id).textContent = value; }
  function updateKpis(row) {
    const revenue = row[4], transactions = row[5], payers = row[6], newPayers = row[7];
    const newRevenue = row[8], recurrentRevenue = row[9], repeats = row[10], top10 = row[11];
    const ticket = transactions ? revenue / transactions : 0;
    const newShare = revenue ? newRevenue / revenue : 0;
    const repeatShare = payers ? repeats / payers : 0;
    const recurrentShare = revenue ? recurrentRevenue / revenue : 0;

    setText("revenueKpi", currency.format(revenue));
    setText("payersKpi", integer.format(payers));
    setText("newRevenueKpi", currency.format(newRevenue));
    setText("newShareKpi", `${percent.format(newShare)} del ingreso · ${integer.format(newPayers)} pagadores`);
    setText("ticketKpi", currency.format(ticket));
    setText("transactionsKpi", `${integer.format(transactions)} transacciones`);
    setText("repeatKpi", percent.format(repeatShare));
    setText("top10Kpi", `Top 10% concentra ${percent.format(top10)}`);
    setText("trendTotal", currency.format(revenue));
    setText("selectionHeadline", `${percent.format(recurrentShare)} del ingreso seleccionado proviene de recurrencia.`);
    setText("selectionDetail", `${integer.format(newPayers)} pagadores nuevos generaron ${currency.format(newRevenue)}. El ticket promedio fue ${currency.format(ticket)} y ${percent.format(repeatShare)} de los pagadores realizó dos o más transacciones dentro del periodo.`);
    const range = currentDateRange();
    setText("revenueContext", state.period === "Personalizado" ? `${range.start} a ${range.end}` : state.period);
  }

  const NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs = {}, text = "") {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    if (text) el.textContent = text;
    return el;
  }

  function makeSvg(container, height, label) {
    container.replaceChildren();
    const width = Math.max(320, container.clientWidth || 700);
    const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": label });
    svg.append(svgEl("title", {}, label));
    container.append(svg);
    return { svg, width, height };
  }

  function scaleLinear(domainMax, rangeStart, rangeEnd) {
    const max = domainMax || 1;
    return value => rangeStart + (value / max) * (rangeEnd - rangeStart);
  }

  function renderLineChart(container, rows) {
    if (!rows.length) { container.innerHTML = '<div class="empty">Sin datos para la selección.</div>'; return; }
    const { svg, width, height } = makeSvg(container, 300, "Ingreso mensual en soles");
    const margin = { top: 18, right: 18, bottom: 42, left: 64 };
    const plotW = width - margin.left - margin.right, plotH = height - margin.top - margin.bottom;
    const max = Math.max(...rows.map(d => d.value), 1) * 1.08;
    const x = i => margin.left + (rows.length === 1 ? plotW / 2 : i * plotW / (rows.length - 1));
    const y = scaleLinear(max, margin.top + plotH, margin.top);
    for (let i = 0; i <= 4; i++) {
      const value = max * i / 4, yy = y(value);
      svg.append(svgEl("line", { x1: margin.left, y1: yy, x2: width - margin.right, y2: yy, class: "gridline" }));
      svg.append(svgEl("text", { x: margin.left - 9, y: yy + 4, "text-anchor": "end", class: "axis" }, shortMoney(value)));
    }
    const path = rows.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
    svg.append(svgEl("path", { d: path, class: "line", stroke: "var(--green)" }));
    rows.forEach((d, i) => {
      const point = svgEl("circle", { cx: x(i), cy: y(d.value), r: 5, fill: "var(--green)", class: "point", tabindex: "0" });
      point.append(svgEl("title", {}, `${d.label}: ${currency.format(d.value)}`));
      svg.append(point);
      if (rows.length <= 12 || i % 2 === 0 || i === rows.length - 1) svg.append(svgEl("text", { x: x(i), y: height - 14, "text-anchor": "middle", class: "axis" }, d.label));
    });
  }

  function renderMixChart(container, rows) {
    if (!rows.length) { container.innerHTML = '<div class="empty">Sin datos para la selección.</div>'; return; }
    const { svg, width, height } = makeSvg(container, 300, "Ingreso nuevo y recurrente por mes");
    const margin = { top: 18, right: 18, bottom: 42, left: 64 };
    const plotW = width - margin.left - margin.right, plotH = height - margin.top - margin.bottom;
    const max = Math.max(...rows.map(d => d.newValue + d.recurringValue), 1) * 1.08;
    const y = scaleLinear(max, margin.top + plotH, margin.top);
    const band = plotW / rows.length, barW = Math.max(8, Math.min(34, band * .62));
    for (let i = 0; i <= 4; i++) {
      const value = max * i / 4, yy = y(value);
      svg.append(svgEl("line", { x1: margin.left, y1: yy, x2: width - margin.right, y2: yy, class: "gridline" }));
      svg.append(svgEl("text", { x: margin.left - 9, y: yy + 4, "text-anchor": "end", class: "axis" }, shortMoney(value)));
    }
    rows.forEach((d, i) => {
      const x = margin.left + i * band + (band - barW) / 2;
      const recH = plotH - (y(d.recurringValue) - margin.top);
      const newH = plotH - (y(d.newValue) - margin.top);
      const rec = svgEl("rect", { x, y: y(d.recurringValue), width: barW, height: recH, rx: 3, fill: "var(--green)", class: "bar", tabindex: "0" });
      rec.append(svgEl("title", {}, `${d.label} · Recurrente: ${currency.format(d.recurringValue)}`));
      svg.append(rec);
      const fresh = svgEl("rect", { x, y: y(d.recurringValue + d.newValue), width: barW, height: newH, rx: 3, fill: "var(--blue)", class: "bar", tabindex: "0" });
      fresh.append(svgEl("title", {}, `${d.label} · Nuevo: ${currency.format(d.newValue)}`));
      svg.append(fresh);
      if (rows.length <= 12 || i % 2 === 0 || i === rows.length - 1) svg.append(svgEl("text", { x: x + barW / 2, y: height - 14, "text-anchor": "middle", class: "axis" }, d.label));
    });
  }

  function renderLifecycleMonthlyChart(container, rows) {
    if (!rows.length) { container.innerHTML = '<div class="empty">Sin datos para la selección.</div>'; return; }
    const { svg, width, height } = makeSvg(container, 330, "Clientes nuevos, continuos y reactivados por mes");
    const margin = { top: 18, right: 18, bottom: 42, left: 54 };
    const plotW = width - margin.left - margin.right, plotH = height - margin.top - margin.bottom;
    const max = Math.max(...rows.map(d => d.newCount + d.continuousCount + d.reactivatedCount), 1) * 1.08;
    const y = scaleLinear(max, margin.top + plotH, margin.top);
    const band = plotW / rows.length, barW = Math.max(10, Math.min(38, band * .64));
    for (let i = 0; i <= 4; i++) {
      const value = max * i / 4, yy = y(value);
      svg.append(svgEl("line", { x1: margin.left, y1: yy, x2: width - margin.right, y2: yy, class: "gridline" }));
      svg.append(svgEl("text", { x: margin.left - 9, y: yy + 4, "text-anchor": "end", class: "axis" }, integer.format(value)));
    }
    rows.forEach((d, i) => {
      const x = margin.left + i * band + (band - barW) / 2;
      const segments = [
        ["Continuo", d.continuousCount, "var(--green)"],
        ["Reactivado", d.reactivatedCount, "var(--purple)"],
        ["Nuevo", d.newCount, "var(--blue)"],
      ];
      let cumulative = 0;
      segments.forEach(([name, value, color]) => {
        const next = cumulative + value;
        const rect = svgEl("rect", { x, y: y(next), width: barW, height: Math.max(0, y(cumulative) - y(next)), rx: 2, fill: color, class: "bar", tabindex: "0" });
        rect.append(svgEl("title", {}, `${d.label} · ${name}: ${integer.format(value)}`));
        svg.append(rect); cumulative = next;
      });
      if (rows.length <= 12 || i % 2 === 0 || i === rows.length - 1) svg.append(svgEl("text", { x: x + barW / 2, y: height - 14, "text-anchor": "middle", class: "axis" }, d.label));
    });
  }

  function renderHorizontalBars(container, rows, color, label) {
    const filtered = rows.filter(d => d.value > 0).sort((a, b) => b.value - a.value);
    if (!filtered.length) { container.innerHTML = '<div class="empty">Sin datos para la selección.</div>'; return; }
    const height = Math.max(310, filtered.length * 34 + 48);
    container.style.minHeight = `${height}px`;
    const { svg, width } = makeSvg(container, height, label);
    const left = Math.min(210, Math.max(120, width * .28)), right = 76, top = 12, rowH = (height - 24) / filtered.length;
    const max = Math.max(...filtered.map(d => d.value), 1);
    const barWidth = scaleLinear(max, 0, width - left - right);
    filtered.forEach((d, i) => {
      const y = top + i * rowH;
      const display = d.label.length > 26 ? `${d.label.slice(0, 24)}…` : d.label;
      svg.append(svgEl("text", { x: left - 10, y: y + rowH * .64, "text-anchor": "end", class: "axis" }, display));
      const rect = svgEl("rect", { x: left, y: y + rowH * .2, width: Math.max(2, barWidth(d.value)), height: rowH * .58, rx: 4, fill: color, class: "bar", tabindex: "0" });
      rect.append(svgEl("title", {}, `${d.label}: ${currency.format(d.value)}`));
      svg.append(rect);
      svg.append(svgEl("text", { x: Math.min(width - 2, left + barWidth(d.value) + 8), y: y + rowH * .64, class: "axis" }, shortMoney(d.value)));
    });
  }

  function renderCharts() {
    const months = visibleMonths();
    const trendRows = months.map(month => ({ label: month.label, value: getMonth(month.label)[4] }));
    const mixRows = months.map(month => {
      const row = getMonth(month.label);
      return { label: month.label, newValue: row[8], recurringValue: row[9] };
    });
    renderLineChart($("revenueChart"), trendRows);
    renderMixChart($("customerMixChart"), mixRows);

    const lifecycleRows = months.map(month => {
      const row = getLifecycleMonth(month.label);
      return { label: month.label, newCount: row[4], continuousCount: row[5], reactivatedCount: row[6] };
    });
    const lifecycleTotals = lifecycleRows.reduce((acc, row) => ({
      newCount: acc.newCount + row.newCount,
      continuousCount: acc.continuousCount + row.continuousCount,
      reactivatedCount: acc.reactivatedCount + row.reactivatedCount,
    }), { newCount: 0, continuousCount: 0, reactivatedCount: 0 });
    const recurrentLifecycle = lifecycleTotals.continuousCount + lifecycleTotals.reactivatedCount;
    setText("newLifecycleKpi", integer.format(lifecycleTotals.newCount));
    setText("continuousLifecycleKpi", integer.format(lifecycleTotals.continuousCount));
    setText("reactivatedLifecycleKpi", integer.format(lifecycleTotals.reactivatedCount));
    setText("reactivationShareKpi", recurrentLifecycle ? percent.format(lifecycleTotals.reactivatedCount / recurrentLifecycle) : "0%");
    renderLifecycleMonthlyChart($("lifecycleMonthlyChart"), lifecycleRows);

    const familyValues = data.families.filter(v => v !== "Todos" && (state.family === "Todos" || state.family === v))
      .map(label => ({ label, value: getSummary(state.period, label, state.method, state.type)[4] }));
    const methodValues = data.methods.filter(v => v !== "Todos" && (state.method === "Todos" || state.method === v))
      .map(label => ({ label, value: getSummary(state.period, state.family, label, state.type)[4] }));
    renderHorizontalBars($("familyChart"), familyValues, "var(--blue)", "Ingreso por familia de plan");
    renderHorizontalBars($("methodChart"), methodValues, "var(--mint)", "Ingreso por método de pago");
  }

  function renderStaticSections() {
    const list = $("opportunityList");
    list.replaceChildren(...data.opportunities.map(([lever, signal, action]) => {
      const row = document.createElement("div"); row.className = "opportunity-row";
      const title = document.createElement("strong"); title.textContent = lever;
      const signalText = document.createElement("p"); signalText.textContent = signal;
      const actionText = document.createElement("p"); actionText.textContent = action;
      row.append(title, signalText, actionText); return row;
    }));

    setText("dueValue", integer.format(data.renewal.due));
    setText("retainedValue", integer.format(data.renewal.retained_or_renewed));
    setText("fugueValue", integer.format(data.renewal.potential_fugue));
    setText("churnValue", percent.format(data.renewal.provisional_churn));
    setText("renewalValue", `${currency.format(data.renewal.matched_value)} · ${data.renewal.matched_last_payment}/13 identificados`);

    const lifecycleOrder = ["Nuevo: 1 pago <=60d", "Activo recurrente", "Activo de 1 compra", "En seguimiento 91-180d", "En riesgo 181-365d", "Inactivo >365d"];
    const lifeMax = Math.max(...Object.values(data.lifecycle));
    $("lifecycleChart").replaceChildren(...lifecycleOrder.filter(key => data.lifecycle[key] != null).map(key => {
      const row = document.createElement("div"); row.className = "life-row";
      const label = document.createElement("span"); label.className = "life-label"; label.textContent = key;
      const track = document.createElement("div"); track.className = "track";
      const bar = document.createElement("span"); bar.style.width = `${data.lifecycle[key] / lifeMax * 100}%`; track.append(bar);
      const value = document.createElement("span"); value.className = "life-value"; value.textContent = integer.format(data.lifecycle[key]);
      row.append(label, track, value); return row;
    }));

    const q = data.quality;
    const quality = [
      ["Clientes registrados", integer.format(q.registryClients)], ["Pagadores observados", integer.format(q.observedPayers)],
      ["Cobertura teléfono", percent.format(q.phoneCoverage)], ["Cobertura distrito", percent.format(q.districtCoverage)],
      ["Edad válida", percent.format(q.validAgeCoverage)], ["Pagos sin match", `${integer.format(q.unmatchedPayments)} · ${percent.format(q.unmatchedPaymentRate)}`],
      ["Ingreso sin método", percent.format(q.unknownPaymentRevenueShare)],
    ];
    $("qualityGrid").replaceChildren(...quality.map(([labelText, valueText]) => {
      const item = document.createElement("div"); item.className = "quality-item";
      const label = document.createElement("span"); label.textContent = labelText;
      const value = document.createElement("strong"); value.textContent = valueText;
      item.append(label, value); return item;
    }));
  }

  function updateAll() {
    Object.keys(controls).forEach(key => state[key] = controls[key].value);
    state.startDate = dateControls.start.value;
    state.endDate = dateControls.end.value;
    const isCustom = state.period === "Personalizado";
    $("customDateRange").hidden = !isCustom;
    const range = currentDateRange();
    setText("dateValidation", range.valid ? "" : "La fecha inicial debe ser anterior o igual a la fecha final.");
    setText("coverageLabel", `${range.start} a ${range.end} · Fuente: ${data.coverage}`);
    updateKpis(getSummary());
    renderCharts();
  }

  const safeCsvCell = value => {
    let text = String(value ?? "");
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  function downloadCsv(rows, fileName) {
    const csv = rows.map(row => row.map(safeCsvCell).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = fileName; link.click(); URL.revokeObjectURL(link.href);
  }
  function exportCsv() {
    const rows = [["Mes", "Ingreso", "Transacciones", "Pagadores", "Nuevos", "Ingreso nuevos", "Ingreso recurrente", "Pagadores repetidos"]];
    visibleMonths().forEach(month => {
      const r = getMonth(month.label);
      rows.push([month.label, r[4], r[5], r[6], r[7], r[8], r[9], r[10]]);
    });
    downloadCsv(rows, `shadow-growth-${state.period.toLowerCase().replaceAll(" ", "-")}.csv`);
  }
  function exportTransactionsCsv() {
    const rows = [["Fecha", "Pagado", "Método de pago", "Comprobante", "N.º comprobante", "N.º pago", "Cliente anónimo", "Plan", "Familia", "Tipo de cliente", "Lifecycle"]];
    rowsForSelection().forEach(row => rows.push(row));
    const range = currentDateRange();
    downloadCsv(rows, `shadow-transacciones-${range.start}-a-${range.end}.csv`);
  }

  Object.values(controls).forEach(control => control.addEventListener("change", updateAll));
  Object.values(dateControls).forEach(control => control.addEventListener("change", updateAll));
  $("resetButton").addEventListener("click", () => {
    state.period = latestMonthLabel; state.family = state.method = state.type = "Todos";
    state.startDate = data.dateMin; state.endDate = data.dateMax;
    dateControls.start.value = state.startDate; dateControls.end.value = state.endDate;
    Object.keys(controls).forEach(key => controls[key].value = state[key]); updateAll();
  });
  $("exportButton").addEventListener("click", exportCsv);
  $("exportTransactionsButton").addEventListener("click", exportTransactionsCsv);
  let resizeTimer;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderCharts, 120); });

  setText("updatedLabel", `Corte del tablero: ${data.generatedAt}`);
  renderStaticSections();
  updateAll();
})();
