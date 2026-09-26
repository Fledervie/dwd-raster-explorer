const climateMonthsSelected = new Set(Array.from({length: 12}, (_, index) => index + 1));
const climateSelectedParameters = new Set();
const climateDisplayTypes = new Map();
const CLIMATE_SERIES_COLOURS = ['--color-primary', '--color-secondary', '--color-accent',
  '--color-info', '--color-warning', '--color-success'];
let climateSelectionChanged = false;
let climateYearChanged = false;
let climateRowsVisible = [];
let climateSourceRequest = 0;
let globalClimateValues = [];
let globalClimatePoint = '';
let dwdProductsLoaded = false;
let climateRequestedYear = '';
const GLOBAL_CLIMATE_PRODUCTS = [
  ['temperature_mean', 'Mittlere Lufttemperatur'],
  ['temperature_max', 'Durchschnittliche Tageshöchsttemperatur'],
  ['temperature_min', 'Durchschnittliche Tagestiefsttemperatur'],
  ['precipitation', 'Niederschlagssumme'],
  ['sunshine', 'Sonnenscheindauer'],
  ['radiation', 'Globalstrahlung'],
  ['evapotranspiration', 'Referenzverdunstung ET₀'],
  ['wind', 'Durchschnittliches tägliches Windmaximum']
];

const climateChart = new Chart($('climateChart'), {
  type: 'line',
  data: {labels: [], datasets: []},
  options: {
    responsive: true, maintainAspectRatio: false,
    interaction: {mode: 'index', intersect: false},
    plugins: {
      legend: {display: true, position: 'top', labels: {color: themeColor('--color-base-content')}},
      tooltip: {callbacks: {label(context) {
        const value = context.parsed.y;
        return `${context.dataset.title || context.dataset.label}: ${value === null ? '–' : format(value)}${context.dataset.unit ? ` ${context.dataset.unit}` : ''}`;
      }}}
    },
    scales: {x: {grid: {display: false}}, y0: {beginAtZero: false}}
  }
});

function climateStatus(message, error = false) {
  $('climateStatus').textContent = message;
  $('climateStatus').classList.toggle('error', error);
}

function climateOption(select, value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.append(option);
}

function renderClimatePanel() {
  const pointKey = state.selectedPoint
    ? `${state.selectedPoint.lat.toFixed(5)},${state.selectedPoint.lng.toFixed(5)}` : '';
  if (pointKey !== globalClimatePoint) {
    globalClimateValues = [];
    globalClimatePoint = pointKey;
  }
  $('climatePoint').textContent = $('pointLabel').textContent;
  const climateValues = [...state.pointValues, ...globalClimateValues];
  const years = climateYears(climateValues);
  const yearSelect = $('climateYear');
  const previous = yearSelect.value;
  const active = state.rasters.get(state.activeId);
  const activeYear = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(active?.timestamp || '')?.[1];
  yearSelect.replaceChildren();
  years.forEach(year => climateOption(yearSelect, year, year));
  yearSelect.disabled = !years.length;
  $('climateYearControl').hidden = years.length <= 1;
  if (years.length) {
    yearSelect.value = years.includes(climateRequestedYear)
      ? climateRequestedYear : (climateYearChanged && years.includes(previous)
        ? previous : (years.includes(activeYear) ? activeYear : years[0]));
  } else climateOption(yearSelect, '', 'Monatsdaten laden');
  climateRequestedYear = '';

  climateRowsVisible = years.length ? climateRows(climateValues, yearSelect.value) : [];
  const availableKeys = new Set(climateRowsVisible.map(row => row.key));
  for (const key of [...climateSelectedParameters]) {
    if (!availableKeys.has(key)) climateSelectedParameters.delete(key);
  }
  if (!climateSelectionChanged) {
    for (const row of climateRowsVisible) {
      if (row.unit === '°C' || row.unit === 'mm') climateSelectedParameters.add(row.key);
    }
    if (!climateSelectedParameters.size && climateRowsVisible.length)
      climateSelectedParameters.add(climateRowsVisible[0].key);
  }
  renderClimateTable(climateRowsVisible);
  renderClimateParameterChoices(climateRowsVisible);
  syncClimateParameterSelection();
}

function syncAllMonthsToggle() {
  const all = $('climateAllMonths');
  all.checked = climateMonthsSelected.size === 12;
  all.indeterminate = climateMonthsSelected.size > 0 && climateMonthsSelected.size < 12;
}

