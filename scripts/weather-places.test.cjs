const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadTypeScript:load}=require('./load-runtime-typescript.cjs');
const {weatherPlaces,placePatch}=load('runtime/weather/places.ts');

test('Older settings retain the current city and coordinate aliases do not duplicate it',()=>{
  const saved={weatherCity:'London',weatherLat:51.5,weatherLon:0,weatherTimezone:'Europe/London',weatherPlaces:JSON.stringify([{name:'Лондон',lat:51.50001,lon:0},{name:'Tokyo',lat:35.68,lon:139.69,timezone:'Asia/Tokyo'}])};
  const places=weatherPlaces(saved);assert.deepEqual(places.map(p=>p.name),['London','Tokyo']);
  assert.equal(placePatch(places[1]).weatherTimezone,'Asia/Tokyo');assert.equal(placePatch(places[1]).weatherUtcOffset,null);
  assert.equal(weatherPlaces({...saved,weatherPlaces:undefined})[0].timezone,'Europe/London');
});
test('Malformed history cannot create invalid city controls',()=>{
  for(const weatherPlacesValue of ['not json','null','{}','"string"'])assert.deepEqual(weatherPlaces({weatherPlaces:weatherPlacesValue}),[]);
  const history=[null,{name:'Invalid',lat:100,lon:0},{name:'Missing',lat:2},{name:'Here',lat:0,lon:0},{name:'Dup',lat:0.00001,lon:0},{name:'Valid',lat:3,lon:4}];
  assert.deepEqual(weatherPlaces({weatherPlaces:JSON.stringify(history)}).map(p=>p.name),['Here','Valid']);
});
test('History remains bounded and new search results reset a previous manual offset',()=>{
  const history=Array.from({length:20},(_,i)=>({name:'City '+i,lat:i,lon:0}));
  assert.equal(weatherPlaces({weatherPlaces:JSON.stringify(history)}).length,8);
  assert.deepEqual(placePatch({name:'New',lat:1,lon:2}),{weatherCity:'New',weatherLat:1,weatherLon:2,weatherTimezone:'',weatherUtcOffset:null});
});
