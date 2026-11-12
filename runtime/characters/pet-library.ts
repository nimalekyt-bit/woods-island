import { React } from '../react';
import { invoke } from '../ipc/client';
import { listen } from '@tauri-apps/api/event';
import { createPetLibraryClient } from './pet-library-state';
export type { LocalPet, PetLibrary } from './pet-library-state';

const client=createPetLibraryClient({
  catalog:force=>invoke(force?'pets_import_codex':'pets_catalog'),
  asset:id=>invoke('pets_asset',{id}),
});
export const refreshPets=client.refresh;
export const localPetAsset=client.asset;
export function usePetLibrary() {
  React.useEffect(()=>{void refreshPets();},[]);
  return React.useSyncExternalStore(client.subscribe,client.getSnapshot);
}
// One listener per WebView keeps settings and the main island in sync. Native
// destroys it with its WebView. Change events apply metadata, never re-import.
if(typeof window!=='undefined'&&window.__TAURI_INTERNALS__){
  void listen<unknown>('pets:changed',event=>{client.changed(event.payload);})
    .then(()=>refreshPets(),()=>refreshPets());
}
