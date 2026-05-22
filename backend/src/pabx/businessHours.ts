import { prisma } from "../db/client";

/** Retorna true se ESTAMOS DENTRO do horario comercial. */
export async function isWithinBusinessHours(now: Date = new Date()): Promise<boolean> {
  const rules = await prisma.businessHours.findMany({ where: { active: true } });

  // Sem regras = 24/7 considerado horario comercial
  if (rules.length === 0) return true;

  const day = now.getDay();
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  for (const rule of rules) {
    if (rule.dayOfWeek !== day) continue;
    const [oh, om] = rule.openTime.split(":").map(Number);
    const [ch, cm] = rule.closeTime.split(":").map(Number);
    const open = oh * 60 + om;
    const close = ch * 60 + cm;
    if (minutesNow >= open && minutesNow <= close) return true;
  }
  return false;
}
