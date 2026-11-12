// One-time recovery of the supplied application. Production builds never run this.
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import prettier from 'prettier';
import { signatures, root } from './generate-ipc.mjs';

const sources = path.join(root, 'frontend/assets');
const target = path.join(root, 'runtime');
if (await fs.stat(path.join(target, 'compat/island.js')).catch(() => null)) throw new Error('Runtime already migrated. Edit runtime/ directly; this one-time recovery must not overwrite maintained sources.');
const names = {
  'type-DVE1z8l3.js': 'shared.js', 'Liquid-BbsJJY6K.js': 'island-store.js',
  'Home-ILtKrcyA.js': 'home.js', 'island-BrWchjAa.js': 'island.js',
  'settings-DKyXEiF7.js': 'settings.js', 'overlay-UROx9wcU.js': 'overlay.js',
  'editor-YkpbrLj9.js': 'editor.js', 'copy-DVnAz-Qz.js': 'window.js',
  'Stage-BwJb3ILo.js': 'stage.js', 'image-CUVEE1Lc.js': 'image.js',
  'square-DfN8atH-.js': 'check.js', 'x-D7kCLGYo.js': 'close.js',
  'undo-2-CLDXo9B6.js': 'undo.js', 'markup-Ch9cn9Ae.js': 'markup.js',
  'woods-extensions.js': '../components/woods-extensions.js',
};
const rewrites = {
  'island-BrWchjAa.js': { N:'useIslandStore', P:'ReactRuntime', F:'jsxRuntime', Yj:'IslandApp', Gj:'useRuntimeEvents', Wj:'useIslandGeometry', nj:'ProgramIcon' },
  'Home-ILtKrcyA.js': { E:'useIslandStore', O:'ReactRuntime', D:'jsxRuntime', ah:'HomePlayer', Jm:'LyricsPanel', ph:'Launcher', _h:'Home', km:'usePlaybackPosition', Df:'togglePlayback', Of:'seekPlayback' },
  'Liquid-BbsJJY6K.js': { F:'useIslandStore', h:'ReactRuntime', g:'jsxRuntime' },
};
function program(file, text) {
  const host = ts.createCompilerHost({allowJs:true, noResolve:true});
  host.getSourceFile = name => name === file ? ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS) : undefined;
  const p = ts.createProgram([file], {allowJs:true,noResolve:true}, host);
  return { ast:p.getSourceFile(file), checker:p.getTypeChecker() };
}
function top(node, ast) { while (node && node.parent !== ast) node=node.parent; return node; }
function visit(node, fn) { fn(node); ts.forEachChild(node, child => visit(child,fn)); }
function rename(file, text) {
  const mapping=rewrites[file]; if(!mapping)return text;
  const {ast,checker}=program(file,text), symbols=new Map();
  for(const statement of ast.statements) {
    visit(statement,node=>{
      if(!ts.isIdentifier(node)||!mapping[node.text])return;
      const symbol=checker.getSymbolAtLocation(node);
      if(symbol?.declarations?.some(d=>top(d,ast)===statement && (ts.isFunctionDeclaration(d)||ts.isVariableDeclaration(d)||ts.isImportSpecifier(d)))) {
        if(symbol.declarations.some(d=>ts.isImportSpecifier(d)||ts.isFunctionDeclaration(d)&&d.parent===ast||ts.isVariableDeclaration(d)&&d.parent.parent.parent===ast)) symbols.set(symbol,mapping[node.text]);
      }
    });
  }
  const edits=[];
  visit(ast,node=>{
    if(!ts.isIdentifier(node))return;
    if(ts.isPropertyAccessExpression(node.parent)&&node.parent.name===node)return;
    if(ts.isImportSpecifier(node.parent)&&node.parent.propertyName===node)return;
    if(ts.isExportSpecifier(node.parent)&&node.parent.name===node&&node.parent.propertyName)return;
    const symbol=ts.isShorthandPropertyAssignment(node.parent)?checker.getShorthandAssignmentValueSymbol(node.parent):ts.isExportSpecifier(node.parent)?checker.getExportSpecifierLocalTargetSymbol(node.parent):checker.getSymbolAtLocation(node);
    const name=symbols.get(symbol);if(!name)return;
    const replacement=ts.isShorthandPropertyAssignment(node.parent)?`${node.text}: ${name}`:ts.isImportSpecifier(node.parent)&&!node.parent.propertyName?`${node.text} as ${name}`:ts.isExportSpecifier(node.parent)&&!node.parent.propertyName?`${name} as ${node.text}`:name;
    edits.push({start:node.getStart(ast),end:node.end,text:replacement});
  });
  for(const e of edits.sort((a,b)=>b.start-a.start))text=text.slice(0,e.start)+e.text+text.slice(e.end);
  return text;
}
function splitModule(file,text,predicate,vendorName,externals={}) {
  const {ast,checker}=program(file,text), selected=new Set(ast.statements.filter(predicate));
  const outputs=new Map(),inputs=new Map();
  visit(ast,node=>{
    if(!ts.isIdentifier(node))return;
    let symbol=checker.getSymbolAtLocation(node);
    if(ts.isExportSpecifier(node.parent))symbol=checker.getExportSpecifierLocalTargetSymbol(node.parent)||symbol;
    if(ts.isShorthandPropertyAssignment(node.parent))symbol=checker.getShorthandAssignmentValueSymbol(node.parent)||symbol;
    const declaration=symbol?.declarations?.[0];if(!declaration||declaration.getSourceFile()!==ast)return;
    if(ts.isIdentifier(declaration)||ts.isPropertyAssignment(declaration)||ts.isPropertyDeclaration(declaration)||ts.isMethodDeclaration(declaration))return;
    const from=top(declaration,ast),to=top(node,ast);
    if(selected.has(from)&&!selected.has(to))outputs.set(symbol,symbol.name);
    if(!selected.has(from)&&selected.has(to))inputs.set(symbol,{name:symbol.name,declaration,from});
  });
  const imported=[];
  for(const {name,declaration,from} of inputs.values()) {
    if(externals[name]) { imported.push(externals[name]); continue; }
    if(!ts.isImportDeclaration(from))throw new Error(`Vendor ${vendorName} depends on application symbol ${name}: ${ts.SyntaxKind[declaration.kind]} ${declaration.getText(ast).slice(0,100)}`);
    const original=declaration.propertyName?.text||declaration.name.text;
    imported.push(`import { ${original} as ${name} } from ${JSON.stringify(from.moduleSpecifier.text)};`);
  }
  const exported=[...outputs.values()].filter(n=>n!=='default');
  const vendor=imported.join('\n')+'\n'+[...selected].map(s=>s.getText(ast)).join('\n')+`\nexport { ${exported.join(', ')} };\n`;
  const app=`import { ${exported.join(', ')} } from '../vendor/${vendorName}';\n`+ast.statements.filter(s=>!selected.has(s)).map(s=>s.getText(ast)).join('\n');
  return {vendor,app};
}
function references(text,fromVendor=false) {
  for(const [oldName,newName] of Object.entries(names))text=text.replaceAll(`./${oldName}`,fromVendor?`../compat/${newName}`:`./${newName}`);
  return text;
}
async function save(relative,text,format=true) {
  const file=path.join(target,relative);await fs.mkdir(path.dirname(file),{recursive:true});
  await fs.writeFile(file,format?await prettier.format(text,{parser:file.endsWith('.ts')?'typescript':'babel',printWidth:110}):text);
}
for(const [file,newName] of Object.entries(names)) {
  let text=await fs.readFile(path.join(sources,file),'utf8');
  if(file==='type-DVE1z8l3.js') {
    const {ast}=program(file,text);
    // React 19/ReactDOM remain pinned together until compatibility components migrate.
    const group=new Set(ast.statements.slice(0,3));
    const parts=splitModule(file,text,s=>group.has(ast.statements.find(x=>x.pos===s.pos)),'react-foundation.js');
    await save('vendor/react-foundation.js','// Pinned React 19 / ReactDOM runtime recovered from the supplied distribution.\n'+parts.vendor,false);
    text=parts.app;
    const parsed=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    const apiStatement=parsed.statements.find(s=>ts.isVariableStatement(s)&&s.declarationList.declarations.some(d=>d.name.getText(parsed)==='Ce'));
    const object=apiStatement.declarationList.declarations.find(d=>d.name.getText(parsed)==='Ce').initializer;
    const methods=object.properties.map(method=>{
      const fn=method.initializer,body=fn.body;
      const command=body.arguments[0].text,spec=signatures[command];
      if(!spec)throw new Error(`Unregistered IPC ${command}`);
      const args=body.arguments[1];
      const params=fn.parameters.map(p=>{
        let field=args?.properties?.find(prop=>(prop.initializer||prop.name)?.getText(parsed).replace(/\?\?null$/,'')===p.name.text);
        let t=spec.params.find(x=>x.name===field?.name?.text)?.type;
        if(p.name.text==='t'&&method.name.text==='webAiEmbed')t="Pick<RustCommands['web_ai_embed']['args'], 'x' | 'y' | 'width' | 'height'>";
        if(!t)t=p.initializer?.kind===ts.SyntaxKind.TrueKeyword||p.initializer?.kind===ts.SyntaxKind.FalseKeyword?'boolean':'string';
        if(command==='settings_set')t='Partial<Settings>';
        if(command==='agents_answer')t=p.name.text==='e'?'string':p.name.text==='t'?"'answer' | 'allow' | 'deny' | 'terminal'":'AgentAnswers | null';
        return `${p.name.text}${p.initializer||command==='agents_answer'&&p.name.text==='n'?'?':''}: ${t}`;
      }).join(', ');
      return `  ${method.name.text}: (${params}) => Promise<Commands['${command}']['result']>;`;
    }).join('\n');
    await save('ipc/legacy-api.ts',`import { invoke as T } from './client';\nimport type { Commands, AgentAnswers } from './client';\nimport type { RustCommands, JsonValue, Settings } from './generated';\nlet Se=0;\nexport const api: {\n${methods}\n} = ${object.getText(parsed)};\n`);
    text=text.slice(0,apiStatement.getStart(parsed))+`import { api as Ce } from '../ipc/legacy-api';\n`+text.slice(apiStatement.end);
  } else if(file==='Home-ILtKrcyA.js') {
    const parts=splitModule(file,text,s=>s.getStart()>650&&s.getStart()<128454,'motion.js');
    await save('vendor/motion.js','// Pinned Framer Motion runtime recovered from the supplied distribution.\n'+references(rename(file,parts.vendor),true),false);
    text=parts.app;
  }
  if(file==='island-BrWchjAa.js') {
    const editor=splitModule(file,text,s=>s.getStart()>=92850&&s.getStart()<487494,'editor.js',{
      P:"import { React as P } from '../react';",
      F:"import { i as getJsxRuntime } from './type-DVE1z8l3.js'; const F=getJsxRuntime();",
    });
    await save('vendor/editor.js','// Pinned ProseMirror / Tiptap runtime recovered from the supplied distribution.\n'+references(rename(file,editor.vendor),true),false);
    text=editor.app;
    const {ast}=program(file,text),question=ast.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='pj');
    text=text.slice(0,question.getStart(ast))+`function pj({peek,where,terminal,done}) { return F.jsx(AgentQuestion,{ask:peek.ask,where,terminal,onAnswer:answers=>done('answer',answers)}); }\n`+text.slice(question.end);
    text=`import { AgentQuestion } from '../components/AgentQuestion';\n`+text;
  }
  text=references(rename(file,text));
  await save('compat/'+newName,'// Compatibility application source; migrate components incrementally.\n'+text);
}
for(const entry of ['index','settings','overlay','editor']) {
  let html=await fs.readFile(path.join(root,'frontend',entry+'.html'),'utf8');
  html=html.replace(/\s*<link rel="modulepreload"[^>]+>/g,'').replace(/\s*<script type="module" src="\/assets\/woods-extensions.js"><\/script>/,'');
  html=html.replace(/\/assets\/[^" ]+\.js/,`/entries/${entry}.ts`).replace('/assets/type-DOL6LRCc.css','/styles/runtime.css');
  await fs.writeFile(path.join(target,entry+'.html'),html);
  await save(`entries/${entry}.ts`,`import '../compat/${entry==='index'?'island':entry}.js';\n`);
}
await fs.mkdir(path.join(target,'styles'),{recursive:true});
await fs.copyFile(path.join(sources,'type-DOL6LRCc.css'),path.join(target,'styles/runtime.css'));
console.log('Recovered application sources in runtime/. Original supplied frontend is retained as an archive.');
