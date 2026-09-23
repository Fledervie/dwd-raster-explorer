const state={rasters:new Map(),overlays:new Map(),selectedUrls:new Set(),activeId:null,chartGroup:null,marker:null,selectedPoint:null,pointValues:[]};
const $=id=>document.getElementById(id);
const map=L.map('map',{zoomControl:true}).setView([51.1,10.4],6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap-Mitwirkende'}).addTo(map);
const placeControl=L.control({position:'topleft'});
placeControl.onAdd=()=>{const form=$('placeSearch');L.DomEvent.disableClickPropagation(form);L.DomEvent.disableScrollPropagation(form);return form};
placeControl.addTo(map);
map.attributionControl.addAttribution('Ortssuche: <a href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noopener noreferrer">Open-Meteo / GeoNames</a>');
map.attributionControl.addAttribution('Globale Klimadaten: <a href="https://open-meteo.com/en/docs/historical-weather-api" target="_blank" rel="noopener noreferrer">Open-Meteo / ERA5-Land</a>');
const chart=new Chart($('chart'),{type:'line',data:{labels:[],datasets:[{label:'Rasterwert',data:[],borderColor:'',backgroundColor:'',pointBackgroundColor:'',pointBorderColor:'',pointRadius:5,pointHoverRadius:7,borderWidth:2,tension:.25,spanGaps:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:10}},y:{beginAtZero:false}}}});
function themeColor(name){return getComputedStyle(document.documentElement).getPropertyValue(name).trim()}
function applyTheme(){const dark=document.documentElement.getAttribute('data-theme')==='lilli-dark';$('themeToggle').setAttribute('aria-label',dark?'Helles Farbschema aktivieren':'Dunkles Farbschema aktivieren');$('themeToggle').setAttribute('aria-pressed',String(!dark));chart.data.datasets[0].borderColor=themeColor('--color-primary');chart.data.datasets[0].backgroundColor=themeColor('--color-primary');chart.data.datasets[0].pointBackgroundColor=themeColor('--color-accent');chart.data.datasets[0].pointBorderColor=themeColor('--color-base-100');for(const axis of Object.values(chart.options.scales)){axis.ticks.color=themeColor('--color-base-content');axis.grid={color:themeColor('--color-base-300')}}if(state.marker)state.marker.setStyle({color:themeColor('--color-base-content'),fillColor:themeColor('--color-accent')});chart.update();document.dispatchEvent(new Event('app-theme-change'))}
$('themeToggle').onclick=()=>{const next=document.documentElement.getAttribute('data-theme')==='lilli-dark'?'lilli-light':'lilli-dark';document.documentElement.setAttribute('data-theme',next);try{localStorage.setItem('theme',next)}catch(_){}applyTheme()};applyTheme();

