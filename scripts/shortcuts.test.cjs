const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadTypeScript:load}=require('./load-runtime-typescript.cjs');
const {readShortcut,canonicalShortcut,shortcutConflict}=load('runtime/keyboard/shortcuts.ts');
const input=(code,mods={})=>({code,key:code,ctrlKey:false,altKey:false,shiftKey:false,metaKey:false,...mods});
test('Modifier display, modifier requirement, Alt Space and keypad remain distinct',()=>{
 assert.deepEqual(readShortcut(input('ControlLeft',{ctrlKey:true})),{kind:'modifier',value:'Ctrl'});
 assert.equal(readShortcut(input('KeyA')).kind,'missingModifier');
 assert.deepEqual(readShortcut(input('Space',{altKey:true})),{kind:'save',value:'Alt+Space'});
 assert.equal(readShortcut(input('Numpad1',{ctrlKey:true})).value,'Ctrl+Numpad1');
 assert.equal(readShortcut(input('Digit1',{ctrlKey:true})).value,'Ctrl+1');
 assert.equal(readShortcut(input('NumpadAdd',{altKey:true})).value,'Alt+NumpadAdd');
 assert.equal(readShortcut(input('F24')).kind,'save');assert.equal(readShortcut(input('F25')).kind,'unsupported');
});
test('Conflict matching understands modifier order, aliases and existing physical key names',()=>{
 assert.equal(canonicalShortcut('Win+Control+KeyA'),'ctrl+super+a');
 assert.equal(shortcutConflict('Ctrl+Shift+A','Ctrl+B',[{value:'Shift+Control+KeyA',label:'Chat'}]),'Chat');
 assert.equal(shortcutConflict('Ctrl+A','Control+KeyA',[{value:'Ctrl+A',label:'Current'}]),null);
 assert.equal(shortcutConflict('Ctrl+Numpad1','',[{value:'Ctrl+1',label:'Other'}]),null);
 assert.equal(canonicalShortcut('Alt+Backquote'),canonicalShortcut('Alt+`'));
});
test('Escape cancels, bare Delete clears, modified Delete can be assigned and Tab leaves the recorder',()=>{
 assert.equal(readShortcut({...input('Escape'),key:'Escape'}).kind,'cancel');
 assert.equal(readShortcut(input('Delete')).kind,'clear');assert.equal(readShortcut(input('Delete',{ctrlKey:true})).kind,'save');
 assert.equal(readShortcut(input('Tab')).kind,'navigate');
});
