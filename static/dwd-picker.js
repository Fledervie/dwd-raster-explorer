const CATALOG_ROOT = 'https://opendata.dwd.de/climate_environment/CDC/grids_germany/';
const CATALOG_PERIODS = {
  monthly: 'Monat', annual: 'Jahr', seasonal: 'Jahreszeit',
  multi_annual: 'Vieljähriges Mittel', daily: 'Tag', hourly: 'Stunde',
  halfyear: 'Halbjahr', '5_minutes': '5 Minuten', return_periods: 'Wiederkehrzeit'
};
const CATALOG_PRODUCTS = {
  air_temperature_max: 'Durchschnittliche Tageshöchsttemperatur',
  air_temperature_mean: 'Durchschnittliche Lufttemperatur',
  air_temperature_min: 'Durchschnittliche Tagestiefsttemperatur',
  precipitation: 'Niederschlag', sunshine_duration: 'Sonnenscheindauer',
  drought_index: 'Trockenheitsindex', frost_days: 'Frosttage',
  hot_days: 'Heiße Tage', ice_days: 'Eistage', summer_days: 'Sommertage',
  snowcover_days: 'Schneedeckentage', radiation_global: 'Globalstrahlung',
  radiation_direct: 'Direktstrahlung', radiation_diffuse: 'Diffuse Strahlung',
  soil_moist: 'Bodenfeuchte', soil_temperature_5cm: 'Bodentemperatur in 5 cm',
  vegetation_begin: 'Vegetationsbeginn', vegetation_end: 'Vegetationsende',
  evapo_p: 'Potenzielle Verdunstung', evapo_r: 'Reale Verdunstung'
};
const CATALOG_MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
let catalogGeneration = 0;
let seriesFolders = [];
let currentCatalogFiles = [];

function catalogLabel(name, kind) {
  if (kind === 'period') return CATALOG_PERIODS[name] || name.replaceAll('_', ' ');
  if (kind === 'product') return CATALOG_PRODUCTS[name] || name.replaceAll('_', ' ');
  const month = /^([0-1]\d)_/.exec(name);
  return month && +month[1] >= 1 && +month[1] <= 12
    ? CATALOG_MONTHS[+month[1] - 1] : name.replaceAll('_', ' ');
}

function catalogOptions(select, entries, label, preferredUrl) {
  select.replaceChildren();
  for (const entry of entries) {
    const option = document.createElement('option');
    option.value = entry.url;
    option.textContent = label(entry);
    select.append(option);
  }
  select.disabled = entries.length === 0;
  if (preferredUrl && entries.some(entry => entry.url === preferredUrl)) select.value = preferredUrl;
}

function catalogMessage(message, error = false) {
  const element = $('catalogMessage');
  element.textContent = message;
  element.classList.toggle('error', error);
}

async function catalogList(url) {
  const data = await api('/api/dwd/list', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({url})
  });
  return data.entries;
}

function clearCatalogBelow(level) {
  if (level === 'period') $('catalogProduct').replaceChildren();
  if (level === 'period' || level === 'product') $('catalogFolders').replaceChildren();
  $('catalogFile').replaceChildren();
  $('catalogFile').disabled = true;
  $('catalogLoad').disabled = true;
  seriesFolders = [];
  currentCatalogFiles = [];
  $('seriesControls').hidden = true;
}

function catalogFailed(error) {
  catalogMessage(`DWD-Katalog nicht erreichbar: ${error.message}`, true);
}

async function choosePeriod() {
  const generation = ++catalogGeneration;
  clearCatalogBelow('period');
  $('catalogProduct').disabled = true;
  catalogMessage('Parameter werden geladen …');
  try {
    const directories = (await catalogList($('catalogPeriod').value))
      .filter(entry => entry.kind === 'directory');
    if (generation !== catalogGeneration) return;
    catalogOptions($('catalogProduct'), directories,
      entry => catalogLabel(entry.name, 'product'),
      directories.find(entry => entry.name === 'air_temperature_max')?.url);
    if (directories.length) await chooseProduct();
    else catalogMessage('Für diese Zeitauflösung wurden keine Parameter gefunden.');
  } catch (error) { if (generation === catalogGeneration) catalogFailed(error); }
}

