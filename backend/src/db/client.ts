import { PrismaClient } from "@prisma/client";
import { config } from "../config";
import { logger } from "../utils/logger";

const isDev = config.NODE_ENV !== "production";

export const prisma = new PrismaClient({
  log: isDev ? ["warn", "error"] : ["error"],
});

export async function disconnectPrisma(): Promise<void> {
  logger.info("Prisma client disconnecting");
  await prisma.$disconnect();
}
