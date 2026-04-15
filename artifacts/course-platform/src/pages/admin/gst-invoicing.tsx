import { Fragment, useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileText, Printer, Settings2, BarChart3, MapPin, Search, RefreshCw, Download, Eye, Trash2 } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const INDIAN_STATES = [
  { name: "Andhra Pradesh", code: "37" },
  { name: "Arunachal Pradesh", code: "12" },
  { name: "Assam", code: "18" },
  { name: "Bihar", code: "10" },
  { name: "Chhattisgarh", code: "22" },
  { name: "Goa", code: "30" },
  { name: "Gujarat", code: "24" },
  { name: "Haryana", code: "06" },
  { name: "Himachal Pradesh", code: "02" },
  { name: "Jharkhand", code: "20" },
  { name: "Karnataka", code: "29" },
  { name: "Kerala", code: "32" },
  { name: "Madhya Pradesh", code: "23" },
  { name: "Maharashtra", code: "27" },
  { name: "Manipur", code: "14" },
  { name: "Meghalaya", code: "17" },
  { name: "Mizoram", code: "15" },
  { name: "Nagaland", code: "13" },
  { name: "Odisha", code: "21" },
  { name: "Punjab", code: "03" },
  { name: "Rajasthan", code: "08" },
  { name: "Sikkim", code: "11" },
  { name: "Tamil Nadu", code: "33" },
  { name: "Telangana", code: "36" },
  { name: "Tripura", code: "16" },
  { name: "Uttar Pradesh", code: "09" },
  { name: "Uttarakhand", code: "05" },
  { name: "West Bengal", code: "19" },
  { name: "Delhi", code: "07" },
  { name: "Jammu & Kashmir", code: "01" },
  { name: "Ladakh", code: "38" },
  { name: "Chandigarh", code: "04" },
  { name: "Puducherry", code: "34" },
  { name: "Lakshadweep", code: "31" },
  { name: "Andaman & Nicobar", code: "35" },
  { name: "Dadra & Nagar Haveli", code: "26" },
  { name: "Daman & Diu", code: "25" },
];

type Tab = "invoices" | "monthly" | "statewise" | "settings";

interface GstSettings {
  id?: number;
  companyName: string;
  gstin: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  email: string;
  phone: string;
  logoUrl: string | null;
  gstRate: number;
  invoicePrefix: string;
  nextInvoiceSeq: number;
}

interface GstInvoice {
  id: number;
  invoiceNumber: string;
  paymentId: number;
  userId: number;
  courseId: number;
  customerName: string;
  customerEmail: string;
  customerMobile: string | null;
  customerGstin: string | null;
  customerAddress: string;
  customerState: string;
  customerStateCode: string;
  courseTitle: string;
  baseAmount: string;
  gstRate: number;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  totalAmount: string;
  isInterstate: boolean;
  financialYear: string;
  gateway: string;
  createdAt: string;
}

