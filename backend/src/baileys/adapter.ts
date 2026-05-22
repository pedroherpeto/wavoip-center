/**
 * Adapter para baileys-v7 (ESM-only).
 *
 * baileys-v7 = npm:@whiskeysockets/baileys@7.0.0-rc11 (ESM puro).
 * Em projeto TS->CJS, NAO podemos usar `import` direto pois transpila para require().
 * Solucao: `eval('import(...)')` para escapar do transpile (mesmo padrao do
 * zpro-passaporte/backend/src/utils/baileysAdapterZPRO.ts:57).
 */

import { baileysLogger } from "../utils/logger";

let _baileysModule: any | null = null;
let _loading: Promise<any> | null = null;

export async function loadBaileys(): Promise<any> {
  if (_baileysModule) return _baileysModule;
  if (_loading) return _loading;

  _loading = (async () => {
    baileysLogger.debug("Loading baileys-v7 (ESM) via dynamic import");
    // eslint-disable-next-line no-eval
    const mod = await (eval('import("baileys-v7")') as Promise<any>);
    // baileys-v7 exports `makeWASocket` as the default export AND
    // re-exports named symbols on the namespace. We want the namespace.
    // If the namespace contains useMultiFileAuthState, use it; else fall
    // back to mod.default (older shapes).
    const resolved = mod.useMultiFileAuthState ? mod : mod.default ?? mod;
    _baileysModule = resolved;
    baileysLogger.info("baileys-v7 loaded");
    return resolved;
  })();

  return _loading;
}

export type BaileysModule = {
  makeWASocket: any;
  useMultiFileAuthState: any;
  Browsers: any;
  DisconnectReason: any;
  delay: any;
  fetchLatestBaileysVersion: any;
  jidNormalizedUser: any;
  makeCacheableSignalKeyStore: any;
  proto: any;
  isJidBroadcast: any;
  isJidGroup: any;
  isJidStatusBroadcast: any;
  isJidNewsletter: any;
  isJidUser: any;
};
