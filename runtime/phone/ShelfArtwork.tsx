import { React } from "../react";
import { H as t } from "../compat/shared.js";
import { PhoneIcon, ShelfOrigin } from "./PhonePanel";
import { shelfLook, shelfTilt, shelfPhotoShape, type ShelfItem } from "./shelf";
import "./shelf.css";

function FileSymbol({ folder = false }: { folder?: boolean }) {
  return <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    {folder ? <path d="M4 12a4 4 0 0 1 4-4h9l4 4h11a4 4 0 0 1 4 4v15a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z" fill="currentColor" opacity=".55" />
      : <><path d="M9 4h15l8 8v22a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" /><path d="M23 4v10h9M13 22h13M13 28h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>}
  </svg>;
}
export function ShelfArtwork({ item }: { item: ShelfItem }) {
  return <ShelfArtworkImage key={`${item.path}\n${item.icon || ""}`} item={item} />;
}
function ShelfArtworkImage({ item }: { item: ShelfItem }) {
  const [photo, setPhoto] = React.useState<"wide" | "tall" | "square" | null>("tall"),
    [broken, setBroken] = React.useState(false),
    look = shelfLook(item);
  const style = { "--wi-shelf-tilt": `${shelfTilt(item.id)}deg`, "--wi-shelf-color": look.color } as React.CSSProperties;
  if (look.kind === "photo" && photo && !broken) return <div className="wi-shelf-art wi-shelf-print" data-shape={photo} style={style}>
    <img src={item.icon || ""} alt="" draggable={false} onError={() => setBroken(true)} onLoad={event => setPhoto(shelfPhotoShape(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight, item.preview === true))} />
  </div>;
  if (look.kind === "video") return <div className="wi-shelf-art wi-shelf-video" style={style}>
    <span className="wi-shelf-play"><svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3 1.5 10 6l-7 4.5Z" /></svg></span><b>{look.ext}</b>
  </div>;
  if (look.kind === "card") return <div className="wi-shelf-art wi-shelf-card" style={style}>
    <span><i /><i /><i /></span><b>{look.ext}</b>
  </div>;
  return <div className="wi-shelf-art wi-shelf-icon" style={style}>
    {item.icon && !broken ? <img src={item.icon} alt="" draggable={false} onError={() => setBroken(true)} /> : <FileSymbol folder={item.isDir} />}
  </div>;
}
export interface ShelfActions {
  onOpen: (item: ShelfItem) => unknown;
  onReveal: (item: ShelfItem) => unknown;
  onRemove: (item: ShelfItem) => unknown;
  onSend?: (item: ShelfItem) => unknown;
}
function ShelfButton({ label, action, tone, children }: { label: string; action: () => unknown; tone?: string; children: React.ReactNode }) {
  return <button type="button" aria-label={label} title={label} data-tone={tone}
    onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}
    onClick={event => { event.stopPropagation(); action(); }}>{children}</button>;
}
export function ShelfObject({ item, linked, dragProps, ...actions }: ShelfActions & { item: ShelfItem; linked?: boolean; dragProps?: React.HTMLAttributes<HTMLDivElement> }) {
  const detail = !item.exists ? t("нет файла", "missing") : item.isDir ? t("папка", "folder") : `${Math.max(0, Math.round((item.size || 0) / 1024))} ${t("КиБ", "KiB")}`;
  return <div {...dragProps} className="wi-shelf-object" data-shelf-item={item.name} data-exists={item.exists} tabIndex={0}
    title={`${item.name}\n${detail} · ${item.fromPhone ? t("с телефона", "from the phone") : t("с компьютера", "from the computer")}\n${t("Перетащи наружу · двойной клик — открыть", "Drag it out · double-click to open")}`}
    onDoubleClick={() => { if (item.exists) actions.onOpen(item); }}
    onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" && item.exists) { event.preventDefault(); actions.onOpen(item); } if (event.key === "Delete") { event.preventDefault(); actions.onRemove(item); } }}>
    <div className="wi-shelf-stage"><ShelfArtwork item={item} /><div className="wi-shelf-tools">
      {item.exists && <ShelfButton label={t("Открыть", "Open")} action={() => actions.onOpen(item)}><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 2H2v8h8V7M7 1h4v4M11 1 5 7" /></svg></ShelfButton>}
      <ShelfButton label={t("Показать в папке", "Show in folder")} action={() => actions.onReveal(item)}><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M1 3h4l1 1h5v6H1ZM1 3V2h4l1 1" /></svg></ShelfButton>
      {linked && item.exists && !item.isDir && actions.onSend && <ShelfButton label={t("На телефон", "To the phone")} tone="phone" action={() => actions.onSend?.(item)}><PhoneIcon size={11} /></ShelfButton>}
      <ShelfButton label={t("Убрать с полки", "Remove from the shelf")} tone="danger" action={() => actions.onRemove(item)}>×</ShelfButton>
    </div></div><div className="wi-shelf-caption"><strong>{item.name}</strong><ShelfOrigin item={item} /></div>
  </div>;
}
export function ShelfRow({ children, linked, empty }: { children?: React.ReactNode; linked?: boolean; empty?: boolean }) {
  const row = React.useRef<HTMLDivElement>(null), [overflow, setOverflow] = React.useState(false);
  React.useEffect(() => {
    const node = row.current;
    if (!node) return;
    const update = () => setOverflow(node.scrollWidth - node.scrollLeft - node.clientWidth > 4), observer = new ResizeObserver(update);
    const wheel = (event: WheelEvent) => {
      if (node.scrollWidth <= node.clientWidth) return;
      event.stopPropagation();
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) { event.preventDefault(); node.scrollLeft += event.deltaY; }
    };
    node.addEventListener("wheel", wheel, { passive: false });
    observer.observe(node); for (const item of node.children) observer.observe(item); update();
    return () => { observer.disconnect(); node.removeEventListener("wheel", wheel); };
  }, [children]);
  return <div className="wi-shelf-row-wrap" data-shelf-empty={empty}>
    <div className="wi-shelf-line" aria-hidden="true" />
    {empty ? <div className="wi-shelf-empty"><FileSymbol /><strong>{t("Полка пуста", "The shelf is empty")}</strong><p>{t("Брось файлы на остров — они встанут сюда и подождут, пока ты не перетащишь их в нужное окно.", "Drop files onto the island. They will stay here until you drag them into the right window.")}</p></div>
      : <div ref={row} className="wi-shelf-row" data-overflow={overflow} onScroll={() => { const node = row.current; if (node) setOverflow(node.scrollWidth - node.scrollLeft - node.clientWidth > 4); }}>{children}</div>}
    {!empty && <p className="wi-shelf-hint">{linked ? t("Тяни файл в любое окно или на остров, в зону «На телефон»", "Drag a file into any window, or onto To the phone") : t("Тяни файл в любое окно · двойной клик — открыть", "Drag a file into any window · double-click to open")}</p>}
  </div>;
}
