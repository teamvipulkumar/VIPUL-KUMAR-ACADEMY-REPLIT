import { Router } from "express";
import { db } from "@workspace/db";
import {
  gstCompanySettingsTable, gstInvoicesTable, paymentsTable, usersTable, coursesTable,
} from "@workspace/db";
import { eq, desc, and, gte, lte, like, count } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

// ── helpers ───────────────────────────────────────────────────────────────────
function getFinancialYear(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return m >= 4
    ? `${String(y).slice(2)}${String(y + 1).slice(2)}`
    : `${String(y - 1).slice(2)}${String(y).slice(2)}`;
}

async function getNextInvoiceNumber(prefix: string, fy: string): Promise<string> {
  const pattern = `${prefix}-${fy}-%`;
  const [row] = await db
    .select({ cnt: count() })
    .from(gstInvoicesTable)
    .where(like(gstInvoicesTable.invoiceNumber, pattern));
  const seq = ((row?.cnt ?? 0) + 1).toString().padStart(4, "0");
  return `${prefix}-${fy}-${seq}`;
}

export async function generateGstInvoice(paymentId: number): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: gstInvoicesTable.id })
      .from(gstInvoicesTable)
      .where(eq(gstInvoicesTable.paymentId, paymentId))
      .limit(1);
    if (existing) return;

    const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId)).limit(1);
    if (!payment || payment.status !== "completed") return;

    const [user] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, payment.userId)).limit(1);
    const [course] = await db.select({ title: coursesTable.title })
      .from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);

    const [settings] = await db.select().from(gstCompanySettingsTable).limit(1);
    const prefix = settings?.invoicePrefix ?? "INV";
    const gstRate = settings?.gstRate ?? 18;
    const companyStateCode = settings?.stateCode ?? "";

    const createdAt = payment.createdAt ?? new Date();
    const fy = getFinancialYear(createdAt);
    const invoiceNumber = await getNextInvoiceNumber(prefix, fy);

    const total = parseFloat(String(payment.amount));
    const baseAmount = parseFloat((total * 100 / (100 + gstRate)).toFixed(2));
    const gstAmount = parseFloat((total - baseAmount).toFixed(2));

    const customerStateCode = "";
    const isInterstate = companyStateCode !== "" && customerStateCode !== companyStateCode;
    const cgst = isInterstate ? 0 : parseFloat((gstAmount / 2).toFixed(2));
    const sgst = isInterstate ? 0 : parseFloat((gstAmount / 2).toFixed(2));
    const igst = isInterstate ? gstAmount : 0;

    await db.insert(gstInvoicesTable).values({
      invoiceNumber,
      paymentId: payment.id,
      userId: payment.userId,
      courseId: payment.courseId,
      customerName: user?.name ?? "",
      customerEmail: user?.email ?? "",
      customerGstin: null,
      customerAddress: "",
      customerState: "",
      customerStateCode,
      courseTitle: course?.title ?? "",
      baseAmount: String(baseAmount),
      gstRate,
      cgstAmount: String(cgst),
      sgstAmount: String(sgst),
      igstAmount: String(igst),
      totalAmount: String(total),
      isInterstate,
      financialYear: fy,
      gateway: payment.gateway,
    });
  } catch (err) {
    console.error("GST invoice generation failed:", err);
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────
router.get("/settings", requireAdmin, async (_req, res): Promise<void> => {
  let [settings] = await db.select().from(gstCompanySettingsTable).limit(1);
  if (!settings) {
    await db.insert(gstCompanySettingsTable).values({});
    [settings] = await db.select().from(gstCompanySettingsTable).limit(1);
  }
  res.json(settings);
});

router.put("/settings", requireAdmin, async (req, res): Promise<void> => {
  const body = req.body;
  let [existing] = await db.select({ id: gstCompanySettingsTable.id }).from(gstCompanySettingsTable).limit(1);
  if (!existing) {
    await db.insert(gstCompanySettingsTable).values({});
    [existing] = await db.select({ id: gstCompanySettingsTable.id }).from(gstCompanySettingsTable).limit(1);
  }
  await db.update(gstCompanySettingsTable).set({
    companyName: body.companyName ?? "",
    gstin: body.gstin ?? "",
    addressLine1: body.addressLine1 ?? "",
    addressLine2: body.addressLine2 ?? "",
    city: body.city ?? "",
    state: body.state ?? "",
    stateCode: body.stateCode ?? "",
    pincode: body.pincode ?? "",
    email: body.email ?? "",
    phone: body.phone ?? "",
    logoUrl: body.logoUrl ?? null,
    gstRate: parseInt(body.gstRate ?? "18"),
    invoicePrefix: body.invoicePrefix ?? "INV",
  }).where(eq(gstCompanySettingsTable.id, existing.id));
  const [updated] = await db.select().from(gstCompanySettingsTable).limit(1);
  res.json(updated);
});

// ── Invoices list ─────────────────────────────────────────────────────────────
router.get("/invoices", requireAdmin, async (req, res): Promise<void> => {
  const { month, year, search } = req.query as Record<string, string>;
  const conditions = [];

  if (month && year) {
    const start = new Date(parseInt(year), parseInt(month) - 1, 1);
    const end = new Date(parseInt(year), parseInt(month), 1);
    conditions.push(gte(gstInvoicesTable.createdAt, start));
    conditions.push(lte(gstInvoicesTable.createdAt, end));
  } else if (year) {
    const start = new Date(parseInt(year), 0, 1);
    const end = new Date(parseInt(year) + 1, 0, 1);
    conditions.push(gte(gstInvoicesTable.createdAt, start));
    conditions.push(lte(gstInvoicesTable.createdAt, end));
  }

  let invoices = await db.select().from(gstInvoicesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(gstInvoicesTable.createdAt));

  if (search) {
    const q = search.toLowerCase();
    invoices = invoices.filter(i =>
      i.invoiceNumber.toLowerCase().includes(q) ||
      i.customerName.toLowerCase().includes(q) ||
      i.customerEmail.toLowerCase().includes(q) ||
      i.courseTitle.toLowerCase().includes(q)
    );
  }

  res.json(invoices);
});

// ── Single invoice ────────────────────────────────────────────────────────────
router.get("/invoices/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [invoice] = await db.select().from(gstInvoicesTable).where(eq(gstInvoicesTable.id, id)).limit(1);
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
  const [settings] = await db.select().from(gstCompanySettingsTable).limit(1);
  res.json({ invoice, settings: settings ?? null });
});

