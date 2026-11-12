# Компоненты и источники данных

- FFmpeg/ffprobe: https://www.gyan.dev/ffmpeg/builds/. Отдельные GPLv3 инструменты; LICENSE и FFMPEG_PROVENANCE.md входят в bin.
- MET Norway: https://www.met.no/en, погодные данные CC BY 4.0.
- OpenStreetMap/Nominatim: https://www.openstreetmap.org/copyright, ODbL.
- Rust/npm зависимости: Cargo.lock и pnpm-lock.yaml; индивидуальные лицензии пакетов сохраняются.
- Авторские дополнения Woods: 11 растровых питомцев — Складень, Узелок, Лунный Нокт, Нуль, Парадокс, Искорка, Кряжик, Нокт, Латунчик, Шурш и Скол. Рисунки созданы вручную в Pillow, включая материалы, силуэты, анимационные кадры и слои лица. PNG входят в текущий приватный комплект. Шесть ранних SVG-концептов заменены; они не входят в production-каталог версии 1.1.0.
- Питомцы OpenAI Codex: рисунки не входят в исходники, EXE, portable или сайт. Дополнительный локальный импорт читает установленное приложение пользователя; право на распространение artwork не установлено и не заявляется.
- Production `runtime/vendor/`: React/ReactDOM 19.3.0 (Meta, MIT), Motion (Framer, MIT), ProseMirror (Marijn Haverbeke и contributors, MIT), Tiptap (ueberdosis и contributors, MIT). Зафиксированные библиотеки перенесены из поставляемого runtime; версии React 18 из pnpm-lock относятся к отдельному прототипу.

Общая MIT-лицензия для полного пакета не заявляется. Исходники и тестовые сборки приватные.
