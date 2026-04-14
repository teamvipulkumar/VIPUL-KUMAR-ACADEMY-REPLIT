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
import { FileText, Printer, Settings2, BarChart3, MapPin, Search, RefreshCw, Download, Eye } from "lucide-react";

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
}

interface GstInvoice {
  id: number;
  invoiceNumber: string;
  paymentId: number;
  userId: number;
  courseId: number;
  customerName: string;
  customerEmail: string;
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

function InvoicePrintModal({ invoice, settings, onClose }: {
  invoice: GstInvoice;
  settings: GstSettings | null;
  onClose: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const content = printRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Invoice ${invoice.invoiceNumber}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #111; }
  .inv-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 16px; }
  .inv-title { font-size: 28px; font-weight: bold; color: #2563eb; }
  .inv-meta { font-size: 13px; color: #555; }
  .inv-section { margin-bottom: 14px; }
  .inv-section h3 { font-size: 12px; text-transform: uppercase; color: #888; margin-bottom: 6px; }
  .inv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-weight: 600; }
  td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
  .tax-row { background: #f9fafb; }
  .total-row td { font-weight: bold; font-size: 15px; border-top: 2px solid #2563eb; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .badge-blue { background: #dbeafe; color: #1d4ed8; }
  .badge-green { background: #dcfce7; color: #166534; }
  .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #888; text-align: center; }
</style></head><body>${content}</body></html>`);
    win.document.close();
    win.print();
  }

  const base = parseFloat(invoice.baseAmount);
  const cgst = parseFloat(invoice.cgstAmount);
  const sgst = parseFloat(invoice.sgstAmount);
  const igst = parseFloat(invoice.igstAmount);
  const total = parseFloat(invoice.totalAmount);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Tax Invoice — {invoice.invoiceNumber}
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-4">
          <Button onClick={handlePrint} className="flex items-center gap-1">
            <Printer className="h-4 w-4" /> Print / Save PDF
          </Button>
        </div>
        <div ref={printRef} className="bg-white text-black p-6 rounded border">
          <div className="inv-header flex justify-between items-start border-b-2 border-blue-600 pb-4 mb-4">
            <div>
              <div className="inv-title text-3xl font-bold text-blue-700">TAX INVOICE</div>
              <div className="text-sm text-gray-500 mt-1">Original for Recipient</div>
            </div>
            <div className="text-right">
              {settings?.companyName && <div className="font-bold text-lg">{settings.companyName}</div>}
              {settings?.gstin && <div className="text-sm">GSTIN: {settings.gstin}</div>}
              {settings?.addressLine1 && <div className="text-sm">{settings.addressLine1}</div>}
              {settings?.addressLine2 && <div className="text-sm">{settings.addressLine2}</div>}
              {(settings?.city || settings?.state) && <div className="text-sm">{[settings.city, settings.state, settings.pincode].filter(Boolean).join(", ")}</div>}
              {settings?.email && <div className="text-sm">{settings.email}</div>}
              {settings?.phone && <div className="text-sm">{settings.phone}</div>}
            </div>
          </div>

          <div className="inv-grid grid grid-cols-2 gap-6 mb-5">
            <div>
              <div className="text-xs uppercase text-gray-400 font-semibold mb-2">Bill To</div>
              <div className="font-semibold">{invoice.customerName}</div>
              <div className="text-sm">{invoice.customerEmail}</div>
              {invoice.customerGstin && <div className="text-sm">GSTIN: {invoice.customerGstin}</div>}
              {invoice.customerAddress && <div className="text-sm">{invoice.customerAddress}</div>}
              {invoice.customerState && <div className="text-sm">{invoice.customerState}</div>}
            </div>
            <div className="text-right">
              <div className="text-xs uppercase text-gray-400 font-semibold mb-2">Invoice Details</div>
              <div className="text-sm"><span className="text-gray-500">Invoice No:</span> <strong>{invoice.invoiceNumber}</strong></div>
              <div className="text-sm"><span className="text-gray-500">Date:</span> {new Date(invoice.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</div>
              <div className="text-sm"><span className="text-gray-500">FY:</span> 20{invoice.financialYear.slice(0, 2)}-20{invoice.financialYear.slice(2)}</div>
              <div className="text-sm"><span className="text-gray-500">Gateway:</span> {invoice.gateway || "—"}</div>
              <div className="mt-1">
                <span className={`badge text-xs px-2 py-0.5 rounded font-semibold ${invoice.isInterstate ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                  {invoice.isInterstate ? "Interstate (IGST)" : "Intra-state (CGST+SGST)"}
                </span>
              </div>
            </div>
          </div>

          <table className="w-full text-sm border-collapse mb-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">#</th>
                <th className="p-2 text-left">Description</th>
                <th className="p-2 text-right">Taxable Amount</th>
                {!invoice.isInterstate && <Fragment>
                  <th className="p-2 text-right">CGST ({invoice.gstRate / 2}%)</th>
                  <th className="p-2 text-right">SGST ({invoice.gstRate / 2}%)</th>
                </Fragment>}
                {invoice.isInterstate && <th className="p-2 text-right">IGST ({invoice.gstRate}%)</th>}
                <th className="p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border-b">1</td>
                <td className="p-2 border-b">
                  <div className="font-medium">{invoice.courseTitle}</div>
                  <div className="text-xs text-gray-500">Online Course — HSN: 999294</div>
                </td>
                <td className="p-2 border-b text-right">{fmt(base)}</td>
                {!invoice.isInterstate && <Fragment>
                  <td className="p-2 border-b text-right">{fmt(cgst)}</td>
                  <td className="p-2 border-b text-right">{fmt(sgst)}</td>
                </Fragment>}
                {invoice.isInterstate && <td className="p-2 border-b text-right">{fmt(igst)}</td>}
                <td className="p-2 border-b text-right font-semibold">{fmt(total)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-gray-50">
                <td colSpan={invoice.isInterstate ? 2 : 2} className="p-2 text-right font-semibold text-sm" />
                <td className="p-2 text-right font-semibold">{fmt(base)}</td>
                {!invoice.isInterstate && <Fragment>
                  <td className="p-2 text-right font-semibold">{fmt(cgst)}</td>
                  <td className="p-2 text-right font-semibold">{fmt(sgst)}</td>
                </Fragment>}
                {invoice.isInterstate && <td className="p-2 text-right font-semibold">{fmt(igst)}</td>}
                <td className="p-2 text-right font-bold text-base">{fmt(total)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="text-xs text-gray-500 mt-4 border-t pt-4 text-center">
            This is a computer-generated invoice and does not require a physical signature. &nbsp;|&nbsp; SAC Code: 999294 (Online Educational Services)
          </div>
        </div>
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
    email: "", phone: "", logoUrl: null, gstRate: 18, invoicePrefix: "INV",
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
          <p className="text-sm text-gray-500 mt-0.5">Manage GST invoices, summaries, and company settings</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { id: "invoices", label: "Invoices", icon: FileText },
          { id: "monthly", label: "Monthly Summary", icon: BarChart3 },
          { id: "statewise", label: "State-wise Report", icon: MapPin },
          { id: "settings", label: "Company Settings", icon: Settings2 },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
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
                  <TableRow><TableCell colSpan={9} className="text-center py-10 text-gray-400">Loading…</TableCell></TableRow>
                ) : invoices.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-10 text-gray-400">No invoices found. Click "Generate Missing" to create invoices for existing completed payments.</TableCell></TableRow>
                ) : invoices.map(inv => {
                  const gst = parseFloat(inv.cgstAmount) + parseFloat(inv.sgstAmount) + parseFloat(inv.igstAmount);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm font-semibold text-blue-700">{inv.invoiceNumber}</TableCell>
                      <TableCell className="text-sm">{new Date(inv.createdAt).toLocaleDateString("en-IN")}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{inv.customerName}</div>
                        <div className="text-xs text-gray-500">{inv.customerEmail}</div>
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
                        <Button size="sm" variant="ghost" onClick={() => openInvoice(inv)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {invoices.length > 0 && (
            <p className="text-sm text-gray-500">{invoices.length} invoice(s) found</p>
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
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-gray-400">Loading…</TableCell></TableRow>
                ) : monthly.map(m => (
                  <TableRow key={m.month} className={m.count === 0 ? "text-gray-400" : ""}>
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
                  <TableRow className="bg-gray-50 font-bold border-t-2">
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
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-gray-400">Loading…</TableCell></TableRow>
                ) : statewise.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-gray-400">No data for {stateYear}</TableCell></TableRow>
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
                  <TableRow className="bg-gray-50 font-bold border-t-2">
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
            <div className="text-center py-10 text-gray-400">Loading settings…</div>
          ) : (
            <Fragment>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
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

      {/* Invoice print modal */}
      {selectedInvoice && (
        <InvoicePrintModal
          invoice={selectedInvoice}
          settings={invoiceSettings ?? settings}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}
