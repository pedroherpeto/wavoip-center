/**
 * IVR Engine - maquina de estados por chamada.
 *
 * Acionado por:
 * - ivr.input com input "__START__" -> inicia o fluxo default da sessao
 * - ivr.input com texto -> processa resposta do usuario
 *
 * Persiste estado em Call.ivrState (JSON) + Call.ivrPath (breadcrumb legivel).
 */

import { prisma } from "../../db/client";
import { eventBus } from "../eventBus";
import { getSession } from "../../baileys/sessionManager";
import { t, isValidLocale } from "../../utils/i18n";
import { pabxLogger as logger } from "../../utils/logger";
import type { IvrStep, IvrState, IvrStepMenu, IvrOption } from "./types";

function findStep(steps: IvrStep[], id: string): IvrStep | undefined {
  return steps.find((s) => s.id === id);
}

function renderMenuPrompt(step: IvrStepMenu, locale: "pt-BR" | "en-US"): string {
  const header = step.promptKey ? t(step.promptKey, locale) : step.prompt || "";
  const options = step.options
    .map((o) => t("ivr.option", locale, { number: o.key, label: o.label }))
    .join("\n");
  return [header, "", options].filter(Boolean).join("\n");
}

function getStepText(
  step: { text?: string; textKey?: string; promptKey?: string },
  locale: "pt-BR" | "en-US"
): string | null {
  if (step.textKey) return t(step.textKey, locale);
  if (step.promptKey) return t(step.promptKey, locale);
  return step.text ?? null;
}

async function getFlow(sessionId: number, flowId?: number | null) {
  if (flowId) {
    return prisma.flow.findFirst({ where: { id: flowId, active: true } });
  }
  return prisma.flow.findFirst({
    where: { sessionId, trigger: "incoming_call", active: true },
    orderBy: { createdAt: "desc" },
  });
}

async function sendToCaller(sessionId: number, phone: string, text: string): Promise<void> {
  const wbot = getSession(sessionId);
  if (!wbot) {
    logger.warn({ sessionId }, "WASocket missing, cannot send IVR message");
    return;
  }
  await wbot.sendMessage(`${phone}@s.whatsapp.net`, { text });
}

eventBus.on("ivr.input", async (payload) => {
  try {
    const { sessionId, callId, from, input } = payload;

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || !session.ivrEnabled) return;

    const locale = isValidLocale(session.locale) ? session.locale : "pt-BR";

    const call = await prisma.call.findUnique({ where: { id: callId } });
    if (!call && input !== "__START__") return;

    // === INICIO DO FLUXO ===
    if (input === "__START__") {
      const flow = await getFlow(sessionId, session.defaultFlowId);
      if (!flow) {
        logger.warn({ sessionId }, "No IVR flow configured");
        return;
      }
      const steps: IvrStep[] = JSON.parse(flow.steps);
      const first = steps[0];
      if (!first) return;

      const newState: IvrState = {
        flowId: flow.id,
        currentStepId: first.id,
        startedAt: Date.now(),
        inputs: [],
      };

      await prisma.call.update({
        where: { id: callId },
        data: {
          status: "in_ivr",
          ivrState: JSON.stringify(newState),
          ivrPath: first.id,
          events: {
            create: { type: "ivr_response", payload: JSON.stringify({ stepId: first.id }) },
          },
        },
      });

      if (first.type === "menu") {
        await sendToCaller(sessionId, from, renderMenuPrompt(first, locale));
      } else {
        const text = getStepText(first as any, locale);
        if (text) await sendToCaller(sessionId, from, text);
      }
      return;
    }

    // === RESPOSTA DO USUARIO ===
    if (!call?.ivrState) return;
    const state: IvrState = JSON.parse(call.ivrState);
    const flow = await prisma.flow.findUnique({ where: { id: state.flowId } });
    if (!flow) return;

    const steps: IvrStep[] = JSON.parse(flow.steps);
    const current = findStep(steps, state.currentStepId);
    if (!current) return;

    let nextStepId: string | undefined;

    if (current.type === "menu") {
      const option: IvrOption | undefined = current.options.find(
        (o) => o.key.toLowerCase() === input.toLowerCase().trim()
      );
      if (option) {
        nextStepId = option.next;
        await prisma.callEvent.create({
          data: {
            callId,
            type: "ivr_input",
            payload: JSON.stringify({ stepId: current.id, input, matched: option.key }),
          },
        });
      } else {
        // Opcao invalida
        await sendToCaller(sessionId, from, t("ivr.invalid", locale));
        await sendToCaller(sessionId, from, renderMenuPrompt(current, locale));
        return;
      }
    } else if (current.type === "message" && current.next) {
      nextStepId = current.next;
    }

    if (!nextStepId) {
      // Fim implicito
      await prisma.call.update({
        where: { id: callId },
        data: { status: "completed", endedAt: new Date() },
      });
      return;
    }

    const next = findStep(steps, nextStepId);
    if (!next) return;

    state.currentStepId = next.id;
    state.inputs.push({ stepId: current.id, input, at: Date.now() });

    await prisma.call.update({
      where: { id: callId },
      data: {
        ivrState: JSON.stringify(state),
        ivrPath: `${call.ivrPath ?? ""}>${next.id}`,
      },
    });

    if (next.type === "menu") {
      await sendToCaller(sessionId, from, renderMenuPrompt(next, locale));
    } else if (next.type === "transfer") {
      const text = next.text || t("ivr.transferred", locale);
      await sendToCaller(sessionId, from, text);
      await prisma.call.update({
        where: { id: callId },
        data: { status: "transferred", endedAt: new Date() },
      });
    } else if (next.type === "end") {
      const text = getStepText(next, locale);
      if (text) await sendToCaller(sessionId, from, text);
      await prisma.call.update({
        where: { id: callId },
        data: { status: "completed", endedAt: new Date() },
      });
    } else if (next.type === "message") {
      const text = getStepText(next, locale);
      if (text) await sendToCaller(sessionId, from, text);
      if (!next.next) {
        await prisma.call.update({
          where: { id: callId },
          data: { status: "completed", endedAt: new Date() },
        });
      }
    }
  } catch (e) {
    logger.error({ err: e, payload }, "IVR engine error");
  }
});
