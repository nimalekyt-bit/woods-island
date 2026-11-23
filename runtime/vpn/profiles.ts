export interface VpnProfile {
  id: string;
  name: string;
  ready: boolean;
  on: boolean | null;
  onSource: string;
  launchPath: string | null;
  lastRequestedOn: boolean | null;
}

export function vpnProfiles(value: unknown): VpnProfile[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const profiles: VpnProfile[] = [];
  for (const item of value.slice(0, 128)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const profile = item as Record<string, unknown>;
    const id = typeof profile.id === "string" ? profile.id : "";
    const name = typeof profile.name === "string" ? profile.name.trim() : "";
    if (
      !/^(app|service|ras):[^\u0000\r\n]{1,512}$/.test(id) ||
      seen.has(id) ||
      !name ||
      name.length > 256
    )
      continue;
    seen.add(id);
    profiles.push({
      id,
      name,
      ready: profile.ready === true,
      on: typeof profile.on === "boolean" ? profile.on : null,
      onSource: typeof profile.onSource === "string" ? profile.onSource : "",
      launchPath:
        typeof profile.launchPath === "string" &&
        profile.launchPath.length <= 32768 &&
        !profile.launchPath.includes("\0")
          ? profile.launchPath
          : null,
      lastRequestedOn:
        typeof profile.lastRequestedOn === "boolean"
          ? profile.lastRequestedOn
          : null,
    });
  }
  return profiles;
}

export function vpnPickAction(profile: VpnProfile): boolean | null {
  // Unknown state needs explicit Connect/Disconnect, not a guessed toggle.
  return profile.ready && profile.on !== null ? !profile.on : null;
}

const errors: Record<string, [string, string]> = {
  "A VPN action is already running": [
    "Переключение VPN уже идёт",
    "A VPN switch is already running",
  ],
  "VPN is disabled in Woods Island settings": [
    "VPN выключен в настройках Woods Island",
    "VPN is disabled in Woods Island settings",
  ],
  "VPN profile is unavailable": [
    "Это подключение VPN больше недоступно",
    "This VPN connection is no longer available",
  ],
  "Open this VPN client to manage its connection": [
    "Открой VPN-клиент для управления подключением",
    "Open the VPN client to manage its connection",
  ],
  "Disconnect the active VPN in its client before switching": [
    "Сначала отключи действующий VPN в его клиенте",
    "Disconnect the active VPN in its client first",
  ],
  "Custom VPN settings changed while its command ran": [
    "Настройки VPN изменились во время выполнения команды",
    "VPN settings changed while the command ran",
  ],
  "The custom VPN is still connected after its disconnect command": [
    "Команда выполнена, но VPN всё ещё подключён. Проверь его клиент",
    "The command completed but the VPN is still connected. Check its client",
  ],
  "VPN connection command timed out": [
    "Команда VPN не завершилась вовремя",
    "The VPN command timed out",
  ],
  "VPN client did not confirm the requested connection state": [
    "VPN-клиент не подтвердил изменение подключения",
    "The VPN client did not confirm the connection change",
  ],
  "VPN connection command failed. Check the client or Windows VPN settings.": [
    "Команда VPN завершилась с ошибкой. Проверь клиент или параметры VPN Windows",
    "The VPN command failed. Check the client or Windows VPN settings",
  ],
};
export function vpnErrorMessage(
  reason: unknown,
  language: "ru" | "en",
): string {
  const text = String(reason).replace(/^Error:\s*/, "");
  return errors[text]?.[language === "en" ? 1 : 0] || text;
}
