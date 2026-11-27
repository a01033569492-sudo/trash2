/* 설치 없는 정적 웹사이트: Leaflet 지도 + OSM 위치 + 카카오맵 도보 길찾기 */
const $ = id => document.getElementById(id);
const regions = [
  ['서울',37.5665,126.978],['부산',35.1796,129.0756],['대구',35.8714,128.6014],
  ['인천',37.4563,126.7052],['광주',35.1595,126.8526],['대전',36.3504,127.3845],
  ['울산',35.5395,129.3114],['세종',36.4801,127.289],['경기 · 수원',37.2636,127.0286],
  ['강원 · 춘천',37.8813,127.7298],['충북 · 청주',36.6424,127.489],['충남 · 홍성',36.6013,126.6608],
  ['전북 · 전주',35.8242,127.148],['전남 · 무안',34.9905,126.4817],
  ['경북 · 안동',36.5684,128.7294],['경남 · 창원',35.2285,128.6811],['제주',33.4996,126.5312]
];
let map, clusters, origin, originMarker, bins = [], markers = new Map();
let loading = false, toastTimer;
regions.forEach(([name], i) => $('region').add(new Option(name, String(i))));
function toast(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 5500);
}
function distance(a, b) {
  const rad = Math.PI / 180, dLat = (b.lat-a.lat)*rad, dLng = (b.lng-a.lng)*rad;
  const h = Math.sin(dLat/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLng/2)**2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1,h)));
}
function formatDistance(m) { return m < 1000 ? Math.round(m)+'m' : (m/1000).toFixed(1)+'km'; }
function routeURL(bin) {
  const to = `${encodeURIComponent(bin.name)},${bin.lat},${bin.lng}`;
  return origin
    ? `https://map.kakao.com/link/by/walk/${encodeURIComponent('출발지')},${origin.lat},${origin.lng}/${to}`
    : `https://map.kakao.com/link/to/${to}`;
}
function routeLink(bin) {
  const a = document.createElement('a'); a.className='route'; a.textContent='도보 길 안내';
  a.href=routeURL(bin); a.target='_blank'; a.rel='noopener noreferrer';
  a.addEventListener('click', () => toast(origin ? '카카오맵에서 도보 경로를 확인하세요.' : '카카오맵에서 출발지와 도보를 선택해 주세요.'));
  return a;
}
function popup(bin) {
  const div = document.createElement('div'), title = document.createElement('strong');
  title.textContent=bin.name; div.append(title, document.createElement('br'));
  const info = document.createElement('span'); info.textContent=bin.address || `${bin.lat.toFixed(5)}, ${bin.lng.toFixed(5)}`;
  div.append(info, document.createElement('br'), routeLink(bin)); return div;
}
function setOrigin(point, label) {
  origin={lat:point.lat,lng:point.lng};
  if (originMarker) originMarker.remove();
  originMarker=L.circleMarker(origin,{radius:8,color:'#fff',weight:3,fillColor:'#3478d4',fillOpacity:1}).addTo(map).bindTooltip('출발지');
  $('origin-note').textContent=label+' · 파란 점이 출발지예요.';
  map.closePopup(); renderList();
}
function renderList() {
  if (!map) return;
  const query=$('search').value.trim().toLowerCase(), center=origin || map.getCenter(), bounds=map.getBounds();
  const visible=bins.filter(b => bounds.contains([b.lat,b.lng]) && `${b.name} ${b.address}`.toLowerCase().includes(query))
    .map(b => ({...b,d:distance(center,b)})).sort((a,b)=>a.d-b.d);
  $('count').textContent=visible.length.toLocaleString('ko-KR');
  $('sort').textContent=origin ? '출발지에서 직선거리순' : '지도 중심에서 직선거리순';
  $('list').replaceChildren();
  if (!loading) $('status').textContent=!bins.length ? '등록된 정보를 아직 불러오지 못했어요.' : !visible.length ? '이 영역에 등록된 정보가 없어요. 지도를 이동하거나 검색어를 바꿔보세요.' : `가까운 ${Math.min(visible.length,30)}곳을 표시해요. 실제 도보 거리와 달라요.`;
  visible.slice(0,30).forEach(bin => {
    const card=document.createElement('article'); card.className='bin';
    const name=document.createElement('h3'); name.textContent=bin.name;
    const location=document.createElement('p'); location.textContent=bin.address || `위도 ${bin.lat.toFixed(5)} · 경도 ${bin.lng.toFixed(5)}`;
    const d=document.createElement('p'); d.className='distance'; d.textContent=`직선거리 ${formatDistance(bin.d)}`;
    const actions=document.createElement('div'); actions.className='actions';
    const show=document.createElement('button'); show.textContent='지도에서 보기';
    show.onclick=()=>{map.setView([bin.lat,bin.lng],18); const marker=markers.get(bin.id); clusters.zoomToShowLayer(marker,()=>marker.openPopup());};
    actions.append(routeLink(bin),show); card.append(name,location,d,actions); $('list').append(card);
  });
}
function displayData(data) {
  if (!Array.isArray(data.bins)) throw new Error('잘못된 위치 데이터');
  bins=data.bins.filter(b => Number.isFinite(b.lat) && Number.isFinite(b.lng) && Math.abs(b.lat)<=90 && Math.abs(b.lng)<=180);
  clusters.clearLayers(); markers.clear();
  const icon=L.divIcon({className:'bin-pin',html:'♧',iconSize:[28,28]});
  bins.forEach(bin=>{
    const marker=L.marker([bin.lat,bin.lng],{icon,title:bin.name});
    marker.bindPopup(()=>popup(bin)); markers.set(bin.id,marker); clusters.addLayer(marker);
  });
  $('total').textContent=`전국 등록 ${bins.length.toLocaleString('ko-KR')}곳`;
  $('data-note').textContent=`OpenStreetMap 등록 정보 · 수집 ${data.date || '날짜 미상'}. 전국 전체 쓰레기통을 포함하지 않으며 미등록·철거·실내 여부 오류가 있을 수 있어요.`;
}
async function loadData() {
  if (loading) return; loading=true; $('retry').hidden=true;
  $('status').textContent='전국 쓰레기통 정보를 불러오는 중이에요.';
  try {
    if (window.BIN_DATA) displayData(window.BIN_DATA);
    else {
      // 정적 데이터가 없을 때만 공개 API에 조회합니다.
      const query='[out:json][timeout:45];area["ISO3166-1"="KR"][admin_level=2]->.kr;nwr[amenity=waste_basket][indoor!=yes][access!=private][access!=no](area.kr);out center tags;';
      const response=await fetch('https://ovp.dresel.systems/api-as/interpreter?data='+encodeURIComponent(query),{signal:AbortSignal.timeout(55000)});
      if (!response.ok) throw new Error('공개 데이터 서버 오류');
      const raw=await response.json(); if (raw.remark || !Array.isArray(raw.elements)) throw new Error('조회 실패');
      displayData({date:new Date().toISOString().slice(0,10),bins:raw.elements.map(e=>({id:e.type+'/'+e.id,lat:e.lat??e.center?.lat,lng:e.lon??e.center?.lon,name:e.tags?.name||'길가 쓰레기통',address:[e.tags?.['addr:city'],e.tags?.['addr:street'],e.tags?.['addr:housenumber']].filter(Boolean).join(' ')}))});
    }
    loading=false; renderList();
  } catch(error) {
    loading=false; $('status').textContent='위치 정보를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
    $('retry').hidden=false;
  }
}
function init() {
  if (!window.L || !L.markerClusterGroup) {
    $('status').textContent='지도 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인한 뒤 새로고침해 주세요.'; return;
  }
  map=L.map('map',{zoomControl:false,minZoom:6,maxBounds:[[30,122],[40,134]],maxBoundsViscosity:.8});
  const showAll=()=>map.fitBounds([[33,124.5],[38.7,131.9]],{padding:[24,24]});
  showAll();
  L.control.zoom({position:'topright'}).addTo(map);
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  tiles.on('tileerror',()=> $('map-error').hidden=false);
  clusters=L.markerClusterGroup({showCoverageOnHover:false,chunkedLoading:true,iconCreateFunction:cluster=>L.divIcon({className:'cluster',html:String(cluster.getChildCount()),iconSize:[44,44]})}).addTo(map);
  map.on('moveend',renderList); map.on('click',e=>setOrigin(e.latlng,'지도에서 선택한 위치'));
  $('region').onchange=()=>{const i=$('region').value; if(i==='') showAll(); else map.setView(regions[Number(i)].slice(1),13);};
  $('all').onclick=()=>{$('region').value='';$('search').value='';showAll();renderList();};
  $('search').oninput=renderList; $('retry').onclick=loadData;
  $('locate').onclick=()=>{
    if(!navigator.geolocation) return toast('이 브라우저에서는 위치를 사용할 수 없어요. 지도에서 출발지를 선택해 주세요.');
    $('locate').disabled=true; $('locate').textContent='위치 확인 중…';
    navigator.geolocation.getCurrentPosition(position=>{
      $('locate').disabled=false; $('locate').textContent='◎ 내 위치로 찾기';
      const point={lat:position.coords.latitude,lng:position.coords.longitude};
      if(point.lat<32 || point.lat>39.5 || point.lng<124 || point.lng>132) return toast('현재 위치는 국내 지도 범위 밖이에요. 지도에서 출발지를 선택해 주세요.');
      setOrigin(point,'현재 위치'); map.setView(point,15);
    },()=>{$('locate').disabled=false;$('locate').textContent='◎ 내 위치로 찾기';toast('위치를 확인할 수 없어요. 위치 권한을 허용하거나 지도에서 출발지를 선택해 주세요.');},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
  };
  loadData();
}
init();
