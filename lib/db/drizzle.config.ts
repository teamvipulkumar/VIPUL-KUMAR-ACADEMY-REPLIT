import { defineConfig } from "drizzle-kit";
import path from "path";

const connectionString = process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL or SUPABASE_DATABASE_URL must be set, ensure the database is provisioned");
}

const isSupabase = !!process.env.SUPABASE_DATABASE_URL;

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
    ssl: isSupabase ? "require" : undefined,
  },
});