function selectClimateParameter(key, checked) {
  climateSelectionChanged = true;
  checked ? climateSelectedParameters.add(key) : climateSelectedParameters.delete(key);
  syncClimateParameterSelection();
}

function syncClimateParameterSelection() {
  for (const input of document.querySelectorAll('.climate-parameter-input')) {
    input.checked = climateSelectedParameters.has(input.dataset.parameterKey);
    input.closest('.climate-chip')?.classList.toggle('selected', input.checked);
  }
  const count = climateRowsVisible.filter(row => climateSelectedParameters.has(row.key)).length;
  $('climateSelectedCount').textContent = `${count} ausgewählt`;
  updateClimateChart();
}

function renderClimateParameterChoices(rows) {
  const container = $('climateParameterChoices');
  container.replaceChildren();
  if (!rows.length) {
    const hint = document.createElement('p');
    hint.textContent = 'Geladene Monatsparameter erscheinen hier zur Mehrfachauswahl.';
    container.append(hint);
  }
  rows.forEach((row, index) => {
    const label = document.createElement('label');
    label.className = 'climate-chip';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'climate-parameter-input';
    checkbox.dataset.parameterKey = row.key;
    checkbox.checked = climateSelectedParameters.has(row.key);
    checkbox.onchange = () => selectClimateParameter(row.key, checkbox.checked);
    const swatch = document.createElement('span');
    swatch.className = 'climate-chip-swatch';
    swatch.style.backgroundColor = themeColor(CLIMATE_SERIES_COLOURS[index % CLIMATE_SERIES_COLOURS.length]);
    const name = document.createElement('span');
    name.textContent = `${row.title}${row.unit ? ` · ${row.unit}` : ''}`;
    label.append(checkbox, swatch, name);
    container.append(label);
  });
  $('climateSelectAll').disabled = !rows.length;
  $('climateSelectNone').disabled = !rows.length;
}

function renderClimateTable(rows) {
  const table = $('climateTable'), head = table.tHead, body = table.tBodies[0];
  head.replaceChildren();
  body.replaceChildren();
  const header = document.createElement('tr');
  for (const title of ['Parameter', 'Darstellung']) {
    const cell = document.createElement('th');
    cell.textContent = title;
    header.append(cell);
  }
  CLIMATE_MONTHS.forEach((name, index) => {
    const cell = document.createElement('th');
    const label = document.createElement('label');
    label.className = 'climate-month-label';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = climateMonthsSelected.has(index + 1);
    checkbox.setAttribute('aria-label', `${name}: im Diagramm anzeigen`);
    checkbox.onchange = () => {
      checkbox.checked ? climateMonthsSelected.add(index + 1) : climateMonthsSelected.delete(index + 1);
      cell.classList.toggle('inactive', !checkbox.checked);
      for (const row of body.rows) row.cells[index + 2]?.classList.toggle('inactive', !checkbox.checked);
      syncAllMonthsToggle();
      updateClimateChart();
    };
    label.append(checkbox, document.createTextNode(name));
    cell.append(label);
    cell.classList.toggle('inactive', !checkbox.checked);
    header.append(cell);
  });
  head.append(header);
  syncAllMonthsToggle();

  if (!rows.length) {
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 14;
    cell.className = 'climate-no-data';
    cell.textContent = state.selectedPoint
      ? 'Noch keine Monatsraster für diesen Ort und dieses Jahr geladen.'
      : 'Wähle zuerst einen Ort auf der Karte.';
    return;
  }
  for (const group of rows) {
    const row = body.insertRow();
    const parameterCell = row.insertCell();
    const parameterLabel = document.createElement('label');
    parameterLabel.className = 'climate-parameter-label';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'climate-parameter-input';
    checkbox.dataset.parameterKey = group.key;
    checkbox.checked = climateSelectedParameters.has(group.key);
    checkbox.setAttribute('aria-label', `${group.title} im Klimadiagramm anzeigen`);
    checkbox.onchange = () => selectClimateParameter(group.key, checkbox.checked);
    const title = document.createElement('span');
    title.textContent = `${group.title}${group.unit ? ` · ${group.unit}` : ''}`;
    parameterLabel.append(checkbox, title);
    parameterCell.append(parameterLabel);

    const typeCell = row.insertCell();
    const type = document.createElement('select');
    type.setAttribute('aria-label', `Darstellung für ${group.title}`);
    climateOption(type, 'line', 'Linie');
    climateOption(type, 'bar', 'Balken');
    type.value = climateDisplayTypes.get(group.key) || (group.unit === 'mm' ? 'bar' : 'line');
    type.onchange = () => {climateDisplayTypes.set(group.key, type.value);updateClimateChart()};
    typeCell.append(type);

    group.values.forEach((value, index) => {
      const cell = row.insertCell();
      cell.textContent = value === null ? '–' : format(value);
      cell.classList.toggle('inactive', !climateMonthsSelected.has(index + 1));
      if (!group.loaded[index]) cell.title = 'Monatsraster nicht geladen';
      else if (value === null) cell.title = 'Für diesen Ort liegt kein Wert vor';
    });
  }
}

