import { prisma } from "../db/client";
import { eventBus } from "./eventBus";
import { getSession } from "../baileys/sessionManager";
import { t, isValidLocale } from "../utils/i18n";
import { pabxLogger as logger } from "../utils/logger";
import { isWithinBusinessHours } from "./businessHours";
import { sendWelcomeSequence } from "./welcomeSequence";
import { getSettingSync } from "./settings";
import { evaluateRouting } from "./routing";

async function rejectAndNotify(
  wbot: any,
  whatsappCallId: string | undefined,
  jid: string,
  text: string,
  sessionId: number,
  reason: string
) {
  if (whatsappCallId) {
    try {
      await wbot.rejectCall?.(whatsappCallId, jid);
    } catch (e) {
      logger.warn({ err: e, sessionId }, `rejectCall failed (${reason})`);
    }
  }
  try {
    await wbot.sendMessage(jid, { text });
  } catch (e) {
    logger.warn({ err: e, sessionId }, `notify message failed (${reason})`);
  }
  logger.info({ sessionId, reason }, "Call rejected + notified");
}

eventBus.on("call.incoming", async (payload) => {
  try {
    const session = await prisma.session.findUnique({ where: { id: payload.sessionId } });
    if (!session) return;

    const wbot = getSession(payload.sessionId);
    if (!wbot) {
      logger.warn({ sessionId: payload.sessionId }, "WASocket not active, cannot auto-reply");
      return;
    }

    const locale = isValidLocale(session.locale) ? session.locale : "pt-BR";
    const jid = (payload as any).jid ?? `${payload.from}@s.whatsapp.net`;

    // === Smart routing (blacklist/VIP/repeat caller/custom rules) ===
    const routing = await evaluateRouting({
      sessionId: session.id,
      from: payload.from,
      whatsappCallId: payload.whatsappCallId,
    });
    if (routing.shortCircuit) {
      logger.info(
        { sessionId: session.id, reason: routing.reason },
        "Routing short-circuit - silent reject"
      );
      if (payload.whatsappCallId) {
        try {
          await wbot.rejectCall?.(payload.whatsappCallId, jid);
        } catch (e) {
          logger.warn({ err: e }, "rejectCall failed (routing)");
        }
      }
      return;
    }

    // === Pre-checagens: status do agente e horario comercial ===
    const agentStatus = getSettingSync("agent_status");
    const agentBusyReject = getSettingSync("agent_busy_reject");
    const outsideHoursReject = getSettingSync("outside_hours_reject");

    if (agentStatus === "busy" && agentBusyReject) {
      await rejectAndNotify(
        wbot,
        payload.whatsappCallId,
        jid,
        getSettingSync("agent_busy_message"),
        session.id,
        "agent-busy"
      );
      return;
    }
    if (agentStatus === "paused" && agentBusyReject) {
      await rejectAndNotify(
        wbot,
        payload.whatsappCallId,
        jid,
        getSettingSync("agent_paused_message"),
        session.id,
        "agent-paused"
      );
      return;
    }

    const inBusinessHours = await isWithinBusinessHours();
    if (!inBusinessHours && outsideHoursReject) {
      await rejectAndNotify(
        wbot,
        payload.whatsappCallId,
        jid,
        getSettingSync("outside_hours_message"),
        session.id,
        "outside-hours"
      );
      return;
    }

    if (!session.rejectCalls && !session.ivrEnabled) return;

    // 1) Rejeita a chamada (se configurado)
    if (session.rejectCalls && payload.whatsappCallId) {
      try {
        await wbot.rejectCall?.(payload.whatsappCallId, jid);
        logger.info(
          { sessionId: session.id, from: payload.from, callId: payload.whatsappCallId },
          "Call rejected"
        );
      } catch (e) {
        logger.warn({ err: e }, "rejectCall failed (continuing with text reply)");
      }
    }

    // 2) Mensagem/sequencia de boas-vindas
    await sendWelcomeSequence(wbot, jid, session, locale).catch((e) =>
      logger.warn({ err: e, sessionId: session.id }, "welcome sequence failed")
    );

    if (payload.callId) {
      await prisma.callEvent.create({
        data: {
          callId: payload.callId,
          type: "auto_reply",
          payload: JSON.stringify({
            locale,
            hasSequence: !!session.welcomeSequence,
          }),
        },
      });
    }

    logger.info(
      { sessionId: session.id, from: payload.from, locale, ivrEnabled: session.ivrEnabled },
      "Auto-reply sent"
    );

    // 3) IVR ativo? Inicia fluxo (handled em ivr/engine.ts)
    if (session.ivrEnabled && inBusinessHours) {
      eventBus.emit("ivr.input", {
        sessionId: session.id,
        callId: payload.callId ?? 0,
        from: payload.from,
        input: "__START__",
        timestamp: Date.now(),
      });
    }
  } catch (e) {
    logger.error({ err: e, payload }, "auto-reply failed");
  }
});
