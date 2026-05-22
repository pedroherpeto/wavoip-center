/**
 * Seed inicial - cria um Flow IVR de exemplo (menu 2 niveis, bilingue).
 * Roda com: npm run db:seed
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.flow.findFirst({
    where: { name: "Menu padrao bilingue" },
  });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log("Seed flow ja existe (id=" + existing.id + "), skip");
    return;
  }

  const stepsPt = [
    {
      id: "start",
      type: "menu",
      promptKey: "ivr.welcome",
      options: [
        { key: "1", label: "Vendas", next: "sales" },
        { key: "2", label: "Suporte tecnico", next: "support" },
        { key: "3", label: "Financeiro", next: "finance" },
      ],
      timeoutSec: 60,
      onTimeout: "timeout",
    },
    {
      id: "sales",
      type: "transfer",
      department: "sales",
      text: "Voce escolheu Vendas. Em breve um consultor entrara em contato.",
    },
    {
      id: "support",
      type: "transfer",
      department: "support",
      text: "Voce escolheu Suporte. Aguarde, ja te respondemos.",
    },
    {
      id: "finance",
      type: "transfer",
      department: "finance",
      text: "Voce escolheu Financeiro. Em breve te atenderemos.",
    },
    {
      id: "timeout",
      type: "end",
      textKey: "ivr.timeout",
    },
  ];

  const flow = await prisma.flow.create({
    data: {
      name: "Menu padrao bilingue",
      trigger: "incoming_call",
      locale: "pt-BR",
      steps: JSON.stringify(stepsPt),
      active: true,
    },
  });

  // eslint-disable-next-line no-console
  console.log("Seed flow criado: id=" + flow.id);

  // BusinessHours: seg-sex 09:00-18:00
  await prisma.businessHours.deleteMany({});
  for (let day = 1; day <= 5; day++) {
    await prisma.businessHours.create({
      data: { dayOfWeek: day, openTime: "09:00", closeTime: "18:00", active: true },
    });
  }
  // eslint-disable-next-line no-console
  console.log("BusinessHours: Seg-Sex 09:00-18:00");
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
