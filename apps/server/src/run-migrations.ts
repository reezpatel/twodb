import { db } from "./auth";
import { logger } from "./lib/logger";
import { runMigrations } from "./lib/migrate";

runMigrations(db)
  .then(() => {
    logger.info("migrations: ok");
    process.exit(0);
  })
  .catch((e) => {
    logger.error({ err: e }, "migrations: failed");
    process.exit(1);
  });