async function chooseProduct() {
  const generation = ++catalogGeneration;
  clearCatalogBelow('product');
  catalogMessage('Verfügbare Datensätze werden geladen …');
  await catalogBranch($('catalogProduct').value, 0, generation);
}

async function catalogBranch(url, depth, generation) {
  try {
    const entries = await catalogList(url);
    if (generation !== catalogGeneration) return;
    for (const label of [...$('catalogFolders').children]) {
      if (+label.dataset.depth >= depth) label.remove();
    }
    const directories = entries.filter(entry => entry.kind === 'directory');
    const files = entries.filter(entry => entry.kind === 'file');
    if (depth === 0) {
      seriesFolders = $('catalogPeriod').value.endsWith('/monthly/')
        && directories.every(entry => /^(0[1-9]|1[0-2])_/.test(entry.name))
        ? directories : [];
    }
    if (directories.length) {
      const label = document.createElement('label');
      label.dataset.depth = depth;
      label.textContent = directories.every(entry => /^\d{2}_/.test(entry.name))
        ? 'Monat' : 'Unterordner';
      const select = document.createElement('select');
      const choices = files.length
        ? [{name: 'Dateien in diesem Ordner', url, kind: 'directory'}, ...directories]
        : directories;
      catalogOptions(select, choices, entry => catalogLabel(entry.name, 'folder'));
      label.append(select);
      $('catalogFolders').append(label);
      select.onchange = () => {
        const nextGeneration = ++catalogGeneration;
        for (const child of [...$('catalogFolders').children]) {
          if (+child.dataset.depth > depth) child.remove();
        }
        $('catalogFile').replaceChildren();
        $('catalogFile').disabled = true;
        $('catalogLoad').disabled = true;
        catalogMessage('Verfügbare Datensätze werden geladen …');
        if (select.value === url) showCatalogFiles(files);
        else catalogBranch(select.value, depth + 1, nextGeneration);
      };
      if (select.value === url) showCatalogFiles(files);
      else await catalogBranch(select.value, depth + 1, generation);
    } else showCatalogFiles(files);
  } catch (error) { if (generation === catalogGeneration) catalogFailed(error); }
}

function showCatalogFiles(files) {
  const ordered = [...files].sort((a, b) => b.name.localeCompare(a.name));
  currentCatalogFiles = ordered;
  catalogOptions($('catalogFile'), ordered, entry => entry.label || entry.name);
  $('catalogLoad').disabled = ordered.length === 0;
  updateSeriesControls();
  catalogMessage(ordered.length
    ? `${ordered.length} Datensätze verfügbar. Jahr wählen und Raster laden.`
    : 'In diesem Ordner wurden keine .asc- oder .asc.gz-Raster gefunden.');
}

function updateSeriesControls() {
  const selected = currentCatalogFiles.find(file => file.url === $('catalogFile').value);
  const parts = selected && monthlyFileParts(selected.name);
  const available = seriesFolders.length >= 2 && parts;
  $('seriesControls').hidden = !available;
  if (!available) return;
  const years = [...new Set(currentCatalogFiles
    .filter(file => monthlyFileParts(file.name)?.prefix === parts.prefix)
    .map(file => monthlyFileParts(file.name).year))].sort().reverse();
  const previous = $('seriesYear').value;
  catalogOptions($('seriesYear'), years.map(year => ({url: year, name: year})),
    entry => entry.name, years.includes(previous) ? previous : parts.year);
  $('seriesLoad').disabled = years.length === 0;
}

