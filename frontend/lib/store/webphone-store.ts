"use client";

import { create } from "zustand";
import { rejectCallApi, endCallApi } from "@/lib/api";

export type AgentStatus = "available" | "busy" | "paused";

export interface PendingWavoipCall {
  phone: string;
  token?: string;
  ticketId?: number | string;
  contactName?: string;
  contactPic?: string;
  inboxName?: string;
}

export interface IncomingCallPayload {
  callId: string | number;
  callDbId?: number; // id da Call no banco (para chamar reject/end APIs)
  from: string;
  contactName?: string;
  contactPic?: string;
  sessionId?: number;
  startedAt?: string;
}

export interface SendMessageRequest {
  sessionId: number;
  to: string;
  prefilledText?: string;
  contactName?: string;
}

export interface WavoipTokenEntry {
  token: string;
  inboxName: string;
  sessionId: number;
}

export interface ActiveCall {
  callId: string | number;
  phone: string;
  contactName?: string;
  contactPic?: string;
  direction: "incoming" | "outgoing";
  startedAt: number;
  muted: boolean;
  notes: string;
}

interface WebphoneState {
  agentStatus: AgentStatus;
  pendingWavoipCall: PendingWavoipCall | null;
  incomingCall: IncomingCallPayload | null;
  activeCall: ActiveCall | null;
  sendMessageRequest: SendMessageRequest | null;
  widgetReady: boolean;
  widgetWarning: string | null;
  wavoipTokens: Record<string, WavoipTokenEntry>; // key = token
  isDialing: boolean;

  setAgentStatus: (status: AgentStatus) => void;

  requestWavoipCall: (payload: PendingWavoipCall) => void;
  clearPendingCall: () => void;

  addWavoipToken: (entry: WavoipTokenEntry) => void;
  removeWavoipToken: (token: string) => void;
  clearWavoipTokens: () => void;

  setIncomingCall: (call: IncomingCallPayload | null) => void;
  acceptIncoming: () => void;
  rejectIncoming: () => Promise<void>;

  startActiveCall: (call: ActiveCall) => void;
  endActiveCall: () => Promise<void>;
  toggleMute: () => void;
  setNotes: (notes: string) => void;

  openSendMessage: (req: SendMessageRequest) => void;
  closeSendMessage: () => void;

  setWidgetReady: (ready: boolean) => void;
  setWidgetWarning: (warning: string | null) => void;

  setDialing: (dialing: boolean) => void;
}

export const useWebphoneStore = create<WebphoneState>((set, get) => ({
  agentStatus: "available",
  pendingWavoipCall: null,
  incomingCall: null,
  activeCall: null,
  sendMessageRequest: null,
  widgetReady: false,
  widgetWarning: null,
  wavoipTokens: {},
  isDialing: false,

  setAgentStatus: (status) => set({ agentStatus: status }),

  requestWavoipCall: (payload) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(20);
    }
    set({ pendingWavoipCall: payload });
  },
  clearPendingCall: () => set({ pendingWavoipCall: null }),

  addWavoipToken: (entry) =>
    set((state) => ({
      wavoipTokens: { ...state.wavoipTokens, [entry.token]: entry },
    })),
  removeWavoipToken: (token) =>
    set((state) => {
      const next = { ...state.wavoipTokens };
      delete next[token];
      return { wavoipTokens: next };
    }),
  clearWavoipTokens: () => set({ wavoipTokens: {} }),

  setIncomingCall: (call) => set({ incomingCall: call }),
  acceptIncoming: () => {
    const inc = get().incomingCall;
    if (!inc) return;
    set({
      incomingCall: null,
      activeCall: {
        callId: inc.callId,
        phone: inc.from,
        contactName: inc.contactName,
        contactPic: inc.contactPic,
        direction: "incoming",
        startedAt: Date.now(),
        muted: false,
        notes: "",
      },
    });
  },
  rejectIncoming: async () => {
    const inc = get().incomingCall;
    set({ incomingCall: null });
    if (!inc?.callDbId) return;
    try {
      await rejectCallApi(inc.callDbId);
    } catch (e) {
      console.error("[webphone] rejectCallApi failed", e);
    }
  },

  startActiveCall: (call) => set({ activeCall: call }),
  endActiveCall: async () => {
    const active = get().activeCall;
    set({ activeCall: null });
    if (typeof active?.callId === "number") {
      try {
        await endCallApi(active.callId as number);
      } catch (e) {
        console.error("[webphone] endCallApi failed", e);
      }
    }
  },
  toggleMute: () => {
    const active = get().activeCall;
    if (!active) return;
    set({ activeCall: { ...active, muted: !active.muted } });
  },
  setNotes: (notes) => {
    const active = get().activeCall;
    if (!active) return;
    set({ activeCall: { ...active, notes } });
  },

  openSendMessage: (req) => set({ sendMessageRequest: req }),
  closeSendMessage: () => set({ sendMessageRequest: null }),

  setWidgetReady: (ready) => set({ widgetReady: ready }),
  setWidgetWarning: (warning) => set({ widgetWarning: warning }),

  setDialing: (dialing) => set({ isDialing: dialing }),
}));