function updateClimateChart() {
  const {months, rows, units} = climateSelection(
    climateRowsVisible, climateSelectedParameters, climateMonthsSelected);
  const annual = climateAnnualSummaries(climateRowsVisible, climateSelectedParameters);
  const axisFor = new Map(units.map((unit, index) => [unit, `y${index}`]));
  const colourFor = new Map(climateRowsVisible.map((row, index) => [row.key,
    row.unit === '°C' ? themeColor('--color-error') : row.unit === 'mm'
      ? themeColor('--color-info') : themeColor(CLIMATE_SERIES_COLOURS[index % CLIMATE_SERIES_COLOURS.length])]));
  climateChart.data.labels = months.map(month => CLIMATE_MONTHS[month - 1]);
  climateChart.data.datasets = rows.map(row => {
    const color = colourFor.get(row.key);
    return {
      type: climateDisplayTypes.get(row.key) || (row.unit === 'mm' ? 'bar' : 'line'),
      label: `${row.title}${row.unit ? ` [${row.unit}]` : ''}`, title: row.title,
      unit: row.unit, yAxisID: axisFor.get(row.unit || 'Originalwert'),
      data: months.map(month => row.values[month - 1]),
      borderColor: color, backgroundColor: color,
      pointBackgroundColor: color, pointRadius: 3, pointHoverRadius: 5,
      borderWidth: 2, tension: 0.25, spanGaps: false, barPercentage: 0.7
    };
  });
  const textColor = themeColor('--color-base-content');
  const gridColor = themeColor('--color-base-300');
  const scales = {x: {ticks: {color: textColor}, grid: {display: false}}};
  units.forEach((unit, index) => {
    scales[`y${index}`] = {
      type: 'linear', position: index === 0 ? 'left' : 'right', offset: index > 1,
      beginAtZero: unit === 'mm',
      title: {display: true, text: unit, color: textColor},
      ticks: {color: textColor}, grid: {color: gridColor, drawOnChartArea: index === 0}
    };
  });
  climateChart.options.scales = scales;
  climateChart.options.plugins.legend.labels.color = textColor;
  climateChart.options.plugins.title = {
    display: rows.length > 0,
    text: `${$('climatePoint').textContent} · ${$('climateYear').value}`,
    color: textColor, font: {size: 16, weight: 'bold'}, padding: {bottom: 5}
  };
  climateChart.options.plugins.subtitle = {
    display: annual.length > 0,
    text: annual.map(item => `${item.kind} ${item.title}: ${item.value === null ? '–' : Number(item.value).toLocaleString('de-DE', {maximumFractionDigits: 1})} ${item.unit}`),
    color: textColor, font: {size: 11}, padding: {bottom: 12}
  };
  climateChart.update();

  const hasValues = rows.some(row => months.some(month => row.values[month - 1] !== null));
  $('copyClimateChart').disabled = !hasValues;
  $('climateEmpty').hidden = hasValues;
  if (!state.selectedPoint) climateStatus('Wähle einen Ort auf der Karte oder über die Ortssuche.');
  else if (!climateRowsVisible.length) climateStatus('Lade Monatsraster, um Parameter in die Tabelle aufzunehmen.');
  else if (!rows.length) climateStatus('Wähle mindestens einen Parameter in der Tabelle.');
  else if (!months.length) climateStatus('Wähle Monate in der Tabellenüberschrift oder aktiviere „Alle Monate anzeigen“.');
  else climateStatus(`${rows.length} Parameter · ${months.length} Monate · ${$('climateYear').value}`);
  $('climateEmpty').textContent = !state.selectedPoint
    ? 'Wähle zuerst einen Ort auf der Karte.'
    : !climateRowsVisible.length ? 'Lade Monatsdaten für das Klimadiagramm.'
    : !rows.length ? 'Wähle einen Parameter in der Tabelle.'
    : !months.length ? 'Wähle mindestens einen Monat.'
    : 'Für diese Auswahl liegen an diesem Ort keine Werte vor.';
}

