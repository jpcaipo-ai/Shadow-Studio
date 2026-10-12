(() => {
  "use strict";

  const data = window.SHADOW_GROWTH_DATA;
  const funnel = data.funnel || {};
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

  function rowsInVisibleMonths(rows = []) {
    const keys = new Set(visibleMonths().map(month => month.key));
    return rows.filter(row => keys.has(row.month));
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
    const { svg, width, height } = makeSvg(container, 330, "Nuevos, renovaciones, reactivaciones y resurrecciones por mes");
    const margin = { top: 18, right: 18, bottom: 42, left: 54 };
    const plotW = width - margin.left - margin.right, plotH = height - margin.top - margin.bottom;
    const max = Math.max(...rows.map(d => d.newCount + d.continuousCount + d.reactivatedCount + d.resurrectedCount), 1) * 1.08;
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
        ["Renovación", d.continuousCount, "var(--green)"],
        ["Reactivación", d.reactivatedCount, "var(--purple)"],
        ["Resurrección", d.resurrectedCount, "var(--gold)"],
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

  function renderFunnelChart(container, rows) {
    if (!rows.length) { container.innerHTML = '<div class="empty">Sin cohortes de prueba para el periodo.</div>'; return; }
    const { svg, width, height } = makeSvg(container, 310, "Pruebas, asistencias y conversiones por cohorte mensual");
    const margin = { top: 18, right: 18, bottom: 42, left: 48 };
    const plotW = width - margin.left - margin.right, plotH = height - margin.top - margin.bottom;
    const max = Math.max(...rows.map(d => d.trial_customers), 1) * 1.08;
    const y = scaleLinear(max, margin.top + plotH, margin.top);
    const band = plotW / rows.length, groupW = Math.max(18, Math.min(62, band * .72)), barW = groupW / 3;
    for (let i = 0; i <= 4; i++) {
      const value = max * i / 4, yy = y(value);
      svg.append(svgEl("line", { x1: margin.left, y1: yy, x2: width - margin.right, y2: yy, class: "gridline" }));
      svg.append(svgEl("text", { x: margin.left - 8, y: yy + 4, "text-anchor": "end", class: "axis" }, integer.format(value)));
    }
    rows.forEach((d, i) => {
      const startX = margin.left + i * band + (band - groupW) / 2;
      [["Pruebas", d.trial_customers, "var(--blue)"], ["Asistieron", d.attended, "var(--mint)"], ["Compraron ≤30d", d.converted_30d, "var(--green)"]].forEach(([name, value, color], j) => {
        const rect = svgEl("rect", { x: startX + j * barW, y: y(value), width: Math.max(3, barW - 2), height: Math.max(0, margin.top + plotH - y(value)), rx: 2, fill: color, class: "bar", tabindex: "0" });
        rect.append(svgEl("title", {}, `${d.month} · ${name}: ${integer.format(value)}`)); svg.append(rect);
      });
      if (rows.length <= 12 || i % 2 === 0 || i === rows.length - 1) svg.append(svgEl("text", { x: startX + groupW / 2, y: height - 14, "text-anchor": "middle", class: "axis" }, d.month.slice(5)));
    });
  }

  function renderFunnel() {
    const rows = rowsInVisibleMonths(funnel.trial_monthly);
    const totals = rows.reduce((acc, row) => {
      acc.trials += row.trial_customers; acc.attended += row.attended; acc.matured += row.matured_30d; acc.converted += row.converted_30d;
      if (row.avg_first_package != null && row.converted_30d) acc.ticketValue += row.avg_first_package * row.converted_30d;
      if (row.median_days_to_purchase != null && row.converted_30d) { acc.days += row.median_days_to_purchase * row.converted_30d; acc.daysWeight += row.converted_30d; }
      return acc;
    }, { trials: 0, attended: 0, matured: 0, converted: 0, ticketValue: 0, days: 0, daysWeight: 0 });
    setText("trialCustomersKpi", integer.format(totals.trials));
    setText("trialAttendanceKpi", integer.format(totals.attended));
    setText("trialAttendanceRateKpi", totals.trials ? `${percent.format(totals.attended / totals.trials)} de las pruebas` : "Sin pruebas");
    setText("trialConvertedKpi", integer.format(totals.converted));
    setText("trialConversionKpi", totals.matured ? percent.format(totals.converted / totals.matured) : "Cohorte inmadura");
    setText("trialTicketKpi", totals.converted ? currency.format(totals.ticketValue / totals.converted) : "—");
    const packageTotals = new Map();
    rowsInVisibleMonths(funnel.trial_package_monthly).forEach(row => packageTotals.set(row.package, (packageTotals.get(row.package) || 0) + row.buyers));
    const topPackage = [...packageTotals].sort((a, b) => b[1] - a[1])[0];
    setText("trialTopPackageKpi", topPackage ? topPackage[0] : "—");
    setText("trialTopPackageShareKpi", topPackage && totals.converted ? `${integer.format(topPackage[1])} compradores · ${percent.format(topPackage[1] / totals.converted)}` : "Sin cohorte madura");
    setText("trialDaysKpi", totals.daysWeight ? `${(totals.days / totals.daysWeight).toFixed(1)} días` : "—");
    renderFunnelChart($("funnelMonthlyChart"), rows);

    const groups = new Map(["0 clases", "1 clase", "2+ clases"].map(name => [name, { customers: 0, converted: 0, value: 0 }]));
    rowsInVisibleMonths(funnel.trial_conversion_by_attendance_monthly).forEach(row => {
      const group = groups.get(row.group); if (!group) return;
      group.customers += row.trial_customers; group.converted += row.converted_30d;
      if (row.avg_first_package != null) group.value += row.avg_first_package * row.converted_30d;
    });
    $("conversionByAttendance").replaceChildren(...[...groups].map(([name, value]) => {
      const item = document.createElement("div");
      item.innerHTML = `<span>${name}</span><strong>${value.customers ? percent.format(value.converted / value.customers) : "—"}</strong><small>${integer.format(value.converted)} de ${integer.format(value.customers)} · ticket ${value.converted ? currency.format(value.value / value.converted) : "—"}</small>`;
      return item;
    }));
    renderTrialMonthlyTable();
  }

  function renderTrialMonthlyTable() {
    const monthly = (funnel.trial_monthly || []).slice(-12);
    const groupMap = new Map((funnel.trial_conversion_by_attendance_monthly || []).map(row => [`${row.month}¦${row.group}`, row]));
    const body = $("trialMonthlyTable");
    const addCell = (row, main, detail = "", className = "") => {
      const cell = document.createElement("td"); if (className) cell.className = className;
      const strong = document.createElement("strong"); strong.textContent = main; cell.append(strong);
      if (detail) { const small = document.createElement("small"); small.textContent = detail; cell.append(small); }
      row.append(cell);
    };
    body.replaceChildren(...monthly.map(month => {
      const row = document.createElement("tr");
      const zero = groupMap.get(`${month.month}¦0 clases`), one = groupMap.get(`${month.month}¦1 clase`), two = groupMap.get(`${month.month}¦2+ clases`);
      addCell(row, month.month);
      addCell(row, integer.format(month.trial_customers));
      addCell(row, percent.format(month.attendance_rate || 0), `${integer.format(month.attended)} asistieron`);
      addCell(row, `${integer.format(month.zero_attendance)} · ${percent.format(month.zero_attendance_rate || 0)}`, zero ? `Conv. ${percent.format(zero.conversion_30d || 0)}` : "Conv. pendiente");
      addCell(row, `${integer.format(month.one_attendance)} · ${percent.format(month.one_attendance_rate || 0)}`, one ? `Conv. ${percent.format(one.conversion_30d || 0)}` : "Conv. pendiente");
      addCell(row, `${integer.format(month.two_plus_attendance)} · ${percent.format(month.two_plus_attendance_rate || 0)}`, two ? `Conv. ${percent.format(two.conversion_30d || 0)}` : "Conv. pendiente");
      if (month.matured_30d) addCell(row, percent.format(month.conversion_30d || 0), `${integer.format(month.converted_30d)} de ${integer.format(month.matured_30d)} maduras`);
      else addCell(row, "Inmadura", "Aún no cumple 30 días", "immature");
      addCell(row, month.avg_first_package != null ? currency.format(month.avg_first_package) : "—");
      addCell(row, month.top_package || "—", month.top_package ? `${integer.format(month.top_package_buyers)} compradores · ${percent.format(month.top_package_share || 0)}` : "");
      return row;
    }));
  }

  function renderTrialVolumeChart(container, rows) {
    if (!rows.length) { container.innerHTML = '<div class="empty">Sin clases de prueba registradas.</div>'; return; }
    const { svg, width, height } = makeSvg(container, 230, "Free Pass y clases de prueba 2 por 1 por mes");
    const margin = { top: 20, right: 18, bottom: 38, left: 42 };
    const plotW = width - margin.left - margin.right, plotH = height - margin.top - margin.bottom;
    const max = Math.max(...rows.map(row => row.total_trials), 1) * 1.15;
    const y = scaleLinear(max, margin.top + plotH, margin.top);
    const band = plotW / rows.length, barW = Math.max(6, Math.min(36, band * .66));
    rows.forEach((row, index) => {
      const x = margin.left + index * band + (band - barW) / 2;
      const freeRect = svgEl("rect", { x, y: y(row.free_pass), width: barW, height: margin.top + plotH - y(row.free_pass), rx: 3, fill: "var(--blue)", class: "bar", tabindex: "0" });
      freeRect.append(svgEl("title", {}, `${row.month} · Free Pass: ${integer.format(row.free_pass)}`)); svg.append(freeRect);
      const twoRect = svgEl("rect", { x, y: y(row.total_trials), width: barW, height: Math.max(0, y(row.free_pass) - y(row.total_trials)), rx: 3, fill: "var(--gold)", class: "bar", tabindex: "0" });
      twoRect.append(svgEl("title", {}, `${row.month} · 2×1: ${integer.format(row.two_for_one)}`)); svg.append(twoRect);
      if (rows.length <= 12 || index % 3 === 0 || index === rows.length - 1) svg.append(svgEl("text", { x: x + barW / 2, y: height - 12, "text-anchor": "middle", class: "axis" }, row.month.slice(2)));
    });
    svg.append(svgEl("line", { x1: margin.left, y1: margin.top + plotH, x2: width - margin.right, y2: margin.top + plotH, class: "baseline" }));
  }

  function renderOperations() {
    const volumeTotals = funnel.trial_volume_totals || {};
    const volumeMonthly = funnel.trial_volume_monthly || [];
    const two = rowsInVisibleMonths(funnel.two_for_one?.monthly);
    const t = two.reduce((a, r) => ({ purchases: a.purchases + r.purchases, zero: a.zero + r.attended_zero, one: a.one + r.attended_one, both: a.both + r.used_both, follow: a.follow + r.follow_on }), { purchases: 0, zero: 0, one: 0, both: 0, follow: 0 });
    setText("trialVolumeTotalKpi", integer.format(volumeTotals.total_trials || 0));
    setText("freePassTotalKpi", integer.format(volumeTotals.free_pass || 0));
    setText("twoTotalKpi", integer.format(volumeTotals.two_for_one || 0));
    setText("twoPurchasesKpi", integer.format(t.purchases)); setText("twoBothKpi", integer.format(t.both)); setText("twoOneKpi", integer.format(t.one)); setText("twoZeroKpi", integer.format(t.zero)); setText("twoFollowKpi", integer.format(t.follow));
    setText("twoForOneNote", t.purchases ? `${percent.format(t.both / t.purchases)} utilizó ambas clases. La conversión posterior necesita 60 días completos para consolidarse.` : "La promoción 2×1 solo aparece desde septiembre de 2026.");
    renderTrialVolumeChart($("trialVolumeMonthlyChart"), volumeMonthly);

    const attendance = rowsInVisibleMonths(funnel.attendance_monthly);
    const a = attendance.reduce((acc, r) => ({ attendances: acc.attendances + r.attendances, clients: acc.clients + r.unique_clients, sessions: acc.sessions + r.sessions, p90: Math.max(acc.p90, r.p90_attendees_session || 0) }), { attendances: 0, clients: 0, sessions: 0, p90: 0 });
    setText("attendanceTotalKpi", integer.format(a.attendances)); setText("attendanceClientsKpi", integer.format(a.clients)); setText("attendanceSessionsKpi", integer.format(a.sessions)); setText("attendanceAvgKpi", a.sessions ? (a.attendances / a.sessions).toFixed(1) : "—"); setText("attendanceP90Kpi", a.sessions ? integer.format(a.p90) : "—");
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

    const lifecycleRows = rowsInVisibleMonths(funnel.lifecycle_monthly).map(row => ({ label: monthByLabel.get([...monthByLabel.keys()].find(label => monthByLabel.get(label).key === row.month))?.label || row.month, total: row.total || 0, revenue: row.revenue || 0, newCount: row["Nuevo observado"] || 0, newRevenue: row["Nuevo observado_revenue"] || 0, continuousCount: row["Renovación continua"] || 0, continuousRevenue: row["Renovación continua_revenue"] || 0, reactivatedCount: row["Reactivación"] || 0, reactivatedRevenue: row["Reactivación_revenue"] || 0, resurrectedCount: row["Resurrección"] || 0, resurrectedRevenue: row["Resurrección_revenue"] || 0 }));
    const lifecycleTotals = lifecycleRows.reduce((acc, row) => ({
      total: acc.total + row.total,
      revenue: acc.revenue + row.revenue,
      newCount: acc.newCount + row.newCount,
      newRevenue: acc.newRevenue + row.newRevenue,
      continuousCount: acc.continuousCount + row.continuousCount,
      continuousRevenue: acc.continuousRevenue + row.continuousRevenue,
      reactivatedCount: acc.reactivatedCount + row.reactivatedCount,
      reactivatedRevenue: acc.reactivatedRevenue + row.reactivatedRevenue,
      resurrectedCount: acc.resurrectedCount + row.resurrectedCount,
      resurrectedRevenue: acc.resurrectedRevenue + row.resurrectedRevenue,
    }), { total: 0, revenue: 0, newCount: 0, newRevenue: 0, continuousCount: 0, continuousRevenue: 0, reactivatedCount: 0, reactivatedRevenue: 0, resurrectedCount: 0, resurrectedRevenue: 0 });
    setText("lifecycleRevenueKpi", currency.format(lifecycleTotals.revenue));
    setText("lifecyclePurchasesKpi", integer.format(lifecycleTotals.total));
    setText("newLifecycleKpi", integer.format(lifecycleTotals.newCount));
    setText("newLifecycleRevenueKpi", `${currency.format(lifecycleTotals.newRevenue)} facturados`);
    setText("continuousLifecycleKpi", integer.format(lifecycleTotals.continuousCount));
    setText("continuousLifecycleRevenueKpi", `${currency.format(lifecycleTotals.continuousRevenue)} facturados`);
    setText("reactivatedLifecycleKpi", integer.format(lifecycleTotals.reactivatedCount));
    setText("reactivatedLifecycleRevenueKpi", `${currency.format(lifecycleTotals.reactivatedRevenue)} facturados`);
    setText("resurrectedLifecycleKpi", integer.format(lifecycleTotals.resurrectedCount));
    setText("resurrectedLifecycleRevenueKpi", `${currency.format(lifecycleTotals.resurrectedRevenue)} facturados`);
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

    const renewal = funnel.renewal_probability || {}, gap = funnel.renewal_gap_stats || {};
    const expectedRenewals = (renewal.due_unique_clients || 0) * (renewal.rate_90 || 0);
    setText("dueValue", integer.format(renewal.due_unique_clients || 0));
    setText("retainedValue", percent.format(renewal.rate_30 || 0));
    setText("fugueValue", percent.format(renewal.rate_90 || 0));
    setText("renewalTicketValue", currency.format(renewal.projected_avg_ticket || 0));
    setText("renewalMedianValue", currency.format(renewal.projected_median_ticket || 0));
    setText("churnValue", integer.format(Math.round(expectedRenewals)));
    setText("renewalPipelineValue", currency.format(renewal.projected_gross_value || 0));
    setText("renewalExpectedValue", currency.format(renewal.projected_expected_value || 0));
    setText("renewalValue", percent.format(gap.within_90d || 0));
    setText("renewalNote", `${renewal.valuation_method || "Último paquete pagado por cliente"}. El valor esperado aplica la probabilidad histórica a 90 días. Ese corte captura ${percent.format(gap.within_90d || 0)} de los retornos observados.`);

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
    renderFunnel();
    renderOperations();
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
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { renderCharts(); renderFunnel(); renderOperations(); }, 120); });

  setText("updatedLabel", `Corte del tablero: ${data.generatedAt}`);
  renderStaticSections();
  updateAll();
})();