function status(message,isError=false){$('status').textContent=message;$('status').classList.toggle('error',isError)}
async function api(url,options={}){const response=await fetch(url,options);let data;try{data=await response.json()}catch{throw new Error(`Serverfehler (${response.status})`)}if(!response.ok||data.error)throw new Error(data.error||`Fehler ${response.status}`);return data}
function styleQuery(){const p=new URLSearchParams({palette:$('palette').value});if($('scaleMin').value)p.set('min',$('scaleMin').value);if($('scaleMax').value)p.set('max',$('scaleMax').value);return p.toString()}
function imageUrl(id){return `/api/raster/${id}/image.png?${styleQuery()}&v=${Date.now()}`}
function pointGroup(item){return `${item.productKey||item.id}::${item.unit||''}`}
function addRaster(r,deferView=false,visible=true){state.rasters.set(r.id,r);state.activeId=r.id;state.chartGroup=pointGroup(r);const overlay=L.imageOverlay(imageUrl(r.id),r.bounds,{opacity:+$('opacity').value,interactive:false});if(visible)overlay.addTo(map);state.overlays.set(r.id,overlay);renderLayers();updateLegend();if(!deferView){if(state.selectedPoint)refreshPointValues();else map.fitBounds(r.bounds,{padding:[20,20]})}}
function displayName(r){return r.title&&r.periodLabel?`${r.title} · ${r.periodLabel}`:r.title||r.name}
function renderLayers(){$('emptyLayers').hidden=state.rasters.size>0;$('mapEmpty').hidden=state.rasters.size>0;$('layerCount').textContent=`${state.rasters.size} ${state.rasters.size===1?'Ebene':'Ebenen'}`;$('layers').innerHTML='';for(const r of [...state.rasters.values()].reverse()){const div=document.createElement('div');div.className='layer';div.innerHTML=`<div class="layer-row"><input type="checkbox" aria-label="${escapeHtml(displayName(r))} sichtbar"><button type="button" class="layer-name">${escapeHtml(displayName(r))}</button><button type="button" class="remove" aria-label="${escapeHtml(displayName(r))} entfernen" title="Entfernen">×</button></div><div class="layer-meta">${escapeHtml(r.description||'Rasterwerte')} · ${escapeHtml(r.unit||'Originaleinheit')}<br>${r.ncols} × ${r.nrows} Zellen · ${escapeHtml(r.crs)}</div>`;const checkbox=div.querySelector('input');checkbox.checked=map.hasLayer(state.overlays.get(r.id));checkbox.onchange=e=>{const o=state.overlays.get(r.id);e.target.checked?o.addTo(map):map.removeLayer(o)};div.querySelector('.layer-name').onclick=()=>{state.activeId=r.id;state.chartGroup=pointGroup(r);updateLegend();renderLayers();renderPointValues()};div.querySelector('.remove').onclick=()=>removeRaster(r.id);if(r.id===state.activeId)div.classList.add('active');$('layers').append(div)}}
async function removeRaster(id){const overlay=state.overlays.get(id);if(overlay)map.removeLayer(overlay);state.overlays.delete(id);state.rasters.delete(id);state.pointValues=state.pointValues.filter(v=>v.id!==id);await api(`/api/raster/${id}`,{method:'DELETE'});if(state.activeId===id)state.activeId=state.rasters.keys().next().value||null;renderLayers();updateLegend();if(state.selectedPoint)refreshPointValues();else renderPointValues()}
function updateLegend(){const r=state.rasters.get(state.activeId);$('legendTitle').textContent=r?displayName(r):'Keine Ebene';$('legendMin').textContent=r?(format($('scaleMin').value||r.min)+(r.unit?` ${r.unit}`:'')):'–';$('legendMax').textContent=r?(format($('scaleMax').value||r.max)+(r.unit?` ${r.unit}`:'')):'–';$('activeTitle').textContent=r?r.title||r.name:'Raster auf der Karte';$('activeDescription').textContent=r?r.description||'Originalwerte des Rasters':'Eine Ebene auswählen, um Details zu sehen.';$('activePeriod').textContent=r?r.periodLabel||'Zeitraum unbekannt':'–';const link=$('descriptionLink');link.hidden=!r?.descriptionUrl;if(r?.descriptionUrl){link.href=r.descriptionUrl;link.textContent=r.descriptionUrl.endsWith('.pdf')?'DWD-Beschreibung ↗':'DWD-Produktseite ↗'}const ramps={climate:'linear-gradient(90deg,#183487,#2389da,#3fbe8c,#f8da59,#d23737)',precip:'linear-gradient(90deg,#f7fcfd,#66c2a4,#2c7fb8,#253494)',terrain:'linear-gradient(90deg,#30784a,#d1c47d,#875737,#f5f5f0)',gray:'linear-gradient(90deg,#141414,#f5f5f5)'};$('legendRamp').style.background=ramps[$('palette').value]}
function escapeHtml(s){const d=document.createElement('div');d.textContent=String(s);return d.innerHTML}

async function uploadFiles(files){if(!files.length)return;status(`${files.length} Datei(en) werden verarbeitet …`);const form=new FormData();[...files].forEach(f=>form.append('files',f));form.append('epsg',$('epsg').value);form.append('unit',$('unit').value);try{const data=await api('/api/upload',{method:'POST',body:form});data.rasters.forEach(addRaster);showErrors(data.errors);status(`${data.rasters.length} Raster geladen`)}catch(e){status(e.message,true)}}
function showErrors(errors=[]){if(errors.length)alert(errors.map(e=>`${e.name}: ${e.error}`).join('\n\n'))}
const dz=$('dropzone');dz.onclick=()=>$('fileInput').click();dz.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('fileInput').click()}};$('fileInput').onchange=e=>uploadFiles(e.target.files);['dragenter','dragover'].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.add('drag')}));['dragleave','drop'].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.remove('drag')}));dz.addEventListener('drop',e=>uploadFiles(e.dataTransfer.files));

