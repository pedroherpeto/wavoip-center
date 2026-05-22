import axios from "axios";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

export interface CallRecord {
  id: number;
  sessionId: number;
  direction: "incoming" | "outgoing";
  fromNumber: string;
  toNumber?: string | null;
  whatsappCallId?: string | null;
  wavoipCallId?: string | null;
  status: "ringing" | "answered" | "rejected" | "missed" | "completed";
  durationSec?: number | null;
  startedAt: string;
  endedAt?: string | null;
  contactName?: string | null;
}

export async function fetchCalls(params?: {
  status?: string;
  direction?: string;
  limit?: number;
}): Promise<CallRecord[]> {
  const { data } = await api.get<{
    items: CallRecord[];
    count: number;
    limit: number;
    offset: number;
  }>("/calls", { params });
  return data.items ?? [];
}

export async function updateCallStatus(id: number, body: Partial<CallRecord>) {
  const { data } = await api.put(`/calls/${id}`, body);
  return data;
}

export interface WelcomeStep {
  type: "text" | "audio" | "image";
  text?: string;
  audioUrl?: string;
  imageUrl?: string;
  caption?: string;
  delayMs?: number;
  /** Se true em step "audio": nao envia no WhatsApp - sera tocado na chamada ao atender */
  injectOnAnswer?: boolean;
}

export interface SessionRecord {
  id: number;
  name: string;
  number?: string | null;
  status: "OPENING" | "CONNECTED" | "DISCONNECTED" | "QRCODE";
  qrcode?: string | null;
  wavoipTokens?: string | null;
  authPath: string;
  baileysLib: string;
  rejectCalls: boolean;
  callRejectMessage?: string | null;
  welcomeSequence?: string | null; // JSON string
  ivrEnabled: boolean;
  defaultFlowId?: number | null;
  locale: string;
  isActive: boolean;
  retries: number;
  createdAt: string;
  updatedAt: string;
}

export function parseWelcomeSequence(raw?: string | null): WelcomeStep[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (s: any) =>
        s && (s.type === "text" || s.type === "audio" || s.type === "image")
    );
  } catch {
    return [];
  }
}

export async function fetchSessions(): Promise<SessionRecord[]> {
  const { data } = await api.get<SessionRecord[]>("/sessions");
  return data;
}

export async function fetchSession(id: number): Promise<SessionRecord> {
  const { data } = await api.get<SessionRecord>(`/sessions/${id}`);
  return data;
}

export async function createSession(body: {
  name: string;
  locale?: "pt-BR" | "en-US";
  wavoipTokens?: string;
  rejectCalls?: boolean;
  callRejectMessage?: string;
  ivrEnabled?: boolean;
  defaultFlowId?: number;
}): Promise<SessionRecord> {
  const { data } = await api.post<SessionRecord>("/sessions", body);
  return data;
}

export async function updateSession(
  id: number,
  body: Partial<{
    name: string;
    locale: "pt-BR" | "en-US";
    wavoipTokens: string;
    rejectCalls: boolean;
    callRejectMessage: string;
    welcomeSequence: WelcomeStep[] | string | null;
    ivrEnabled: boolean;
    defaultFlowId: number;
  }>
): Promise<SessionRecord> {
  const { data } = await api.put<SessionRecord>(`/sessions/${id}`, body);
  return data;
}

export async function startSessionApi(id: number) {
  const { data } = await api.post(`/sessions/${id}/start`);
  return data;
}

export async function stopSessionApi(id: number) {
  const { data } = await api.post(`/sessions/${id}/stop`);
  return data;
}

export async function deleteSession(id: number) {
  const { data } = await api.delete(`/sessions/${id}`);
  return data;
}

export interface SettingItem {
  key: string;
  type: "string" | "number" | "boolean";
  description: string;
  envVar?: string;
  default: string | number | boolean;
  value: string | number | boolean;
  overridden: boolean;
  secret?: boolean;
  valueMasked?: string;
  enum?: string[];
  enumOpen?: boolean;
}

export async function fetchSettings(): Promise<SettingItem[]> {
  const { data } = await api.get<{ items: SettingItem[] }>("/settings");
  return data.items;
}

export async function updateSettings(
  payload: Record<string, string | number | boolean>
) {
  const { data } = await api.put("/settings", payload);
  return data;
}

export async function resetSetting(key: string) {
  const { data } = await api.delete(`/settings/${key}`);
  return data;
}

export async function rejectCallApi(id: number) {
  const { data } = await api.post(`/calls/${id}/reject`);
  return data;
}

export async function endCallApi(id: number) {
  const { data } = await api.post(`/calls/${id}/end`);
  return data;
}

export async function sendMessageApi(
  sessionId: number,
  to: string,
  text: string
) {
  const { data } = await api.post(`/sessions/${sessionId}/send-message`, {
    to,
    text,
  });
  return data as { ok: boolean; to: string; whatsappMessageId: string | null };
}

export interface BusinessHoursRecord {
  id: number;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  active: boolean;
}

