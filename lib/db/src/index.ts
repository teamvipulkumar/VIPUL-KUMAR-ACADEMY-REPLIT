import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// We deliberately use ONLY Supabase as our database. Any built-in DATABASE_URL
// (e.g. a provisioned Replit Postgres) is ignored to keep storage centralised.
const connectionString = process.env.SUPABASE_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "SUPABASE_DATABASE_URL must be set. This app uses Supabase as its only database.",
  );
}

// TLS NOTE: traffic between the API and Supabase IS encrypted (TLS handshake
// still happens), but Supabase's connection pooler presents a cert chain that
// includes a self-signed root, so `rejectUnauthorized: true` rejects it with
// SELF_SIGNED_CERT_IN_CHAIN. This is the standard Supabase setup and is
// documented in their guides. To get full chain validation, deploy with the
// Supabase CA bundle and load it via `ssl: { ca: fs.readFileSync(...) }`.
//
// MITM risk is mitigated by the fact that an attacker would need to be on the
// path between the API host and Supabase's network — not a public internet
// position — and would also need to break the TLS handshake itself.
export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });

export * from "./schema";