async function loadClimateProductYears() {
  const requestId = ++climateSourceRequest;
  const select = $('climateSourceYear');
  select.replaceChildren();
  climateOption(select, '', 'Jahre werden geladen …');
  select.disabled = true;
  $('climateAdd').disabled = true;
  try {
    let years;
    if ($('climateDataSource').value === 'global') {
      const lastYear = new Date().getFullYear() - 1;
      years = Array.from({length: lastYear - 1949}, (_, index) => String(lastYear - index));
    } else {
      const {files} = await monthlyProductFiles($('climateProduct').value, catalogList);
      years = [...new Set(files.map(entry => monthlyFileParts(entry.name)?.year).filter(Boolean))]
        .sort().reverse();
    }
    if (requestId !== climateSourceRequest) return;
    select.replaceChildren();
    years.forEach(year => climateOption(select, year, year));
    select.disabled = !years.length;
    $('climateAdd').disabled = !years.length;
    const chartYear = $('climateYear').value;
    const completeYear = String(new Date().getFullYear() - 1);
    if (years.includes(chartYear)) select.value = chartYear;
    else if (years.includes(completeYear)) select.value = completeYear;
    if (!years.length) climateStatus('Für diesen Parameter wurden keine lesbaren Monatsraster gefunden.', true);
  } catch (error) {
    if (requestId === climateSourceRequest) {
      select.replaceChildren();
      climateOption(select, '', 'Keine Jahre verfügbar');
      climateStatus(`DWD-Parameter konnten nicht geladen werden: ${error.message}`, true);
    }
  }
}

async function initClimateProducts() {
  try {
    const entries = (await catalogList(`${CATALOG_ROOT}monthly/`))
      .filter(entry => entry.kind === 'directory');
    const select = $('climateProduct');
    select.replaceChildren();
    climateOption(select, '', 'Lesbare Monatsraster werden geprüft …');
    select.disabled = true;
    const checked = await readableMonthlyProducts(entries, catalogList,
      (done, total) => climateStatus(`DWD-Parameter werden geprüft … ${done}/${total}`));
    select.replaceChildren();
    checked.products.forEach(entry => climateOption(select, entry.url, catalogLabel(entry.name, 'product')));
    select.disabled = !checked.products.length;
    const preferred = checked.products.find(entry => entry.name === 'air_temperature_max');
    if (preferred) select.value = preferred.url;
    if (checked.products.length) await loadClimateProductYears();
    else climateStatus('Im DWD-Verzeichnis wurden keine lesbaren Monatsraster gefunden.', true);
    if (checked.errors.length) climateStatus(`${checked.errors.length} DWD-Parameter konnten nicht geprüft werden. Seite neu laden, um es erneut zu versuchen.`, true);
  } catch (error) {climateStatus(`DWD-Katalog nicht erreichbar: ${error.message}`, true)}
}

async function changeClimateDataSource() {
  const select = $('climateProduct');
  select.replaceChildren();
  if ($('climateDataSource').value === 'global') {
    $('climateMapMonthControl').hidden = false;
    $('climateAdd').textContent = 'Diagramm und Farbfläche laden';
    $('climateProductLabel').textContent = 'Globalen Parameter laden';
    GLOBAL_CLIMATE_PRODUCTS.forEach(([value, label]) => climateOption(select, value, label));
    select.disabled = false;
    await loadClimateProductYears();
    climateStatus(state.selectedPoint
      ? 'Wähle Parameter und Jahr für den markierten Ort.'
      : 'Wähle weltweit einen Ort auf der Karte oder über die Ortssuche.');
  } else {
    $('climateMapMonthControl').hidden = true;
    $('climateAdd').textContent = 'Monatsdaten laden';
    $('climateProductLabel').textContent = 'DWD-Parameter laden';
    if (!dwdProductsLoaded) {
      await initClimateProducts();
      dwdProductsLoaded = true;
    } else await initClimateProducts();
  }
}

function visibleGlobalBounds() {
  const bounds = map.getBounds(), center = state.selectedPoint.lng;
  const span = Math.min(120, Math.max(0.5, bounds.getEast() - bounds.getWest()));
  let west = Math.max(-180, center - span / 2), east = Math.min(180, center + span / 2);
  if (east - west < span) {
    if (west === -180) east = Math.min(180, west + span);
    else west = Math.max(-180, east - span);
  }
  return {
    west, east,
    south: Math.max(-85, bounds.getSouth()),
    north: Math.min(85, bounds.getNorth())
  };
}

