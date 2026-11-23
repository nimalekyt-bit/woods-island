import { React } from "../react";
import { H as t } from "../compat/shared.js";
import { invoke } from "../ipc/client";
import logo from "../../src-tauri/icons/icon.png";
import {
  Music2,
  Clipboard,
  PawPrint,
  Keyboard,
  Video,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Check,
} from "./settings-icons";
import {
  releaseHistory,
  releaseUrl,
  woodsReleasesUrl,
} from "../releases/history";
import { showcaseForVersion } from "../releases/showcase";
import { WhatsNewShowcase } from "./WhatsNewShowcase";
import "./about.css";

const open = (path: string) => void invoke("open_path", { path });
export function AboutSettings({
  version,
  onUpdates,
}: {
  version: string;
  onUpdates: () => void;
}) {
  const features = [
    {
      Icon: Music2,
      title: t("Музыка рядом", "Music within reach"),
      text: t(
        "Плееры Windows и Яндекс Музыка",
        "Windows players and Yandex Music",
      ),
    },
    {
      Icon: Clipboard,
      title: t("Всё под рукой", "Keep things handy"),
      text: t(
        "Буфер, заметки и экспорт в Obsidian",
        "Clipboard, notes and Obsidian export",
      ),
    },
    {
      Icon: PawPrint,
      title: t("Твой остров", "Your island"),
      text: t(
        "Питомцы, персонажи и оформление",
        "Pets, characters and appearance",
      ),
    },
    {
      Icon: Keyboard,
      title: t("Твои устройства", "Your devices"),
      text: t(
        "Заряд, подключения и уведомления",
        "Battery, connections and notifications",
      ),
    },
    {
      Icon: Video,
      title: t("Экран и запись", "Screen and recording"),
      text: t(
        "Снимки, видео и OBS Studio",
        "Screenshots, video and OBS Studio",
      ),
    },
    {
      Icon: Sparkles,
      title: t("Помощь в работе", "Help with your work"),
      text: t(
        "ИИ, диктовка и агенты в терминале",
        "AI, dictation and terminal agents",
      ),
    },
  ];
  return (
    <section id="pro" data-woods-about className="wi-about">
      <header className="wi-about-hero">
        <img data-woods-logo src={logo} width={76} height={76} alt="" />
        <div className="wi-about-heading">
          <span className="wi-about-eyebrow">Woods Personal Corp</span>
          <h2>Woods Island</h2>
          <p>
            {t(
              "Твой остров для Windows 10 и 11",
              "Your island for Windows 10 and 11",
            )}
          </p>
        </div>
      </header>
      <div className="wi-about-meta">
        <button
          data-about-version
          className="wi-about-version"
          onClick={onUpdates}
          aria-label={t("Версия и обновления", "Version and updates")}
        >
          {t("Версия", "Version")}{" "}
          <span>{version || t("Недоступна", "Unavailable")}</span>
          <ChevronRight size={12} />
        </button>
        <span className="wi-about-free">
          <Check size={12} />
          {t("Все функции бесплатно", "All features free")}
        </span>
      </div>
      <p className="wi-about-description">
        {t(
          "Музыка, инструменты и события в одной пилюле. Настрой остров под себя — он всегда рядом, когда нужен.",
          "Music, tools and live events in one pill. Make the island yours — always nearby when you need it.",
        )}
      </p>
      <div className="wi-about-features">
        {features.map(({ Icon, title, text }) => (
          <div className="wi-about-feature" key={title}>
            <Icon size={17} />
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </div>
      <footer className="wi-about-author">
        <span>
          {t(
            "Создал Никита Кузнецов · Woods",
            "Created by Nikita Kuznetsov · Woods",
          )}
        </span>
        <span>{t("Без ключа и подписки", "No key or subscription")}</span>
      </footer>
    </section>
  );
}

export function AboutContact() {
  return (
    <section data-woods-contact className="wi-about-contact">
      <div>
        <h3>{t("Есть идея? Давай обсудим", "Have an idea? Let’s talk")}</h3>
        <p>
          {t(
            "Предложения и сообщения об ошибках — автору Woods Island.",
            "Send suggestions and bug reports to the Woods Island author.",
          )}
        </p>
      </div>
      <div className="wi-about-actions">
        <button
          data-woods-telegram
          onClick={() => open("https://t.me/woodskilla")}
        >
          Telegram · @woodskilla
          <ExternalLink size={12} />
        </button>
        <button
          data-woods-github
          onClick={() =>
            open(
              "https://github.com/nimalekyt-bit/woods-island/issues/new/choose",
            )
          }
        >
          {t("Сообщить об ошибке", "Report a bug")}
          <ExternalLink size={12} />
        </button>
      </div>
    </section>
  );
}

export function ReleaseHistory({ version }: { version: string }) {
  const history = releaseHistory(version),
    lang = t("ru", "en") as "ru" | "en";
  return (
    <section data-whats-new className="wi-release-history">
      <header>
        <h3>{t("Что нового", "What’s new")}</h3>
        <span>{t("История Woods Island", "Woods Island history")}</span>
      </header>
      {!version && (
        <p role="status" className="wi-release-empty">
          {t(
            "Версия сборки недоступна. Историю выпусков можно открыть по ссылке ниже.",
            "The build version is unavailable. Open the release history using the link below.",
          )}
        </p>
      )}
      {version && !history.length && (
        <p className="wi-release-empty">
          {t(
            "Описание этой сборки появится вместе с выпуском.",
            "Notes for this build will be available with its release.",
          )}
        </p>
      )}
      {history.map((entry, index) => (
        <details
          key={entry.version}
          data-release={entry.version}
          open={index === 0}
        >
          <summary>
            <ChevronRight size={13} />
            <div>
              <strong>
                {t("Версия", "Version")} {entry.version}
              </strong>
              <p>{entry.summary[lang]}</p>
            </div>
            {entry.version === version && (
              <span className="wi-release-current">
                {t("Установлена", "Installed")}
              </span>
            )}
          </summary>
          <div className="wi-release-content">
            {(() => {
              const slides = showcaseForVersion(entry.version, index);
              return slides.length > 0 ? (
                <WhatsNewShowcase version={entry.version} slides={slides} />
              ) : null;
            })()}
            {entry.paragraphs[lang].map((paragraph, index) => (
              <p
                className={paragraph.bullet ? "wi-release-bullet" : undefined}
                key={index}
              >
                {paragraph.text}
              </p>
            ))}
            <button
              className="wi-release-link"
              data-release-open={entry.version}
              onClick={() => open(releaseUrl(entry.version))}
            >
              {t("Открыть этот выпуск", "Open this release")}
              <ExternalLink size={12} />
            </button>
          </div>
        </details>
      ))}
      <button
        data-releases-open
        className="wi-release-link"
        onClick={() => open(woodsReleasesUrl)}
      >
        {t("Все выпуски Woods Island", "All Woods Island releases")}
        <ExternalLink size={12} />
      </button>
    </section>
  );
}
