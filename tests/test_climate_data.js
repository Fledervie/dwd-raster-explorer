const test = require('node:test');
const assert = require('node:assert/strict');
const {climateYears, climateRows, climateSelection, climateAnnualSummaries, monthlyProductFiles,
  readableMonthlyProducts} = require('../static/climate-data.js');

test('offers only products with monthly ASC grids, including flat directories', async () => {
  const root = 'https://example.test/monthly/';
  const products = ['radiation_direct', 'evapo_p', 'air_temperature_max'].map(name =>
    ({name, url: `${root}${name}/`}));
  const listings = {
    [`${root}radiation_direct/`]: [],
    [`${root}evapo_p/`]: [{kind: 'file', name: 'grids_germany_monthly_evapo_p_199101.asc.gz', url: 'flat'}],
    [`${root}air_temperature_max/`]: [{kind: 'directory', name: '01_Jan', url: 'jan'}],
    jan: [{kind: 'file', name: 'grids_germany_monthly_air_temperature_max_190101.asc.gz', url: 'nested'}]
  };
  const list = async url => listings[url];
  const result = await readableMonthlyProducts(products, list);
  assert.deepEqual(result.products.map(product => product.name), ['evapo_p', 'air_temperature_max']);
  assert.deepEqual(result.errors, []);
  assert.equal((await monthlyProductFiles(`${root}evapo_p/`, list)).direct, true);
});

test('groups monthly temperature and precipitation by year and leaves missing months empty', () => {
  const values = [
    {id:'a',productKey:'monthly:air_temp_max',title:'Tageshöchsttemperatur',unit:'°C',timestamp:'1901-01',value:-0.6},
    {id:'b',productKey:'monthly:air_temp_max',title:'Tageshöchsttemperatur',unit:'°C',timestamp:'1901-02',value:0},
    {id:'c',productKey:'monthly:precipitation',title:'Niederschlag',unit:'mm',timestamp:'1901-01',value:48},
    {id:'d',productKey:'annual:air_temp_max',title:'Jahreswert',unit:'°C',timestamp:'1901',value:13.2},
    {id:'e',productKey:'monthly:air_temp_max',title:'Tageshöchsttemperatur',unit:'°C',timestamp:'1902-01',value:2}
  ];
  assert.deepEqual(climateYears(values), ['1902', '1901']);
  const rows = climateRows(values, '1901');
  assert.deepEqual(rows.map(row => row.unit), ['mm', '°C']);
  assert.equal(rows[0].values[0], 48);
  assert.deepEqual(rows[1].values.slice(0, 3), [-0.6, 0, null]);
  assert.deepEqual(rows[1].loaded.slice(0, 3), [true, true, false]);
  assert.equal(rows.length, 2);
});

test('keeps a valid value when a duplicate monthly raster has no data', () => {
  const item = {productKey:'monthly:precipitation',title:'Niederschlag',unit:'mm',timestamp:'2020-06'};
  const rows = climateRows([{...item,id:'a',value:20},{...item,id:'b',value:null}], '2020');
  assert.equal(rows[0].values[5], 20);
});

test('selects temperature and precipitation together for chosen months and separate units', () => {
  const values = [
    {id:'t1',productKey:'monthly:air_temp_max',title:'Tageshöchsttemperatur',unit:'°C',timestamp:'1901-01',value:-0.6},
    {id:'t2',productKey:'monthly:air_temp_max',title:'Tageshöchsttemperatur',unit:'°C',timestamp:'1901-02',value:0},
    {id:'p1',productKey:'monthly:precipitation',title:'Niederschlag',unit:'mm',timestamp:'1901-01',value:31},
    {id:'p2',productKey:'monthly:precipitation',title:'Niederschlag',unit:'mm',timestamp:'1901-02',value:22}
  ];
  const rows = climateRows(values, '1901');
  const both = climateSelection(rows, new Set(rows.map(row => row.key)), new Set([2, 1]));
  assert.equal(both.rows.length, 2);
  assert.deepEqual(both.units, ['mm', '°C']);
  assert.deepEqual(both.months, [1, 2]);
  assert.deepEqual(both.rows.map(row => both.months.map(month => row.values[month - 1])),
    [[31, 22], [-0.6, 0]]);
  const onlyRain = climateSelection(rows, new Set([rows[0].key]), new Set([2]));
  assert.deepEqual(onlyRain.rows.map(row => row.title), ['Niederschlag']);
  assert.deepEqual(onlyRain.months, [2]);
});

test('calculates annual means for temperature and annual sums for precipitation', () => {
  const rows = [
    {key:'rain',title:'Niederschlag',unit:'mm',values:Array(12).fill(10)},
    {key:'temp',title:'Temperatur',unit:'°C',values:Array.from({length:12}, (_, index) => index)}
  ];
  const summaries = climateAnnualSummaries(rows, new Set(['rain', 'temp']));
  assert.deepEqual(summaries.map(item => [item.kind, item.value]), [
    ['Jahressumme', 120], ['Jahresmittel', 5.5]
  ]);
});
