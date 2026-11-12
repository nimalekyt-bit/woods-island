// Compatibility application source; migrate components incrementally.
import { A as e, L as t, M as n, N as r, P as i, R as a, j as o, n as s } from "./shared.js";
import { t as c } from "./image.js";
var l = class {
    constructor(...e) {
      ((this.type = `Logical`),
        e.length === 1
          ? `Logical` in e[0]
            ? ((this.width = e[0].Logical.width), (this.height = e[0].Logical.height))
            : ((this.width = e[0].width), (this.height = e[0].height))
          : ((this.width = e[0]), (this.height = e[1])));
    }
    toPhysical(e) {
      return new u(this.width * e, this.height * e);
    }
    [t]() {
      return { width: this.width, height: this.height };
    }
    toJSON() {
      return this[t]();
    }
  },
  u = class {
    constructor(...e) {
      ((this.type = `Physical`),
        e.length === 1
          ? `Physical` in e[0]
            ? ((this.width = e[0].Physical.width), (this.height = e[0].Physical.height))
            : ((this.width = e[0].width), (this.height = e[0].height))
          : ((this.width = e[0]), (this.height = e[1])));
    }
    toLogical(e) {
      return new l(this.width / e, this.height / e);
    }
    [t]() {
      return { width: this.width, height: this.height };
    }
    toJSON() {
      return this[t]();
    }
  },
  d = class {
    constructor(e) {
      this.size = e;
    }
    toLogical(e) {
      return this.size instanceof l ? this.size : this.size.toLogical(e);
    }
    toPhysical(e) {
      return this.size instanceof u ? this.size : this.size.toPhysical(e);
    }
    [t]() {
      return { [`${this.size.type}`]: { width: this.size.width, height: this.size.height } };
    }
    toJSON() {
      return this[t]();
    }
  },
  f = class {
    constructor(...e) {
      ((this.type = `Logical`),
        e.length === 1
          ? `Logical` in e[0]
            ? ((this.x = e[0].Logical.x), (this.y = e[0].Logical.y))
            : ((this.x = e[0].x), (this.y = e[0].y))
          : ((this.x = e[0]), (this.y = e[1])));
    }
    toPhysical(e) {
      return new p(this.x * e, this.y * e);
    }
    [t]() {
      return { x: this.x, y: this.y };
    }
    toJSON() {
      return this[t]();
    }
  },
  p = class {
    constructor(...e) {
      ((this.type = `Physical`),
        e.length === 1
          ? `Physical` in e[0]
            ? ((this.x = e[0].Physical.x), (this.y = e[0].Physical.y))
            : ((this.x = e[0].x), (this.y = e[0].y))
          : ((this.x = e[0]), (this.y = e[1])));
    }
    toLogical(e) {
      return new f(this.x / e, this.y / e);
    }
    [t]() {
      return { x: this.x, y: this.y };
    }
    toJSON() {
      return this[t]();
    }
  },
  m = class {
    constructor(e) {
      this.position = e;
    }
    toLogical(e) {
      return this.position instanceof f ? this.position : this.position.toLogical(e);
    }
    toPhysical(e) {
      return this.position instanceof p ? this.position : this.position.toPhysical(e);
    }
    [t]() {
      return { [`${this.position.type}`]: { x: this.position.x, y: this.position.y } };
    }
    toJSON() {
      return this[t]();
    }
  },
  h;
(function (e) {
  ((e[(e.Critical = 1)] = `Critical`), (e[(e.Informational = 2)] = `Informational`));
})((h ||= {}));
var g = class {
    constructor(e) {
      ((this._preventDefault = !1), (this.event = e.event), (this.id = e.id));
    }
    preventDefault() {
      this._preventDefault = !0;
    }
    isPreventDefault() {
      return this._preventDefault;
    }
  },
  _;
