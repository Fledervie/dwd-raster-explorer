const CLIMATE_MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function monthlyFileParts(name) {
  const match = /^(.*_)((?:18|19|20)\d{2})(0[1-9]|1[0-2])\.asc(?:\.gz)?$/i.exec(name);
  return match ? {prefix: match[1], year: match[2], month: match[3]} : null;
}

function monthlyFiles(entries) {
  return entries.filter(entry => entry.kind === 'file' && monthlyFileParts(entry.name));
}

function monthFolders(entries) {
  return entries.filter(entry => entry.kind === 'directory' && /^(0[1-9]|1[0-2])_/.test(entry.name));
}

async function monthlyProductFiles(productUrl, listEntries) {
  const entries = await listEntries(productUrl);
  const directFiles = monthlyFiles(entries);
  if (directFiles.length) return {files: directFiles, direct: true};
  for (const folder of monthFolders(entries)) {
    const files = monthlyFiles(await listEntries(folder.url))
      .filter(entry => monthlyFileParts(entry.name).month === folder.name.slice(0, 2));
    if (files.length) return {files, direct: false};
  }
  return {files: [], direct: false};
}

async function readableMonthlyProducts(products, listEntries, onProgress = () => {}) {
  const supported = [], errors = [];
  for (let index = 0; index < products.length; index += 4) {
    const batch = products.slice(index, index + 4);
    const results = await Promise.allSettled(batch.map(async product =>
      ({product, listing: await monthlyProductFiles(product.url, listEntries)})));
    results.forEach((result, offset) => {
      if (result.status === 'rejected') errors.push(batch[offset].name);
      else if (result.value.listing.files.length) supported.push(result.value.product);
    });
    onProgress(Math.min(index + 4, products.length), products.length);
  }
  return {products: supported, errors};
}

function climateYears(values) {
  return [...new Set(values.map(value => /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value.timestamp || '')?.[1])
    .filter(Boolean))].sort().reverse();
}

function climateRows(values, year) {
  const rows = new Map();
  for (const item of values) {
    const date = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(item.timestamp || '');
    if (!date || date[1] !== year) continue;
    const key = `${item.productKey || item.id}::${item.unit || ''}`;
    if (!rows.has(key)) rows.set(key, {
      key, title: item.title || item.name, unit: item.unit || '',
      values: Array(12).fill(null), loaded: Array(12).fill(false)
    });
    const row = rows.get(key), month = Number(date[2]) - 1;
    if (!row.loaded[month] || item.value !== null) row.values[month] = item.value;
    row.loaded[month] = true;
  }
  const unitRank = unit => unit === 'mm' ? 0 : unit === '°C' ? 1 : 2;
  return [...rows.values()].sort((a, b) =>
    unitRank(a.unit) - unitRank(b.unit) || a.title.localeCompare(b.title, 'de'));
}

function climateSelection(rows, selectedKeys, selectedMonths) {
  const chosen = rows.filter(row => selectedKeys.has(row.key));
  const months = [...selectedMonths].sort((a, b) => a - b);
  const unitRank = unit => unit === 'mm' ? 0 : unit === '°C' ? 1 : 2;
  const units = [...new Set(chosen.map(row => row.unit || 'Originalwert'))]
    .sort((a, b) => unitRank(a) - unitRank(b) || a.localeCompare(b, 'de'));
  return {rows: chosen, months, units};
}

function climateAnnualSummaries(rows, selectedKeys) {
  return rows.filter(row => selectedKeys.has(row.key)).map(row => {
    const values = row.values.filter(value => value !== null && Number.isFinite(value));
    const mean = row.unit === '°C' || row.unit === 'km/h';
    const value = values.length
      ? (mean ? values.reduce((sum, item) => sum + item, 0) / values.length
        : values.reduce((sum, item) => sum + item, 0))
      : null;
    const kind = values.length === 12
      ? (mean ? 'Jahresmittel' : 'Jahressumme')
      : `${mean ? 'Mittel' : 'Summe'} (${values.length} Monate)`;
    return {...row, value, kind};
  });
}

if (typeof module !== 'undefined') module.exports = {
  CLIMATE_MONTHS, climateYears, climateRows, climateSelection,
  climateAnnualSummaries, monthlyFileParts, monthlyProductFiles, readableMonthlyProducts
};