async function addGlobalColourLayer(year, parameter) {
  climateStatus('ERA5-Farbfläche für den sichtbaren Kartenausschnitt wird berechnet …');
  const data = await api('/api/global-grid', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      ...visibleGlobalBounds(), year, parameter, month: Number($('climateMapMonth').value)
    })
  });
  if (data.raster.palette) $('palette').value = data.raster.palette;
  addRaster(data.raster, true, true);
  updateLegend();
  return data.raster;
}

async function addGlobalClimateProduct(year) {
  if (!state.selectedPoint) throw new Error('Wähle zuerst einen Ort auf der Karte.');
  const parameter = $('climateProduct').value;
  const query = new URLSearchParams({
    lat: state.selectedPoint.lat, lon: state.selectedPoint.lng, year, parameter
  });
  climateStatus('Weltweite ERA5-Daten werden geladen …');
  const data = await api(`/api/global-climate?${query}`);
  globalClimateValues = globalClimateValues.filter(value =>
    !(value.productKey === `global:${parameter}` && value.timestamp.startsWith(`${year}-`)));
  globalClimateValues.push(...data.values);
  climateSelectedParameters.add(`${data.values[0].productKey}::${data.values[0].unit}`);
  climateRequestedYear = year;
  renderClimatePanel();
  const raster = await addGlobalColourLayer(year, parameter);
  climateStatus(`${data.values[0].title} für ${year} geladen · Farbfläche: ${raster.periodLabel} im sichtbaren Kartenausschnitt.`);
}

async function addClimateProduct() {
  const button = $('climateAdd'), year = $('climateSourceYear').value;
  if (!year) return;
  button.disabled = true;
  try {
    if ($('climateDataSource').value === 'global') {
      await addGlobalClimateProduct(year);
      return;
    }
    const urls = await monthlySeriesUrls($('climateProduct').value, year,
      (done, total) => climateStatus(`Monatsraster werden gesucht … ${done}/${total}`));
    if (!urls.length) throw new Error(`Für ${year} wurden keine Monatsraster gefunden.`);
    climateStatus(`${urls.length} Monatsraster werden geladen …`);
    const result = await importUrls(urls, true, true);
    const shown = showMonthlySeries(urls);
    if (shown) {
      climateSelectedParameters.add(pointGroup(shown));
      climateYearChanged = false;
      if (state.selectedPoint) await refreshPointValues();
      renderClimatePanel();
    }
    if (result.errors.length) climateStatus(`${result.rasters.length} Raster geladen; ${result.errors.length} Fehler.`, true);
    else climateStatus(`${urls.length} Monatsraster für ${year} bereit. Wähle Parameter und Monate in der Tabelle.`);
  } catch (error) {climateStatus(error.message, true)}
  finally {button.disabled = false}
}

$('climateYear').onchange = () => {
  climateYearChanged = true;
  if ([...$('climateSourceYear').options].some(option => option.value === $('climateYear').value))
    $('climateSourceYear').value = $('climateYear').value;
  renderClimatePanel();
};
$('climateProduct').onchange = loadClimateProductYears;
$('climateDataSource').onchange = changeClimateDataSource;
$('climateAdd').onclick = addClimateProduct;
$('copyClimateChart').onclick = async () => {
  try { await copyChartImage($('climateChart'), $('copyClimateChart')); }
  catch (error) { climateStatus(error.message, true); }
};
$('climateAllMonths').onchange = event => {
  climateMonthsSelected.clear();
  if (event.target.checked) for (let month = 1; month <= 12; month++) climateMonthsSelected.add(month);
  renderClimatePanel();
};
$('climateSelectAll').onclick = () => {
  climateSelectionChanged = true;
  climateRowsVisible.forEach(row => climateSelectedParameters.add(row.key));
  syncClimateParameterSelection();
};
$('climateSelectNone').onclick = () => {
  climateSelectionChanged = true;
  climateSelectedParameters.clear();
  syncClimateParameterSelection();
};
document.addEventListener('point-values-change', renderClimatePanel);
document.addEventListener('app-theme-change', () => {
  renderClimateParameterChoices(climateRowsVisible);
  syncClimateParameterSelection();
});
renderClimatePanel();
changeClimateDataSource();
