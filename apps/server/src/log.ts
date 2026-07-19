import pino from "pino";

export const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "codeharbor" },
});

export function requestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
