(() => {
  "use strict";

  const data = window.SHADOW_GROWTH_DATA;
  if (!data) return;
  const $ = id => document.getElementById(id);
  const TX = { date: 0, customer: 1, value: 2, family: 4, lifecycle: 5, disciplines: 8, instructor: 9 };
  const AT = { date: 0, discipline: 2, instructor: 3 };
  const EN = { date: 0, customer: 1, type: 2, attendances: 3, converted: 8 };
  const CN = { date: 0, customer: 1, value: 2, source: 4 };
  const CC = { date: 0, contact: 1, source: 2, engaged: 3, hot: 4, category: 5, response24: 6, followup: 7, booking: 8, sale: 9, amount: 10, hotOpenNoFollow: 11, abandoned: 12, selfSent: 13, selfRead: 14, selfReply: 15, selfFollow: 16, selfNoFollow: 17, renewal: 18, expiry: 19, resolution: 20, firstInbound: 21, lastInbound: 22 };
  const CE = { date: 0, contact: 1, source: 2, type: 3, read: 4 };
  const CI = { date: 0, contact: 1, source: 2, meaningful: 3 };
  const ST = { date: 0, customer: 1, agenda1: 2, show1: 3, agenda2: 4, show2: 5, converted: 6, value: 7 };
  const TA = { date: 0, customer: 1, type: 2, source: 3, detail: 4, signalDate: 5, confidence: 6, matchMethod: 7, attendances: 8, show1: 9, show2: 10, converted: 11, conversionDate: 12, value: 13, path: 14 };
  const integer = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });
  const currency = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 0 });
  const percent = new Intl.NumberFormat("es-PE", { style: "percent", maximumFractionDigits: 1 });
  const sum = values => values.reduce((total, value) => total + Number(value || 0), 0);
  const unique = values => new Set(values).size;
  const ratio = (a, b) => b ? a / b : null;

  function controls() {
    return {
      start: $("startDate").value,
      end: $("endDate").value,
      lifecycle: $("lifecycleFilter").value,
      discipline: $("disciplineFilter").value,
      instructor: $("instructorFilter").value,
      family: $("familyFilter").value,
      entry: $("entryFilter").value,
    };
  }

  function txMatches(row, current) {
    return (current.lifecycle === "Todos" || row[TX.lifecycle] === current.lifecycle)
      && (current.discipline === "Todos" || row[TX.disciplines].includes(current.discipline))
      && (current.instructor === "Todos" || row[TX.instructor] === current.instructor)
      && (current.family === "Todos" || row[TX.family] === current.family);
  }

  function between(value, range) { return value && value >= range.start && value <= range.end; }
  function txRows(range) { const c = controls(); return data.transactions.filter(row => between(row[TX.date], range) && txMatches(row, c)); }
  function attendanceRows(range) { const c = controls(); return data.attendance.filter(row => between(row[AT.date], range) && (c.discipline === "Todos" || row[AT.discipline] === c.discipline) && (c.instructor === "Todos" || row[AT.instructor] === c.instructor)); }
  function entryRows(range) { const c = controls(); return data.entries.filter(row => between(row[EN.date], range) && (c.entry === "Todos" || row[EN.type] === c.entry)); }
  function coreRows(range) { return data.coreNew.filter(row => between(row[CN.date], range)); }
  function trialAttributionRows(range, applyLocal = false) {
    const c = controls();
    const source = applyLocal ? $("trialSourceFilter").value : "Todos";
    return (data.trialAttribution || []).filter(row => between(row[TA.date], range)
      && (c.entry === "Todos" || row[TA.type] === c.entry)
      && (source === "Todos" || row[TA.source] === source));
  }
  function conversationEnd(range) { return range.end === data.dateMax ? data.conversationCoverage.end : range.end; }
  function conversationRows(range, applyLocal = false) {
    const source = applyLocal ? $("conversationSourceFilter").value : "Todos";
    const status = applyLocal ? $("conversationStatusFilter").value : "Todos";
    const adjusted = { start: range.start, end: conversationEnd(range) };
    return (data.conversationContacts || []).filter(row => between(row[CC.date], adjusted)
      && (source === "Todos" || row[CC.source] === source)
      && (status === "Todos"
        || (status === "Calientes" && row[CC.hot])
        || (status === "Calientes sin seguimiento" && row[CC.hotOpenNoFollow])
        || (status === "Abandonados" && row[CC.abandoned])
        || (status === "Autoservicio sin seguimiento" && row[CC.selfNoFollow])));
  }
  function conversationEvents(range, applyLocal = false) {
    const source = applyLocal ? $("conversationSourceFilter").value : "Todos";
    const adjusted = { start: range.start, end: conversationEnd(range) };
    return (data.conversationEvents || []).filter(row => between(row[CE.date], adjusted) && (source === "Todos" || row[CE.source] === source));
  }
  function inboundActivity(range, applyLocal = false) {
    const source = applyLocal ? $("conversationSourceFilter").value : "Todos";
    const adjusted = { start: range.start, end: conversationEnd(range) };
    return (data.conversationInbound || []).filter(row => between(row[CI.date], adjusted) && (source === "Todos" || row[CI.source] === source));
  }

  function addMonths(value, amount) {
    const [year, month, day] = value.split("-").map(Number);
    const first = new Date(Date.UTC(year, month - 1 + amount, 1));
    const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    first.setUTCDate(Math.min(day, lastDay));
    return first.toISOString().slice(0, 10);
  }
  function addYears(value, amount) { const date = new Date(`${value}T00:00:00Z`); date.setUTCFullYear(date.getUTCFullYear() + amount); return date.toISOString().slice(0, 10); }
  function currentRange() { return { start: $("startDate").value, end: $("endDate").value }; }
  function comparisonRange(range) {
    return $("metricComparisonMode").value === "priorYear"
      ? { start: addYears(range.start, -1), end: addYears(range.end, -1), label: "mismo periodo del año anterior" }
      : { start: addMonths(range.start, -1), end: addMonths(range.end, -1), label: "mes anterior, mismos días" };
  }
  function coverage(range) {
    const start = data.conversationCoverage.start, end = data.conversationCoverage.end;
    if (range.end < start || range.start > end) return "none";
    return range.start >= start && range.end <= end ? "full" : "partial";
  }

  const metrics = {
    revenue: { label: "Facturación", format: "currency", calc: range => sum(txRows(range).map(row => row[TX.value])) },
    newRevenue: { label: "Facturación de nuevos", format: "currency", calc: range => sum(txRows(range).filter(row => row[TX.lifecycle] === "Nuevo").map(row => row[TX.value])) },
    repeatRevenue: { label: "Facturación recurrente", format: "currency", calc: range => sum(txRows(range).filter(row => row[TX.lifecycle] !== "Nuevo").map(row => row[TX.value])) },
    purchases: { label: "Compras", format: "integer", calc: range => txRows(range).length },
    newCustomers: { label: "Nuevos clientes", format: "integer", calc: range => unique(txRows(range).filter(row => row[TX.lifecycle] === "Nuevo").map(row => row[TX.customer])) },
    averageTicket: { label: "Ticket promedio", format: "currency", calc: range => { const rows = txRows(range); return rows.length ? sum(rows.map(row => row[TX.value])) / rows.length : 0; } },
    attendances: { label: "Asistencias", format: "integer", calc: range => attendanceRows(range).length },
    entryBookings: { label: "Bookings de prueba", format: "integer", calc: range => entryRows(range).length },
    firstShows: { label: "Primer show", format: "integer", calc: range => entryRows(range).filter(row => row[EN.attendances] >= 1).length },
    secondShows: { label: "Segundo show", format: "integer", calc: range => entryRows(range).filter(row => row[EN.attendances] >= 2).length },
    trialConversions: { label: "Conversiones de prueba ≤30d", format: "integer", calc: range => entryRows(range).filter(row => row[EN.converted]).length },
    trialConversionRate: { label: "Tasa de conversión de prueba", format: "percent", calc: range => { const rows = entryRows(range); return ratio(rows.filter(row => row[EN.converted]).length, rows.length) || 0; } },
    trialTraceCoverage: { label: "Pruebas con origen trazable", format: "percent", conversation: true, calc: range => { const rows = trialAttributionRows(range); return ratio(rows.filter(row => row[TA.source] !== "Sin origen trazable").length, rows.length) || 0; } },
    trialsFromAds: { label: "Pruebas atribuidas a Ads", format: "integer", conversation: true, calc: range => trialAttributionRows(range).filter(row => row[TA.source] === "Headline Ads").length },
    trialConversionsFromAds: { label: "Compras desde pruebas de Ads", format: "integer", conversation: true, calc: range => trialAttributionRows(range).filter(row => row[TA.source] === "Headline Ads" && row[TA.converted]).length },
    newCore: { label: "Nuevos paquete core", format: "integer", calc: range => coreRows(range).length },
    hotLeads: { label: "Leads calientes", format: "integer", conversation: true, calc: range => conversationRows(range).filter(row => row[CC.hot]).length },
    hotFollowupRate: { label: "Seguimiento a leads calientes", format: "percent", conversation: true, calc: range => { const rows = conversationRows(range).filter(row => row[CC.hot]); return ratio(rows.filter(row => row[CC.followup]).length, rows.length) || 0; } },
    hotOpenNoFollowup: { label: "Calientes abiertos sin seguimiento", format: "integer", conversation: true, calc: range => conversationRows(range).filter(row => row[CC.hotOpenNoFollow]).length },
    abandoned: { label: "Clientes sin respuesta del equipo", format: "integer", conversation: true, calc: range => conversationRows(range).filter(row => row[CC.abandoned]).length },
    selfServiceNoFollowup: { label: "Web/link sin seguimiento", format: "integer", conversation: true, calc: range => conversationRows(range).filter(row => row[CC.selfNoFollow]).length },
    renewalMessages: { label: "Mensajes de renovación", format: "integer", conversation: true, calc: range => conversationEvents(range).filter(row => row[CE.type] === "Renovación").length },
    expiryMessages: { label: "Mensajes de vencimiento", format: "integer", conversation: true, calc: range => conversationEvents(range).filter(row => row[CE.type] === "Vencimiento").length },
    resolutionMessages: { label: "Mensajes de resolución", format: "integer", conversation: true, calc: range => conversationEvents(range).filter(row => row[CE.type] === "Resolución").length },
  };
  const metricKeys = Object.keys(metrics);
  const formatValue = (key, value) => value == null ? "n.a." : metrics[key].format === "currency" ? currency.format(value) : metrics[key].format === "percent" ? percent.format(value) : integer.format(value);
  const signedDelta = value => `${value >= 0 ? "+" : ""}${percent.format(value)}`;

  function fillMetricSelect(select, selected) {
    select.replaceChildren(...metricKeys.map(key => { const option = document.createElement("option"); option.value = key; option.textContent = metrics[key].label; option.selected = key === selected; return option; }));
  }

  const savedWidgets = (() => { try { return JSON.parse(localStorage.getItem("shadowMetricWidgets")); } catch { return null; } })();
  const defaults = ["revenue", "newRevenue", "newCustomers", "hotOpenNoFollowup"];
  document.querySelectorAll(".widget-metric").forEach((select, index) => {
    fillMetricSelect(select, savedWidgets?.[index] || defaults[index]);
    select.addEventListener("change", () => {
      localStorage.setItem("shadowMetricWidgets", JSON.stringify([...document.querySelectorAll(".widget-metric")].map(item => item.value)));
      renderMetricLab();
    });
  });
  fillMetricSelect($("metricA"), "revenue");
  fillMetricSelect($("metricB"), "hotOpenNoFollowup");

  function metricValue(key, range) {
    return metrics[key].conversation && coverage(range) === "none" ? null : metrics[key].calc(range);
  }
  function comparisonText(key, current, prior, priorRange, currentRange) {
    if (metrics[key].conversation && coverage(currentRange) === "partial") return "Periodo actual con cobertura parcial";
    if (current == null) return "Sin cobertura de conversaciones en el periodo";
    if (metrics[key].conversation && coverage(priorRange) !== "full") return coverage(priorRange) === "none" ? "Comparación no disponible: sin histórico de conversaciones" : "Comparación no disponible: cobertura parcial";
    if (prior === 0) return `Base anterior ${formatValue(key, prior)}`;
    const change = current / prior - 1;
    return `${signedDelta(change)} vs. ${priorRange.label} · ${formatValue(key, prior)}`;
  }

  function renderMetricLab() {
    const range = currentRange();
    const priorRange = comparisonRange(range);
    document.querySelectorAll(".metric-widget").forEach(widget => {
      const key = widget.querySelector("select").value;
      const current = metricValue(key, range);
      const prior = metricValue(key, priorRange);
      widget.querySelector(".widget-value").textContent = formatValue(key, current);
      const comparison = widget.querySelector(".widget-comparison");
      comparison.textContent = comparisonText(key, current, prior, priorRange, range);
      comparison.className = `widget-comparison${prior && current / prior - 1 >= 0 ? " positive" : prior ? " negative" : ""}`;
    });
    const keys = [$("metricA").value, $("metricB").value];
    $("metricDuel").replaceChildren(...keys.map(key => {
      const current = metricValue(key, range), prior = metricValue(key, priorRange);
      const side = document.createElement("div"); side.className = "duel-side";
      const label = document.createElement("span"); label.textContent = metrics[key].label;
      const value = document.createElement("strong"); value.textContent = formatValue(key, current);
      const delta = document.createElement("b"); delta.textContent = comparisonText(key, current, prior, priorRange, range);
      if (prior) delta.className = current / prior - 1 >= 0 ? "positive" : "negative";
      side.append(label, value, delta); return side;
    }));
  }

  function stageStep(label, value, previous, risk = false) {
    const step = document.createElement("div"); step.className = `funnel-step${risk ? " risk" : ""}`;
    const title = document.createElement("span"); title.textContent = label;
    const count = document.createElement("strong"); count.textContent = integer.format(value);
    const rate = document.createElement("small"); rate.textContent = previous == null ? "Base" : `${percent.format(ratio(value, previous) || 0)} del paso anterior`;
    step.append(title, count, rate); return step;
  }

  function renderTwoStages() {
    const range = currentRange();
    const rows = (data.twoXOneStages || []).filter(row => between(row[ST.date], range));
    const values = [rows.length, rows.filter(row => row[ST.agenda1]).length, rows.filter(row => row[ST.show1]).length, rows.filter(row => row[ST.agenda2]).length, rows.filter(row => row[ST.show2]).length, rows.filter(row => row[ST.converted]).length];
    const labels = ["Bookings 2×1", "Agenda 1", "Show 1", "Agenda 2", "Show 2", "Compró paquete"];
    const drops = values.slice(1).map((value, index) => ({ index: index + 1, rate: ratio(value, values[index]) ?? 1 }));
    const bottleneck = drops.sort((a, b) => a.rate - b.rate)[0]?.index;
    $("twoStageCards").replaceChildren(...labels.map((label, index) => {
      const card = document.createElement("article"); card.className = `stage-card${index === bottleneck ? " bottleneck" : ""}`;
      const title = document.createElement("span"); title.textContent = label;
      const value = document.createElement("strong"); value.textContent = integer.format(values[index]);
      const note = document.createElement("small"); note.textContent = index ? `${percent.format(ratio(values[index], values[index - 1]) || 0)} del paso anterior` : `${rows.length} cohortes`;
      card.append(title, value, note); return card;
    }));
    $("twoStageFunnel").replaceChildren(...labels.map((label, index) => stageStep(label, values[index], index ? values[index - 1] : null, index === bottleneck)));
    $("twoStageContext").textContent = rows.length ? `Mayor caída: ${labels[bottleneck - 1]} → ${labels[bottleneck]} (${percent.format(1 - drops.find(item => item.index === bottleneck).rate)} de pérdida).` : "No hay cohortes 2×1 con detalle de reserva en el periodo seleccionado.";
  }

  function simpleBars(container, items) {
    const max = Math.max(1, ...items.map(item => item.value));
    container.replaceChildren(...items.map(item => {
      const row = document.createElement("div"); row.className = "simple-bar-row";
      const label = document.createElement("span"); label.className = "simple-bar-label"; label.textContent = item.label;
      const track = document.createElement("div"); track.className = "simple-bar-track";
      const fill = document.createElement("span"); fill.className = "simple-bar-fill"; fill.style.width = `${item.value / max * 100}%`; track.append(fill);
      const value = document.createElement("strong"); value.className = "simple-bar-value"; value.textContent = item.format === "percent" ? percent.format(item.value) : integer.format(item.value);
      row.append(label, track, value); return row;
    }));
  }

  function appendTableRow(values, formats = {}) {
    const tr = document.createElement("tr");
    values.forEach((value, index) => {
      const td = document.createElement("td");
      td.textContent = formats[index] === "percent" ? percent.format(value || 0)
        : formats[index] === "currency" ? currency.format(value || 0)
          : typeof value === "number" ? integer.format(value) : value;
      tr.append(td);
    });
    return tr;
  }

  function renderTrialAttribution() {
    const range = currentRange();
    const rows = trialAttributionRows(range, true);
    const matched = rows.filter(row => row[TA.source] !== "Sin origen trazable");
    const show1 = rows.filter(row => row[TA.show1]);
    const show2 = rows.filter(row => row[TA.show2]);
    const converted = rows.filter(row => row[TA.converted]);
    const selectedSource = $("trialSourceFilter").value;
    $("trialSourceBookingsKpi").textContent = integer.format(rows.length);
    $("trialSourceMixKpi").textContent = selectedSource === "Todos" ? "todos los orígenes" : selectedSource;
    $("trialSourceMatchedKpi").textContent = integer.format(matched.length);
    $("trialSourceMatchedRate").textContent = `${percent.format(ratio(matched.length, rows.length) || 0)} de las pruebas`;
    $("trialSourceShowKpi").textContent = integer.format(show1.length);
    $("trialSourceShowRate").textContent = `${percent.format(ratio(show1.length, rows.length) || 0)} de las pruebas`;
    $("trialSourceConvertedKpi").textContent = integer.format(converted.length);
    $("trialSourceConvertedRate").textContent = `${percent.format(ratio(converted.length, rows.length) || 0)} de las pruebas`;
    const coverageState = coverage(range);
    $("trialAttributionCoverage").textContent = coverageState === "none"
      ? `Sin cobertura de origen para este periodo. Conversaciones disponibles del ${data.conversationCoverage.start} al ${data.conversationCoverage.end}.`
      : `${coverageState === "partial" ? "Cobertura parcial" : "Cobertura completa"}: la fuente se cruza con conversaciones del ${data.conversationCoverage.start} al ${data.conversationCoverage.end}. “Sin origen trazable” permanece separado y no se reasigna.`;

    const allSources = data.dimensions.trialSources || [];
    const sourceNames = selectedSource === "Todos" ? allSources : [selectedSource];
    const sourceGroups = sourceNames.map(source => ({ source, group: rows.filter(row => row[TA.source] === source) })).filter(item => item.group.length);
    simpleBars($("trialSourceChart"), sourceGroups.map(item => ({ label: item.source, value: item.group.length })).sort((a, b) => b.value - a.value));
    $("trialSourceFunnel").replaceChildren(
      stageStep("Pruebas emitidas", rows.length, null),
      stageStep("Show 1", show1.length, rows.length),
      stageStep("Show 2", show2.length, show1.length),
      stageStep("Compró paquete ≤30d", converted.length, rows.length)
    );

    $("trialSourceTable").replaceChildren(...sourceGroups.map(({ source, group }) => {
      const conversions = group.filter(row => row[TA.converted]);
      return appendTableRow([
        source,
        group.length,
        group.filter(row => row[TA.type] === "2x1").length,
        group.filter(row => row[TA.type] === "Free Pass").length,
        group.filter(row => row[TA.type] === "1 Clase").length,
        group.filter(row => row[TA.show1]).length,
        ratio(group.filter(row => row[TA.show1]).length, group.length) || 0,
        conversions.length,
        ratio(conversions.length, group.length) || 0,
        sum(conversions.map(row => row[TA.value])),
      ], { 6: "percent", 8: "percent", 9: "currency" });
    }));

    const details = new Map();
    rows.forEach(row => {
      const key = `${row[TA.source]}\u0000${row[TA.detail]}`;
      if (!details.has(key)) details.set(key, { source: row[TA.source], detail: row[TA.detail], rows: [] });
      details.get(key).rows.push(row);
    });
    const detailRows = [...details.values()].sort((a, b) => b.rows.length - a.rows.length);
    $("trialSourceDetailTable").replaceChildren(...detailRows.map(item => {
      const conversions = item.rows.filter(row => row[TA.converted]).length;
      return appendTableRow([
        item.detail,
        item.source,
        item.rows.length,
        item.rows.filter(row => row[TA.show1]).length,
        conversions,
        ratio(conversions, item.rows.length) || 0,
      ], { 5: "percent" });
    }));
  }

  function renderConversations() {
    const range = currentRange();
    const rows = conversationRows(range, true), events = conversationEvents(range, true), activity = inboundActivity(range, true);
    const hot = rows.filter(row => row[CC.hot]);
    const followed = hot.filter(row => row[CC.followup]);
    const response = hot.filter(row => row[CC.response24]);
    const bookings = hot.filter(row => row[CC.booking]);
    const sales = hot.filter(row => row[CC.sale]);
    const leaks = hot.filter(row => row[CC.hotOpenNoFollow]);
    const selfSent = rows.filter(row => row[CC.selfSent]);
    const selfRead = selfSent.filter(row => row[CC.selfRead]);
    const selfReply = selfSent.filter(row => row[CC.selfReply]);
    const selfFollow = selfSent.filter(row => row[CC.selfFollow]);
    const selfLeak = rows.filter(row => row[CC.selfNoFollow]);
    const statusIsAll = $("conversationStatusFilter").value === "Todos";
    const activeContacts = statusIsAll ? unique(activity.map(row => row[CI.contact])) : unique(rows.map(row => row[CC.contact]));
    const engagedContacts = statusIsAll ? unique(activity.filter(row => row[CI.meaningful]).map(row => row[CI.contact])) : unique(rows.filter(row => row[CC.engaged]).map(row => row[CC.contact]));
    $("inboundContactsKpi").textContent = integer.format(activeContacts);
    $("engagedContactsKpi").textContent = `${integer.format(engagedContacts)} escribieron algo adicional`;
    $("hotLeadsKpi").textContent = integer.format(hot.length);
    $("hotFollowupKpi").textContent = integer.format(followed.length);
    $("hotFollowupRate").textContent = `${percent.format(ratio(followed.length, hot.length) || 0)} de calientes`;
    $("hotLeakKpi").textContent = integer.format(leaks.length);
    $("hotLeakRate").textContent = `${percent.format(ratio(leaks.length, hot.length) || 0)} de calientes`;
    $("abandonedKpi").textContent = integer.format(rows.filter(row => row[CC.abandoned]).length);
    $("selfServiceLeakKpi").textContent = integer.format(selfLeak.length);
    $("selfServiceReadKpi").textContent = `${integer.format(selfRead.length)} mensajes enviados a web marcados como leídos`;
    const coverageState = coverage({ start: range.start, end: conversationEnd(range) });
    $("conversationCoverage").textContent = coverageState === "none"
      ? `Sin cobertura de conversaciones en este periodo. Export disponible: ${data.conversationCoverage.start} a ${data.conversationCoverage.end}.`
      : `${coverageState === "partial" ? "Cobertura parcial" : "Cobertura completa"}: conversaciones del ${data.conversationCoverage.start} al ${data.conversationCoverage.end}. Los datos comerciales sí conservan su histórico completo.`;
    $("hotLeadFunnel").replaceChildren(
      stageStep("Leads calientes", hot.length, null), stageStep("Respuesta ≤24 h", response.length, hot.length),
      stageStep("Seguimiento manual", followed.length, hot.length, followed.length < hot.length / 2),
      stageStep("Booking detectado", bookings.length, hot.length), stageStep("Venta detectada", sales.length, hot.length)
    );
    const categories = new Map(); hot.forEach(row => categories.set(row[CC.category] || "Sin categoría", (categories.get(row[CC.category] || "Sin categoría") || 0) + 1));
    simpleBars($("hotCategoryChart"), [...categories].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value));
    const eventTypes = ["Vencimiento", "Renovación", "Resolución", "Autoservicio / link"];
    simpleBars($("conversationEventChart"), eventTypes.map(label => ({ label, value: events.filter(row => row[CE.type] === label).length })));
    simpleBars($("selfServiceChart"), [
      { label: "Enviados a web/link", value: selfSent.length }, { label: "Mensaje marcado leído", value: selfRead.length },
      { label: "Cliente respondió", value: selfReply.length }, { label: "Hubo recontacto", value: selfFollow.length },
      { label: "Sin respuesta ni seguimiento", value: selfLeak.length },
    ]);
    const sources = $("conversationSourceFilter").value === "Todos" ? data.dimensions.conversationSources : [$("conversationSourceFilter").value];
    $("conversationSourceTable").replaceChildren(...sources.map(source => {
      const group = rows.filter(row => row[CC.source] === source), groupHot = group.filter(row => row[CC.hot]), sourceActivity = activity.filter(row => row[CI.source] === source);
      const tr = document.createElement("tr");
      [source, statusIsAll ? unique(sourceActivity.map(row => row[CI.contact])) : unique(group.map(row => row[CC.contact])), groupHot.length, groupHot.filter(row => row[CC.followup]).length, groupHot.filter(row => row[CC.hotOpenNoFollow]).length, group.filter(row => row[CC.abandoned]).length, group.filter(row => row[CC.selfNoFollow]).length, groupHot.filter(row => row[CC.sale]).length].forEach(value => { const td = document.createElement("td"); td.textContent = typeof value === "number" ? integer.format(value) : value; tr.append(td); });
      return tr;
    }));
  }

  function csvCell(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
  function exportConversations() {
    const rows = conversationRows(currentRange(), true);
    const output = [["fecha_senal", "contacto_anonimo", "origen", "es_lead_caliente", "categoria_caliente", "respuesta_24h", "seguimiento_manual", "booking_detectado", "venta_detectada", "abierto_sin_seguimiento", "cliente_sin_respuesta", "web_link_enviado", "web_link_leido", "cliente_respondio_link", "recontacto_despues_link", "web_sin_seguimiento", "mensajes_renovacion", "mensajes_vencimiento", "mensajes_resolucion"], ...rows.map(row => [row[CC.date], row[CC.contact], row[CC.source], row[CC.hot] ? "Sí" : "No", row[CC.category], row[CC.response24] ? "Sí" : "No", row[CC.followup] ? "Sí" : "No", row[CC.booking] ? "Sí" : "No", row[CC.sale] ? "Sí" : "No", row[CC.hotOpenNoFollow] ? "Sí" : "No", row[CC.abandoned] ? "Sí" : "No", row[CC.selfSent] ? "Sí" : "No", row[CC.selfRead] ? "Sí" : "No", row[CC.selfReply] ? "Sí" : "No", row[CC.selfFollow] ? "Sí" : "No", row[CC.selfNoFollow] ? "Sí" : "No", row[CC.renewal], row[CC.expiry], row[CC.resolution]])];
    const blob = new Blob(["\uFEFF" + output.map(row => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = `shadow-auditoria-conversaciones-${currentRange().start}-${currentRange().end}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function exportTrialAttribution() {
    const rows = trialAttributionRows(currentRange(), true);
    const output = [["fecha_prueba", "cliente_anonimo", "oferta_entrada", "origen_atribuido", "detalle_origen", "fecha_senal", "confianza", "metodo_cruce", "asistencias", "show_1", "show_2", "compro_paquete_30d", "fecha_compra", "monto_compra", "ruta_origen"], ...rows.map(row => [
      row[TA.date], row[TA.customer], row[TA.type], row[TA.source], row[TA.detail], row[TA.signalDate], row[TA.confidence], row[TA.matchMethod], row[TA.attendances], row[TA.show1] ? "Sí" : "No", row[TA.show2] ? "Sí" : "No", row[TA.converted] ? "Sí" : "No", row[TA.conversionDate], row[TA.value], row[TA.path],
    ])];
    const blob = new Blob(["\uFEFF" + output.map(row => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = `shadow-atribucion-pruebas-${currentRange().start}-${currentRange().end}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function renderAll() { renderMetricLab(); renderTrialAttribution(); renderTwoStages(); renderConversations(); }
  const sourceSelect = $("conversationSourceFilter");
  sourceSelect.replaceChildren(...["Todos", ...data.dimensions.conversationSources].map(value => { const option = document.createElement("option"); option.value = value; option.textContent = value; return option; }));
  const trialSourceSelect = $("trialSourceFilter");
  trialSourceSelect.replaceChildren(...["Todos", ...(data.dimensions.trialSources || [])].map(value => { const option = document.createElement("option"); option.value = value; option.textContent = value; return option; }));
  ["periodFilter", "startDate", "endDate", "lifecycleFilter", "disciplineFilter", "instructorFilter", "familyFilter", "entryFilter"].forEach(id => $(id).addEventListener("change", renderAll));
  ["conversationSourceFilter", "conversationStatusFilter", "trialSourceFilter", "metricComparisonMode", "metricA", "metricB"].forEach(id => $(id).addEventListener("change", renderAll));
  $("resetFilters").addEventListener("click", () => { sourceSelect.value = "Todos"; trialSourceSelect.value = "Todos"; $("conversationStatusFilter").value = "Todos"; setTimeout(renderAll, 0); });
  $("exportConversations").addEventListener("click", exportConversations);
  $("exportTrialAttribution").addEventListener("click", exportTrialAttribution);
  renderAll();
})();
