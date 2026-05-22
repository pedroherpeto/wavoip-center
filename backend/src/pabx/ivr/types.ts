/**
 * Tipos do motor IVR.
 *
 * Um Flow.steps e um array JSON de IvrStep.
 * Exemplo de fluxo simples (menu de 2 niveis):
 *
 * [
 *   { "id": "start", "type": "menu", "prompt": "ivr.welcome",
 *     "options": [
 *       { "key": "1", "label": "Vendas", "next": "sales" },
 *       { "key": "2", "label": "Suporte", "next": "support" }
 *     ], "timeoutSec": 60, "onTimeout": "timeout"
 *   },
 *   { "id": "sales", "type": "message", "text": "Voce escolheu Vendas. Em breve um agente respondera." },
 *   { "id": "support", "type": "message", "text": "Voce escolheu Suporte. Aguarde, ja te respondemos." },
 *   { "id": "timeout", "type": "message", "promptKey": "ivr.timeout" }
 * ]
 */

export type IvrOption = {
  key: string;             // "1", "2", "vendas"
  label: string;
  next: string;            // id do proximo step
};

export type IvrStepMenu = {
  id: string;
  type: "menu";
  prompt?: string;         // texto direto
  promptKey?: string;      // chave i18n
  options: IvrOption[];
  timeoutSec?: number;
  onTimeout?: string;      // id do step se nao responder
  onInvalid?: string;      // id do step se opcao invalida
};

export type IvrStepMessage = {
  id: string;
  type: "message";
  text?: string;
  textKey?: string;
  promptKey?: string;
  next?: string;
};

export type IvrStepTransfer = {
  id: string;
  type: "transfer";
  department?: string;
  text?: string;
};

export type IvrStepEnd = {
  id: string;
  type: "end";
  text?: string;
  textKey?: string;
};

export type IvrStep = IvrStepMenu | IvrStepMessage | IvrStepTransfer | IvrStepEnd;

export type IvrState = {
  flowId: number;
  currentStepId: string;
  startedAt: number;
  inputs: Array<{ stepId: string; input: string; at: number }>;
};
