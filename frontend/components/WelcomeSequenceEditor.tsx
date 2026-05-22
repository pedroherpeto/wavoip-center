"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  MessageSquare,
  Music,
  Image as ImageIcon,
} from "lucide-react";
import { type WelcomeStep } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MediaPicker } from "@/components/MediaPicker";

interface Props {
  value: WelcomeStep[];
  onChange: (next: WelcomeStep[]) => void;
}

function StepIcon({ type }: { type: WelcomeStep["type"] }) {
  if (type === "audio") return <Music className="h-4 w-4" />;
  if (type === "image") return <ImageIcon className="h-4 w-4" />;
  return <MessageSquare className="h-4 w-4" />;
}

export function WelcomeSequenceEditor({ value, onChange }: Props) {
  function update(idx: number, patch: Partial<WelcomeStep>) {
    onChange(value.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }
  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  }
  function add(type: WelcomeStep["type"]) {
    onChange([
      ...value,
      type === "text"
        ? { type, text: "" }
        : type === "audio"
          ? { type, audioUrl: "" }
          : { type, imageUrl: "", caption: "" },
    ]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>Sequencia de boas-vindas</Label>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Mensagens enviadas em sequencia quando uma chamada chega. Se vazio,
            usa apenas a mensagem global.
          </p>
        </div>
      </div>

      {value.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--muted-foreground)]">
          Nenhum passo. Adicione abaixo.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {value.map((step, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)]/40 p-3 flex gap-2"
            >
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30"
                  aria-label="Mover para cima"
                >
                  <GripVertical className="h-4 w-4 rotate-180" />
                </button>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === value.length - 1}
                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30"
                  aria-label="Mover para baixo"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-wavoip-500/10 text-wavoip-500 px-2 py-0.5 text-xs">
                    <StepIcon type={step.type} />
                    {step.type}
                  </span>
                  <Input
                    type="number"
                    value={step.delayMs ?? 800}
                    onChange={(e) =>
                      update(i, { delayMs: Number(e.target.value) })
                    }
                    className="h-8 w-24 text-xs"
                    placeholder="delay ms"
                  />
                  <span className="text-xs text-[var(--muted-foreground)]">
                    ms antes
                  </span>
                </div>

                {step.type === "text" && (
                  <Textarea
                    value={step.text ?? ""}
                    onChange={(e) => update(i, { text: e.target.value })}
                    rows={2}
                    placeholder="Texto da mensagem"
                  />
                )}
                {step.type === "audio" && (
                  <>
                    <MediaPicker
                      value={step.audioUrl ?? ""}
                      accept="audio/*"
                      placeholder="https://.../audio.mp3"
                      hint="URL, upload do PC ou biblioteca (mp3/ogg/m4a)"
                      onChange={(url) => update(i, { audioUrl: url })}
                    />
                    <label className="flex items-center gap-2 text-xs cursor-pointer select-none mt-1 rounded-lg bg-wavoip-500/5 border border-wavoip-500/20 px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={!!step.injectOnAnswer}
                        onChange={(e) =>
                          update(i, { injectOnAnswer: e.target.checked })
                        }
                        className="h-4 w-4 accent-wavoip-500"
                      />
                      <span>
                        <strong className="text-wavoip-500">
                          Tocar na chamada ao atender (URA)
                        </strong>
                        <span className="text-[var(--muted-foreground)] block text-[10px]">
                          Quando marcado: este audio NAO sera enviado como mensagem
                          WhatsApp - sera reproduzido mixado com sua voz quando
                          atender a ligacao.
                        </span>
                      </span>
                    </label>
                  </>
                )}
                {step.type === "image" && (
                  <>
                    <MediaPicker
                      value={step.imageUrl ?? ""}
                      accept="image/*"
                      placeholder="https://.../imagem.jpg"
                      hint="URL, upload do PC ou biblioteca (jpg/png/webp)"
                      onChange={(url) => update(i, { imageUrl: url })}
                    />
                    <Input
                      value={step.caption ?? ""}
                      onChange={(e) => update(i, { caption: e.target.value })}
                      placeholder="Legenda (opcional)"
                    />
                  </>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(i)}
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => add("text")}
        >
          <Plus className="h-3 w-3" />
          <MessageSquare className="h-3 w-3" />
          Texto
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => add("audio")}
        >
          <Plus className="h-3 w-3" />
          <Music className="h-3 w-3" />
          Audio
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => add("image")}
        >
          <Plus className="h-3 w-3" />
          <ImageIcon className="h-3 w-3" />
          Imagem
        </Button>
      </div>
    </div>
  );
}
