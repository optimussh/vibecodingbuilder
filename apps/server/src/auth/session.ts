import session from "express-session";
import connectPg from "connect-pg-simple";
import { config } from "../config.js";
import { getPool } from "../rag/db.js";
import { log } from "../log.js";

const PgStore = connectPg(session);

let store: session.Store | undefined;

export function createSessionMiddleware() {
  try {
    // Prefer Postgres session store when DB is reachable at boot
    store = new PgStore({
      pool: getPool(),
      tableName: "web_sessions",
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15,
    });
    log.info("session store: postgres (web_sessions)");
  } catch (err) {
    log.warn({ err }, "session store: memory fallback");
    store = undefined;
  }

  return session({
    name: "vibe.sid",
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  });
}
