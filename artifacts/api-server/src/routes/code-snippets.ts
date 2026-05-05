import { Router } from "express";
import { db, codeSnippetsTable } from "@workspace/db";
import { eq, asc, desc } from "drizzle-orm";
import { requirePermission } from "../middlewares/auth";

// Code snippets inject site-wide scripts, so we gate every admin route on the
// same `settings` staff permission used by the Settings & Pixel admin pages
// (see admin-layout.tsx PERMISSION_MAP). `requirePermission` internally calls
// `requireAdmin`, so super-admins always pass through.
const requireSnippetsAdmin = requirePermission("settings");

const ALLOWED_PLACEMENTS = new Set(["head", "body_start", "body_end"]);

function sanitizePlacement(p: unknown): "head" | "body_start" | "body_end" {
  return typeof p === "string" && ALLOWED_PLACEMENTS.has(p)
    ? (p as "head" | "body_start" | "body_end")
    : "head";
}

// ── Public router: returns enabled snippets only (no auth) ─────────────────
export const publicCodeSnippetsRouter = Router();

publicCodeSnippetsRouter.get("/", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        id: codeSnippetsTable.id,
        name: codeSnippetsTable.name,
        code: codeSnippetsTable.code,
        placement: codeSnippetsTable.placement,
        position: codeSnippetsTable.position,
      })
      .from(codeSnippetsTable)
      .where(eq(codeSnippetsTable.enabled, true))
      .orderBy(asc(codeSnippetsTable.position), asc(codeSnippetsTable.id));
    res.json(rows);
  } catch {
    res.json([]);
  }
});

// ── Admin router: full CRUD ────────────────────────────────────────────────
const router = Router();

router.get("/", requireSnippetsAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(codeSnippetsTable)
    .orderBy(asc(codeSnippetsTable.placement), asc(codeSnippetsTable.position), desc(codeSnippetsTable.id));
  res.json(rows);
});

router.post("/", requireSnippetsAdmin, async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const code = typeof body.code === "string" ? body.code : "";
  const placement = sanitizePlacement(body.placement);
  const enabled = body.enabled === undefined ? true : !!body.enabled;
  const position = typeof body.position === "number" ? body.position : 0;

  if (!name) { res.status(400).json({ error: "Name is required" }); return; }
  if (!code.trim()) { res.status(400).json({ error: "Code is required" }); return; }

  const [created] = await db
    .insert(codeSnippetsTable)
    .values({ name, code, placement, enabled, position })
    .returning();
  res.status(201).json(created);
});

router.put("/:id", requireSnippetsAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = req.body as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  if (typeof body.name === "string") update.name = body.name.trim();
  if (typeof body.code === "string") update.code = body.code;
  if (body.placement !== undefined) update.placement = sanitizePlacement(body.placement);
  if (body.enabled !== undefined) update.enabled = !!body.enabled;
  if (typeof body.position === "number") update.position = body.position;

  if (Object.keys(update).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [existing] = await db
    .select({ id: codeSnippetsTable.id })
    .from(codeSnippetsTable)
    .where(eq(codeSnippetsTable.id, id))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "Snippet not found" }); return; }

  await db.update(codeSnippetsTable).set(update).where(eq(codeSnippetsTable.id, id));
  const [updated] = await db
    .select()
    .from(codeSnippetsTable)
    .where(eq(codeSnippetsTable.id, id))
    .limit(1);
  res.json(updated);
});

router.patch("/:id/toggle", requireSnippetsAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db
    .select()
    .from(codeSnippetsTable)
    .where(eq(codeSnippetsTable.id, id))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "Snippet not found" }); return; }
  await db
    .update(codeSnippetsTable)
    .set({ enabled: !existing.enabled })
    .where(eq(codeSnippetsTable.id, id));
  const [updated] = await db
    .select()
    .from(codeSnippetsTable)
    .where(eq(codeSnippetsTable.id, id))
    .limit(1);
  res.json(updated);
});

router.delete("/:id", requireSnippetsAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db
    .select({ id: codeSnippetsTable.id })
    .from(codeSnippetsTable)
    .where(eq(codeSnippetsTable.id, id))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "Snippet not found" }); return; }
  await db.delete(codeSnippetsTable).where(eq(codeSnippetsTable.id, id));
  res.json({ ok: true });
});

export default router;
