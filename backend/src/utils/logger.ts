import pino from "pino";
import { config } from "../config";

const isDev = config.NODE_ENV !== "production";

export const logger = pino({
  level: config.LOG_LEVEL,
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "yyyy-mm-dd HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
  }),
});

export const baileysLogger = logger.child({ module: "baileys" });
export const httpLogger = logger.child({ module: "http" });
export const pabxLogger = logger.child({ module: "pabx" });