async function browse(url=$('dwdUrl').value){status('DWD-Verzeichnis wird geladen …');try{const data=await api('/api/dwd/list',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});$('dwdUrl').value=data.url;state.selectedUrls.clear();$('importSelectedBtn').disabled=true;$('importSelectedBtn').textContent='Auswahl importieren';$('dwdFilter').hidden=false;$('dwdFilter').value='';$('dwdEntries').innerHTML='';data.entries.forEach(entry=>{if(entry.kind==='directory'){const button=document.createElement('button');button.type='button';button.className='entry dir';button.textContent=`▸ ${entry.name}`;button.onclick=()=>browse(entry.url);$('dwdEntries').append(button)}else{const div=document.createElement('label');div.className='entry';div.innerHTML=`<input type="checkbox"><span class="entry-text"><strong>${escapeHtml(entry.label||entry.name)}</strong><small>${escapeHtml(entry.name)}</small></span>`;div.querySelector('input').onchange=e=>{e.target.checked?state.selectedUrls.add(entry.url):state.selectedUrls.delete(entry.url);$('importSelectedBtn').disabled=!state.selectedUrls.size;$('importSelectedBtn').textContent=state.selectedUrls.size?`${state.selectedUrls.size} Datei(en) importieren`:'Auswahl importieren'};$('dwdEntries').append(div)}});status(`${data.entries.length} Einträge gefunden`)}catch(e){status(e.message,true)}}
$('dwdFilter').oninput=e=>{const query=e.target.value.trim().toLocaleLowerCase('de-DE');for(const entry of $('dwdEntries').children)entry.hidden=!entry.textContent.toLocaleLowerCase('de-DE').includes(query)};
$('browseBtn').onclick=()=>browse();
async function importUrls(urls,autoDetect=false,displayLastOnly=false){const loaded=new Set([...state.rasters.values()].map(r=>r.sourceUrl).filter(Boolean));const pending=[...new Set(urls)].filter(url=>!loaded.has(url));if(!pending.length){status('Alle ausgewählten Raster sind bereits geladen.');return {rasters:[],errors:[]}}status(`${pending.length} DWD-Datei(en) werden geladen …`);try{const data=await api('/api/import-url',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({urls:pending,epsg:autoDetect?'':$('epsg').value,unit:autoDetect?'':$('unit').value})});data.rasters.forEach((r,index)=>addRaster(r,true,!displayLastOnly||index===data.rasters.length-1));if(data.rasters.length){if(state.selectedPoint)refreshPointValues();else map.fitBounds(data.rasters.at(-1).bounds,{padding:[20,20]})}showErrors(data.errors);status(data.errors.length&&!data.rasters.length?'Import fehlgeschlagen':`${data.rasters.length} Raster geladen`,data.errors.length&&!data.rasters.length);return data}catch(e){status(e.message,true);return {rasters:[],errors:[{error:e.message}]}}}
$('importSelectedBtn').onclick=()=>importUrls([...state.selectedUrls]);
$('importUrlBtn').onclick=()=>importUrls([$('dwdFileUrl').value.trim()].filter(Boolean));
$('dwdFileUrl').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('importUrlBtn').click()}};

$('applyStyle').onclick=()=>{for(const [id,old] of state.overlays){const r=state.rasters.get(id),visible=map.hasLayer(old);map.removeLayer(old);const fresh=L.imageOverlay(imageUrl(id),r.bounds,{opacity:+$('opacity').value});state.overlays.set(id,fresh);if(visible)fresh.addTo(map)}updateLegend()};$('opacity').oninput=e=>state.overlays.forEach(o=>o.setOpacity(+e.target.value));$('palette').onchange=updateLegend;

