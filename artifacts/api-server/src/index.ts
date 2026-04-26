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

  // Enable RLS on all public tables and add explicit deny-all policies for anon/authenticated
  // roles (Supabase PostgREST roles). The API server connects as the postgres superuser
  // which bypasses RLS, so this has zero effect on existing queries.
  // This silences both "RLS Disabled" and "RLS Enabled No Policy" Security Advisor warnings.
  try {
    await db.execute(sql`
      DO $$
      DECLARE
        tbl text;
      BEGIN
        FOR tbl IN
          SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        LOOP
          -- Enable RLS
          EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
          -- Drop old deny policy if exists, then re-create (idempotent)
          EXECUTE format('DROP POLICY IF EXISTS deny_external_access ON public.%I', tbl);
          EXECUTE format(
            'CREATE POLICY deny_external_access ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
            tbl
          );
        END LOOP;
      END
      $$;
    `);
    logger.info("RLS enabled with deny-all policies on all public tables");
  } catch (e) {
    logger.warn({ e }, "RLS migration warning (non-fatal)");
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