// ── Manual generate for a payment ────────────────────────────────────────────
router.post("/invoices/generate/:paymentId", requireAdmin, async (req, res): Promise<void> => {
  const paymentId = parseInt(req.params.paymentId);
  await generateGstInvoice(paymentId);
  const [invoice] = await db.select().from(gstInvoicesTable)
    .where(eq(gstInvoicesTable.paymentId, paymentId)).limit(1);
  if (!invoice) { res.status(404).json({ error: "Could not generate invoice" }); return; }
  res.json(invoice);
});

// ── Bulk generate for all completed payments missing invoices ─────────────────
router.post("/invoices/generate-all", requireAdmin, async (_req, res): Promise<void> => {
  const payments = await db.select({ id: paymentsTable.id })
    .from(paymentsTable)
    .where(eq(paymentsTable.status, "completed"));

  const existingInvoicePaymentIds = new Set(
    (await db.select({ paymentId: gstInvoicesTable.paymentId }).from(gstInvoicesTable))
      .map(i => i.paymentId)
  );

  const missing = payments.filter(p => !existingInvoicePaymentIds.has(p.id));
  for (const p of missing) await generateGstInvoice(p.id);
  res.json({ generated: missing.length });
});

// ── Monthly summary ───────────────────────────────────────────────────────────
router.get("/summary/monthly", requireAdmin, async (req, res): Promise<void> => {
  const { year } = req.query as Record<string, string>;
  const y = parseInt(year ?? String(new Date().getFullYear()));

  const invoices = await db.select().from(gstInvoicesTable)
    .where(and(
      gte(gstInvoicesTable.createdAt, new Date(y, 0, 1)),
      lte(gstInvoicesTable.createdAt, new Date(y + 1, 0, 1))
    ));

  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    label: new Date(y, i, 1).toLocaleString("en-IN", { month: "long" }),
    count: 0,
    taxable: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    total: 0,
  }));

  for (const inv of invoices) {
    const m = new Date(inv.createdAt).getMonth();
    months[m].count++;
    months[m].taxable += parseFloat(String(inv.baseAmount));
    months[m].cgst += parseFloat(String(inv.cgstAmount));
    months[m].sgst += parseFloat(String(inv.sgstAmount));
    months[m].igst += parseFloat(String(inv.igstAmount));
    months[m].total += parseFloat(String(inv.totalAmount));
  }

  res.json({ year: y, months: months.map(m => ({ ...m, taxable: parseFloat(m.taxable.toFixed(2)), cgst: parseFloat(m.cgst.toFixed(2)), sgst: parseFloat(m.sgst.toFixed(2)), igst: parseFloat(m.igst.toFixed(2)), total: parseFloat(m.total.toFixed(2)) })) });
});

// ── State-wise report ─────────────────────────────────────────────────────────
router.get("/summary/state", requireAdmin, async (req, res): Promise<void> => {
  const { year } = req.query as Record<string, string>;
  const y = parseInt(year ?? String(new Date().getFullYear()));

  const invoices = await db.select().from(gstInvoicesTable)
    .where(and(
      gte(gstInvoicesTable.createdAt, new Date(y, 0, 1)),
      lte(gstInvoicesTable.createdAt, new Date(y + 1, 0, 1))
    ));

  const stateMap = new Map<string, { state: string; count: number; taxable: number; cgst: number; sgst: number; igst: number; total: number }>();
  for (const inv of invoices) {
    const state = inv.customerState || "Unknown";
    if (!stateMap.has(state)) stateMap.set(state, { state, count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
    const s = stateMap.get(state)!;
    s.count++;
    s.taxable += parseFloat(String(inv.baseAmount));
    s.cgst += parseFloat(String(inv.cgstAmount));
    s.sgst += parseFloat(String(inv.sgstAmount));
    s.igst += parseFloat(String(inv.igstAmount));
    s.total += parseFloat(String(inv.totalAmount));
  }

  const result = Array.from(stateMap.values())
    .map(s => ({ ...s, taxable: parseFloat(s.taxable.toFixed(2)), cgst: parseFloat(s.cgst.toFixed(2)), sgst: parseFloat(s.sgst.toFixed(2)), igst: parseFloat(s.igst.toFixed(2)), total: parseFloat(s.total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total);

  res.json({ year: y, states: result });
});

export default router;
