"use client";

import * as React from "react";
import { Trash2, Plus } from "lucide-react";
import {
  fetchBusinessHours,
  createBusinessHours,
  updateBusinessHours,
  deleteBusinessHours,
  type BusinessHoursRecord,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const DAYS = [
  "Domingo",
  "Segunda",
  "Terca",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sabado",
];

export function BusinessHoursSection() {
  const [items, setItems] = React.useState<BusinessHoursRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setItems(await fetchBusinessHours());
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function addDay(dayOfWeek: number) {
    await createBusinessHours({
      dayOfWeek,
      openTime: "09:00",
      closeTime: "18:00",
      active: true,
    });
    load();
  }

  async function update(id: number, body: Partial<BusinessHoursRecord>) {
    await updateBusinessHours(id, body);
    load();
  }

  async function remove(id: number) {
    if (!confirm("Apagar este horario?")) return;
    await deleteBusinessHours(id);
    load();
  }

  const usedDays = new Set(items.map((i) => i.dayOfWeek));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Horario comercial</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Quando ativo, mensagens automaticas de "fora do expediente" sao
          enviadas fora desses horarios.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3">
            {items.map((item) => (
              <Card key={item.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base">
                    {DAYS[item.dayOfWeek]}
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={item.active}
                      onCheckedChange={(v) => update(item.id, { active: v })}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(item.id)}
                      aria-label="Apagar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-3">
                    <div className="flex flex-col gap-2 flex-1">
                      <Label htmlFor={`open-${item.id}`}>Abertura</Label>
                      <Input
                        id={`open-${item.id}`}
                        type="time"
                        defaultValue={item.openTime}
                        onBlur={(e) =>
                          e.target.value !== item.openTime &&
                          update(item.id, { openTime: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                      <Label htmlFor={`close-${item.id}`}>Fechamento</Label>
                      <Input
                        id={`close-${item.id}`}
                        type="time"
                        defaultValue={item.closeTime}
                        onBlur={(e) =>
                          e.target.value !== item.closeTime &&
                          update(item.id, { closeTime: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Adicionar dia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((name, i) => (
                  <Button
                    key={i}
                    size="sm"
                    variant="outline"
                    onClick={() => addDay(i)}
                    disabled={usedDays.has(i)}
                  >
                    <Plus className="h-3 w-3" />
                    {name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
