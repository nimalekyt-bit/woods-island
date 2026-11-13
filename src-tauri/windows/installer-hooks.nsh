; Woods Island uses a historical Run value and profile path that differ from
; Tauri's productName/identifier defaults. Only touch our installed executable
; and our fixed profile folder; preserve both during an update.
!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $UpdateMode <> 1
    Push $R0
    ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "WoodsIsland"
    ${If} $R0 == '$\"$INSTDIR\woods-island.exe$\"'
      DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "WoodsIsland"
    ${EndIf}
    Pop $R0

    ; NSIS creates this opt-in checkbox unchecked. Never delete custom data-dir
    ; overrides or a profile during an upgrade/silent uninstall.
    ${If} $DeleteAppDataCheckboxState = 1
    ${AndIf} $APPDATA != ""
      RmDir /r "$APPDATA\woods-island"
    ${EndIf}
  ${EndIf}
!macroend