export async function fetchBusinessHours(): Promise<BusinessHoursRecord[]> {
  const { data } = await api.get<{ items: BusinessHoursRecord[] }>(
    "/business-hours"
  );
  return data.items ?? [];
}

export async function createBusinessHours(body: {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  active?: boolean;
}): Promise<BusinessHoursRecord> {
  const { data } = await api.post<BusinessHoursRecord>("/business-hours", body);
  return data;
}

export async function updateBusinessHours(
  id: number,
  body: Partial<{
    openTime: string;
    closeTime: string;
    active: boolean;
  }>
): Promise<BusinessHoursRecord> {
  const { data } = await api.put<BusinessHoursRecord>(
    `/business-hours/${id}`,
    body
  );
  return data;
}

export async function deleteBusinessHours(id: number) {
  await api.delete(`/business-hours/${id}`);
}

export interface CallbackRecord {
  id: number;
  sessionId: number;
  phone: string;
  reason?: string | null;
  status: "pending" | "done" | "cancelled";
  scheduledAt?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export async function fetchCallbacks(params?: {
  status?: string;
  sessionId?: number;
  limit?: number;
}): Promise<CallbackRecord[]> {
  const { data } = await api.get<{ items: CallbackRecord[] }>("/callbacks", {
    params,
  });
  return data.items ?? [];
}

export async function createCallback(body: {
  sessionId: number;
  phone: string;
  reason?: string;
  scheduledAt?: string;
}): Promise<CallbackRecord> {
  const { data } = await api.post<CallbackRecord>("/callbacks", body);
  return data;
}

export interface CallRatingRecord {
  id: number;
  callId: number;
  phone: string;
  score: number;
  comment?: string | null;
  createdAt: string;
}

export interface NpsSummary {
  total: number;
  nps: number;
  avg?: number;
  promoters: number;
  neutrals: number;
  detractors: number;
  promoterPct?: number;
  neutralPct?: number;
  detractorPct?: number;
}

export async function fetchRatings(params?: {
  limit?: number;
}): Promise<CallRatingRecord[]> {
  const { data } = await api.get<{ items: CallRatingRecord[] }>("/ratings", {
    params,
  });
  return data.items ?? [];
}

export async function fetchNpsSummary(): Promise<NpsSummary> {
  const { data } = await api.get<NpsSummary>("/ratings/summary");
  return data;
}

// ============ ContactTag (blacklist/VIP) ============
export interface ContactTag {
  id: number;
  phone: string;
  tag: "blocked" | "vip" | "trusted" | string;
  reason?: string | null;
  createdAt: string;
}

export async function fetchContactTags(filter?: string): Promise<ContactTag[]> {
  const { data } = await api.get<{ items: ContactTag[] }>("/contact-tags", {
    params: filter ? { tag: filter } : {},
  });
  return data.items ?? [];
}

export async function upsertContactTag(body: {
  phone: string;
  tag: "blocked" | "vip" | "trusted";
  reason?: string;
}): Promise<ContactTag> {
  const { data } = await api.post<ContactTag>("/contact-tags", body);
  return data;
}

export async function deleteContactTag(phone: string): Promise<void> {
  await api.delete(`/contact-tags/${phone}`);
}

// ============ RoutingRule ============
export interface RoutingRule {
  id: number;
  name: string;
  priority: number;
  condition: Record<string, any>;
  action: Record<string, any>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchRoutingRules(): Promise<RoutingRule[]> {
  const { data } = await api.get<{ items: RoutingRule[] }>("/routing-rules");
  return data.items ?? [];
}

export async function createRoutingRule(body: {
  name: string;
  priority?: number;
  condition: Record<string, any>;
  action: Record<string, any>;
  active?: boolean;
}): Promise<RoutingRule> {
  const { data } = await api.post<RoutingRule>("/routing-rules", body);
  return data;
}

export async function updateRoutingRule(
  id: number,
  body: Partial<{
    name: string;
    priority: number;
    condition: Record<string, any>;
    action: Record<string, any>;
    active: boolean;
  }>
): Promise<RoutingRule> {
  const { data } = await api.put<RoutingRule>(`/routing-rules/${id}`, body);
  return data;
}

export async function deleteRoutingRule(id: number): Promise<void> {
  await api.delete(`/routing-rules/${id}`);
}

export async function updateCallback(
  id: number,
  body: Partial<{
    status: "pending" | "done" | "cancelled";
    scheduledAt: string | null;
  }>
): Promise<CallbackRecord> {
  const { data } = await api.put<CallbackRecord>(`/callbacks/${id}`, body);
  return data;
}

export interface UploadResult {
  url: string;
  filename: string;
  mimetype: string;
  size: number;
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file, file.name);
  const { data } = await api.post<UploadResult>("/uploads", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export interface MediaItem {
  url: string;
  filename: string;
  size: number;
  createdAt: string;
}

export async function listUploads(): Promise<MediaItem[]> {
  const { data } = await api.get<{ items: MediaItem[] }>("/uploads");
  return data.items ?? [];
}