interface MonthlyData {
  month: number;
  label: string;
  count: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

interface StateData {
  state: string;
  count: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

function fmt(n: number | string) {
  return "₹" + parseFloat(String(n)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function amountInWords(amount: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function toWords(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "") + " ";
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred " + toWords(n % 100);
    if (n < 100000) return toWords(Math.floor(n / 1000)) + "Thousand " + toWords(n % 1000);
    if (n < 10000000) return toWords(Math.floor(n / 100000)) + "Lakh " + toWords(n % 100000);
    return toWords(Math.floor(n / 10000000)) + "Crore " + toWords(n % 10000000);
  }
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let result = toWords(rupees).trim();
  if (!result) result = "Zero";
  result += " Rupees";
  if (paise > 0) result += " and " + toWords(paise).trim() + " Paise";
  return result + " Only";
}

async function generateInvoicePdfDirect(invoice: GstInvoice, s: GstSettings | null) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const W = 210, H = 297, ML = 10, MR = 10, CW = 190;
  const base = parseFloat(invoice.baseAmount);
  const cgst = parseFloat(invoice.cgstAmount);
  const sgst = parseFloat(invoice.sgstAmount);
  const igst = parseFloat(invoice.igstAmount);
  const total = parseFloat(invoice.totalAmount);
  const totalGst = cgst + sgst + igst;
  const halfRate = invoice.gstRate / 2;
  const formattedDate = new Date(invoice.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const fy = `20${invoice.financialYear.slice(0, 2)}-${invoice.financialYear.slice(2)}`;
  const companyName = s?.companyName || "Your Company";
  const companyInitials = companyName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const placeOfSupply = invoice.customerState
    ? `${invoice.customerState}${invoice.customerStateCode ? ` (${invoice.customerStateCode})` : ""}` : "—";
  const fc = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // ── HEADER BAR ────────────────────────────────────────────────────────────
  const headerH = 36;
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, W, headerH, "F");

  doc.setFillColor(59, 130, 246);
  doc.roundedRect(ML, 5, 18, 18, 2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
  doc.text(companyInitials, ML + 9, 16.5, { align: "center" });

  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
  doc.text(companyName, ML + 22, 13);

  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(147, 197, 253);
  let subY = 18;
  if (s?.gstin) { doc.text(`GSTIN: ${s.gstin}`, ML + 22, subY); subY += 4; }
  const addrLine = [s?.addressLine1, s?.city, s?.state].filter(Boolean).join(", ");
  if (addrLine) { doc.text(addrLine, ML + 22, subY); subY += 4; }
  const contactLine = [s?.email, s?.phone].filter(Boolean).join(" · ");
  if (contactLine) { doc.text(contactLine, ML + 22, subY); }

  doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.4);
  doc.roundedRect(148, 5, 52, 22, 2, 2, "D");
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(191, 219, 254);
  doc.text("TAX INVOICE", 174, 15, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(147, 197, 253);
  doc.text("Original for Recipient", 174, 22, { align: "center" });

  let y = headerH + 6;

  // ── BILL TO + INVOICE DETAILS ─────────────────────────────────────────────
  const colW = CW / 2 - 2;
  const cardH = 54;

  doc.setFillColor(248, 250, 255); doc.setDrawColor(219, 234, 254); doc.setLineWidth(0.3);
  doc.rect(ML, y, colW, cardH, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(107, 114, 128);
  doc.text("BILL TO", ML + 4, y + 6);
  doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.2);
  doc.line(ML + 4, y + 8, ML + colW - 4, y + 8);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30, 58, 95);
  doc.text(invoice.customerName || "—", ML + 4, y + 15);

  const billRows: [string, string][] = [
    ["Email", invoice.customerEmail || "—"],
    ...(invoice.customerMobile ? [["Mobile", invoice.customerMobile] as [string, string]] : []),
    ["State", placeOfSupply],
    ...(invoice.customerGstin ? [["GSTIN", invoice.customerGstin] as [string, string]] : []),
  ];
  let billY = y + 22;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  for (const [label, value] of billRows) {
    doc.setTextColor(107, 114, 128); doc.text(label, ML + 4, billY);
    doc.setTextColor(17, 24, 39); doc.text(String(value), ML + 22, billY);
    billY += 5.5;
  }

  const rightX = ML + colW + 4;
  doc.setFillColor(248, 250, 255); doc.setDrawColor(219, 234, 254); doc.setLineWidth(0.3);
  doc.rect(rightX, y, colW, cardH, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(107, 114, 128);
  doc.text("INVOICE DETAILS", rightX + 4, y + 6);
  doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.2);
  doc.line(rightX + 4, y + 8, rightX + colW - 4, y + 8);

  const detRows: [string, string][] = [
    ["Invoice No.", invoice.invoiceNumber], ["Invoice Date", formattedDate],
    ["Financial Year", fy], ["Place of Supply", placeOfSupply],
    ["Payment Mode", (invoice.gateway || "—").toUpperCase()],
    ["Supply Type", invoice.isInterstate ? "Inter-State" : "Intra-State"],
  ];
  let detY = y + 14;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  for (const [label, value] of detRows) {
    doc.setTextColor(107, 114, 128); doc.text(label, rightX + 4, detY);
    doc.setFont("helvetica", "bold"); doc.setTextColor(17, 24, 39); doc.text(String(value), rightX + 30, detY);
    doc.setFont("helvetica", "normal"); detY += 6;
  }

  y += cardH + 6;

  // ── ITEMS TABLE ───────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(30, 58, 95);
  doc.text("ITEMS", ML, y); y += 2;
  autoTable(doc, {
    startY: y, margin: { left: ML, right: MR },
    head: [["#", "Description", "HSN/SAC", "Qty", "Rate (Excl. Tax)", "Taxable Amt"]],
    body: [["1", invoice.courseTitle + "\nOnline Educational Course — Digital Service", "999294", "1", fc(base), fc(base)]],
    headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: "auto" },
      2: { cellWidth: 20, halign: "center" }, 3: { cellWidth: 10, halign: "right" },
      4: { cellWidth: 32, halign: "right" }, 5: { cellWidth: 28, halign: "right", fontStyle: "bold" },
    },
    styles: { fontSize: 9, cellPadding: 3 }, alternateRowStyles: { fillColor: [249, 250, 251] },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── GST BREAKUP TABLE ─────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(30, 58, 95);
  doc.text("GST BREAKUP", ML, y); y += 2;
  if (invoice.isInterstate) {
    autoTable(doc, {
      startY: y, margin: { left: ML, right: MR },
      head: [["HSN/SAC", "Taxable Value", "IGST Rate", "IGST Amt", "Total Tax"]],
      body: [
        ["999294", fc(base), `${invoice.gstRate}%`, fc(igst), fc(totalGst)],
        [{ content: "Total", styles: { fontStyle: "bold" } }, "", "", { content: fc(igst), styles: { fontStyle: "bold" } }, { content: fc(totalGst), styles: { fontStyle: "bold", textColor: [30, 58, 95] as any } }],
      ],
      headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      columnStyles: { 0: { halign: "left" }, 1: { halign: "right" }, 2: { halign: "center" }, 3: { halign: "right" }, 4: { halign: "right" } },
      styles: { fontSize: 9, cellPadding: 3 }, alternateRowStyles: { fillColor: [249, 250, 251] },
    });
  } else {
    autoTable(doc, {
      startY: y, margin: { left: ML, right: MR },
      head: [["HSN/SAC", "Taxable Value", `CGST (${halfRate}%)`, "CGST Amt", `SGST (${halfRate}%)`, "SGST Amt", "Total Tax"]],
      body: [
        ["999294", fc(base), `${halfRate}%`, fc(cgst), `${halfRate}%`, fc(sgst), fc(totalGst)],
        [{ content: "Total", styles: { fontStyle: "bold" } }, "", "", { content: fc(cgst), styles: { fontStyle: "bold" } }, "", { content: fc(sgst), styles: { fontStyle: "bold" } }, { content: fc(totalGst), styles: { fontStyle: "bold", textColor: [30, 58, 95] as any } }],
      ],
      headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      columnStyles: { 0: { halign: "left" }, 1: { halign: "right" }, 2: { halign: "center" }, 3: { halign: "right" }, 4: { halign: "center" }, 5: { halign: "right" }, 6: { halign: "right" } },
      styles: { fontSize: 9, cellPadding: 3 }, alternateRowStyles: { fillColor: [249, 250, 251] },
    });
  }
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── GRAND TOTAL ───────────────────────────────────────────────────────────
  doc.setFillColor(30, 58, 95);
  doc.roundedRect(ML, y, CW, 22, 2, 2, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(147, 197, 253);
  doc.text("Taxable Value", ML + 6, y + 7);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
  doc.text(fc(base), ML + 6, y + 14);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(147, 197, 253);
  doc.text(`Total GST (${invoice.gstRate}%): ${fc(totalGst)}`, ML + 6, y + 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(147, 197, 253);
  doc.text("GRAND TOTAL (INR)", ML + CW - 6, y + 7, { align: "right" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(255, 255, 255);
  doc.text(fc(total), ML + CW - 6, y + 20, { align: "right" });
  y += 28;

  // ── AMOUNT IN WORDS ───────────────────────────────────────────────────────
  doc.setFillColor(239, 246, 255); doc.setDrawColor(191, 219, 254); doc.setLineWidth(0.3);
  doc.rect(ML, y, CW, 10, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(30, 64, 175);
  const wordsLabel = "Amount in Words:  ";
  doc.text(wordsLabel, ML + 5, y + 6.5);
  doc.setFont("helvetica", "normal");
  doc.text(amountInWords(total), ML + 5 + doc.getTextWidth(wordsLabel), y + 6.5);
  y += 16;

  // ── TERMS + SIGNATURE ─────────────────────────────────────────────────────
  const termsW = CW * 0.56;
  const sigW = CW * 0.38;
  const sigX = ML + CW - sigW;

  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(55, 65, 81);
  doc.text("Terms & Notes", ML, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(107, 114, 128);
  const terms = [
    "1. This is a computer-generated invoice and does not require a physical signature.",
    "2. SAC Code: 999294 — Online Educational Services.",
    "3. All amounts are in Indian Rupees (INR).",
    invoice.isInterstate ? "4. IGST applicable (Inter-State supply)." : "4. CGST + SGST applicable (Intra-State supply).",
  ];
  let termsY = y + 6;
  for (const t of terms) {
    const lines = doc.splitTextToSize(t, termsW - 4);
    doc.text(lines, ML, termsY); termsY += lines.length * 4.5;
  }

  doc.setDrawColor(156, 163, 175); doc.setLineWidth(0.3); doc.setLineDashPattern([2, 2], 0);
  doc.rect(sigX, y, sigW, 18, "D"); doc.setLineDashPattern([], 0);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(156, 163, 175);
  doc.text("Seal / Stamp", sigX + sigW / 2, y + 10, { align: "center" });
  const sigLineY = y + 26;
  doc.setDrawColor(156, 163, 175); doc.line(sigX, sigLineY, sigX + sigW, sigLineY);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(107, 114, 128);
  doc.text("Authorised Signatory", sigX + sigW / 2, sigLineY + 4, { align: "center" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(30, 58, 95);
  doc.text(companyName, sigX + sigW / 2, sigLineY + 9, { align: "center" });

  // ── PAGE FOOTER ───────────────────────────────────────────────────────────
  doc.setFillColor(243, 244, 246);
  doc.rect(0, H - 14, W, 14, "F");
  doc.setDrawColor(30, 58, 95); doc.setLineWidth(0.8);
  doc.line(0, H - 14, W, H - 14);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(107, 114, 128);
  doc.text(`${companyName}${s?.gstin ? ` | GSTIN: ${s.gstin}` : ""}`, ML, H - 7);
  doc.text(`Invoice: ${invoice.invoiceNumber} | FY ${fy}`, W / 2, H - 7, { align: "center" });
  doc.text(`Generated on ${new Date().toLocaleDateString("en-IN")}`, W - MR, H - 7, { align: "right" });

  doc.save(`${invoice.invoiceNumber}.pdf`);
}

function InvoicePrintModal({ invoice, settings, onClose, autoPrint }: {
  invoice: GstInvoice;
  settings: GstSettings | null;
  onClose: () => void;
  autoPrint?: boolean;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const base = parseFloat(invoice.baseAmount);
  const cgst = parseFloat(invoice.cgstAmount);
  const sgst = parseFloat(invoice.sgstAmount);
  const igst = parseFloat(invoice.igstAmount);
  const total = parseFloat(invoice.totalAmount);
  const totalGst = cgst + sgst + igst;
  const halfRate = invoice.gstRate / 2;
  const invDate = new Date(invoice.createdAt);
  const formattedDate = invDate.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const fy = `20${invoice.financialYear.slice(0, 2)}-${invoice.financialYear.slice(2)}`;

  const companyInitials = (settings?.companyName || "VK").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const placeOfSupply = invoice.customerState
    ? `${invoice.customerState}${invoice.customerStateCode ? ` (${invoice.customerStateCode})` : ""}`
    : "—";

  useEffect(() => {
    if (!autoPrint) return;
    const t = setTimeout(async () => {
      if (!printRef.current) return;
      try {
        const mod = await import('html2pdf.js');
        const html2pdfLib = (mod as any).default ?? mod;
        await html2pdfLib()
          .from(printRef.current)
          .set({
            margin: 0,
            filename: `${invoice.invoiceNumber}.pdf`,
            image: { type: "jpeg", quality: 1 },
            html2canvas: {
              scale: 4,
              useCORS: true,
              logging: false,
              letterRendering: true,
              allowTaint: true,
            },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
          })
          .save();
      } finally {
        onClose();
      }
    }, 500);
    return () => clearTimeout(t);
  }, [autoPrint]);

  function handlePrint() {
    const content = printRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
<title>Invoice ${invoice.invoiceNumber}</title>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1a1a2e; font-size: 13px; }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 0; }
  .header-bar { background: #1e3a5f; color: white; padding: 22px 30px; display: flex; justify-content: space-between; align-items: center; }
  .company-logo { width: 50px; height: 50px; background: #3b82f6; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; color: white; letter-spacing: 1px; flex-shrink: 0; }
  .company-info { margin-left: 14px; flex: 1; }
  .company-name { font-size: 18px; font-weight: 700; letter-spacing: 0.3px; }
  .company-detail { font-size: 11px; color: #93c5fd; margin-top: 2px; }
  .inv-badge { background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; padding: 10px 20px; text-align: right; }
  .inv-badge-title { font-size: 20px; font-weight: 800; letter-spacing: 2px; color: #bfdbfe; }
  .inv-badge-sub { font-size: 11px; color: #93c5fd; margin-top: 3px; }
  .body-section { padding: 24px 30px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .card { background: #f8faff; border: 1px solid #dbeafe; border-radius: 8px; padding: 16px; }
  .card-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 700; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
  .field-row { display: flex; margin-bottom: 5px; }
  .field-label { font-size: 11px; color: #6b7280; width: 100px; flex-shrink: 0; }
  .field-value { font-size: 12px; color: #111827; font-weight: 500; }
  .bill-to-name { font-size: 15px; font-weight: 700; color: #1e3a5f; margin-bottom: 8px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #1e3a5f; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .items-table th { background: #1e3a5f; color: white; padding: 10px 12px; text-align: left; font-weight: 600; font-size: 11px; letter-spacing: 0.3px; }
  .items-table th.r, .items-table td.r { text-align: right; }
  .items-table td { padding: 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  .items-table tr:nth-child(even) td { background: #f9fafb; }
  .item-name { font-weight: 600; color: #1a1a2e; }
  .item-sub { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .gst-table { margin-top: 16px; }
  .gst-table th { background: #1e3a5f; color: white; padding: 8px 12px; font-size: 11px; text-align: center; }
  .gst-table td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 12px; }
  .gst-table td.l { text-align: left; }
  .gst-table tr:nth-child(even) td { background: #f9fafb; }
  .total-section { background: #1e3a5f; color: white; border-radius: 8px; padding: 16px 20px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center; }
  .total-label { font-size: 13px; font-weight: 600; color: #93c5fd; }
  .total-amount { font-size: 26px; font-weight: 800; color: white; }
  .words-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px 14px; margin-top: 12px; font-size: 11px; color: #1e40af; }
  .words-label { font-weight: 700; margin-right: 6px; }
  .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
  .note-box { font-size: 11px; color: #6b7280; line-height: 1.6; }
  .sig-box { text-align: right; }
  .sig-line { border-top: 1px solid #9ca3af; margin-top: 40px; padding-top: 6px; font-size: 11px; color: #6b7280; }
  .stamp-box { border: 1px dashed #9ca3af; border-radius: 4px; height: 60px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #9ca3af; margin-bottom: 8px; }
  .page-footer { background: #f3f4f6; border-top: 2px solid #1e3a5f; padding: 10px 30px; text-align: center; font-size: 10px; color: #6b7280; display: flex; justify-content: space-between; }
  .supply-badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; }
  .badge-intra { background: #dcfce7; color: #166534; }
  .badge-inter { background: #dbeafe; color: #1d4ed8; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head><body>
<div class="page">${content}</div>
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }

  const invoiceBodyEl = (
    <div ref={printRef} style={{ fontFamily: "'Segoe UI', Arial, sans-serif", background: "#fff", color: "#1a1a2e" }}>
          {/* Header */}
          <div style={{ background: "#1e3a5f", color: "white", padding: "22px 30px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ width: 50, height: 50, background: "#3b82f6", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "white", flexShrink: 0 }}>
                {companyInitials}
              </div>
              <div style={{ marginLeft: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{settings?.companyName || "Your Company"}</div>
                {settings?.gstin && <div style={{ fontSize: 11, color: "#93c5fd", marginTop: 2 }}>GSTIN: {settings.gstin}</div>}
                <div style={{ fontSize: 11, color: "#93c5fd", marginTop: 1 }}>
                  {[settings?.addressLine1, settings?.city, settings?.state].filter(Boolean).join(", ")}
                </div>
                {(settings?.email || settings?.phone) && (
                  <div style={{ fontSize: 11, color: "#93c5fd", marginTop: 1 }}>
                    {[settings?.email, settings?.phone].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, padding: "12px 22px", textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, color: "#bfdbfe" }}>TAX INVOICE</div>
              <div style={{ fontSize: 11, color: "#93c5fd", marginTop: 4 }}>Original for Recipient</div>
            </div>
          </div>

          <div style={{ padding: "24px 30px" }}>
            {/* Bill To + Invoice Details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              {/* Bill To */}
              <div style={{ background: "#f8faff", border: "1px solid #dbeafe", borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#6b7280", fontWeight: 700, marginBottom: 10, borderBottom: "1px solid #e5e7eb", paddingBottom: 6 }}>Bill To</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1e3a5f", marginBottom: 10 }}>{invoice.customerName || "—"}</div>
                <div style={{ display: "flex", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: "#6b7280", width: 80, flexShrink: 0 }}>Email</span>
                  <span style={{ fontSize: 12, color: "#111827", fontWeight: 500 }}>{invoice.customerEmail || "—"}</span>
                </div>
                {invoice.customerMobile && (
                  <div style={{ display: "flex", marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: "#6b7280", width: 80, flexShrink: 0 }}>Mobile</span>
                    <span style={{ fontSize: 12, color: "#111827", fontWeight: 500 }}>{invoice.customerMobile}</span>
                  </div>
                )}
                <div style={{ display: "flex", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: "#6b7280", width: 80, flexShrink: 0 }}>State</span>
                  <span style={{ fontSize: 12, color: "#111827", fontWeight: 500 }}>{placeOfSupply}</span>
                </div>
                {invoice.customerGstin && (
                  <div style={{ display: "flex", marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: "#6b7280", width: 80, flexShrink: 0 }}>GSTIN</span>
                    <span style={{ fontSize: 12, color: "#111827", fontWeight: 600, fontFamily: "monospace" }}>{invoice.customerGstin}</span>
                  </div>
                )}
              </div>

              {/* Invoice Details */}
              <div style={{ background: "#f8faff", border: "1px solid #dbeafe", borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#6b7280", fontWeight: 700, marginBottom: 10, borderBottom: "1px solid #e5e7eb", paddingBottom: 6 }}>Invoice Details</div>
                {[
                  ["Invoice No.", invoice.invoiceNumber],
                  ["Invoice Date", formattedDate],
                  ["Financial Year", fy],
                  ["Place of Supply", placeOfSupply],
                  ["Payment Mode", (invoice.gateway || "—").toUpperCase()],
                  ["Supply Type", invoice.isInterstate ? "Inter-State" : "Intra-State"],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: "flex", marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: "#6b7280", width: 110, flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: 12, color: "#111827", fontWeight: label === "Invoice No." ? 700 : 500, fontFamily: label === "Invoice No." ? "monospace" : "inherit" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Items Table */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#1e3a5f", marginBottom: 8 }}>Items</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["#", "Description", "HSN/SAC", "Qty", "Rate (Excl. Tax)", "Taxable Amt"].map((h, i) => (
                      <th key={h} style={{ background: "#1e3a5f", color: "white", padding: "10px 12px", textAlign: i >= 3 ? "right" : "left", fontWeight: 600, fontSize: 11, letterSpacing: 0.3 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "12px", borderBottom: "1px solid #e5e7eb" }}>1</td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #e5e7eb" }}>
                      <div style={{ fontWeight: 600, color: "#1a1a2e" }}>{invoice.courseTitle}</div>
                      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>Online Educational Course — Digital Service</div>
                    </td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>999294</td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>1</td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>{fmt(base)}</td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #e5e7eb", textAlign: "right", fontWeight: 600 }}>{fmt(base)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* GST Breakup */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#1e3a5f", marginBottom: 8 }}>GST Breakup</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ background: "#1e3a5f", color: "white", padding: "8px 12px", textAlign: "left", fontSize: 11 }}>HSN/SAC</th>
                    <th style={{ background: "#1e3a5f", color: "white", padding: "8px 12px", textAlign: "right", fontSize: 11 }}>Taxable Value</th>
                    {!invoice.isInterstate ? (
                      <Fragment>
                        <th style={{ background: "#1e3a5f", color: "white", padding: "8px 12px", textAlign: "center", fontSize: 11 }}>CGST Rate</th>
                        <th style={{ background: "#1e3a5f", color: "white", padding: "8px 12px", textAlign: "right", fontSize: 11 }}>CGST Amt</th>
                        <th style={{ background: "#1e3a5f", color: "white", padding: "8px 12px", textAlign: "center", fontSize: 11 }}>SGST Rate</th>
                        <th style={{ background: "#1e3a5f", color: "white", padding: "8px 12px", textAlign: "right", fontSize: 11 }}>SGST Amt</th>
                      </Fragment>
                    ) : (
                      <Fragment>
                        <th style={{ background: "#1e3a5f", color: "white", padding: "8px 12px", textAlign: "center", fontSize: 11 }}>IGST Rate</th>
                        <th style={{ background: "#1e3a5f", color: "white", padding: "8px 12px", textAlign: "right", fontSize: 11 }}>IGST Amt</th>
                      </Fragment>
                    )}
                    <th style={{ background: "#1e3a5f", color: "white", padding: "8px 12px", textAlign: "right", fontSize: 11 }}>Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>999294</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>{fmt(base)}</td>
                    {!invoice.isInterstate ? (
                      <Fragment>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>{halfRate}%</td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>{fmt(cgst)}</td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>{halfRate}%</td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>{fmt(sgst)}</td>
                      </Fragment>
                    ) : (
                      <Fragment>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>{invoice.gstRate}%</td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>{fmt(igst)}</td>
                      </Fragment>
                    )}
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb", textAlign: "right", fontWeight: 700 }}>{fmt(totalGst)}</td>
                  </tr>
                  {/* Summary row */}
                  <tr style={{ background: "#f0f9ff" }}>
                    <td colSpan={2} style={{ padding: "8px 12px", fontWeight: 700, fontSize: 12, color: "#1e3a5f" }}>Total</td>
                    {!invoice.isInterstate ? (
                      <Fragment>
                        <td colSpan={2} style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>{fmt(cgst)}</td>
                        <td colSpan={2} style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>{fmt(sgst)}</td>
                      </Fragment>
                    ) : (
                      <td colSpan={2} style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>{fmt(igst)}</td>
                    )}
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, color: "#1e3a5f" }}>{fmt(totalGst)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Grand Total */}
            <div style={{ background: "#1e3a5f", color: "white", borderRadius: 8, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "#93c5fd", marginBottom: 2 }}>Taxable Value</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{fmt(base)}</div>
                <div style={{ fontSize: 11, color: "#93c5fd", marginTop: 4 }}>Total GST ({invoice.gstRate}%): {fmt(totalGst)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, color: "#93c5fd", fontWeight: 600 }}>GRAND TOTAL (INR)</div>
                <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: 1 }}>{fmt(total)}</div>
              </div>
            </div>

            {/* Amount in words */}
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "10px 14px", marginBottom: 20, fontSize: 11, color: "#1e40af" }}>
              <span style={{ fontWeight: 700 }}>Amount in Words: </span>{amountInWords(total)}
            </div>

            {/* Footer: Notes + Signature */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.7 }}>
                <div style={{ fontWeight: 700, color: "#374151", marginBottom: 6 }}>Terms & Notes</div>
                <div>1. This is a computer-generated invoice and does not require a physical signature.</div>
                <div>2. SAC Code: 999294 — Online Educational Services.</div>
                <div>3. All amounts are in Indian Rupees (INR).</div>
                {invoice.isInterstate
                  ? <div>4. IGST applicable (Inter-State supply).</div>
                  : <div>4. CGST + SGST applicable (Intra-State supply).</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ border: "1px dashed #9ca3af", borderRadius: 4, height: 56, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#9ca3af", marginBottom: 8 }}>Seal / Stamp</div>
                <div style={{ borderTop: "1px solid #9ca3af", paddingTop: 6, fontSize: 11, color: "#6b7280" }}>
                  Authorised Signatory<br />
                  <span style={{ fontWeight: 700, color: "#1e3a5f" }}>{settings?.companyName || ""}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Page footer */}
          <div style={{ background: "#f3f4f6", borderTop: "2px solid #1e3a5f", padding: "8px 30px", display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6b7280" }}>
            <span>{settings?.companyName} {settings?.gstin ? `| GSTIN: ${settings.gstin}` : ""}</span>
            <span>Invoice: {invoice.invoiceNumber} | FY {fy}</span>
            <span>Generated on {new Date().toLocaleDateString("en-IN")}</span>
          </div>
    </div>
  );

  if (autoPrint) {
    return (
      <div aria-hidden style={{ position: "fixed", top: -9999, left: -9999, width: "210mm", zIndex: -1 }}>
        {invoiceBodyEl}
      </div>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-400" />
            <span className="font-bold text-foreground">{invoice.invoiceNumber}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${invoice.isInterstate ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"}`}>
              {invoice.isInterstate ? "Interstate · IGST" : "Intra-state · CGST+SGST"}
            </span>
          </div>
          <Button onClick={handlePrint} className="bg-blue-700 hover:bg-blue-800 text-white gap-2">
            <Printer className="h-4 w-4" /> Print / Save PDF
          </Button>
        </div>
        {invoiceBodyEl}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminGstInvoicingPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("invoices");

  // Invoices tab state
  const [invoices, setInvoices] = useState<GstInvoice[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invSearch, setInvSearch] = useState("");
  const [invMonth, setInvMonth] = useState("");
  const [invYear, setInvYear] = useState(String(new Date().getFullYear()));
  const [selectedInvoice, setSelectedInvoice] = useState<GstInvoice | null>(null);
  const [invoiceSettings, setInvoiceSettings] = useState<GstSettings | null>(null);
  const [generating, setGenerating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GstInvoice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Monthly summary state
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [monthlyYear, setMonthlyYear] = useState(String(new Date().getFullYear()));
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // State-wise state
  const [statewise, setStatewise] = useState<StateData[]>([]);
  const [stateYear, setStateYear] = useState(String(new Date().getFullYear()));
  const [stateLoading, setStateLoading] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<GstSettings>({
    companyName: "", gstin: "", addressLine1: "", addressLine2: "",
    city: "", state: "", stateCode: "", pincode: "",
    email: "", phone: "", logoUrl: null, gstRate: 18, invoicePrefix: "INV", nextInvoiceSeq: 1,
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  async function loadInvoices() {
    setInvLoading(true);
    try {
      const params = new URLSearchParams();
      if (invMonth) params.set("month", invMonth);
      if (invYear) params.set("year", invYear);
      if (invSearch) params.set("search", invSearch);
      const res = await fetch(`${API_BASE}/api/admin/gst/invoices?${params}`, { credentials: "include" });
      const data = await res.json();
      setInvoices(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Failed to load invoices", variant: "destructive" });
    } finally {
      setInvLoading(false);
    }
  }

  async function loadMonthly() {
    setMonthlyLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/gst/summary/monthly?year=${monthlyYear}`, { credentials: "include" });
      const data = await res.json();
      setMonthly(data.months ?? []);
    } catch {
      toast({ title: "Failed to load monthly summary", variant: "destructive" });
    } finally {
      setMonthlyLoading(false);
    }
  }

  async function loadStatewise() {
    setStateLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/gst/summary/state?year=${stateYear}`, { credentials: "include" });
      const data = await res.json();
      setStatewise(data.states ?? []);
    } catch {
      toast({ title: "Failed to load state-wise report", variant: "destructive" });
    } finally {
      setStateLoading(false);
    }
  }

  async function loadSettings() {
    setSettingsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/gst/settings`, { credentials: "include" });
      const data = await res.json();
      setSettings(data);
    } catch {
      toast({ title: "Failed to load settings", variant: "destructive" });
    } finally {
      setSettingsLoading(false);
    }
  }

  async function saveSettings() {
    setSettingsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/gst/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      toast({ title: "GST settings saved" });
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    } finally {
      setSettingsSaving(false);
    }
  }

  async function generateAll() {
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/gst/invoices/generate-all`, {
        method: "POST", credentials: "include",
      });
      const data = await res.json();
      toast({ title: `Generated ${data.generated} new invoice(s)` });
      loadInvoices();
    } catch {
      toast({ title: "Failed to generate invoices", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function confirmDeleteInvoice() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/gst/invoices/${deleteTarget.id}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error();
      toast({ title: `Invoice ${deleteTarget.invoiceNumber} deleted` });
      setDeleteTarget(null);
      loadInvoices();
    } catch {
      toast({ title: "Failed to delete invoice", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  async function openInvoice(inv: GstInvoice) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/gst/invoices/${inv.id}`, { credentials: "include" });
      const data = await res.json();
      setInvoiceSettings(data.settings);
      setSelectedInvoice(data.invoice);
    } catch {
      setInvoiceSettings(null);
      setSelectedInvoice(inv);
    }
  }

  async function downloadInvoicePdf(inv: GstInvoice) {
    setDownloadingId(inv.id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/gst/invoices/${inv.id}`, { credentials: "include" });
      const data = await res.json();
      await generateInvoicePdfDirect(data.invoice ?? inv, data.settings ?? settings);
    } catch {
      await generateInvoicePdfDirect(inv, settings);
    } finally {
      setDownloadingId(null);
    }
  }

  useEffect(() => { loadSettings(); }, []);
  useEffect(() => { if (tab === "invoices") loadInvoices(); }, [tab]);
  useEffect(() => { if (tab === "monthly") loadMonthly(); }, [tab, monthlyYear]);
  useEffect(() => { if (tab === "statewise") loadStatewise(); }, [tab, stateYear]);

  function exportCsv() {
    const rows = [
      ["Invoice No", "Date", "Customer Name", "Email", "Course", "Taxable", "CGST", "SGST", "IGST", "Total", "Type", "FY"],
      ...invoices.map(i => [
        i.invoiceNumber,
        new Date(i.createdAt).toLocaleDateString("en-IN"),
        i.customerName,
        i.customerEmail,
        i.courseTitle,
        i.baseAmount,
        i.cgstAmount,
        i.sgstAmount,
        i.igstAmount,
        i.totalAmount,
        i.isInterstate ? "Interstate" : "Intra-state",
        i.financialYear,
      ])
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `gst-invoices-${invYear}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const years = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i));
  const months = [
    { value: "1", label: "January" }, { value: "2", label: "February" },
    { value: "3", label: "March" }, { value: "4", label: "April" },
    { value: "5", label: "May" }, { value: "6", label: "June" },
    { value: "7", label: "July" }, { value: "8", label: "August" },
    { value: "9", label: "September" }, { value: "10", label: "October" },
    { value: "11", label: "November" }, { value: "12", label: "December" },
  ];

  const monthlyTotals = monthly.reduce((acc, m) => ({
    count: acc.count + m.count,
    taxable: acc.taxable + m.taxable,
    cgst: acc.cgst + m.cgst,
    sgst: acc.sgst + m.sgst,
    igst: acc.igst + m.igst,
    total: acc.total + m.total,
  }), { count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });

  const stateTotals = statewise.reduce((acc, s) => ({
    count: acc.count + s.count,
    taxable: acc.taxable + s.taxable,
    cgst: acc.cgst + s.cgst,
    sgst: acc.sgst + s.sgst,
    igst: acc.igst + s.igst,
    total: acc.total + s.total,
  }), { count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" /> GST Invoicing
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage GST invoices, summaries, and company settings</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 mb-2 flex-wrap">
        {[
          { id: "invoices", label: "Invoices", icon: FileText },
          { id: "monthly", label: "Monthly Summary", icon: BarChart3 },
          { id: "statewise", label: "State-wise Report", icon: MapPin },
          { id: "settings", label: "Company Settings", icon: Settings2 },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === t.id ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-background"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Invoices Tab ── */}
      {tab === "invoices" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, invoice no, course..."
                  value={invSearch}
                  onChange={e => setInvSearch(e.target.value)}
                  className="pl-9"
                  onKeyDown={e => e.key === "Enter" && loadInvoices()}
                />
              </div>
            </div>
            <Select value={invMonth} onValueChange={v => setInvMonth(v === "all" ? "" : v)}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All Months" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={invYear} onValueChange={setInvYear}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={loadInvoices} disabled={invLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${invLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={invoices.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
            <Button onClick={generateAll} disabled={generating} className="bg-blue-600 hover:bg-blue-700 text-white">
              {generating ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
              Generate Missing
            </Button>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead className="text-right">Taxable</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : invoices.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">No invoices found. Click "Generate Missing" to create invoices for existing completed payments.</TableCell></TableRow>
                ) : invoices.map(inv => {
                  const gst = parseFloat(inv.cgstAmount) + parseFloat(inv.sgstAmount) + parseFloat(inv.igstAmount);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm font-semibold text-blue-400">{inv.invoiceNumber}</TableCell>
                      <TableCell className="text-sm">{new Date(inv.createdAt).toLocaleDateString("en-IN")}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{inv.customerName}</div>
                        <div className="text-xs text-muted-foreground">{inv.customerEmail}</div>
                      </TableCell>
                      <TableCell className="text-sm max-w-[140px] truncate">{inv.courseTitle}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(inv.baseAmount)}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(gst)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(inv.totalAmount)}</TableCell>
                      <TableCell>
                        <Badge variant={inv.isInterstate ? "secondary" : "outline"} className="text-xs">
                          {inv.isInterstate ? "IGST" : "CGST+SGST"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openInvoice(inv)} title="View invoice">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                            onClick={() => downloadInvoicePdf(inv)}
                            disabled={downloadingId === inv.id}
                            title="Download PDF"
                          >
                            {downloadingId === inv.id
                              ? <RefreshCw className="h-4 w-4 animate-spin" />
                              : <Download className="h-4 w-4" />}
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => setDeleteTarget(inv)} title="Delete invoice">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {invoices.length > 0 && (
            <p className="text-sm text-muted-foreground">{invoices.length} invoice(s) found</p>
          )}
        </div>
      )}

      {/* ── Monthly Summary Tab ── */}
      {tab === "monthly" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Label className="font-medium">Year</Label>
            <Select value={monthlyYear} onValueChange={setMonthlyYear}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={loadMonthly} disabled={monthlyLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${monthlyLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">Taxable Value</TableHead>
                  <TableHead className="text-right">CGST</TableHead>
                  <TableHead className="text-right">SGST</TableHead>
                  <TableHead className="text-right">IGST</TableHead>
                  <TableHead className="text-right">Total Tax</TableHead>
                  <TableHead className="text-right">Gross Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : monthly.map(m => (
                  <TableRow key={m.month} className={m.count === 0 ? "text-muted-foreground/50" : ""}>
                    <TableCell className="font-medium">{m.label}</TableCell>
                    <TableCell className="text-right">{m.count}</TableCell>
                    <TableCell className="text-right">{fmt(m.taxable)}</TableCell>
                    <TableCell className="text-right">{fmt(m.cgst)}</TableCell>
                    <TableCell className="text-right">{fmt(m.sgst)}</TableCell>
                    <TableCell className="text-right">{fmt(m.igst)}</TableCell>
                    <TableCell className="text-right">{fmt(m.cgst + m.sgst + m.igst)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(m.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {!monthlyLoading && monthly.length > 0 && (
                <tfoot>
                  <TableRow className="bg-muted/40 font-bold border-t-2">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{monthlyTotals.count}</TableCell>
                    <TableCell className="text-right">{fmt(monthlyTotals.taxable)}</TableCell>
                    <TableCell className="text-right">{fmt(monthlyTotals.cgst)}</TableCell>
                    <TableCell className="text-right">{fmt(monthlyTotals.sgst)}</TableCell>
                    <TableCell className="text-right">{fmt(monthlyTotals.igst)}</TableCell>
                    <TableCell className="text-right">{fmt(monthlyTotals.cgst + monthlyTotals.sgst + monthlyTotals.igst)}</TableCell>
                    <TableCell className="text-right">{fmt(monthlyTotals.total)}</TableCell>
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </div>
        </div>
      )}

      {/* ── State-wise Report Tab ── */}
      {tab === "statewise" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Label className="font-medium">Year</Label>
            <Select value={stateYear} onValueChange={setStateYear}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={loadStatewise} disabled={stateLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${stateLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">Taxable Value</TableHead>
                  <TableHead className="text-right">CGST</TableHead>
                  <TableHead className="text-right">SGST</TableHead>
                  <TableHead className="text-right">IGST</TableHead>
                  <TableHead className="text-right">Total Tax</TableHead>
                  <TableHead className="text-right">Gross Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stateLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : statewise.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No data for {stateYear}</TableCell></TableRow>
                ) : statewise.map(s => (
                  <TableRow key={s.state}>
                    <TableCell className="font-medium">{s.state}</TableCell>
                    <TableCell className="text-right">{s.count}</TableCell>
                    <TableCell className="text-right">{fmt(s.taxable)}</TableCell>
                    <TableCell className="text-right">{fmt(s.cgst)}</TableCell>
                    <TableCell className="text-right">{fmt(s.sgst)}</TableCell>
                    <TableCell className="text-right">{fmt(s.igst)}</TableCell>
                    <TableCell className="text-right">{fmt(s.cgst + s.sgst + s.igst)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(s.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {!stateLoading && statewise.length > 0 && (
                <tfoot>
                  <TableRow className="bg-muted/40 font-bold border-t-2">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{stateTotals.count}</TableCell>
                    <TableCell className="text-right">{fmt(stateTotals.taxable)}</TableCell>
                    <TableCell className="text-right">{fmt(stateTotals.cgst)}</TableCell>
                    <TableCell className="text-right">{fmt(stateTotals.sgst)}</TableCell>
                    <TableCell className="text-right">{fmt(stateTotals.igst)}</TableCell>
                    <TableCell className="text-right">{fmt(stateTotals.cgst + stateTotals.sgst + stateTotals.igst)}</TableCell>
                    <TableCell className="text-right">{fmt(stateTotals.total)}</TableCell>
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </div>
        </div>
      )}

      {/* ── Company Settings Tab ── */}
      {tab === "settings" && (
        <div className="max-w-2xl space-y-6">
          {settingsLoading ? (
            <div className="text-center py-10 text-muted-foreground">Loading settings…</div>
          ) : (
            <Fragment>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-sm text-blue-400">
                These settings appear on all GST invoices. Make sure your GSTIN is correct before generating invoices.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Company / Business Name</Label>
                  <Input value={settings.companyName} onChange={e => setSettings(s => ({ ...s, companyName: e.target.value }))} placeholder="Vipul Kumar Academy" />
                </div>
                <div>
                  <Label>GSTIN</Label>
                  <Input value={settings.gstin} onChange={e => setSettings(s => ({ ...s, gstin: e.target.value.toUpperCase() }))} placeholder="29AABCT1332L1ZV" maxLength={15} />
                </div>
                <div>
                  <Label>Invoice Prefix</Label>
                  <Input value={settings.invoicePrefix} onChange={e => setSettings(s => ({ ...s, invoicePrefix: e.target.value.toUpperCase() }))} placeholder="INV" maxLength={10} />
                </div>
                <div>
                  <Label>Next Invoice Number</Label>
                  <Input
                    type="number"
                    min={1}
                    value={settings.nextInvoiceSeq}
                    onChange={e => setSettings(s => ({ ...s, nextInvoiceSeq: Math.max(1, parseInt(e.target.value) || 1) }))}
                    placeholder="1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Next invoice will be: <span className="font-mono font-semibold text-foreground">{settings.invoicePrefix || "INV"}-{settings.nextInvoiceSeq}</span>
                  </p>
                </div>
                <div>
                  <Label>GST Rate (%)</Label>
                  <Select value={String(settings.gstRate)} onValueChange={v => setSettings(s => ({ ...s, gstRate: parseInt(v) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="18">18% (Standard)</SelectItem>
                      <SelectItem value="12">12%</SelectItem>
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="0">0% (Exempt)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>State</Label>
                  <Select value={settings.state} onValueChange={v => {
                    const st = INDIAN_STATES.find(s => s.name === v);
                    setSettings(s => ({ ...s, state: v, stateCode: st?.code ?? "" }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map(st => <SelectItem key={st.code} value={st.name}>{st.name} ({st.code})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Address Line 1</Label>
                  <Input value={settings.addressLine1} onChange={e => setSettings(s => ({ ...s, addressLine1: e.target.value }))} placeholder="Street address" />
                </div>
                <div className="col-span-2">
                  <Label>Address Line 2</Label>
                  <Input value={settings.addressLine2} onChange={e => setSettings(s => ({ ...s, addressLine2: e.target.value }))} placeholder="Area, Landmark (optional)" />
                </div>
                <div>
                  <Label>City</Label>
                  <Input value={settings.city} onChange={e => setSettings(s => ({ ...s, city: e.target.value }))} />
                </div>
                <div>
                  <Label>Pincode</Label>
                  <Input value={settings.pincode} onChange={e => setSettings(s => ({ ...s, pincode: e.target.value }))} maxLength={6} />
                </div>
                <div>
                  <Label>Business Email</Label>
                  <Input type="email" value={settings.email} onChange={e => setSettings(s => ({ ...s, email: e.target.value }))} />
                </div>
                <div>
                  <Label>Business Phone</Label>
                  <Input value={settings.phone} onChange={e => setSettings(s => ({ ...s, phone: e.target.value }))} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={saveSettings} disabled={settingsSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {settingsSaving ? "Saving…" : "Save Settings"}
                </Button>
                <Button variant="outline" onClick={loadSettings} disabled={settingsLoading}>Reset</Button>
              </div>
            </Fragment>
          )}
        </div>
      )}

      {/* Invoice print modal (view) */}
      {selectedInvoice && (
        <InvoicePrintModal
          invoice={selectedInvoice}
          settings={invoiceSettings ?? settings}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <Dialog open onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" /> Delete Invoice
              </DialogTitle>
            </DialogHeader>
            <div className="py-2 space-y-3">
              <p className="text-sm text-foreground">
                Are you sure you want to permanently delete invoice{" "}
                <span className="font-mono font-bold text-foreground">{deleteTarget.invoiceNumber}</span>?
              </p>
              <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm space-y-1 text-muted-foreground">
                <div><span className="font-medium text-foreground">Customer:</span> {deleteTarget.customerName}</div>
                <div><span className="font-medium text-foreground">Course:</span> {deleteTarget.courseTitle}</div>
                <div><span className="font-medium text-foreground">Amount:</span> {fmt(deleteTarget.totalAmount)}</div>
              </div>
              <p className="text-xs text-red-500">This action cannot be undone. The invoice record will be permanently removed.</p>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDeleteInvoice} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete Invoice"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