let hoverTimer;map.on('mousemove',e=>{clearTimeout(hoverTimer);hoverTimer=setTimeout(async()=>{if(!state.activeId)return;try{const d=await api('/api/values',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat:e.latlng.lat,lon:e.latlng.lng,ids:[state.activeId]})});const v=d.values[0],value=v&&v.value!==null?`${format(v.value)} ${v.unit||'(Originalwert)'}`:'kein Wert';$('hoverValue').textContent=`${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)} · ${value}` }catch{}},100)});
function renderPointValues(){
  const sorted=state.pointValues;
  const frequencyNames={monthly:'Monat',annual:'Jahr',seasonal:'Jahreszeit',multi_annual:'Vieljährig'};
  const groups=new Map();
  for(const value of sorted){
    const key=pointGroup(value);
    if(!groups.has(key))groups.set(key,{title:value.title||short(value.name),unit:value.unit||'',frequency:value.productKey?.split(':')[0]||'',values:[]});
    groups.get(key).values.push(value);
  }
  if(groups.size&&!groups.has(state.chartGroup))state.chartGroup=groups.keys().next().value;
  const select=$('chartParameter');
  select.replaceChildren();
  for(const [key,group] of groups){const option=document.createElement('option');option.value=key;option.textContent=`${group.title}${frequencyNames[group.frequency]?` · ${frequencyNames[group.frequency]}`:''}${group.unit?` (${group.unit})`:''}`;select.append(option)}
  if(groups.size)select.value=state.chartGroup;
  else{const option=document.createElement('option');option.textContent=state.selectedPoint?'Keine Rasterwerte':'Punkt wählen';select.append(option)}
  select.disabled=groups.size<2;
  const group=groups.get(state.chartGroup),comparable=group?.values||[];
  $('chartTitle').textContent=group?`${group.frequency==='monthly'?'Monatsverlauf':'Verlauf'}: ${group.title}`:'Werte am gewählten Ort';
  chart.data.labels=comparable.map(value=>value.periodLabel||value.timestamp||short(value.name));
  chart.data.datasets[0].data=comparable.map(value=>value.value);
  chart.data.datasets[0].label=group?.unit||'Rasterwert';
  chart.options.scales.y.title={display:!!group?.unit,text:group?.unit,color:themeColor('--color-base-content')};
  chart.update();
  $('valueTable').innerHTML=sorted.length?`<table class="values"><thead><tr><th>Parameter und Zeitraum</th><th>Wert</th></tr></thead><tbody>${sorted.map(v=>`<tr><td>${escapeHtml(v.title||short(v.name))}<br><small>${escapeHtml(v.periodLabel||v.timestamp||'Zeitraum unbekannt')}</small></td><td>${v.value===null?'–':`${format(v.value)} ${escapeHtml(v.unit||'(Originalwert)')}`}</td></tr>`).join('')}</tbody></table>`:'';
  document.dispatchEvent(new Event('point-values-change'));
}
$('chartParameter').onchange=event=>{state.chartGroup=event.target.value;renderPointValues()};
let pointRequest = 0;
function selectPoint(latlng,name=''){
  state.selectedPoint={lat:latlng.lat,lng:latlng.lng};
  if(state.marker)state.marker.setLatLng(latlng);
  else state.marker=L.circleMarker(latlng,{radius:6,color:themeColor('--color-base-content'),fillColor:themeColor('--color-accent'),fillOpacity:1}).addTo(map);
  $('pointLabel').textContent=name||`${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
  refreshPointValues();
}
async function refreshPointValues(){
  const point=state.selectedPoint,requestId=++pointRequest;
  if(!point||!state.rasters.size){state.pointValues=[];renderPointValues();return}
  try{
    const data=await api('/api/values',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat:point.lat,lon:point.lng,ids:[...state.rasters.keys()]})});
    if(requestId!==pointRequest)return;
    state.pointValues=data.values.sort((a,b)=>(a.timestamp||a.name).localeCompare(b.timestamp||b.name));
    renderPointValues();
  }catch(error){if(requestId===pointRequest)status(error.message,true)}
}
map.on('click',event=>selectPoint(event.latlng));

let searchRequest=0;
$('placeSearch').onsubmit=async event=>{
  event.preventDefault();
  const query=$('placeQuery').value.trim(),results=$('placeResults'),requestId=++searchRequest;
  results.hidden=false;
  results.textContent='Orte werden gesucht …';
  if(query.length<2){results.textContent='Bitte mindestens zwei Zeichen eingeben.';return}
  try{
    const data=await api(`/api/places?q=${encodeURIComponent(query)}`);
    if(requestId!==searchRequest)return;
    results.replaceChildren();
    if(!data.places.length){results.textContent='Kein Ort gefunden. Versuche einen anderen Namen oder eine Postleitzahl.';return}
    for(const place of data.places){
      const button=document.createElement('button');
      button.type='button';button.className='place-result';button.textContent=place.name;
      button.onclick=()=>{selectPoint(L.latLng(place.lat,place.lon),place.name);map.setView([place.lat,place.lon],Math.max(map.getZoom(),9));results.hidden=true};
      results.append(button);
    }
  }catch(error){if(requestId===searchRequest)results.textContent=error.message}
};
function format(v){return Number(v).toLocaleString('de-DE',{maximumFractionDigits:3})}function short(s){return s.length>28?s.slice(0,25)+'…':s}

Promise.all([api('/api/sample'),api('/api/sample-january')]).then(([annual,january])=>{addRaster(annual);addRaster(january);map.removeLayer(state.overlays.get(annual.id));renderLayers();status('Januar 1901 und Jahresraster geladen')}).catch(e=>status(e.message,true));
