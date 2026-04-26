import app from "./app";
import { logger } from "./lib/logger";
import { processSequences, processScheduledCampaigns } from "./routes/crm";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function runMigrations() {
  try {
    await db.execute(sql`ALTER TABLE automation_funnels ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS site_url text NOT NULL DEFAULT ''`);
    await db.execute(sql`ALTER TABLE email_sends ADD COLUMN IF NOT EXISTS html_body text`);
    logger.info("DB migrations OK");
  } catch (e) {
    logger.warn({ e }, "Migration warning (non-fatal)");
  }
}

runMigrations().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");

    setInterval(async () => {
      await processSequences();
      await processScheduledCampaigns();
    }, 10 * 60 * 1000);
  });
});
