/* Woods-owned mobile client. No external scripts, telemetry or servers. */
(() => {
  "use strict";
  const lang = navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en";
  const strings = {
    localBadge: ["Локально", "Local"],
    toComputer: ["На компьютер", "To the computer"],
    localHint: [
      "Фото, видео и файлы сразу появятся на полке Woods Island.",
      "Photos, videos and files appear right on the Woods Island shelf.",
    ],
    photos: ["Фото и видео", "Photos & video"],
    photosFiles: ["Фото и файлы", "Photos and files"],
    gallery: ["Выбрать из галереи", "Choose from gallery"],
    files: ["Файлы", "Files"],
    fileLimit: [
      "До 256 МиБ на файл · передаётся напрямую по Wi-Fi.",
      "Up to 256 MiB per file · stays on your local Wi-Fi.",
    ],
    cancel: ["Отмена", "Cancel"],
    saving: ["Сохраняем на полку…", "Saving to shelf…"],
    sentMark: ["Отправлено", "Sent"],
    textTitle: ["Текст или ссылка", "Text or a link"],
    textPlaceholder: ["Вставь ссылку или заметку…", "Paste a link or note…"],
    sendText: [
      "Отправить в буфер компьютера",
      "Send to the computer’s clipboard",
    ],
    fromComputer: ["С компьютера", "From the computer"],
    empty: [
      "Файлы появятся здесь, когда отправишь их из Woods Island.",
      "Files appear here when you send them from Woods Island.",
    ],
    footer: ["Woods Island", "Woods Island"],
    disconnect: ["Отключить", "Disconnect"],
    pending: [
      "Подтверди телефон на компьютере",
      "Approve this phone on the computer",
    ],
    pendingDetail: [
      "Открой полку Woods Island и нажми «Разрешить» у этого телефона.",
      "Open the Woods Island shelf and choose Allow for this phone.",
    ],
    connecting: ["Подключаемся…", "Connecting…"],
    reconnecting: ["Переподключаемся к ПК…", "Reconnecting to PC…"],
    reconnectingDetail: [
      "Ждём, пока Woods Island снова выйдет на связь.",
      "Waiting for Woods Island to come back online.",
    ],
    connected: ["Подключено к Woods Island", "Connected to Woods Island"],
    connectedDetail: [
      "Можно отправлять фото, файлы и текст. Сессия сохраняется при перезапуске.",
      "Ready for photos, files and text. Session stays active across restarts.",
    ],
    disconnected: ["Связь завершена", "Disconnected"],
    disconnectedDetail: [
      "На компьютере создай новый QR-код и отсканируй его.",
      "Create a new QR code on the computer and scan it.",
    ],
    expired: [
      "Код или разрешение истекли. Отсканируй новый код.",
      "The code or approval expired. Scan a new code.",
    ],
    network: [
      "Нет связи с компьютером. Проверь Wi-Fi и Woods Island.",
      "The computer is unreachable. Check Wi-Fi and Woods Island.",
    ],
    busy: [
      "Передача уже идёт. Подожди или нажми «Отмена».",
      "A transfer is running. Wait or choose Cancel.",
    ],
    canceled: ["Передача отменена.", "Transfer canceled."],
    uploadDone: ["Файл отправлен: ", "File sent: "],
    textDone: [
      "Текст в буфере компьютера.",
      "Text is on the computer’s clipboard.",
    ],
    download: ["Скачать", "Download"],
    received: ["Получен", "Received"],
    downloaded: ["Получен файл: ", "File received: "],
    invalidFile: [
      "Имя файла не подходит для Windows. Переименуй файл.",
      "This filename is not valid on Windows. Rename the file.",
    ],
    tooLarge: ["Файл больше 256 МиБ.", "The file is larger than 256 MiB."],
    disk: [
      "На компьютере недостаточно свободного места.",
      "There is not enough free space on the computer.",
    ],
    clipboard: [
      "Файл на полке; Windows не дала изменить буфер.",
      "The file is on the shelf; Windows did not allow a clipboard change.",
    ],
    clipboardText: [
      "Windows не дала изменить буфер. Попробуй ещё раз.",
      "Windows did not allow a clipboard change. Try again.",
    ],
    failed: [
      "Передача не завершилась. Попробуй ещё раз.",
      "The transfer did not finish. Try again.",
    ],
    timeout: [
      "Время ожидания истекло. Проверь Wi-Fi и попробуй ещё раз.",
      "Transfer timed out. Check Wi-Fi and try again.",
    ],
    emptyText: ["Введи текст или ссылку.", "Enter text or a link."],
    fileChanged: [
      "Файл на компьютере изменился. Отправь его заново.",
      "The file changed on the computer. Offer it again.",
    ],
    limit: [
      "Лимит этой сессии достигнут. Создай новый код на компьютере.",
      "This session’s limit was reached. Create a new code on the computer.",
    ],
    error: ["Нужно проверить связь", "Connection needs attention"],
    tabFiles: ["Файлы", "Files"],
    tabRemote: ["Пульт ПК", "PC Remote"],
    remoteNothing: ["Сейчас ничего не играет", "Nothing playing"],
    remoteIdleBadge: ["На паузе", "Paused"],
    remotePlayingBadge: ["Играет", "Playing"],
    remoteAudioTitle: ["Громкость и микрофон", "Volume & microphone"],
    remoteMute: ["Звук ПК", "PC Sound"],
    remoteMic: ["Микрофон", "Microphone"],
    remoteStateOn: ["Включён", "Active"],
    remoteStateMuted: ["Выключен", "Muted"],
    remotePowerTitle: ["Экран и питание", "Screen & power"],
    remoteShot: ["Скриншот", "Screenshot"],
    remoteLock: ["Блокировка", "Lock PC"],
    remoteSleep: ["Сон", "Sleep"],
    remoteLinkTitle: ["Открыть ссылку на ПК", "Open link on PC"],
    remoteUrlPlaceholder: ["Вставь ссылку (https://…)", "Paste link (https://…)"],
    remoteTimerTitle: ["Таймер на ПК", "PC Timer"],
    remoteTimerIdle: ["Не запущен", "Idle"],
    remoteTimerReset: ["Сбросить таймер", "Reset timer"],
    remoteSaveShot: ["Сохранить скриншот", "Save screenshot"],
    remoteHideShot: ["Скрыть", "Hide"],
    remoteOpened: ["Ссылка открыта на ПК.", "Link opened on PC."],
    remoteDone: ["Команда выполнена.", "Done."],
    remoteSleepConfirm: ["Перевести компьютер в сон?", "Put the PC to sleep?"],
    pcDisconnectedTitle: [
      "Подключение остановлено на ПК",
      "Disconnected from PC",
    ],
    pcDisconnectedDetail: [
      "Вы отключили телефон в Woods Island. Создай новый QR-код на полке и отсканируй его снова.",
      "This phone was disconnected in Woods Island. Create a new QR code on the shelf and scan it again.",
    ],
    lostConnectionTitle: [
      "Связь с ПК потеряна",
      "Connection to PC lost",
    ],
    lostConnectionDetail: [
      "Если ты отключил телефон на пилюле — отсканируй новый QR-код. Если Woods Island перезапускается — подожди или проверь связь.",
      "If you turned off phone sync on the island, scan a new QR code. If Woods Island is restarting, wait or retry.",
    ],
    retryConnection: ["Проверить", "Retry"],
  };
  const t = (key) => strings[key]?.[lang === "ru" ? 0 : 1] || key;
  const element = (id) => document.getElementById(id);
  const code = location.hash.slice(1);
  history.replaceState(null, "", location.pathname);
  document.documentElement.lang = lang;
  for (const node of document.querySelectorAll("[data-i18n]"))
    node.textContent = t(node.dataset.i18n);
  if (element("text")) element("text").placeholder = t("textPlaceholder");
  element("send-text").setAttribute("aria-label", t("sendText"));
  element("pick-options").setAttribute("aria-label", t("gallery"));
  element("pick-options").addEventListener("click", () => {
    const menu = element("gallery-menu");
    menu.hidden = !menu.hidden;
    element("pick-options").setAttribute("aria-expanded", String(!menu.hidden));
  });
  element("text").addEventListener("input", () => {
    const field = element("text");
    field.style.height = "38px";
    field.style.height = Math.min(132, field.scrollHeight) + "px";
  });

  const storageKey = "woods-phone-capability:" + location.host;
  const legacyKey = "woods-phone-capability";
  const loadTicket = () => {
    try {
      const fromLocal = localStorage.getItem(storageKey);
      if (fromLocal) return fromLocal;
    } catch {}
    try {
      return (
        sessionStorage.getItem(storageKey) ||
        sessionStorage.getItem(legacyKey) ||
        ""
      );
    } catch {
      return "";
    }
  };
  const saveTicket = (value) => {
    ticket = value;
    try {
      localStorage.setItem(storageKey, value);
    } catch {}
    try {
      sessionStorage.setItem(storageKey, value);
    } catch {}
  };
  const forget = () => {
    ticket = "";
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    try {
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem(legacyKey);
    } catch {}
  };

  let ticket = loadTicket();
  let linked = false,
    polling = false,
    upload = null,
    offerSignature = "",
    stopped = false,
    reconnecting = false,
    consecutivePollErrors = 0;
  const recentSent = [];
  const showDisconnectBanner = (titleKey, detailKey, allowRetry) => {
    const banner = element("disconnect-banner");
    if (!banner) return;
    element("disconnect-banner-title").textContent = t(titleKey);
    element("disconnect-banner-detail").textContent = t(detailKey);
    if (element("disconnect-retry")) element("disconnect-retry").hidden = !allowRetry;
    banner.hidden = false;
  };
  const hideDisconnectBanner = () => {
    const banner = element("disconnect-banner");
    if (banner) banner.hidden = true;
  };

  const bytes = (amount) =>
    amount >= 1048576
      ? (amount / 1048576).toFixed(1) + (lang === "ru" ? " МБ" : " MB")
      : amount >= 1024
        ? (amount / 1024).toFixed(1) + (lang === "ru" ? " КБ" : " KB")
        : amount + (lang === "ru" ? " Б" : " B");
  function fileTile(name) {
    const tile = document.createElement("span");
    tile.className = "file-tile";
    tile.setAttribute("aria-hidden", "true");
    const extension = name.split(".").slice(1).at(-1)?.toLowerCase() || "";
    tile.textContent = extension.toUpperCase().slice(0, 4);
    const colors = {
      pdf: "#e5484d",
      doc: "#3e63dd",
      docx: "#3e63dd",
      xlsx: "#2f9e5b",
      xls: "#2f9e5b",
      pptx: "#f76b15",
      png: "#6e56cf",
      jpg: "#6e56cf",
      jpeg: "#6e56cf",
      webp: "#6e56cf",
      zip: "#8b8d98",
      mp3: "#c27a12",
    };
    tile.style.background = colors[extension] || "#596078";
    return tile;
  }
  function waveTransfer(up) {
    if (
      document.hidden ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    document
      .querySelector(".phone-edge svg")
      .animate(
        [
          { translate: "0 0" },
          { translate: `0 ${up ? -10 : 8}px`, offset: 0.35 },
          { translate: "0 0" },
        ],
        { duration: 1100, easing: "cubic-bezier(.3,.7,.2,1)" },
      );
  }
  const speedText = (bps) =>
    bps >= 1048576
      ? (bps / 1048576).toFixed(1) + (lang === "ru" ? " МБ/с" : " MB/s")
      : bps >= 1024
        ? Math.round(bps / 1024) + (lang === "ru" ? " КБ/с" : " KB/s")
        : "";
  const message = (text, error = false) => {
    element("message").textContent = text;
    element("message").dataset.error = String(error);
  };
  const setConnected = (state) => {
    linked = state;
    element("phone-eyes").dataset.awake = String(state);
    for (const id of [
      "pick-photos",
      "pick-files",
      "pick-options",
      "text",
      "send-text",
      "disconnect",
      "remote-prev",
      "remote-play",
      "remote-next",
      "remote-mute",
      "remote-vol",
      "remote-mic",
      "remote-shot",
      "remote-lock",
      "remote-sleep",
      "remote-url",
      "remote-open-url",
      "remote-t5",
      "remote-t10",
      "remote-t15",
      "remote-t25",
      "remote-treset",
    ])
      if (element(id)) element(id).disabled = !state;
    if (!state) element("gallery-menu").hidden = true;
    document.querySelector(".connection").dataset.state = state
      ? "connected"
      : "pending";
  };
  const connection = (title, detail, state) => {
    element("connection-title").textContent = t(title);
    element("connection-detail").textContent = t(detail);
    document.querySelector(".connection").dataset.state = state;
    element("connection-detail").hidden = state === "connected";
  };
  const isRevoked = (codeValue) =>
    [
      "invalid_link",
      "pairing_expired",
      "not_approved",
      "disconnected",
    ].includes(codeValue);
  const errorMessage = (error) => {
    const key = {
      invalid_link: "expired",
      pairing_expired: "expired",
      not_approved: "expired",
      disconnected: "expired",
      invalid_filename: "invalidFile",
      file_too_large: "tooLarge",
      body_too_large: "tooLarge",
      disk_full: "disk",
      disk_unavailable: "disk",
      busy: "busy",
      session_limit: "limit",
      file_changed: "fileChanged",
      clipboard_failed: "clipboardText",
      transfer_timeout: "timeout",
      timeout: "timeout",
    }[error?.code];
    return t(key || "failed");
  };
  async function api(path, options = {}) {
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(path, {
        ...options,
        headers: {
          ...(ticket ? { Authorization: "Bearer " + ticket } : {}),
          ...options.headers,
        },
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        const error = new Error(data.error);
        error.code = data.error;
        throw error;
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }
  function renderSent() {
    const host = element("sent-list");
    if (!host) return;
    host.replaceChildren();
    host.hidden = recentSent.length === 0;
    for (const item of recentSent) {
      const row = document.createElement("div");
      row.className = "sent-item";
      const name = document.createElement("strong");
      const meta = document.createElement("span");
      name.textContent = item.name;
      meta.textContent = "✓ " + bytes(item.size);
      row.append(fileTile(item.name), name, meta);
      host.append(row);
    }
  }
  function renderOffers(files) {
    const signature = JSON.stringify(files);
    if (signature === offerSignature) return;
    offerSignature = signature;
    const list = element("offered");
    list.replaceChildren();
    element("files-empty").hidden = files.length > 0;
    for (const file of files) {
      const row = document.createElement("div");
      row.className = "offered-file";
      const info = document.createElement("div"),
        name = document.createElement("strong"),
        detail = document.createElement("span"),
        button = document.createElement("button");
      name.textContent = file.name;
      detail.textContent =
        bytes(file.size) + (file.taken ? " · " + t("received") : "");
      info.append(name, detail);
      button.textContent = t("download");
      button.addEventListener("click", () => download(file, button));
      row.append(fileTile(file.name), info, button);
      list.append(row);
    }
  }
  async function download(file, button) {
    button.disabled = true;
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 180000);
    try {
      const response = await fetch("/files/" + encodeURIComponent(file.id), {
        headers: { Authorization: "Bearer " + ticket },
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = new Error("download");
        error.code = (await response.json()).error;
        throw error;
      }
      const blob = await response.blob();
      if (blob.size !== file.size) throw new Error("incomplete");
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.rel = "noreferrer";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      for (let attempt = 0; ; attempt++) {
        try {
          await api("/taken/" + encodeURIComponent(file.id), {
            method: "POST",
            body: "",
          });
          break;
        } catch (error) {
          if (error.code !== "missing_file" || attempt >= 5) throw error;
          await new Promise((resolve) =>
            setTimeout(resolve, 50 * (attempt + 1)),
          );
        }
      }
      message(t("downloaded") + file.name);
      waveTransfer(false);
      await poll();
    } catch (error) {
      message(errorMessage(error), true);
    } finally {
      clearTimeout(timeout);
      button.disabled = false;
    }
  }
  async function poll() {
    if (
      (!linked && !reconnecting) ||
      polling ||
      stopped ||
      document.hidden ||
      upload
    )
      return;
    if (!ticket) return;
    polling = true;
    try {
      const data = await api("/state");
      consecutivePollErrors = 0;
      reconnecting = false;
      hideDisconnectBanner();
      if (!linked) setConnected(true);
      renderOffers(data.offered || []);
      connection("connected", "connectedDetail", "connected");
    } catch (error) {
      if (isRevoked(error.code)) {
        stopped = true;
        reconnecting = false;
        forget();
        setConnected(false);
        connection("pcDisconnectedTitle", "pcDisconnectedDetail", "error");
        showDisconnectBanner("pcDisconnectedTitle", "pcDisconnectedDetail", false);
        upload?.abort();
      } else {
        consecutivePollErrors += 1;
        reconnecting = true;
        if (consecutivePollErrors >= 3) {
          setConnected(false);
          connection("lostConnectionTitle", "lostConnectionDetail", "error");
          showDisconnectBanner("lostConnectionTitle", "lostConnectionDetail", true);
        } else {
          connection("reconnecting", "reconnectingDetail", "reconnecting");
        }
      }
    } finally {
      polling = false;
    }
  }
  function uploadFile(file, index, count) {
    return new Promise((resolve, reject) => {
      if (file.size > 268435456) {
        const error = new Error("large");
        error.code = "file_too_large";
        reject(error);
        return;
      }
      const xhr = new XMLHttpRequest();
      upload = xhr;
      const started = Date.now();
      const prefix = count > 1 ? `[${index + 1}/${count}] ` : "";
      xhr.open("POST", "/file?name=" + encodeURIComponent(file.name));
      xhr.setRequestHeader("Authorization", "Bearer " + ticket);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.timeout = 300000;
      xhr.upload.onprogress = (event) => {
        const total =
          event.lengthComputable && event.total > 0 ? event.total : file.size;
        const progress =
          total > 0
            ? Math.min(100, Math.round((event.loaded / total) * 100))
            : 0;
        element("progress").value = progress;
        if (progress >= 100) {
          element("progress-label").textContent =
            prefix + file.name + " · " + t("saving");
        } else {
          const elapsed = Math.max(0.2, (Date.now() - started) / 1000);
          const spd = speedText(event.loaded / elapsed);
          const detail =
            total > 0
              ? `${bytes(event.loaded)} / ${bytes(total)} · ${progress}%${spd ? " · " + spd : ""}`
              : `${progress}%`;
          element("progress-label").textContent =
            `${prefix}${file.name} · ${detail}`;
        }
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else {
            const error = new Error(data.error);
            error.code = data.error;
            reject(error);
          }
        } catch (error) {
          reject(error);
        }
      };
      xhr.onerror = () => reject(new Error("network"));
      xhr.ontimeout = () => {
        const error = new Error("timeout");
        error.code = "timeout";
        reject(error);
      };
      xhr.onabort = () => {
        const error = new Error("cancel");
        error.code = "canceled";
        reject(error);
      };
      xhr.send(file);
    });
  }
  async function sendFiles(input) {
    const files = Array.from(input.files || []);
    input.value = "";
    if (!linked || !files.length || upload) return;
    element("gallery-menu").hidden = true;
    element("pick-options").setAttribute("aria-expanded", "false");
    element("upload-progress").hidden = false;
    element("pick-photos").disabled = true;
    element("pick-files").disabled = true;
    element("pick-options").disabled = true;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!linked) throw new Error("disconnected");
        element("progress").value = 0;
        element("progress-label").textContent =
          (files.length > 1 ? `[${i + 1}/${files.length}] ` : "") +
          file.name +
          (file.size ? " · " + bytes(file.size) : "");
        const result = await uploadFile(file, i, files.length);
        recentSent.unshift({ name: file.name, size: file.size });
        if (recentSent.length > 5) recentSent.pop();
        renderSent();
        waveTransfer(true);
        message(
          result.clipboard === false
            ? t("clipboard")
            : t("uploadDone") + file.name,
          result.clipboard === false,
        );
      }
    } catch (error) {
      message(
        error.code === "canceled" ? t("canceled") : errorMessage(error),
        error.code !== "canceled",
      );
    } finally {
      upload = null;
      element("upload-progress").hidden = true;
      element("pick-photos").disabled = !linked;
      element("pick-files").disabled = !linked;
      element("pick-options").disabled = !linked;
      void poll();
    }
  }
  element("pick-photos").addEventListener("click", () => {
    element("gallery-menu").hidden = true;
    element("pick-options").setAttribute("aria-expanded", "false");
    element("photos").click();
  });
  element("pick-files").addEventListener("click", () =>
    element("files").click(),
  );
  element("photos").addEventListener("change", () =>
    sendFiles(element("photos")),
  );
  element("files").addEventListener("change", () =>
    sendFiles(element("files")),
  );
  element("cancel-upload").addEventListener("click", () => upload?.abort());
  element("send-text").addEventListener("click", async () => {
    const button = element("send-text"),
      text = element("text").value;
    if (!text.trim()) {
      message(t("emptyText"), true);
      return;
    }
    button.disabled = true;
    try {
      await api("/text", {
        method: "POST",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: text,
      });
      message(t("textDone"));
      element("text").value = "";
      element("text").style.height = "38px";
      waveTransfer(true);
    } catch (error) {
      message(errorMessage(error), true);
    } finally {
      button.disabled = !linked;
    }
  });
  element("disconnect").addEventListener("click", async () => {
    stopped = true;
    reconnecting = false;
    upload?.abort();
    try {
      await api("/disconnect", { method: "POST", body: "" });
    } catch {}
    forget();
    setConnected(false);
    renderOffers([]);
    connection("disconnected", "disconnectedDetail", "pending");
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void poll();
      if (activeMode === "remote") void pollRemote();
    }
  });
  setInterval(() => void poll(), 2000);

  element("disconnect-retry")?.addEventListener("click", () => {
    consecutivePollErrors = 0;
    reconnecting = true;
    connection("reconnecting", "reconnectingDetail", "reconnecting");
    void poll();
  });

  // Phone QR 2.0 — PC Remote Control tab logic
  let activeMode = "files";
  let volTimer = null;
  if (element("remote-url")) element("remote-url").placeholder = t("remoteUrlPlaceholder");
  const updateVolVisual = (pct, muted) => {
    const safePct = Math.max(0, Math.min(100, Math.round(pct)));
    if (element("remote-vol-fill")) {
      element("remote-vol-fill").style.width = (muted ? 0 : safePct) + "%";
    }
    if (element("remote-vol-val")) {
      element("remote-vol-val").textContent = muted ? t("remoteStateMuted") : safePct + "%";
    }
  };
  function switchMode(mode) {
    activeMode = mode;
    element("tab-files")?.setAttribute("aria-selected", String(mode === "files"));
    element("tab-remote")?.setAttribute("aria-selected", String(mode === "remote"));
    if (element("files-view")) element("files-view").hidden = mode !== "files";
    if (element("remote-view")) element("remote-view").hidden = mode !== "remote";
    if (mode === "remote" && linked) void pollRemote();
  }
  element("tab-files")?.addEventListener("click", () => switchMode("files"));
  element("tab-remote")?.addEventListener("click", () => switchMode("remote"));

  async function remoteAction(payload) {
    if (!linked) return null;
    try {
      const res = await api("/remote/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      void pollRemote();
      return res;
    } catch (error) {
      if (isRevoked(error.code)) {
        stopped = true;
        forget();
        setConnected(false);
        connection("pcDisconnectedTitle", "pcDisconnectedDetail", "error");
        showDisconnectBanner("pcDisconnectedTitle", "pcDisconnectedDetail", false);
      } else {
        message(errorMessage(error), true);
      }
      return null;
    }
  }

  async function pollRemote() {
    if (!linked || activeMode !== "remote" || document.hidden) return;
    try {
      const st = await api("/remote/state");
      const m = st.media;
      const playing = Boolean(m?.playing);
      const trackEl = element("remote-track");
      const artistEl = element("remote-artist");
      const coverEl = element("remote-cover");
      const fallbackEl = element("remote-cover-fallback");
      const glowEl = element("remote-glow");
      const statusEl = element("remote-status-pill");
      if (trackEl) trackEl.textContent = m?.title || t("remoteNothing");
      if (artistEl) artistEl.textContent = m ? [m.artist, m.appName].filter(Boolean).join(" · ") : "";
      if (statusEl) {
        statusEl.dataset.playing = String(playing);
        statusEl.textContent = playing ? t("remotePlayingBadge") : t("remoteIdleBadge");
      }
      if (coverEl) {
        if (st.cover) {
          coverEl.src = st.cover;
          coverEl.hidden = false;
          if (fallbackEl) fallbackEl.hidden = true;
          if (glowEl) {
            glowEl.style.backgroundImage = `url("${st.cover}")`;
            glowEl.dataset.active = "true";
          }
        } else {
          coverEl.hidden = true;
          if (fallbackEl) fallbackEl.hidden = false;
          if (glowEl) glowEl.dataset.active = "false";
        }
      }
      if (element("remote-play")) element("remote-play").dataset.playing = String(playing);
      if (st.audio && typeof st.audio.level === "number") {
        const pct = Math.round(st.audio.level * 100);
        const muted = Boolean(st.audio.muted);
        const micMuted = Boolean(st.audio.micMuted);
        if (element("remote-vol") && document.activeElement !== element("remote-vol")) {
          element("remote-vol").value = String(pct);
        }
        updateVolVisual(pct, muted);
        if (element("remote-mute")) element("remote-mute").dataset.muted = String(muted);
        if (element("remote-mute-state")) element("remote-mute-state").textContent = muted ? t("remoteStateMuted") : t("remoteStateOn");
        if (element("remote-mic")) element("remote-mic").dataset.muted = String(micMuted);
        if (element("remote-mic-state")) element("remote-mic-state").textContent = micMuted ? t("remoteStateMuted") : t("remoteStateOn");
      }
      const tm = st.timer;
      const tmEl = element("remote-timer-status");
      if (tmEl) {
        if (tm && tm.endsAt && tm.endsAt > Date.now()) {
          const sec = Math.max(0, Math.ceil((tm.endsAt - Date.now()) / 1000));
          const mm = Math.floor(sec / 60);
          const ss = String(sec % 60).padStart(2, "0");
          tmEl.textContent = (tm.label ? tm.label + " · " : "") + mm + ":" + ss;
        } else {
          tmEl.textContent = t("remoteTimerIdle");
        }
      }
    } catch (error) {
      if (isRevoked(error.code)) {
        stopped = true;
        forget();
        setConnected(false);
        connection("pcDisconnectedTitle", "pcDisconnectedDetail", "error");
        showDisconnectBanner("pcDisconnectedTitle", "pcDisconnectedDetail", false);
      }
    }
  }
  setInterval(() => void pollRemote(), 1500);

  element("remote-prev")?.addEventListener("click", () => void remoteAction({ action: "media_prev" }));
  element("remote-play")?.addEventListener("click", () => void remoteAction({ action: "media_toggle" }));
  element("remote-next")?.addEventListener("click", () => void remoteAction({ action: "media_next" }));
  element("remote-mute")?.addEventListener("click", () => void remoteAction({ action: "volume_mute" }));
  element("remote-mic")?.addEventListener("click", () => void remoteAction({ action: "mic_mute" }));
  element("remote-vol")?.addEventListener("input", (ev) => {
    const val = Number(ev.target.value);
    updateVolVisual(val, false);
    clearTimeout(volTimer);
    volTimer = setTimeout(() => void remoteAction({ action: "volume_set", level: val / 100 }), 80);
  });
  element("remote-lock")?.addEventListener("click", () => void remoteAction({ action: "lock" }));
  element("remote-sleep")?.addEventListener("click", () => {
    if (confirm(t("remoteSleepConfirm"))) void remoteAction({ action: "sleep" });
  });
  element("remote-shot")?.addEventListener("click", async () => {
    const res = await remoteAction({ action: "screenshot" });
    if (res?.image) {
      element("remote-shot-img").src = res.image;
      element("remote-shot-save").href = res.image;
      element("remote-shot-box").hidden = false;
      message(t("remoteDone"));
    }
  });
  element("remote-shot-hide")?.addEventListener("click", () => {
    if (element("remote-shot-box")) element("remote-shot-box").hidden = true;
  });
  element("remote-open-url")?.addEventListener("click", async () => {
    const raw = (element("remote-url").value || "").trim();
    if (!raw) return;
    const url = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
    const res = await remoteAction({ action: "open_url", url });
    if (res?.ok) {
      element("remote-url").value = "";
      message(t("remoteOpened"));
    }
  });
  element("remote-url")?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") element("remote-open-url")?.click();
  });
  element("remote-t5")?.addEventListener("click", () => void remoteAction({ action: "timer_start", minutes: 5 }));
  element("remote-t10")?.addEventListener("click", () => void remoteAction({ action: "timer_start", minutes: 10 }));
  element("remote-t15")?.addEventListener("click", () => void remoteAction({ action: "timer_start", minutes: 15 }));
  element("remote-t25")?.addEventListener("click", () => void remoteAction({ action: "timer_start", minutes: 25, label: "Фокус" }));
  element("remote-treset")?.addEventListener("click", () => void remoteAction({ action: "timer_reset" }));
  async function start() {
    setConnected(false);
    connection("connecting", "pendingDetail", "pending");
    try {
      if (code) {
        const device = /iPad/i.test(navigator.userAgent)
          ? "iPad"
          : /iPhone/i.test(navigator.userAgent)
            ? "iPhone"
            : /Android/i.test(navigator.userAgent)
              ? "Android"
              : lang === "en"
                ? "Phone browser"
                : "Браузер телефона";
        const data = await api("/pair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: code, device }),
        });
        saveTicket(data.ticket);
      }
      if (!ticket) {
        connection("disconnected", "disconnectedDetail", "error");
        return;
      }
      connection("pending", "pendingDetail", "pending");
      for (let i = 0; i < 120 && !stopped; i++) {
        try {
          const data = await api("/approval");
          if (data.status === "approved") {
            reconnecting = false;
            setConnected(true);
            connection("connected", "connectedDetail", "connected");
            await poll();
            return;
          }
          connection("pending", "pendingDetail", "pending");
        } catch (error) {
          if (isRevoked(error.code)) {
            forget();
            connection("disconnected", "disconnectedDetail", "error");
            message(errorMessage(error), true);
            return;
          }
          // Transient error (e.g. Woods Island restarting): keep saved ticket and keep retrying!
          reconnecting = true;
          connection("reconnecting", "reconnectingDetail", "reconnecting");
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (reconnecting) return;
      forget();
      connection("disconnected", "disconnectedDetail", "error");
    } catch (error) {
      if (isRevoked(error.code) || code) {
        forget();
        connection("disconnected", "disconnectedDetail", "error");
        message(error.code ? errorMessage(error) : t("network"), true);
      } else {
        reconnecting = true;
        connection("reconnecting", "reconnectingDetail", "reconnecting");
      }
    }
  }
  void start();
})();
