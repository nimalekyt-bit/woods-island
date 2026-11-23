import { React } from '../../runtime/react';
import { g as dom } from '../../runtime/vendor/react-foundation.js';
import { CharacterSprite } from '../../runtime/characters/CharacterSprite';
import { LiquidIsland } from '../../runtime/characters/LiquidIsland';
import { seasonalDefinitions } from '../../runtime/characters/seasonal';
import { createCharacterCatalog } from '../../runtime/characters/catalog';
import { genericDrawings } from '../../runtime/characters/drawings/generic';
import { creatures } from '../../runtime/characters/drawings/creatures';
import { things } from '../../runtime/characters/drawings/things';
import { setCharacterMotionPreference } from '../../runtime/characters/scheduler';
import type { CharacterMood } from '../../runtime/characters/types';
import '../../runtime/styles/runtime.css';

const fixture = window as any;
const catalog = createCharacterCatalog({ creatures, things, renderers: genericDrawings, language: () => 'ru' });
const sizes = [[60, 34, 'Обычный'], [80, 44, 'Крупный'], [100, 100, 'Галерея']] as const;
const liquidSizes = [[150,30],[268,32],[420,44],[680,336]] as const;
function Fixture() {
  const [mood, setMood] = React.useState<CharacterMood>('idle'), [still, setStill] = React.useState(false), [all, setAll] = React.useState(false);
  const [liquid, setLiquid] = React.useState(false), [fold, setFold] = React.useState(false);
  fixture.setCharacterMood = setMood;
  fixture.setCharactersStill = setStill;
  fixture.setCharacterScope = setAll;
  fixture.setLiquidDemo = setLiquid;
  fixture.setLiquidFold = setFold;
  fixture.setCharacterMotionPreference = setCharacterMotionPreference;
  const definitions = all ? catalog.catalog.filter(d => d.kind === 'slot' && d.puppet) : seasonalDefinitions;
  if (liquid) return <main style={{padding:24,color:'var(--color-ink)',background:'var(--color-island)',minHeight:'100%'}}>
    <h1 style={{fontSize:18,marginBottom:24}}>Woods Island · Жидкая пилюля</h1>
    <div style={{display:'grid',justifyItems:'start',gap:82}}>
      {liquidSizes.map(([width,height])=><div key={width} data-liquid-demo style={{width,height:fold&&height>60?44:height,position:'relative',borderRadius:height>60?32:height/2}}>
        <LiquidIsland mood={mood} accent="#d99972" round rain readAudio={()=>({level:.7,bands:[.2,.8,.4,.9,.1],bandsAt:performance.now(),liquidSpectrum:true})}/>
        <div data-liquid-clip style={{position:'relative',height:'100%'}}><div data-liquid-squash style={{height:'100%',transformOrigin:'50% 0',display:'flex',alignItems:'center',justifyContent:'center',gap:10,fontSize:12}}>
          <span style={{width:14,height:14,borderRadius:'50%',background:'var(--color-ink-2)'}}/><strong>Woods · 12°</strong>
        </div></div>
      </div>)}
    </div>
  </main>;
  return <main style={{ padding: 20, color: 'var(--color-ink)', background: 'var(--color-island)', minHeight: '100%' }}>
    <h1 style={{ fontSize: 18, marginBottom: 4 }}>Woods Island · Персонажи</h1>
    <p data-fixture-mood style={{ color: 'var(--color-ink-2)', fontSize: 12, marginBottom: 14 }}>{mood}</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
      {definitions.map(definition => <section key={definition.id} data-fixture-character={definition.id} style={{ borderRadius: 16, padding: 12, background: 'var(--color-tile)', display: 'grid', justifyItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 12 }}>{definition.name}</strong>
        {sizes.map(([width, height, name]) => <div key={name} data-fixture-size={name} style={{ width: 130, height: height + 12, display: 'grid', placeItems: 'center' }}>
          <CharacterSprite definition={definition} mood={mood} width={width} height={height} look={1} accent="#d99972" still={still}/>
        </div>)}
      </section>)}
    </div>
  </main>;
}
dom().createRoot(document.getElementById('root')).render(<Fixture/>);