async function loadMonthlySeries() {
  const selected = currentCatalogFiles.find(file => file.url === $('catalogFile').value);
  const parts = selected && monthlyFileParts(selected.name);
  if (!parts || !seriesFolders.length) return;
  const year = $('seriesYear').value;
  const button = $('seriesLoad');
  button.disabled = true;
  try {
    const urls = await monthlySeriesUrls($('catalogProduct').value, year,
      (done, total) => catalogMessage(`Monatsdateien für ${year} werden gesucht … ${done}/${total}`),
      parts.prefix, seriesFolders);
    if (!urls.length) {
      catalogMessage(`Für ${year} wurden keine Monatsraster gefunden.`, true);
      return;
    }
    catalogMessage(`${urls.length} Monatsraster werden geladen …`);
    const data = await importUrls(urls, true, true);
    showMonthlySeries(urls);
    if (state.selectedPoint) $('chartTitle').scrollIntoView({behavior: 'smooth', block: 'nearest'});
    if (data?.errors?.length) catalogMessage(`${data.rasters.length} Monate geladen; ${data.errors.length} konnten nicht geladen werden.`, true);
    else catalogMessage(`${urls.length} Monate für ${year} verfügbar und geladen. Wähle einen Ort für das Diagramm.`);
  } catch (error) { catalogMessage(error.message, true); }
  finally { button.disabled = false; }
}

async function monthlySeriesUrls(productUrl, year, onProgress = () => {}, prefix = '', knownFolders = null) {
  const entries = await catalogList(productUrl);
  const direct = monthlyFiles(entries).filter(entry => {
    const parts = monthlyFileParts(entry.name);
    return parts.year === year && (!prefix || parts.prefix === prefix);
  }).sort((a, b) => monthlyFileParts(a.name).month.localeCompare(monthlyFileParts(b.name).month));
  if (direct.length) return direct.map(entry => entry.url);
  const folders = knownFolders || monthFolders(entries);
  const urls = [];
  for (const [index, folder] of folders.entries()) {
    onProgress(index + 1, folders.length);
    const month = folder.name.slice(0, 2);
    const entries = await catalogList(folder.url);
    const match = entries.find(entry => {
      const parts = entry.kind === 'file' && monthlyFileParts(entry.name);
      return parts && parts.year === year && parts.month === month
        && (!prefix || parts.prefix === prefix);
    });
    if (match) urls.push(match.url);
  }
  return urls;
}

function showMonthlySeries(urls) {
  const seriesRasters = urls.map(url => [...state.rasters.values()]
    .find(raster => raster.sourceUrl === url)).filter(Boolean);
  const shown = seriesRasters.at(-1);
  if (!shown) return null;
  for (const raster of seriesRasters) {
    const overlay = state.overlays.get(raster.id);
    if (raster.id !== shown.id && overlay && map.hasLayer(overlay)) map.removeLayer(overlay);
  }
  const overlay = state.overlays.get(shown.id);
  if (overlay && !map.hasLayer(overlay)) overlay.addTo(map);
  state.activeId = shown.id;
  state.chartGroup = pointGroup(shown);
  renderLayers();
  updateLegend();
  renderPointValues();
  return shown;
}

async function initCatalog() {
  try {
    const directories = (await catalogList(CATALOG_ROOT))
      .filter(entry => entry.kind === 'directory');
    catalogOptions($('catalogPeriod'), directories,
      entry => catalogLabel(entry.name, 'period'),
      directories.find(entry => entry.name === 'monthly')?.url);
    if (directories.length) await choosePeriod();
    else catalogMessage('Der DWD-Katalog enthält derzeit keine Zeitauflösungen.');
  } catch (error) { catalogFailed(error); }
}

$('catalogPeriod').onchange = choosePeriod;
$('catalogProduct').onchange = chooseProduct;
$('catalogFile').onchange = updateSeriesControls;
$('seriesLoad').onclick = loadMonthlySeries;
$('catalogLoad').onclick = () => {
  if ($('catalogFile').value) importUrls([$('catalogFile').value], true);
};
initCatalog();
