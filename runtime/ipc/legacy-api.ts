import { invoke as T } from "./client";
import type { Commands, AgentAnswers } from "./client";
import type { RustCommands, JsonValue, Settings } from "./generated";
let Se = 0;
export const api: {
  bootstrap: () => Promise<Commands["bootstrap"]["result"]>;
  reportRect: (
    e: number,
    t: number,
    n: number,
    r: number,
    i: boolean,
    a?: boolean,
    o?: boolean,
    attachmentRight?: number,
    attachmentBottom?: number,
  ) => Promise<Commands["report_island_rect"]["result"]>;
  uploadImage: (e: string | null) => Promise<Commands["upload_image"]["result"]>;
  throughToggle: () => Promise<Commands["through_toggle"]["result"]>;
  themeFlip: () => Promise<Commands["theme_flip"]["result"]>;
  ocrFile: (e: string | null) => Promise<Commands["ocr_file"]["result"]>;
  webAiOpen: (e: string | null) => Promise<Commands["web_ai_open"]["result"]>;
  webAiEmbed: (
    e: string | null,
    t: Pick<RustCommands["web_ai_embed"]["args"], "x" | "y" | "width" | "height">,
    n?: boolean | null,
  ) => Promise<Commands["web_ai_embed"]["result"]>;
  webAiHide: () => Promise<Commands["web_ai_hide"]["result"]>;
  webAiBrowser: (e: string | null) => Promise<Commands["web_ai_browser"]["result"]>;
  webAiWindow: (e: string | null) => Promise<Commands["web_ai_window"]["result"]>;
  webAiWindowShow: () => Promise<Commands["web_ai_window_show"]["result"]>;
  webAiWindowClose: () => Promise<Commands["web_ai_window_close"]["result"]>;
  webAiPopped: () => Promise<Commands["web_ai_popped"]["result"]>;
  islandTall: (e: boolean | null) => Promise<Commands["island_tall"]["result"]>;
  playerVolume: () => Promise<Commands["player_volume"]["result"]>;
  playerVolumeSet: (e: number | null, t?: boolean | null) => Promise<Commands["player_volume_set"]["result"]>;
  vpnToggle: () => Promise<Commands["vpn_toggle_now"]["result"]>;
  vpnChip: () => Promise<Commands["vpn_chip"]["result"]>;
  launcherList: () => Promise<Commands["launcher_list"]["result"]>;
  launcherHotkeysGet: () => Promise<Commands["launcher_hotkeys_get"]["result"]>;
  launcherHotkeysSet: (e: string | null) => Promise<Commands["launcher_hotkeys_set"]["result"]>;
  reportPageScale: (e: number | null) => Promise<Commands["report_page_scale"]["result"]>;
  takeFocus: () => Promise<Commands["take_focus"]["result"]>;
  releaseFocus: () => Promise<Commands["release_focus"]["result"]>;
  clipList: (e: string | null) => Promise<Commands["clip_list"]["result"]>;
  clipPaste: (e: number, t: boolean | null) => Promise<Commands["clip_paste"]["result"]>;
  clipPin: (e: number, t: boolean | null) => Promise<Commands["clip_pin"]["result"]>;
  clipDelete: (e: number) => Promise<Commands["clip_delete"]["result"]>;
  clipClear: () => Promise<Commands["clip_clear"]["result"]>;
  clipCurrentText: () => Promise<Commands["clip_current_text"]["result"]>;
  clipSetText: (e: string | null) => Promise<Commands["clip_set_text"]["result"]>;
  clipSetPng: (e: string | null) => Promise<Commands["clip_set_png"]["result"]>;
  mediaControl: (e: string | null, t: boolean | null) => Promise<Commands["media_control"]["result"]>;
  mediaSeek: (e: number | null) => Promise<Commands["media_seek"]["result"]>;
  lyricsGet: (
    e: string | null,
    t: string | null,
    n: string | null,
    r: number | null,
  ) => Promise<Commands["lyrics_get"]["result"]>;
  restartIsland: () => Promise<Commands["restart_island"]["result"]>;
  mediaSources: () => Promise<Commands["media_sources"]["result"]>;
  mediaPick: (e: string | null) => Promise<Commands["media_pick"]["result"]>;
  mediaRename: (e: string | null, t: string | null) => Promise<Commands["media_rename"]["result"]>;
  captureStart: (e: string | null) => Promise<Commands["capture_start"]["result"]>;
  captureRegion: (
    e: number | null,
    t: number | null,
    n: number | null,
    r: number | null,
    i: string | null,
  ) => Promise<Commands["capture_region"]["result"]>;
  captureRegionDrawn: (
    e: number | null,
    t: number | null,
    n: number | null,
    r: number | null,
    i: string | null,
  ) => Promise<Commands["capture_region_drawn"]["result"]>;
  pickerSize: () => Promise<Commands["picker_size"]["result"]>;
  captureCancel: () => Promise<Commands["capture_cancel"]["result"]>;
  shelfList: () => Promise<Commands["shelf_list"]["result"]>;
  shelfAdd: (e: Array<string> | null) => Promise<Commands["shelf_add"]["result"]>;
  shelfRemove: (e: string | null) => Promise<Commands["shelf_remove"]["result"]>;
  shelfClear: () => Promise<Commands["shelf_clear"]["result"]>;
  launcherAdd: (e: Array<string> | null) => Promise<Commands["launcher_add"]["result"]>;
  launcherRemove: (e: string | null) => Promise<Commands["launcher_remove"]["result"]>;
  launcherLaunch: (e: string | null) => Promise<Commands["launcher_launch"]["result"]>;
  launcherAddLink: (
    e: string | null,
    t: string | null,
    n: JsonValue | null,
  ) => Promise<Commands["launcher_add_link"]["result"]>;
  launcherEditLink: (
    e: string | null,
    t: string | null,
    n: string | null,
    r: JsonValue | null,
  ) => Promise<Commands["launcher_edit_link"]["result"]>;
  launcherLinkIcon: (e: string | null) => Promise<Commands["launcher_link_icon"]["result"]>;
  launcherPickIcon: () => Promise<Commands["launcher_pick_icon"]["result"]>;
  launcherGroupsGet: () => Promise<Commands["launcher_groups_get"]["result"]>;
  launcherGroupsSet: (e: string | null) => Promise<Commands["launcher_groups_set"]["result"]>;
  openPath: (
    e: string | null,
    t?: boolean | null,
    n?: boolean | null,
  ) => Promise<Commands["open_path"]["result"]>;
  runShell: (e: string | null, t: string | null) => Promise<Commands["run_shell"]["result"]>;
  prtscTaken: () => Promise<Commands["prtsc_taken"]["result"]>;
  obsState: () => Promise<Commands["obs_state"]["result"]>;
  obsPasswordSet: (e: string | null) => Promise<Commands["obs_password_set"]["result"]>;
  obsPasswordStatus: () => Promise<Commands["obs_password_status"]["result"]>;
  runsAsAdmin: () => Promise<Commands["runs_as_admin"]["result"]>;
  openCaptures: (e: string | null) => Promise<Commands["open_captures"]["result"]>;
  settingsGet: () => Promise<Commands["settings_get"]["result"]>;
  monitorsList: () => Promise<Commands["monitors_list"]["result"]>;
  btDevices: () => Promise<Commands["bt_devices"]["result"]>;
  wifiNetworks: () => Promise<Commands["wifi_networks"]["result"]>;
  wifiJoin: (e: string | null, t: string | null) => Promise<Commands["wifi_join"]["result"]>;
  wifiLeave: () => Promise<Commands["wifi_leave"]["result"]>;
  agentsNow: () => Promise<Commands["agents_now"]["result"]>;
  agentsConnections: () => Promise<Commands["agents_connections"]["result"]>;
  agentsConnect: (
    e: string | null,
    t: boolean | null,
    n?: boolean | null,
  ) => Promise<Commands["agents_connect"]["result"]>;
  agentsAnswer: (
    e: string,
    t: "answer" | "allow" | "deny" | "terminal",
    n?: AgentAnswers | null,
  ) => Promise<Commands["agents_answer"]["result"]>;
  btSwitch: (e: string | null, t: boolean | null) => Promise<Commands["bt_switch"]["result"]>;
  settingsSet: (e: Partial<Settings>) => Promise<Commands["settings_set"]["result"]>;
  hotkeysCheck: () => Promise<Commands["hotkeys_check"]["result"]>;
  openSettings: (e: string | null) => Promise<Commands["open_settings"]["result"]>;
  settingsTarget: () => Promise<Commands["settings_target"]["result"]>;
  newsGet: () => Promise<Commands["news_get"]["result"]>;
  notificationsAccess: () => Promise<Commands["notifications_access"]["result"]>;
  notificationsRequest: () => Promise<Commands["notifications_request"]["result"]>;
  filesSearch: (e: string | null) => Promise<Commands["files_search"]["result"]>;
  filesWarm: () => Promise<Commands["files_warm"]["result"]>;
  filesHeld: () => Promise<Commands["files_held"]["result"]>;
  newsTold: () => Promise<Commands["news_told"]["result"]>;
  setIslandHidden: (e: boolean | null) => Promise<Commands["set_island_hidden"]["result"]>;
  quit: () => Promise<Commands["quit"]["result"]>;
  volumeSet: (e: number | null) => Promise<Commands["volume_set"]["result"]>;
  volumeStep: (e: number | null) => Promise<Commands["volume_step"]["result"]>;
  volumeMuteToggle: () => Promise<Commands["volume_mute_toggle"]["result"]>;
  micToggle: () => Promise<Commands["mic_toggle"]["result"]>;
  audioDevices: () => Promise<Commands["audio_devices"]["result"]>;
  audioInputs: () => Promise<Commands["audio_inputs"]["result"]>;
  audioSetDefault: (e: string | null) => Promise<Commands["audio_set_default"]["result"]>;
  vpnRefresh: () => Promise<Commands["vpn_refresh"]["result"]>;
  colorPatch: (
    e: number | null,
    t: number | null,
    n: number | null,
  ) => Promise<Commands["color_patch"]["result"]>;
  colorPick: (e: number | null, t: number | null) => Promise<Commands["color_pick"]["result"]>;
  colorHistory: () => Promise<Commands["color_history"]["result"]>;
  noteGet: () => Promise<Commands["note_get"]["result"]>;
  noteSet: (e: string | null) => Promise<Commands["note_set"]["result"]>;
  noteFoldersGet: () => Promise<Commands["note_folders_get"]["result"]>;
  noteFoldersSet: (e: string | null) => Promise<Commands["note_folders_set"]["result"]>;
  remindersGet: () => Promise<Commands["reminders_get"]["result"]>;
  remindersSet: (e: string | null) => Promise<Commands["reminders_set"]["result"]>;
  timerGet: () => Promise<Commands["timer_get"]["result"]>;
  timerSet: (e: string | null) => Promise<Commands["timer_set"]["result"]>;
  chime: () => Promise<Commands["chime"]["result"]>;
  chimeTry: (e: string | null) => Promise<Commands["chime_try"]["result"]>;
  pickSound: () => Promise<Commands["pick_sound"]["result"]>;
  updateCheck: () => Promise<Commands["update_check"]["result"]>;
  updateInstall: () => Promise<Commands["update_install"]["result"]>;
  aiRun: (e: number | null, t: string | null, n: string | null) => Promise<Commands["ai_run"]["result"]>;
  aiChat: (e: number | null, t: Array<JsonValue> | null) => Promise<Commands["ai_chat"]["result"]>;
  chatGet: () => Promise<Commands["chat_get"]["result"]>;
  chatSet: (e: string | null) => Promise<Commands["chat_set"]["result"]>;
  aiCancel: (e: number | null) => Promise<Commands["ai_cancel"]["result"]>;
  aiKeySet: (e: string | null) => Promise<Commands["ai_key_set"]["result"]>;
  aiKeyStatus: () => Promise<Commands["ai_key_status"]["result"]>;
  aiTest: () => Promise<Commands["ai_test"]["result"]>;
  aiModels: () => Promise<Commands["ai_models"]["result"]>;
  dictateToggle: (e?: string | null) => Promise<Commands["dictate_toggle"]["result"]>;
  dictateCancel: () => Promise<Commands["dictate_cancel"]["result"]>;
  sttKeySet: (e: string | null) => Promise<Commands["stt_key_set"]["result"]>;
  sttKeyStatus: () => Promise<Commands["stt_key_status"]["result"]>;
  sttTest: () => Promise<Commands["stt_test"]["result"]>;
  attachPick: () => Promise<Commands["attach_pick"]["result"]>;
  attachPaths: (e: Array<string> | null) => Promise<Commands["attach_paths"]["result"]>;
  attachData: (e: string | null, t: string | null) => Promise<Commands["attach_data"]["result"]>;
  attachmentsPrune: (e: Array<string> | null) => Promise<Commands["attachments_prune"]["result"]>;
  weatherGet: () => Promise<Commands["weather_get"]["result"]>;
  weatherRefresh: () => Promise<Commands["weather_refresh"]["result"]>;
  weatherSearch: (e: string | null) => Promise<Commands["weather_search"]["result"]>;
  licenseStatus: () => Promise<Commands["license_status"]["result"]>;
  licenseActivate: (e: string | null) => Promise<Commands["license_activate"]["result"]>;
  licenseRemove: () => Promise<Commands["license_remove"]["result"]>;
  paletteApps: () => Promise<Commands["palette_apps"]["result"]>;
  paletteRecent: () => Promise<Commands["palette_recent"]["result"]>;
  paletteIcon: (e: string | null) => Promise<Commands["palette_icon"]["result"]>;
  rates: () => Promise<Commands["rates"]["result"]>;
  controlsGet: () => Promise<Commands["controls_get"]["result"]>;
  controlsSet: (e: string | null, t: boolean | null) => Promise<Commands["controls_set"]["result"]>;
  powerAction: (e: string | null) => Promise<Commands["power_action"]["result"]>;
  powerSchedule: (e: boolean | null, t: number | null) => Promise<Commands["power_schedule"]["result"]>;
  recordStart: () => Promise<Commands["record_start"]["result"]>;
  recordStop: () => Promise<Commands["record_stop"]["result"]>;
  recordBegin: (
    e: number | null,
    t: number | null,
    n: number | null,
    r: number | null,
    i: string | null,
  ) => Promise<Commands["record_begin"]["result"]>;
  editorOpen: (e: string | null) => Promise<Commands["editor_open"]["result"]>;
  editorImage: () => Promise<Commands["editor_image"]["result"]>;
  editorSave: (e: string | null, t: boolean | null) => Promise<Commands["editor_save"]["result"]>;
} = {
  bootstrap: () => T(`bootstrap`),
  reportRect: (e, t, n, r, i, a = !1, o = !1, attachmentRight = 0, attachmentBottom = 0) =>
    T(`report_island_rect`, { x: e, y: t, w: n, h: r, expanded: i, tucked: a, through: o, attachmentRight, attachmentBottom }),
  uploadImage: (e) => T(`upload_image`, { path: e }),
  throughToggle: () => T(`through_toggle`),
  themeFlip: () => T(`theme_flip`),
  ocrFile: (e) => T(`ocr_file`, { path: e }),
  webAiOpen: (e) => T(`web_ai_open`, { service: e ?? null }),
  webAiEmbed: (e, t, n = !1) => T(`web_ai_embed`, { service: e, ...t, focus: n, word: ++Se }),
  webAiHide: () => T(`web_ai_hide`, { word: ++Se }),
  webAiBrowser: (e) => T(`web_ai_browser`, { service: e }),
  webAiWindow: (e) => T(`web_ai_window`, { service: e }),
  webAiWindowShow: () => T(`web_ai_window_show`),
  webAiWindowClose: () => T(`web_ai_window_close`),
  webAiPopped: () => T(`web_ai_popped`),
  islandTall: (e) => T(`island_tall`, { on: e }),
  playerVolume: () => T(`player_volume`),
  playerVolumeSet: (e, t = null) => T(`player_volume_set`, { level: e, mute: t }),
  vpnToggle: () => T(`vpn_toggle_now`),
  vpnChip: () => T(`vpn_chip`),
  launcherList: () => T(`launcher_list`),
  launcherHotkeysGet: () => T(`launcher_hotkeys_get`),
  launcherHotkeysSet: (e) => T(`launcher_hotkeys_set`, { json: e }),
  reportPageScale: (e) => T(`report_page_scale`, { width: e }),
  takeFocus: () => T(`take_focus`),
  releaseFocus: () => T(`release_focus`),
  clipList: (e) => T(`clip_list`, { query: e }),
  clipPaste: (e, t) => T(`clip_paste`, { id: e, paste: t }),
  clipPin: (e, t) => T(`clip_pin`, { id: e, pinned: t }),
  clipDelete: (e) => T(`clip_delete`, { id: e }),
  clipClear: () => T(`clip_clear`),
  clipCurrentText: () => T(`clip_current_text`),
  clipSetText: (e) => T(`clip_set_text`, { text: e }),
  clipSetPng: (e) => T(`clip_set_png`, { dataUrl: e }),
  mediaControl: (e, t) => T(`media_control`, { action: e, playing: t }),
  mediaSeek: (e) => T(`media_seek`, { ms: e }),
  lyricsGet: (e, t, n, r) => T(`lyrics_get`, { artist: e, title: t, album: n, durationMs: r }),
  restartIsland: () => T(`restart_island`),
  mediaSources: () => T(`media_sources`),
  mediaPick: (e) => T(`media_pick`, { id: e }),
  mediaRename: (e, t) => T(`media_rename`, { appId: e, name: t }),
  captureStart: (e) => T(`capture_start`, { mode: e }),
  captureRegion: (e, t, n, r, i) => T(`capture_region`, { x: e, y: t, w: n, h: r, mode: i }),
  captureRegionDrawn: (e, t, n, r, i) => T(`capture_region_drawn`, { x: e, y: t, w: n, h: r, drawing: i }),
  pickerSize: () => T(`picker_size`),
  captureCancel: () => T(`capture_cancel`),
  shelfList: () => T(`shelf_list`),
  shelfAdd: (e) => T(`shelf_add`, { paths: e }),
  shelfRemove: (e) => T(`shelf_remove`, { id: e }),
  shelfClear: () => T(`shelf_clear`),
  launcherAdd: (e) => T(`launcher_add`, { paths: e }),
  launcherRemove: (e) => T(`launcher_remove`, { id: e }),
  launcherLaunch: (e) => T(`launcher_launch`, { id: e }),
  launcherAddLink: (e, t, n) => T(`launcher_add_link`, { link: e, name: t, icon: n }),
  launcherEditLink: (e, t, n, r) => T(`launcher_edit_link`, { id: e, link: t, name: n, icon: r }),
  launcherLinkIcon: (e) => T(`launcher_link_icon`, { link: e }),
  launcherPickIcon: () => T(`launcher_pick_icon`),
  launcherGroupsGet: () => T(`launcher_groups_get`),
  launcherGroupsSet: (e) => T(`launcher_groups_set`, { json: e }),
  openPath: (e, t = !1, n = !1) => T(`open_path`, { path: e, reveal: t, elevated: n }),
  runShell: (e, t) => T(`run_shell`, { shell: e, command: t }),
  prtscTaken: () => T(`prtsc_taken`),
  obsState: () => T(`obs_state`),
  obsPasswordSet: (e) => T(`obs_password_set`, { password: e }),
  obsPasswordStatus: () => T(`obs_password_status`),
  runsAsAdmin: () => T(`runs_as_admin`),
  openCaptures: (e) => T(`open_captures`, { kind: e }),
  settingsGet: () => T(`settings_get`),
  monitorsList: () => T(`monitors_list`),
  btDevices: () => T(`bt_devices`),
  wifiNetworks: () => T(`wifi_networks`),
  wifiJoin: (e, t) => T(`wifi_join`, { ssid: e, password: t }),
  wifiLeave: () => T(`wifi_leave`),
  agentsNow: () => T(`agents_now`),
  agentsConnections: () => T(`agents_connections`),
  agentsConnect: (e, t, n = !1) => T(`agents_connect`, { agent: e, on: t, beside: n }),
  agentsAnswer: (e, t, n) => T(`agents_answer`, { id: e, verdict: t, answers: n ?? null }),
  btSwitch: (e, t) => T(`bt_switch`, { id: e, on: t }),
  settingsSet: (e) => T(`settings_set`, { settings: e }),
  hotkeysCheck: () => T(`hotkeys_check`),
  openSettings: (e) => T(`open_settings`, { section: e ?? null }),
  settingsTarget: () => T(`settings_target`),
  newsGet: () => T(`news_get`),
  notificationsAccess: () => T(`notifications_access`),
  notificationsRequest: () => T(`notifications_request`),
  filesSearch: (e) => T(`files_search`, { query: e }),
  filesWarm: () => T(`files_warm`),
  filesHeld: () => T(`files_held`),
  newsTold: () => T(`news_told`),
  setIslandHidden: (e) => T(`set_island_hidden`, { hidden: e }),
  quit: () => T(`quit`),
  volumeSet: (e) => T(`volume_set`, { level: e }),
  volumeStep: (e) => T(`volume_step`, { delta: e }),
  volumeMuteToggle: () => T(`volume_mute_toggle`),
  micToggle: () => T(`mic_toggle`),
  audioDevices: () => T(`audio_devices`),
  audioInputs: () => T(`audio_inputs`),
  audioSetDefault: (e) => T(`audio_set_default`, { id: e }),
  vpnRefresh: () => T(`vpn_refresh`),
  colorPatch: (e, t, n) => T(`color_patch`, { x: e, y: t, radius: n }),
  colorPick: (e, t) => T(`color_pick`, { x: e, y: t }),
  colorHistory: () => T(`color_history`),
  noteGet: () => T(`note_get`),
  noteSet: (e) => T(`note_set`, { text: e }),
  noteFoldersGet: () => T(`note_folders_get`),
  noteFoldersSet: (e) => T(`note_folders_set`, { json: e }),
  remindersGet: () => T(`reminders_get`),
  remindersSet: (e) => T(`reminders_set`, { json: e }),
  timerGet: () => T(`timer_get`),
  timerSet: (e) => T(`timer_set`, { json: e }),
  chime: () => T(`chime`),
  chimeTry: (e) => T(`chime_try`, { sound: e }),
  pickSound: () => T(`pick_sound`),
  updateCheck: () => T(`update_check`),
  updateInstall: () => T(`update_install`),
  aiRun: (e, t, n) => T(`ai_run`, { id: e, system: t, prompt: n }),
  aiChat: (e, t) => T(`ai_chat`, { id: e, messages: t }),
  chatGet: () => T(`chat_get`),
  chatSet: (e) => T(`chat_set`, { json: e }),
  aiCancel: (e) => T(`ai_cancel`, { id: e }),
  aiKeySet: (e) => T(`ai_key_set`, { key: e }),
  aiKeyStatus: () => T(`ai_key_status`),
  aiTest: () => T(`ai_test`),
  aiModels: () => T(`ai_models`),
  dictateToggle: (e = `clipboard`) => T(`dictate_toggle`, { target: e }),
  dictateCancel: () => T(`dictate_cancel`),
  sttKeySet: (e) => T(`stt_key_set`, { key: e }),
  sttKeyStatus: () => T(`stt_key_status`),
  sttTest: () => T(`stt_test`),
  attachPick: () => T(`attach_pick`),
  attachPaths: (e) => T(`attach_paths`, { paths: e }),
  attachData: (e, t) => T(`attach_data`, { name: e, data: t }),
  attachmentsPrune: (e) => T(`attachments_prune`, { keep: e }),
  weatherGet: () => T(`weather_get`),
  weatherRefresh: () => T(`weather_refresh`),
  weatherSearch: (e) => T(`weather_search`, { query: e }),
  licenseStatus: () => T(`license_status`),
  licenseActivate: (e) => T(`license_activate`, { key: e }),
  licenseRemove: () => T(`license_remove`),
  paletteApps: () => T(`palette_apps`),
  paletteRecent: () => T(`palette_recent`),
  paletteIcon: (e) => T(`palette_icon`, { path: e }),
  rates: () => T(`rates`),
  controlsGet: () => T(`controls_get`),
  controlsSet: (e, t) => T(`controls_set`, { what: e, on: t }),
  powerAction: (e) => T(`power_action`, { action: e }),
  powerSchedule: (e, t) => T(`power_schedule`, { restart: e, seconds: t }),
  recordStart: () => T(`record_start`),
  recordStop: () => T(`record_stop`),
  recordBegin: (e, t, n, r, i) => T(`record_begin`, { x: e, y: t, w: n, h: r, format: i }),
  editorOpen: (e) => T(`editor_open`, { path: e }),
  editorImage: () => T(`editor_image`),
  editorSave: (e, t) => T(`editor_save`, { dataUrl: e, copy: t }),
};
