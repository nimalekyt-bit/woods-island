import { CODEX_IDS } from './bitmap';

export interface LocalPet { id: string; available: boolean; error?: string; sha256?: string | null; bytes?: number | null }
export interface PetLibrary { status: string; pets: LocalPet[]; error?: string }
export interface PetLibraryDependencies {
  catalog: (force: boolean) => Promise<unknown>;
  asset: (id: string) => Promise<unknown>;
}
function parseLibrary(value: unknown): PetLibrary {
  if (!value || typeof value !== 'object') throw Error('Invalid pet library response');
  const data = value as PetLibrary;
  if (typeof data.status !== 'string' || !Array.isArray(data.pets) ||
    data.pets.some(pet => !pet || !CODEX_IDS.includes(pet.id as typeof CODEX_IDS[number]) || typeof pet.available !== 'boolean') ||
    new Set(data.pets.map(pet => pet.id)).size !== data.pets.length) throw Error('Invalid pet availability');
  return data;
}
const MAX_CACHE_BYTES = 16 * 1024 * 1024;
export function createPetLibraryClient(dependencies: PetLibraryDependencies) {
  let library: PetLibrary = {status:'loading',pets:[]}, loaded = false, revision = 0;
  let request: Promise<PetLibrary> | undefined, forcedRequest: Promise<PetLibrary> | undefined;
  const listeners = new Set<() => void>();
  const assets = new Map<string, {version:string;url:string}>();
  const pendingAssets = new Map<string, Promise<string>>();
  const assetVersion = (id: string) => {
    const pet=library.pets.find(pet => pet.id===id);
    return pet?.available ? `${pet.sha256 ?? ''}:${pet.bytes ?? ''}` : null;
  };
  function apply(value: PetLibrary) {
    library=value;loaded=true;revision++;
    for (const [id, cached] of assets) if (assetVersion(id)!==cached.version) assets.delete(id);
    listeners.forEach(listener => listener());
  }
  async function fetch(force: boolean) {
    const before=revision;
    try {
      const result=parseLibrary(await dependencies.catalog(force));
      // A native change event emitted during the command carries the latest
      // result. An older catalog response must not restore stale availability.
      if (revision===before) apply(result);
    } catch (error) {
      if (revision===before) apply({status:'error',pets:[],error:String(error)});
    }
    return library;
  }
  function track(operation: Promise<PetLibrary>, force: boolean) {
    request=operation;
    if (force) forcedRequest=operation;
    void operation.then(() => {
      if (request===operation) request=undefined;
      if (forcedRequest===operation) forcedRequest=undefined;
    });
    return operation;
  }
  function refresh(force=false): Promise<PetLibrary> {
    if (force) {
      if (forcedRequest) return forcedRequest;
      return track((request ?? Promise.resolve()).then(() => fetch(true)),true);
    }
    if (request) return request;
    if (loaded) return Promise.resolve(library);
    return track(fetch(false),false);
  }
  async function asset(id: string): Promise<string> {
    if (!CODEX_IDS.includes(id as typeof CODEX_IDS[number])) throw Error('Unknown local pet');
    const version=assetVersion(id);if (version===null) throw Error('Local pet is unavailable');
    const cached=assets.get(id);
    if (cached?.version===version) {assets.delete(id);assets.set(id,cached);return cached.url;}
    const key=`${id}:${version}`, pending=pendingAssets.get(key);if(pending)return pending;
    const operation=(async () => {
      const value=await dependencies.asset(id);
      if (typeof value!=='string'||!value.startsWith('data:image/webp;base64,')||value.length>12*1024*1024) throw Error('Invalid local pet image');
      if(assetVersion(id)!==version)return asset(id);
      assets.set(id,{version,url:value});
      while([...assets.values()].reduce((sum,item)=>sum+item.url.length,0)>MAX_CACHE_BYTES&&assets.size>1) assets.delete(assets.keys().next().value!);
      return value;
    })();
    pendingAssets.set(key,operation);
    try{return await operation;}finally{pendingAssets.delete(key);}
  }
  return {
    getSnapshot:()=>library,
    subscribe(callback:()=>void){listeners.add(callback);return()=>{listeners.delete(callback);};},
    refresh,asset,
    changed(value:unknown){try{apply(parseLibrary(value));return true;}catch{return false;}},
  };
}
