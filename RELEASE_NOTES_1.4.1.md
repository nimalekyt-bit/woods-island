# Woods Island 1.4.1

Обновление производительности, ввода во встроенных веб-ИИ и стабильности работы в играх — без компромиссов по визуалу, анимациям и функциям.

- Глубокая оптимизация CPU, GPU и RAM: интеграция с медиаслужбой Windows (GSMTC) переведена с постоянного опроса на нативные события WinRT — нагрузка на системную службу `NPSMSvc` сведена практически к нулю и устранены ошибки `0x80004003` в логах.
- Убран постоянный 60–144 FPS опрос геометрии окна в интерфейсе и лишние перерисовки атласов персонажей и жидкой пилюли при неизменном кадре; частота анимации жидкой пилюли аккуратно выровнена на высокогерцовых экранах.
- В полноэкранных играх и при скрытой пилюле фоновые циклы (курсор, аудио, телеметрия, уведомления) автоматически переходят в экономный режим.
- Исправлен ввод текста с клавиатуры во встроенных веб-чатах ИИ (ChatGPT, Gemini, Claude, DeepSeek, Grok, Qwen) прямо внутри пилюли: окно и WebView2 теперь корректно принимают фокус при клике.
- Исправлены ложные перезапуски watchdog под высокой нагрузкой CPU и во время полноэкранных игр.

Setup сохраняет настройки. Portable обновляется вручную после закрытия острова.

---

Performance, embedded Web AI input and gaming stability update — with zero compromises to visuals, animations or features.

- Deep CPU, GPU and RAM optimization: Windows media integration (GSMTC) moved from continuous polling to native WinRT events, reducing `NPSMSvc` service load to near zero and eliminating `0x80004003` log errors.
- Eliminated continuous 60–144 FPS layout polling in the pill and redundant bitmap character atlas and liquid SVG redraws when frames are unchanged, with clean frame pacing on high-refresh-rate monitors.
- Background loops (cursor tracking, audio state, telemetry and notifications) automatically switch to low-power mode during fullscreen games or while the pill is hidden.
- Fixed keyboard typing in embedded Web AI panels (ChatGPT, Gemini, Claude, DeepSeek, Grok, Qwen) inside the pill: window activation and WebView2 focus now engage immediately on click.
- Fixed false watchdog self-restarts under heavy CPU load and during fullscreen games.

Setup preserves preferences. Portable updates manually after closing the island.
