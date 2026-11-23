import { React } from '../../runtime/react';
import { g as dom } from '../../runtime/vendor/react-foundation.js';
import { PhonePanel } from '../../runtime/phone/PhonePanel';
import { ShelfObject, ShelfRow } from '../../runtime/phone/ShelfArtwork';
import { EMPTY_PHONE, phoneState } from '../../runtime/phone/state';
import '../../runtime/styles/runtime.css';

const fixture = window as any;
fixture.phoneCalls = [];
fixture.shelfCalls = [];
fixture.__TAURI_INTERNALS__ = { invoke: async (command: string, args: object) => {
  fixture.phoneCalls.push({ command, args });
  if (fixture.phoneFail) throw new Error(fixture.phoneFail);
  return fixture.phoneNext || EMPTY_PHONE;
} };
const qr = async () => 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="white"/><path d="M10 10h25v25H10zm55 0h25v25H65zM10 65h25v25H10zM45 45h10v10H45zm20 20h25v25H65z" fill="black"/></svg>');
const photo = (width: number, height: number) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#6f947a"/><path d="M0 ${height} ${width / 2} ${height / 3} ${width} ${height}" fill="#3d6351"/><circle cx="${width * .73}" cy="${height * .25}" r="${height * .12}" fill="#e0cba2"/></svg>`);
const items = [
  { id: 1, name: 'Лесная прогулка.png', path: 'fixture:wide', icon: photo(200, 120), exists: true, fromPhone: true, added: Date.now(), size: 3412 },
  { id: 2, name: 'Портрет.jpg', path: 'fixture:tall', icon: photo(100, 180), exists: true, size: 12 },
  { id: 3, name: 'Обложка.webp', path: 'fixture:square', icon: photo(128, 128), exists: true, size: 45 },
  { id: 4, name: 'План.pdf', path: 'fixture:pdf', exists: true, size: 4251 },
  { id: 5, name: 'Бюджет.xlsx', path: 'fixture:xlsx', exists: true, size: 251 },
  { id: 6, name: 'Вечер.mp4', path: 'fixture:mp4', exists: true, size: 11 },
  { id: 7, name: 'Папка.png', path: 'fixture:folder', isDir: true, exists: true, size: 0 },
  { id: 8, name: '<img src=x onerror=window.phoneXss=true>.txt', path: 'fixture:missing', exists: false, size: 0 },
  { id: 9, name: 'Нет миниатюры.jpg', path: 'fixture:small', icon: photo(32, 32), exists: true, size: 42 },
];
const shelfAction = (action: string) => (item: any) => fixture.shelfCalls.push({action, id: item.id});
function Fixture() {
  const [state, setState] = React.useState(EMPTY_PHONE), [empty, setEmpty] = React.useState(false);
  fixture.setPhoneState = (value: unknown) => setState(phoneState(value));
  fixture.setShelfEmpty = setEmpty;
  return <div onWheel={() => fixture.parentWheel = (fixture.parentWheel || 0) + 1} style={{display:'flex',gap:14,width:900,height:300,padding:16,background:'var(--color-island)'}}>
    <PhonePanel state={state} onState={setState} makeQr={qr} />
    <ShelfRow linked empty={empty}>{items.map(item => <ShelfObject key={item.id} item={item} linked onOpen={shelfAction('open')} onReveal={shelfAction('reveal')} onRemove={shelfAction('remove')} onSend={shelfAction('send')} dragProps={{onPointerDown: () => fixture.shelfCalls.push({action:'drag'})}} />)}</ShelfRow>
  </div>;
}
dom().createRoot(document.getElementById('root')).render(<Fixture />);
