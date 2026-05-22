/**
 * Cliente HTTP da API Wavoip.
 * Espelha os endpoints usados em zpro-passaporte/frontend/src/services/wavoip.ts:
 *  - POST /fetch-calls
 *  - POST /fetch-devices
 *  - GET /calls/:token
 */

import axios, { AxiosInstance } from "axios";
import { config } from "../config";
import { logger } from "../utils/logger";
import type { WavoipCall, WavoipDevice } from "./types";

const wavoipLogger = logger.child({ module: "wavoip" });

function client(token?: string): AxiosInstance {
  return axios.create({
    baseURL: config.WAVOIP_API_BASE_URL,
    timeout: 15000,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

export async function fetchCalls(token: string): Promise<WavoipCall[]> {
  try {
    const { data } = await client(token).post<{ result?: WavoipCall[] } | WavoipCall[]>("/fetch-calls");
    if (Array.isArray(data)) return data;
    return data?.result ?? [];
  } catch (e: any) {
    wavoipLogger.warn({ err: e?.message }, "fetchCalls failed");
    return [];
  }
}

export async function fetchDevices(token: string): Promise<WavoipDevice[]> {
  try {
    const { data } = await client(token).post<{ result?: WavoipDevice[] } | WavoipDevice[]>("/fetch-devices");
    if (Array.isArray(data)) return data;
    return data?.result ?? [];
  } catch (e: any) {
    wavoipLogger.warn({ err: e?.message }, "fetchDevices failed");
    return [];
  }
}

export async function fetchCallsByToken(token: string): Promise<WavoipCall[]> {
  try {
    const { data } = await client(token).get<{ result?: WavoipCall[] } | WavoipCall[]>(
      `/calls/${token}`
    );
    if (Array.isArray(data)) return data;
    return data?.result ?? [];
  } catch (e: any) {
    wavoipLogger.warn({ err: e?.message }, "fetchCallsByToken failed");
    return [];
  }
}
