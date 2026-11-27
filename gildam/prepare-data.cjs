// 내려받은 Overpass JSON을 작은 배포용 위치 파일로 변환합니다.
// 실행: node prepare-data.cjs osm-asia.json
const fs=require('node:fs');
const raw=JSON.parse(fs.readFileSync(process.argv[2]||'osm-asia.json','utf8'));
if(raw.remark || !Array.isArray(raw.elements)) throw new Error('불완전한 원본 데이터');
const bins=raw.elements.map(e=>({
  id:e.type+'/'+e.id,lat:e.lat??e.center?.lat,lng:e.lon??e.center?.lon,
  name:e.tags?.['name:ko']||e.tags?.name||'길가 쓰레기통',
  address:[e.tags?.['addr:city'],e.tags?.['addr:street'],e.tags?.['addr:housenumber']].filter(Boolean).join(' ')
})).filter(b=>Number.isFinite(b.lat)&&Number.isFinite(b.lng));
if(!bins.length) throw new Error('실제 위치가 없습니다');
const data={date:'2026-11-27',sourceTimestamp:raw.osm3s?.timestamp_osm_base,bins};
fs.writeFileSync('dist/bins.js','// © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright\nwindow.BIN_DATA = '+JSON.stringify(data)+';\n');
console.log('실제 쓰레기통 '+bins.length+'곳 저장 완료');
