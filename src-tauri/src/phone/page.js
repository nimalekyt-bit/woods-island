/* Woods-owned mobile client. No external scripts, telemetry or servers. */
(() => {
  "use strict";
  const lang = navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en";
  const strings = {
    tagline: [
      "Прямая передача без облака",
      "Direct local transfer, no cloud",
    ],
    localBadge: ["Локально", "Local"],
    toComputer: ["На компьютер", "To the computer"],
    localHint: [
      "Фото, видео и файлы сразу появятся на полке Woods Island.",
      "Photos, videos and files appear right on the Woods Island shelf.",
    ],
    photos: ["Фото и видео", "Photos & video"],
    files: ["Файлы", "Files"],
    fileLimit: [
      "До 256 МиБ на файл · передаётся напрямую по Wi-Fi.",
      "Up to 256 MiB per file · stays on your local Wi-Fi.",
    ],
    cancel: ["Отмена", "Cancel"],
    saving: ["Сохраняем на полку…", "Saving to shelf…"],
    sentMark: ["Отправлено", "Sent"],
    textTitle: ["Текст или ссылка", "Text or a link"],
    textPlaceholder: [
      "Вставь ссылку или заметку…",
      "Paste a link or note…",
    ],
    sendText: [
      "Отправить в буфер компьютера",
      "Send to the computer’s clipboard",
    ],
    fromComputer: ["С компьютера", "From the computer"],
    empty: [
      "Файлы появятся здесь, когда отправишь их из Woods Island.",
      "Files appear here when you send them from Woods Island.",
    ],
    footer: [
      "Прямая связь с Woods Island. Без приложения, подписки и чужого сервера.",
      "A direct link to Woods Island. No app, subscription or third-party server.",
    ],
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
    connected: ["Телефон подключён", "Phone connected"],
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
  };
  const t = (key) => strings[key]?.[lang === "ru" ? 0 : 1] || key;
  const element = (id) => document.getElementById(id);
  const code = location.hash.slice(1);
  history.replaceState(null, "", location.pathname);
  document.documentElement.lang = lang;
  for (const node of document.querySelectorAll("[data-i18n]"))
    node.textContent = t(node.dataset.i18n);
  if (element("text")) element("text").placeholder = t("textPlaceholder");

  const storageKey = "woods-phone-capability:" + location.host;
  const legacyKey = "woods-phone-capability";
  const loadTicket = () => {
    try {
      const fromLocal = localStorage.getItem(storageKey);
      if (fromLocal) return fromLocal;
    } catch {}
    try {
      return sessionStorage.getItem(storageKey) || sessionStorage.getItem(legacyKey) || "";
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
    reconnecting = false;
  const recentSent = [];

  const bytes = (amount) =>
    amount >= 1048576
      ? (amount / 1048576).toFixed(1) + (lang === "ru" ? " МБ" : " MB")
      : amount >= 1024
        ? (amount / 1024).toFixed(1) + (lang === "ru" ? " КБ" : " KB")
        : amount + (lang === "ru" ? " Б" : " B");
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
    for (const id of [
      "pick-photos",
      "pick-files",
      "text",
      "send-text",
      "disconnect",
    ])
      element(id).disabled = !state;
    document.querySelector(".connection").dataset.state = state
      ? "connected"
      : "pending";
  };
  const connection = (title, detail, state) => {
    element("connection-title").textContent = t(title);
    element("connection-detail").textContent = t(detail);
    document.querySelector(".connection").dataset.state = state;
  };
  const isRevoked = (codeValue) =>
    ["invalid_link", "pairing_expired", "not_approved", "disconnected"].includes(
      codeValue,
    );
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
      row.append(name, meta);
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
      row.append(info, button);
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
          await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
        }
      }
      message(t("downloaded") + file.name);
      await poll();
    } catch (error) {
      message(errorMessage(error), true);
    } finally {
      clearTimeout(timeout);
      button.disabled = false;
    }
  }
  async function poll() {
    if ((!linked && !reconnecting) || polling || stopped || document.hidden || upload)
      return;
    if (!ticket) return;
    polling = true;
    try {
      const data = await api("/state");
      reconnecting = false;
      if (!linked) setConnected(true);
      renderOffers(data.offered || []);
      connection("connected", "connectedDetail", "connected");
    } catch (error) {
      if (isRevoked(error.code)) {
        stopped = true;
        reconnecting = false;
        forget();
        setConnected(false);
        connection("disconnected", "disconnectedDetail", "error");
        upload?.abort();
      } else {
        reconnecting = true;
        connection("reconnecting", "reconnectingDetail", "reconnecting");
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
        const total = event.lengthComputable && event.total > 0 ? event.total : file.size;
        const progress = total > 0 ? Math.min(100, Math.round((event.loaded / total) * 100)) : 0;
        element("progress").value = progress;
        if (progress >= 100) {
          element("progress-label").textContent = prefix + file.name + " · " + t("saving");
        } else {
          const elapsed = Math.max(0.2, (Date.now() - started) / 1000);
          const spd = speedText(event.loaded / elapsed);
          const detail = total > 0
            ? `${bytes(event.loaded)} / ${bytes(total)} · ${progress}%${spd ? " · " + spd : ""}`
            : `${progress}%`;
          element("progress-label").textContent = `${prefix}${file.name} · ${detail}`;
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
    element("upload-progress").hidden = false;
    element("pick-photos").disabled = true;
    element("pick-files").disabled = true;
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
      void poll();
    }
  }
  element("pick-photos").addEventListener("click", () =>
    element("photos").click(),
  );
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
    if (!document.hidden) void poll();
  });
  setInterval(() => void poll(), 2000);
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