(function (e) {
  ((e.None = `none`),
    (e.Normal = `normal`),
    (e.Indeterminate = `indeterminate`),
    (e.Paused = `paused`),
    (e.Error = `error`));
})((_ ||= {}));
function v() {
  return new x(window.__TAURI_INTERNALS__.metadata.currentWindow.label, { skip: !0 });
}
async function y() {
  return a(`plugin:window|get_all_windows`).then((e) => e.map((e) => new x(e, { skip: !0 })));
}
var b = [`tauri://created`, `tauri://error`],
  x = class {
    constructor(e, t = {}) {
      ((this.label = e),
        (this.listeners = Object.create(null)),
        t?.skip ||
          a(`plugin:window|create`, {
            options: { ...t, parent: typeof t.parent == `string` ? t.parent : t.parent?.label, label: e },
          })
            .then(async () => this.emit(`tauri://created`))
            .catch(async (e) => this.emit(`tauri://error`, e)));
    }
    static async getByLabel(e) {
      return (await y()).find((t) => t.label === e) ?? null;
    }
    static getCurrent() {
      return v();
    }
    static async getAll() {
      return y();
    }
    static async getFocusedWindow() {
      for (let e of await y()) if (await e.isFocused()) return e;
      return null;
    }
    async listen(e, t) {
      return this._handleTauriEvent(e, t)
        ? () => {
            let n = this.listeners[e];
            n.splice(n.indexOf(t), 1);
          }
        : r(e, t, { target: { kind: `Window`, label: this.label } });
    }
    async once(e, t) {
      return this._handleTauriEvent(e, t)
        ? () => {
            let n = this.listeners[e];
            n.splice(n.indexOf(t), 1);
          }
        : i(e, t, { target: { kind: `Window`, label: this.label } });
    }
    async emit(e, t) {
      if (b.includes(e)) {
        for (let n of this.listeners[e] || []) n({ event: e, id: -1, payload: t });
        return;
      }
      return o(e, t);
    }
    async emitTo(e, t, r) {
      if (b.includes(t)) {
        for (let e of this.listeners[t] || []) e({ event: t, id: -1, payload: r });
        return;
      }
      return n(e, t, r);
    }
    _handleTauriEvent(e, t) {
      return b.includes(e)
        ? (e in this.listeners ? this.listeners[e].push(t) : (this.listeners[e] = [t]), !0)
        : !1;
    }
    async scaleFactor() {
      return a(`plugin:window|scale_factor`, { label: this.label });
    }
    async innerPosition() {
      return a(`plugin:window|inner_position`, { label: this.label }).then((e) => new p(e));
    }
    async outerPosition() {
      return a(`plugin:window|outer_position`, { label: this.label }).then((e) => new p(e));
    }
    async innerSize() {
      return a(`plugin:window|inner_size`, { label: this.label }).then((e) => new u(e));
    }
    async outerSize() {
      return a(`plugin:window|outer_size`, { label: this.label }).then((e) => new u(e));
    }
    async isFullscreen() {
      return a(`plugin:window|is_fullscreen`, { label: this.label });
    }
    async isMinimized() {
      return a(`plugin:window|is_minimized`, { label: this.label });
    }
    async isMaximized() {
      return a(`plugin:window|is_maximized`, { label: this.label });
    }
    async isFocused() {
      return a(`plugin:window|is_focused`, { label: this.label });
    }
    async isDecorated() {
      return a(`plugin:window|is_decorated`, { label: this.label });
    }
    async isResizable() {
      return a(`plugin:window|is_resizable`, { label: this.label });
    }
    async isMaximizable() {
      return a(`plugin:window|is_maximizable`, { label: this.label });
    }
    async isMinimizable() {
      return a(`plugin:window|is_minimizable`, { label: this.label });
    }
    async isClosable() {
      return a(`plugin:window|is_closable`, { label: this.label });
    }
    async isVisible() {
      return a(`plugin:window|is_visible`, { label: this.label });
    }
    async title() {
      return a(`plugin:window|title`, { label: this.label });
    }
    async theme() {
      return a(`plugin:window|theme`, { label: this.label });
    }
    async isAlwaysOnTop() {
      return a(`plugin:window|is_always_on_top`, { label: this.label });
    }
    async activityName() {
      return a(`plugin:window|activity_name`, { label: this.label });
    }
    async sceneIdentifier() {
      return a(`plugin:window|scene_identifier`, { label: this.label });
    }
    async center() {
      return a(`plugin:window|center`, { label: this.label });
    }
    async requestUserAttention(e) {
      let t = null;
      return (
        e && (t = e === h.Critical ? { type: `Critical` } : { type: `Informational` }),
        a(`plugin:window|request_user_attention`, { label: this.label, value: t })
      );
    }
    async setResizable(e) {
      return a(`plugin:window|set_resizable`, { label: this.label, value: e });
    }
    async setEnabled(e) {
      return a(`plugin:window|set_enabled`, { label: this.label, value: e });
    }
    async isEnabled() {
      return a(`plugin:window|is_enabled`, { label: this.label });
    }
    async setMaximizable(e) {
      return a(`plugin:window|set_maximizable`, { label: this.label, value: e });
    }
    async setMinimizable(e) {
      return a(`plugin:window|set_minimizable`, { label: this.label, value: e });
    }
    async setClosable(e) {
      return a(`plugin:window|set_closable`, { label: this.label, value: e });
    }
    async setTitle(e) {
      return a(`plugin:window|set_title`, { label: this.label, value: e });
    }
    async maximize() {
      return a(`plugin:window|maximize`, { label: this.label });
    }
    async unmaximize() {
      return a(`plugin:window|unmaximize`, { label: this.label });
    }
    async toggleMaximize() {
      return a(`plugin:window|toggle_maximize`, { label: this.label });
    }
    async minimize() {
      return a(`plugin:window|minimize`, { label: this.label });
    }
    async unminimize() {
      return a(`plugin:window|unminimize`, { label: this.label });
    }
    async show() {
      return a(`plugin:window|show`, { label: this.label });
    }
    async hide() {
      return a(`plugin:window|hide`, { label: this.label });
    }
    async close() {
      return a(`plugin:window|close`, { label: this.label });
    }
    async destroy() {
      return a(`plugin:window|destroy`, { label: this.label });
    }
    async setDecorations(e) {
      return a(`plugin:window|set_decorations`, { label: this.label, value: e });
    }
    async setShadow(e) {
      return a(`plugin:window|set_shadow`, { label: this.label, value: e });
    }
    async setEffects(e) {
      return a(`plugin:window|set_effects`, { label: this.label, value: e });
    }
    async clearEffects() {
      return a(`plugin:window|set_effects`, { label: this.label, value: null });
    }
    async setAlwaysOnTop(e) {
      return a(`plugin:window|set_always_on_top`, { label: this.label, value: e });
    }
    async setAlwaysOnBottom(e) {
      return a(`plugin:window|set_always_on_bottom`, { label: this.label, value: e });
    }
    async setContentProtected(e) {
      return a(`plugin:window|set_content_protected`, { label: this.label, value: e });
    }
    async setSize(e) {
      return a(`plugin:window|set_size`, { label: this.label, value: e instanceof d ? e : new d(e) });
    }
    async setMinSize(e) {
      return a(`plugin:window|set_min_size`, {
        label: this.label,
        value: e instanceof d ? e : e ? new d(e) : null,
      });
    }
    async setMaxSize(e) {
      return a(`plugin:window|set_max_size`, {
        label: this.label,
        value: e instanceof d ? e : e ? new d(e) : null,
      });
    }
    async setSizeConstraints(e) {
      function t(e) {
        return e ? { Logical: e } : null;
      }
      return a(`plugin:window|set_size_constraints`, {
        label: this.label,
        value: {
          minWidth: t(e?.minWidth),
          minHeight: t(e?.minHeight),
          maxWidth: t(e?.maxWidth),
          maxHeight: t(e?.maxHeight),
        },
      });
    }
    async setPosition(e) {
      return a(`plugin:window|set_position`, { label: this.label, value: e instanceof m ? e : new m(e) });
    }
    async setFullscreen(e) {
      return a(`plugin:window|set_fullscreen`, { label: this.label, value: e });
    }
    async setFullscreenOnMonitor(e) {
      return a(`plugin:window|set_fullscreen_on_monitor`, { label: this.label, value: e });
    }
    async setSimpleFullscreen(e) {
      return a(`plugin:window|set_simple_fullscreen`, { label: this.label, value: e });
    }
    async setFocus() {
      return a(`plugin:window|set_focus`, { label: this.label });
    }
    async setFocusable(e) {
      return a(`plugin:window|set_focusable`, { label: this.label, value: e });
    }
    async setIcon(e) {
      return a(`plugin:window|set_icon`, { label: this.label, value: c(e) });
    }
    async setSkipTaskbar(e) {
      return a(`plugin:window|set_skip_taskbar`, { label: this.label, value: e });
    }
    async setCursorGrab(e) {
      return a(`plugin:window|set_cursor_grab`, { label: this.label, value: e });
    }
    async setCursorVisible(e) {
      return a(`plugin:window|set_cursor_visible`, { label: this.label, value: e });
    }
    async setCursorIcon(e) {
      return a(`plugin:window|set_cursor_icon`, { label: this.label, value: e });
    }
    async setBackgroundColor(e) {
      return a(`plugin:window|set_background_color`, { label: this.label, value: e });
    }
    async setCursorPosition(e) {
      return a(`plugin:window|set_cursor_position`, {
        label: this.label,
        value: e instanceof m ? e : new m(e),
      });
    }
    async setIgnoreCursorEvents(e) {
      return a(`plugin:window|set_ignore_cursor_events`, { label: this.label, value: e });
    }
    async startDragging() {
      return a(`plugin:window|start_dragging`, { label: this.label });
    }
    async startResizeDragging(e) {
      return a(`plugin:window|start_resize_dragging`, { label: this.label, value: e });
    }
    async setBadgeCount(e) {
      return a(`plugin:window|set_badge_count`, { label: this.label, value: e });
    }
    async setBadgeLabel(e) {
      return a(`plugin:window|set_badge_label`, { label: this.label, value: e });
    }
    async setOverlayIcon(e) {
      return a(`plugin:window|set_overlay_icon`, { label: this.label, value: e ? c(e) : void 0 });
    }
    async setProgressBar(e) {
      return a(`plugin:window|set_progress_bar`, { label: this.label, value: e });
    }
    async setVisibleOnAllWorkspaces(e) {
      return a(`plugin:window|set_visible_on_all_workspaces`, { label: this.label, value: e });
    }
    async setTitleBarStyle(e) {
      return a(`plugin:window|set_title_bar_style`, { label: this.label, value: e });
    }
    async setTheme(e) {
      return a(`plugin:window|set_theme`, { label: this.label, value: e });
    }
    async onResized(t) {
      return this.listen(e.WINDOW_RESIZED, (e) => {
        ((e.payload = new u(e.payload)), t(e));
      });
    }
    async onMoved(t) {
      return this.listen(e.WINDOW_MOVED, (e) => {
        ((e.payload = new p(e.payload)), t(e));
      });
    }
    async onCloseRequested(t) {
      return this.listen(e.WINDOW_CLOSE_REQUESTED, async (e) => {
        let n = new g(e);
        (await t(n), n.isPreventDefault() || (await this.destroy()));
      });
    }
    async onDragDropEvent(t) {
      let n = await this.listen(e.DRAG_ENTER, (e) => {
          t({
            ...e,
            payload: { type: `enter`, paths: e.payload.paths, position: new p(e.payload.position) },
          });
        }),
        r = await this.listen(e.DRAG_OVER, (e) => {
          t({ ...e, payload: { type: `over`, position: new p(e.payload.position) } });
        }),
        i = await this.listen(e.DRAG_DROP, (e) => {
          t({ ...e, payload: { type: `drop`, paths: e.payload.paths, position: new p(e.payload.position) } });
        }),
        a = await this.listen(e.DRAG_LEAVE, (e) => {
          t({ ...e, payload: { type: `leave` } });
        });
      return () => {
        (n(), i(), r(), a());
      };
    }
    async onFocusChanged(t) {
      let n = await this.listen(e.WINDOW_FOCUS, (e) => {
          t({ ...e, payload: !0 });
        }),
        r = await this.listen(e.WINDOW_BLUR, (e) => {
          t({ ...e, payload: !1 });
        });
      return () => {
        (n(), r());
      };
    }
    async onScaleChanged(t) {
      return this.listen(e.WINDOW_SCALE_FACTOR_CHANGED, t);
    }
    async onThemeChanged(t) {
      return this.listen(e.WINDOW_THEME_CHANGED, t);
    }
  },
  S;
