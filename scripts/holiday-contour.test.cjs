const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadTypeScript:load}=require('./load-runtime-typescript.cjs');
const {contourY,publishLiquidContour,readLiquidContour,clearLiquidContour}=load('runtime/characters/liquid-contour.ts');
const {garlandPoints,garlandBrightness}=load('runtime/holidays/garland.ts');
test('Garland follows both sides and closes only the capsule top at small and expanded sizes',()=>{
 for(const [w,h] of [[150,30],[368,44],[680,336]])for(const capsule of [false,true]){
  const points=garlandPoints(w,h,capsule);assert(points.length>8);
  assert(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-2.5&&p.x<=w+2.5&&p.y>=4.5&&p.y<=h+9.5));
  assert(points.some(p=>p.x<5)&&points.some(p=>p.x>w-5),'Both sides need lamps');
  assert(points.some(p=>p.bottom),'Bottom follows liquid');
  assert.equal(points.some(p=>p.y===4.5),capsule,'Top edge belongs only to a capsule');
 }
});
test('Reference lamp normals and shimmer retain small outward offsets and bounded light',()=>{
 const points=garlandPoints(300,60,true,26);
 assert.equal(points.find(p=>p.phase===0).y,69.5);
 assert(points.some(p=>p.x>300)&&points.some(p=>p.x<0));
 for(const mode of ['wave','music','twinkle'])for(const phase of [-4,0,6])for(const seconds of [0,.25,10]){
  const light=garlandBrightness(mode,phase,seconds,.8,2);assert(light>=.22&&light<=1);
 }
 assert.equal(garlandBrightness('wave',0,0),.4375);
 assert.notEqual(garlandBrightness('twinkle',-3,1),garlandBrightness('twinkle',3,1));
});
test('Garland samples live waves rather than a flat bottom and scales to its own viewport',()=>{
 const contour={width:100,height:40,points:[[-50,40],[0,20],[50,40]]};
 assert.equal(contourY(contour,50,100,40),20);assert.equal(contourY(contour,25,100,40),30);
 assert.equal(contourY(contour,100,200,80),40);
 const owner={};publishLiquidContour(owner,contour);assert.equal(readLiquidContour(owner),contour);
 clearLiquidContour(owner);assert.equal(readLiquidContour(owner),undefined);
});
