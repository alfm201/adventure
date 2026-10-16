import { ASSET_URL, PACKAGE_URL, PACKAGE_SHA256, MANIFEST, LOCAL_MODEL, LOCAL_PACKAGE_URL } from './model.js';
const consentKey='adventure-lyra-cache-consent-v2';
export const PACKAGE_CACHE_NAME=`adventure-lyra-package-v1:${new URL('../',ASSET_URL).pathname}`;
const cacheName=PACKAGE_CACHE_NAME;
const cacheKey=new URL(`__cache__/${PACKAGE_SHA256}`,ASSET_URL).href;
let resident;
export const hashBytes=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
export function cacheAllowed(){if(LOCAL_MODEL)return false;try{return localStorage.getItem(consentKey)==='yes';}catch{return false;}}
export function rememberCacheChoice(allowed){if(LOCAL_MODEL&&allowed)return;try{if(allowed)localStorage.setItem(consentKey,'yes');else localStorage.removeItem(consentKey);}catch{}}
// Presence only decides whether to skip the consent screen. loadPackage still
// checks the complete package hash before any saved bytes can be used.
export async function hasSavedPackage(){
  try{
    if(!globalThis.caches||!await caches.has(cacheName))return false;
    const saved=await (await caches.open(cacheName)).match(cacheKey);
    if(!saved)return false;
    await saved.body?.cancel();
    return true;
  }catch{return false;}
}
// Deleting disk storage does not interrupt the model already in use this visit.
export async function clearPackageCache(){rememberCacheChoice(false);if(globalThis.caches)await caches.delete(cacheName);}
async function checked(bytes,manifest){return bytes.byteLength===manifest.bytes && await hashBytes(bytes)===manifest.sha256;}
export async function loadPackage({persist=cacheAllowed(),signal,onProgress=()=>{}}={}){
  signal?.throwIfAborted();
  onProgress({phase:'inspect'});
  const response=await fetch(new URL('download.json',ASSET_URL),{signal,cache:'no-cache'});
  if(!response.ok)throw Error('LYRA download metadata unavailable');
  const manifest=await response.json();
  if(manifest.format!=='lyra-pack-gzip-v1'||manifest.sha256!==PACKAGE_SHA256||manifest.bytes!==31029778||manifest.assetsSha256!==MANIFEST.metadataSha256||manifest.decodedBytes!==66752274)
    throw Error('Invalid LYRA package manifest');
  let bytes=resident,cache,fromCache=false,cacheFailed=false,cacheSaved=false;
  if(persist){
    try{
      if(!globalThis.caches)throw Error('Storage unavailable');
      cache=await caches.open(cacheName);
      const saved=await cache.match(cacheKey);
      if(saved){
        const data=await saved.arrayBuffer();signal?.throwIfAborted();
        if(await checked(data,manifest)){bytes??=data;fromCache=true;cacheSaved=true;}
        else await cache.delete(cacheKey);
      }
    }catch{signal?.throwIfAborted();cacheFailed=true;}
  }
  if(!bytes){
    const controller=new AbortController(),cancel=()=>controller.abort(signal.reason);
    signal?.addEventListener('abort',cancel,{once:true});
    let timer;const reset=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(new DOMException('Download timed out','TimeoutError')),30000);};
    try{
      reset();onProgress({phase:'download',received:0,total:manifest.bytes,fraction:0});
      const url=LOCAL_MODEL ? LOCAL_PACKAGE_URL : PACKAGE_URL;
      const res=await fetch(url,{signal:controller.signal,cache:'no-store',credentials:'omit'});
      if(!res.ok||!res.body)throw Error(`LYRA download failed (${res.status})`);
      const reader=res.body.getReader(),data=new Uint8Array(manifest.bytes);let offset=0;
      try{for(;;){const {done,value}=await reader.read();if(done)break;reset();if(offset+value.length>data.length)throw Error('Oversized LYRA download');data.set(value,offset);offset+=value.length;onProgress({phase:'download',received:offset,total:manifest.bytes,fraction:offset/manifest.bytes});}}
      finally{await reader.cancel().catch(()=>{});}
      bytes=data.buffer;
      onProgress({phase:'verify'});
      if(!await checked(bytes,manifest))throw Error('LYRA package integrity check failed');
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
  }else onProgress({phase:fromCache?'cache':'memory',fraction:1});
  signal?.throwIfAborted();resident=bytes;
  if(cache&&!cacheSaved){try{await cache.put(cacheKey,new Response(bytes,{headers:{'Content-Type':'application/gzip','Content-Length':String(bytes.byteLength)}}));cacheSaved=true;}catch{cacheFailed=true;}}
  signal?.throwIfAborted();
  if(cacheSaved){try{for(const request of await cache.keys())if(request.url!==cacheKey)await cache.delete(request);}catch{}}
  return {bytes,manifest,info:{fromCache,cacheSaved,cacheFailed,packageSha256:PACKAGE_SHA256,packageBytes:manifest.bytes}};
}

export async function unpackPackage(bytes,manifest){
  if(!await checked(bytes,manifest))throw Error('LYRA package integrity check failed');
  const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const decoded=new Uint8Array(manifest.decodedBytes);let offset=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;if(offset+value.length>decoded.length)throw Error('Oversized LYRA package');decoded.set(value,offset);offset+=value.length;}}
  finally{await reader.cancel().catch(()=>{});}
  if(offset!==decoded.length||await hashBytes(decoded)!==manifest.decodedSha256)throw Error('Invalid decoded LYRA package');
  if(new TextDecoder().decode(decoded.subarray(0,8))!=='LYRAPACK')throw Error('Invalid LYRA package format');
  const length=new DataView(decoded.buffer).getUint32(8,true);
  if(length>65536||12+length>decoded.length)throw Error('Invalid LYRA package header');
  const header=JSON.parse(new TextDecoder().decode(decoded.subarray(12,12+length)));
  if(header.schemaVersion!==1||header.assetsSha256!==MANIFEST.metadataSha256||header.ortVersion!=='1.30.0'||header.files.length!==4)throw Error('Incompatible LYRA package');
  const files={};let end=0;
  for(const file of header.files){
    const expected=manifest.files.find(entry=>entry.file===file.file);
    if(!expected||file.offset!==end||file.bytes!==expected.bytes||file.sha256!==expected.sha256||file.offset!==expected.offset||files[file.file])throw Error('Invalid LYRA file entry');
    const data=decoded.subarray(12+length+file.offset,12+length+file.offset+file.bytes);
    if(data.length!==file.bytes||await hashBytes(data)!==file.sha256)throw Error('LYRA inner file integrity check failed');
    files[file.file]=data;end+=file.bytes;
  }
  if(12+length+end!==decoded.length)throw Error('Unexpected LYRA package data');
  return files;
}