(function (e) {
  ((e.Disabled = `disabled`), (e.Throttle = `throttle`), (e.Suspend = `suspend`));
})((S ||= {}));
var C;
(function (e) {
  ((e.Default = `default`), (e.FluentOverlay = `fluentOverlay`));
})((C ||= {}));
var w;
(function (e) {
  ((e.AppearanceBased = `appearanceBased`),
    (e.Light = `light`),
    (e.Dark = `dark`),
    (e.MediumLight = `mediumLight`),
    (e.UltraDark = `ultraDark`),
    (e.Titlebar = `titlebar`),
    (e.Selection = `selection`),
    (e.Menu = `menu`),
    (e.Popover = `popover`),
    (e.Sidebar = `sidebar`),
    (e.HeaderView = `headerView`),
    (e.Sheet = `sheet`),
    (e.WindowBackground = `windowBackground`),
    (e.HudWindow = `hudWindow`),
    (e.FullScreenUI = `fullScreenUI`),
    (e.Tooltip = `tooltip`),
    (e.ContentBackground = `contentBackground`),
    (e.UnderWindowBackground = `underWindowBackground`),
    (e.UnderPageBackground = `underPageBackground`),
    (e.LiquidGlassRegular = `liquidGlassRegular`),
    (e.LiquidGlassClear = `liquidGlassClear`),
    (e.Mica = `mica`),
    (e.Blur = `blur`),
    (e.Acrylic = `acrylic`),
    (e.Tabbed = `tabbed`),
    (e.TabbedDark = `tabbedDark`),
    (e.TabbedLight = `tabbedLight`));
})((w ||= {}));
var T;
(function (e) {
  ((e.FollowsWindowActiveState = `followsWindowActiveState`),
    (e.Active = `active`),
    (e.Inactive = `inactive`));
})((T ||= {}));
var E = {
  name: `copy`,
  size: 24,
  node: [
    [`rect`, { width: `14`, height: `14`, x: `8`, y: `8`, rx: `2`, ry: `2`, key: `17jyea` }],
    [`path`, { d: `M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2`, key: `zix9uf` }],
  ],
};
E.node;
var D = s(E);
export { u as a, p as i, x as n, m as o, v as r, d as s, D as t };
