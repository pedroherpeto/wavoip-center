"use client";

import * as React from "react";
import { getSocket } from "@/lib/socket";
import { useWebphoneStore } from "@/lib/store/webphone-store";

/**
 * Connects to the backend Socket.IO server and forwards realtime call events
 * into the zustand store.
 */
export function SocketBridge() {
  const setIncomingCall = useWebphoneStore((s) => s.setIncomingCall);
  const endActiveCall = useWebphoneStore((s) => s.endActiveCall);

  React.useEffect(() => {
    const socket = getSocket();

    const onIncoming = (payload: {
      callId?: number;
      callDbId?: number;
      whatsappCallId?: string;
      from: string;
      contactName?: string;
      contactPic?: string;
      sessionId?: number;
    }) => {
      const callDbId = payload.callDbId ?? payload.callId;
      setIncomingCall({
        callId: payload.whatsappCallId ?? String(callDbId ?? Date.now()),
        callDbId,
        from: payload.from,
        contactName: payload.contactName,
        contactPic: payload.contactPic,
        sessionId: payload.sessionId,
        startedAt: new Date().toISOString(),
      });
    };
    const onTerminated = () => {
      endActiveCall();
      setIncomingCall(null);
    };

    socket.on("call.incoming", onIncoming);
    socket.on("call.terminated", onTerminated);
    socket.on("call.answered", () => {
      // optionally update something — left as no-op for now
    });

    return () => {
      socket.off("call.incoming", onIncoming);
      socket.off("call.terminated", onTerminated);
    };
  }, [setIncomingCall, endActiveCall]);

  return null;
}
