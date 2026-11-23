const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadTypeScript}=require('./load-runtime-typescript.cjs');
const {shelfLook,shelfTilt,shelfPhotoShape}=loadTypeScript('runtime/phone/shelf.ts');
test('Shelf material respects directories, image thumbnails, video and known document families',()=>{
  assert.equal(shelfLook({name:'folder.png',isDir:true,icon:'thumb'}).kind,'icon');
  assert.equal(shelfLook({name:'PHOTO.HEIC',icon:'thumb'}).kind,'photo');
  assert.equal(shelfLook({name:'PHOTO.jpg'}).kind,'icon');
  assert.equal(shelfLook({name:'movie.mkv'}).kind,'video');
  for(const name of ['readme.md','report.pdf','table.csv','archive.7z','sound.flac'])assert.equal(shelfLook({name}).kind,'card');
  assert.equal(shelfLook({name:'tool.exe'}).kind,'icon');
});
test('A shell icon is not stretched into a photo; real previews keep their aspect',()=>{
  assert.equal(shelfPhotoShape(32,32),null);assert.equal(shelfPhotoShape(0,100),null);
  assert.equal(shelfPhotoShape(32,32,true),'square','A validated native photo keeps its identity even when smaller than a shell icon');
  assert.equal(shelfPhotoShape(200,120),'wide');assert.equal(shelfPhotoShape(100,180),'tall');assert.equal(shelfPhotoShape(100,100),'square');
  assert.equal(shelfTilt('file-id'),shelfTilt('file-id'));assert(Math.abs(shelfTilt('file-id'))<=2.4);
});
