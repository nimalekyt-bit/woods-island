# Woods Island 1.3.0

На главной странице появился заряд устройств: компактная строка и подробная карточка с настройками имён, видимости и уведомлений.

- Поддерживаемые устройства обновляются через Windows или собственные HID-адаптеры. Для DAREU A950 Air V3 проверены приёмник и USB-кабель.
- Logitech G435 через LIGHTSPEED получил ручную кнопку «Измерить заряд». Перед запуском приложение предупреждает о краткой паузе звука и микрофона. Процент приблизительный, рассчитан по напряжению; показание хранится 24 часа с отметкой времени. Фонового опроса G435 нет. Проверен приёмник 046D:0ACB, ревизия 0008.
- Зарядка, связь с устройством и устаревшее показание отображаются отдельно. Недоступный процент не подменяется нулём. FL680 видна в списке, но чтение её заряда пока не поддерживается.
- Убраны стандартные полосы прокрутки и стрелки по краям главной панели. Вертикальная прокрутка содержимого сохранена.

Обновление через Setup сохраняет настройки. Portable обновляется вручную. Поддержка зависит от модели, ревизии и подключения; полный список и ограничения описаны в docs/peripheral-support.md.

---

The Home page now shows peripheral battery levels in a compact row and an expanded card, with device names, visibility controls and notifications.

- Supported devices use Windows telemetry or dedicated HID adapters. The DAREU A950 Air V3 receiver and USB cable have been tested.
- Logitech G435 over LIGHTSPEED has a manual Measure battery action. A notice explains the brief audio and microphone interruption before starting. The percentage is an approximate voltage estimate; the reading is retained for 24 hours with its timestamp. G435 is never polled in the background. Tested receiver: 046D:0ACB, revision 0008.
- Charging, radio connection and saved readings have separate states. Unavailable battery levels are not shown as zero. FL680 appears in the list, but its battery cannot currently be read.
- Removed native scrollbar tracks and arrows from the Home panel while retaining vertical scrolling.

Setup updates preserve settings. Portable requires a manual update. Support depends on the model, revision and connection; see docs/peripheral-support.md for the support matrix.
