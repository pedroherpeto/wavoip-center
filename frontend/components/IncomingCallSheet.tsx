"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, AlertTriangle, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useWebphoneStore } from "@/lib/store/webphone-store";
import { formatPhone, initials } from "@/lib/utils";

export function IncomingCallSheet() {
  const t = useTranslations();
  const incoming = useWebphoneStore((s) => s.incomingCall);
  const accept = useWebphoneStore((s) => s.acceptIncoming);
  const reject = useWebphoneStore((s) => s.rejectIncoming);
  const widgetReady = useWebphoneStore((s) => s.widgetReady);
  const openSendMessage = useWebphoneStore((s) => s.openSendMessage);

  React.useEffect(() => {
    if (incoming && typeof navigator !== "undefined" && navigator.vibrate) {
      // pulse vibration
      navigator.vibrate([200, 100, 200, 100, 200]);
    }
  }, [incoming]);

  return (
    <AnimatePresence>
      {incoming && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={reject}
          />

          {/* Mobile: bottom sheet | Desktop: centered modal */}
          <motion.div
            initial={{ y: "100%", opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: "100%", opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed z-50 inset-x-0 bottom-0 lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[420px]"
          >
            <div className="glass rounded-t-3xl lg:rounded-3xl border-t lg:border p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
              <div className="flex flex-col items-center text-center gap-4">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="relative h-24 w-24 rounded-full bg-wavoip-500/20 flex items-center justify-center"
                >
                  <div className="absolute inset-0 rounded-full ring-4 ring-wavoip-500/30 animate-ping" />
                  <span className="text-2xl font-semibold text-wavoip-500">
                    {initials(incoming.contactName || incoming.from)}
                  </span>
                </motion.div>

                <div>
                  <p className="text-sm text-[var(--muted-foreground)] uppercase tracking-wide">
                    {t("call.incomingTitle")}
                  </p>
                  <h2 className="text-2xl font-semibold mt-1">
                    {incoming.contactName || formatPhone(incoming.from)}
                  </h2>
                  {incoming.contactName && (
                    <p className="text-sm text-[var(--muted-foreground)] mt-1">
                      {formatPhone(incoming.from)}
                    </p>
                  )}
                </div>

                {!widgetReady && (
                  <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Widget Wavoip carregando ou indisponivel. Voce ainda pode
                      rejeitar e responder por mensagem.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 w-full mt-2">
                  <button
                    onClick={() => reject()}
                    aria-label={t("common.reject")}
                    className="flex items-center justify-center gap-2 h-16 rounded-2xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-semibold transition-colors"
                  >
                    <PhoneOff className="h-6 w-6" />
                    {t("common.reject")}
                  </button>
                  <button
                    onClick={accept}
                    disabled={!widgetReady}
                    aria-label={t("common.accept")}
                    className="flex items-center justify-center gap-2 h-16 rounded-2xl bg-wavoip-500 hover:bg-wavoip-400 active:bg-wavoip-600 text-black font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Phone className="h-6 w-6" />
                    {t("common.accept")}
                  </button>
                </div>

                {incoming.sessionId && (
                  <button
                    onClick={() => {
                      reject();
                      openSendMessage({
                        sessionId: incoming.sessionId!,
                        to: incoming.from,
                        contactName: incoming.contactName,
                      });
                    }}
                    className="flex items-center justify-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mt-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Recusar e enviar mensagem
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
