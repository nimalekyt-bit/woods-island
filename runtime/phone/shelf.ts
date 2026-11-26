export interface ShelfItem {
  id: string | number;
  name: string;
  path: string;
  icon?: string | null;
  size?: number;
  isDir?: boolean;
  exists: boolean;
  fromPhone?: boolean;
  added?: number | null;
  preview?: boolean;
}
export interface ShelfLook {
  kind: "photo" | "video" | "card" | "icon";
  ext: string;
  color?: string;
}
const documents: [RegExp, string][] = [
  [/\.pdf$/i, "#e5484d"],
  [/\.(docx?|rtf|odt)$/i, "#3e63dd"],
  [/\.(xlsx?|xlsm|csv|ods)$/i, "#2f9e5b"],
  [/\.(pptx?|odp|key)$/i, "#f76b15"],
  [/\.(zip|rar|7z|tar|gz|tgz|bz2|xz)$/i, "#777d8b"],
  [/\.(mp3|m4a|wav|flac|ogg|aac|opus|wma)$/i, "#a78a51"],
  [/\.(txt|md|log|json|xml|ya?ml|ini)$/i, "#596578"],
];
export function shelfLook(item: Pick<ShelfItem, "name" | "icon" | "isDir">): ShelfLook {
  const dot = item.name.lastIndexOf("."),
    ext = dot > 0 ? item.name.slice(dot + 1).toUpperCase().slice(0, 4) : "";
  if (item.isDir) return { kind: "icon", ext: "" };
  if (/\.(png|jpe?g|jfif|gif|webp|bmp|heic|heif|avif|tiff?)$/i.test(item.name) && item.icon)
    return { kind: "photo", ext };
  if (/\.(mp4|mov|mkv|avi|webm|wmv|m4v|3gp)$/i.test(item.name)) return { kind: "video", ext };
  for (const [pattern, color] of documents)
    if (pattern.test(item.name)) return { kind: "card", ext, color };
  return { kind: "icon", ext };
}
export function shelfTilt(id: string | number): number {
  const hash = Array.from(String(id)).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
  return ((hash % 9) - 4) * 0.6;
}
export function shelfPhotoShape(width: number, height: number, preview = false): "wide" | "tall" | "square" | null {
  if (width <= 0 || height <= 0 || (!preview && width <= 64 && height <= 64)) return null;
  const ratio = width / height;
  return ratio > 1.15 ? "wide" : ratio < 0.87 ? "tall" : "square";
}
