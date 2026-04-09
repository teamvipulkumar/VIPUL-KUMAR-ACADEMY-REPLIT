import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Search, DollarSign, ShoppingCart, Clock, RefreshCw, Download,
  User, BookOpen, Calendar, CreditCard, Tag, Hash, Mail
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button as Btn } from "@/components/ui/button";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Order = {
  id: number;
  userId: number;
  courseId: number;
  amount: string;
  currency: string;
  status: "pending" | "completed" | "failed" | "refunded";
  gateway: "stripe" | "razorpay";
  couponCode: string | null;
  paymentId: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
  courseTitle: string;
};

type Stats = {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  refundedOrders: number;
};

const statusConfig = {
  completed: { label: "Completed", className: "text-green-400 border-green-400/30 bg-green-400/10" },
  pending: { label: "Pending", className: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10" },
  failed: { label: "Failed", className: "text-red-400 border-red-400/30 bg-red-400/10" },
  refunded: { label: "Refunded", className: "text-purple-400 border-purple-400/30 bg-purple-400/10" },
};

const gatewayConfig = {
  stripe: { label: "Stripe", className: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
  razorpay: { label: "Razorpay", className: "text-indigo-400 border-indigo-400/30 bg-indigo-400/10" },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function formatAmount(amount: string, currency: string) {
  const num = parseFloat(amount);
  if (currency === "INR") return `₹${num.toFixed(2)}`;
  if (currency === "USD") return `$${num.toFixed(2)}`;
  return `${currency} ${num.toFixed(2)}`;
}

function AvatarInitial({ name }: { name: string }) {
  const colors = ["bg-blue-600", "bg-purple-600", "bg-green-600", "bg-orange-600", "bg-pink-600", "bg-teal-600"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Order Detail Dialog ───────────────────────────────────────────────────────
function OrderDetailDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const cfg = statusConfig[order.status];
  const gtw = gatewayConfig[order.gateway];
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md bg-[#0d1424] border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary" />Order #{order.id}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Status + amount hero */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-card/60 border border-border">
            <div>
              <p className="text-2xl font-bold text-foreground">{formatAmount(order.amount, order.currency)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Order #{order.id}</p>
            </div>
            <Badge className={`text-sm px-3 py-1 ${cfg.className}`}>{cfg.label}</Badge>
          </div>

          {/* Details */}
          <div className="space-y-2.5">
            {[
              { icon: User, label: "Customer", value: order.userName },
              { icon: Mail, label: "Email", value: order.userEmail },
              { icon: BookOpen, label: "Course", value: order.courseTitle },
              { icon: Calendar, label: "Order Date", value: formatDate(order.createdAt) },
              { icon: CreditCard, label: "Payment Gateway", value: <Badge className={`text-xs ${gtw.className}`}>{gtw.label}</Badge> },
              ...(order.paymentId ? [{ icon: Hash, label: "Payment ID", value: <code className="text-xs font-mono text-muted-foreground">{order.paymentId}</code> }] : []),
              ...(order.couponCode ? [{ icon: Tag, label: "Coupon Used", value: <code className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-mono">{order.couponCode}</code> }] : []),
            ].map((row, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <row.icon className="w-3.5 h-3.5" />{row.label}
                </span>
                <span className="text-sm text-foreground font-medium text-right max-w-[55%] truncate">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Btn variant="outline" onClick={onClose} className="border-white/10">Close</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats>({ totalRevenue: 0, totalOrders: 0, pendingOrders: 0, refundedOrders: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [gateway, setGateway] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const { toast } = useToast();

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status !== "all") params.set("status", status);
      if (gateway !== "all") params.set("gateway", gateway);
      params.set("limit", "100");
      const res = await fetch(`${API_BASE}/api/admin/orders?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data = await res.json();
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
      setStats(data.stats ?? { totalRevenue: 0, totalOrders: 0, pendingOrders: 0, refundedOrders: 0 });
    } catch (err) {
      toast({ title: "Error loading orders", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [debouncedSearch, status, gateway]);

  const handleSearch = (v: string) => {
    setSearch(v);
    const t = setTimeout(() => setDebouncedSearch(v), 400);
    return () => clearTimeout(t);
  };

  const exportCsv = () => {
    const headers = ["Order ID", "Customer", "Email", "Course", "Amount", "Currency", "Status", "Gateway", "Coupon", "Date"];
    const rows = orders.map(o => [
      o.id, o.userName, o.userEmail, `"${o.courseTitle}"`,
      parseFloat(o.amount).toFixed(2), o.currency, o.status, o.gateway,
      o.couponCode ?? "", formatDate(o.createdAt)
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const statCards = [
    { label: "Total Revenue", value: `₹${stats.totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Total Orders", value: stats.totalOrders, icon: ShoppingCart, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Pending", value: stats.pendingOrders, icon: Clock, color: "text-yellow-400", bg: "bg-yellow-400/10" },
    { label: "Refunded", value: stats.refundedOrders, icon: RefreshCw, color: "text-purple-400", bg: "bg-purple-400/10" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-full">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} total orders</p>
        </div>
        <Button onClick={exportCsv} variant="outline" className="border-white/10 gap-2 self-start sm:self-auto hover:bg-white/5">
          <Download className="w-4 h-4" />Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {statCards.map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-foreground truncate">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer, email or course..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-40 bg-card border-border"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <Select value={gateway} onValueChange={setGateway}>
          <SelectTrigger className="w-full sm:w-40 bg-card border-border"><SelectValue placeholder="All Gateways" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Gateways</SelectItem>
            <SelectItem value="stripe">Stripe</SelectItem>
            <SelectItem value="razorpay">Razorpay</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5,6].map(i => <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No orders found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-card border-b border-border">
              <tr>
                {["Order", "Customer", "Course", "Date & Time", "Amount", "Status", "Gateway", ""].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map(order => {
                const cfg = statusConfig[order.status];
                const gtw = gatewayConfig[order.gateway];
                return (
                  <tr key={order.id} className="hover:bg-card/40 transition-colors cursor-pointer" onClick={() => setSelectedOrder(order)}>
                    {/* Order # */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-semibold text-foreground">#{order.id}</span>
                      {order.couponCode && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Tag className="w-2.5 h-2.5 text-primary" />
                          <code className="text-[10px] text-primary font-mono">{order.couponCode}</code>
                        </div>
                      )}
                    </td>
                    {/* Customer */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <AvatarInitial name={order.userName} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{order.userName}</p>
                          <p className="text-xs text-muted-foreground truncate">{order.userEmail}</p>
                        </div>
                      </div>
                    </td>
                    {/* Course */}
                    <td className="px-4 py-3">
                      <p className="text-sm text-foreground max-w-[180px] truncate" title={order.courseTitle}>{order.courseTitle}</p>
                    </td>
                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        {formatDate(order.createdAt)}
                      </div>
                    </td>
                    {/* Amount */}
                    <td className="px-4 py-3">
                      <span className="font-bold text-sm text-foreground">{formatAmount(order.amount, order.currency)}</span>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
                    </td>
                    {/* Gateway */}
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${gtw.className}`}>{gtw.label}</Badge>
                    </td>
                    {/* View */}
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5"
                        onClick={e => { e.stopPropagation(); setSelectedOrder(order); }}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Total row */}
      {orders.length > 0 && (
        <div className="mt-3 text-right text-xs text-muted-foreground">
          Showing {orders.length} of {total} orders
        </div>
      )}

      {selectedOrder && <OrderDetailDialog order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </div>
  );
}
