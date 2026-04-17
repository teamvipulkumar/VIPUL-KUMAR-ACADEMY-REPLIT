import { Router } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import { usersTable, adminStaffTable } from "@workspace/db";
import { DEFAULT_PERMISSIONS } from "@workspace/db";
import type { StaffPermissions } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin, type JwtPayload } from "../middlewares/auth";
import type { Request } from "express";

const router = Router();
type AuthedRequest = Request & { user: JwtPayload };

router.get("/", requireAdmin, async (req, res): Promise<void> => {
  const staff = await db
    .select()
    .from(adminStaffTable)
    .orderBy(desc(adminStaffTable.createdAt));
  res.json(staff);
});

router.post("/", requireAdmin, async (req: Request, res): Promise<void> => {
  const authed = req as AuthedRequest;
  const { email, name, roleName, permissions, notes } = req.body as {
    email: string; name: string; roleName: string;
    permissions: StaffPermissions; notes?: string;
  };

  if (!email || !name || !roleName || !permissions) {
    res.status(400).json({ error: "email, name, roleName, and permissions are required" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  let targetUser = existing[0];

  if (targetUser) {
    if (targetUser.role === "admin") {
      const alreadyStaff = await db.select().from(adminStaffTable).where(eq(adminStaffTable.userId, targetUser.id)).limit(1);
      if (alreadyStaff.length === 0) {
        res.status(400).json({ error: "This user is already a super admin and cannot be added as staff." });
        return;
      }
    }
    const alreadyStaff = await db.select().from(adminStaffTable).where(eq(adminStaffTable.userId, targetUser.id)).limit(1);
    if (alreadyStaff.length > 0) {
      res.status(400).json({ error: "This user is already a staff member." });
      return;
    }
  } else {
    const tempPassword = nanoid(12);
    const hashed = await bcrypt.hash(tempPassword, 10);
    const referralCode = nanoid(8).toUpperCase();
    const [created] = await db.insert(usersTable).values({
      email: email.toLowerCase(),
      password: hashed,
      name,
      referralCode,
      role: "student",
      emailVerified: true,
    }).returning();
    targetUser = created;
  }

  const previousRole = targetUser.role;
  await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, targetUser.id));

  const [staffRecord] = await db.insert(adminStaffTable).values({
    userId: targetUser.id,
    name: targetUser.name,
    email: targetUser.email,
    roleName,
    permissions: permissions ?? DEFAULT_PERMISSIONS,
    previousRole,
    status: "active",
    invitedBy: authed.user.userId,
    notes: notes ?? null,
  }).returning();

  res.status(201).json(staffRecord);
});

router.patch("/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { roleName, permissions, notes } = req.body as {
    roleName?: string; permissions?: StaffPermissions; notes?: string;
  };

  const updates: Partial<typeof adminStaffTable.$inferInsert> = { updatedAt: new Date() };
  if (roleName !== undefined) updates.roleName = roleName;
  if (permissions !== undefined) updates.permissions = permissions;
  if (notes !== undefined) updates.notes = notes;

  const [updated] = await db.update(adminStaffTable).set(updates).where(eq(adminStaffTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Staff member not found" }); return; }
  res.json(updated);
});

router.post("/:id/revoke", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [staff] = await db.select().from(adminStaffTable).where(eq(adminStaffTable.id, id)).limit(1);
  if (!staff) { res.status(404).json({ error: "Staff member not found" }); return; }

  await db.update(usersTable).set({ role: staff.previousRole as "student" | "affiliate" }).where(eq(usersTable.id, staff.userId));
  const [updated] = await db.update(adminStaffTable).set({ status: "revoked", updatedAt: new Date() }).where(eq(adminStaffTable.id, id)).returning();
  res.json(updated);
});

router.post("/:id/restore", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [staff] = await db.select().from(adminStaffTable).where(eq(adminStaffTable.id, id)).limit(1);
  if (!staff) { res.status(404).json({ error: "Staff member not found" }); return; }

  await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, staff.userId));
  const [updated] = await db.update(adminStaffTable).set({ status: "active", updatedAt: new Date() }).where(eq(adminStaffTable.id, id)).returning();
  res.json(updated);
});

router.delete("/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [staff] = await db.select().from(adminStaffTable).where(eq(adminStaffTable.id, id)).limit(1);
  if (!staff) { res.status(404).json({ error: "Staff member not found" }); return; }

  await db.update(usersTable).set({ role: staff.previousRole as "student" | "affiliate" }).where(eq(usersTable.id, staff.userId));
  await db.delete(adminStaffTable).where(eq(adminStaffTable.id, id));
  res.json({ success: true });
});

export default router;
