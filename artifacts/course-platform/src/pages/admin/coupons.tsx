import { useState } from "react";
import { useListCoupons, getListCouponsQueryKey, useCreateCoupon, useDeleteCoupon } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

export default function AdminCouponsPage() {
  const { data: coupons, isLoading } = useListCoupons({ query: { queryKey: getListCouponsQueryKey() } });
  const createCoupon = useCreateCoupon();
  const deleteCoupon = useDeleteCoupon();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", discountType: "percentage", discountValue: "", maxUses: "" });

  const handleCreate = () => {
    if (!form.code || !form.discountValue) { toast({ title: "Fill all required fields", variant: "destructive" }); return; }
    createCoupon.mutate({ data: { code: form.code.toUpperCase(), discountType: form.discountType as "percentage" | "fixed", discountValue: parseFloat(form.discountValue), maxUses: form.maxUses ? parseInt(form.maxUses) : null } }, {
      onSuccess: () => { toast({ title: "Coupon created!" }); setOpen(false); setForm({ code: "", discountType: "percentage", discountValue: "", maxUses: "" }); queryClient.invalidateQueries({ queryKey: getListCouponsQueryKey() }); },
      onError: () => toast({ title: "Error creating coupon", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    deleteCoupon.mutate({ couponId: id }, {
      onSuccess: () => { toast({ title: "Coupon deleted" }); queryClient.invalidateQueries({ queryKey: getListCouponsQueryKey() }); },
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Coupons</h1><p className="text-muted-foreground">Manage discount codes.</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-2" />New Coupon</Button></DialogTrigger>
          <DialogContent className="bg-card border-border max-w-sm">
            <DialogHeader><DialogTitle>Create Coupon</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <Input placeholder="Coupon code (e.g. SAVE20)" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} className="bg-background font-mono" />
              <Select value={form.discountType} onValueChange={v => setForm(f => ({ ...f, discountType: v }))}><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">Percentage (%)</SelectItem><SelectItem value="fixed">Fixed amount ($)</SelectItem></SelectContent></Select>
              <Input placeholder="Discount value" type="number" value={form.discountValue} onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))} className="bg-background" />
              <Input placeholder="Max uses (optional)" type="number" value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))} className="bg-background" />
              <Button className="w-full" onClick={handleCreate} disabled={createCoupon.isPending}>Create Coupon</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-card rounded animate-pulse" />)}</div> : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-card border-b border-border"><tr>{["Code", "Discount", "Used/Max", "Status", "Expires", "Actions"].map(h => <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {(coupons ?? []).map(c => (
                <tr key={c.id} className="hover:bg-card/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-sm">{c.code}</td>
                  <td className="px-4 py-3 text-sm">{c.discountValue}{c.discountType === "percentage" ? "%" : "$"} off</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{c.usedCount}/{c.maxUses ?? "∞"}</td>
                  <td className="px-4 py-3"><Badge className={`text-xs ${c.isActive ? "text-green-400 border-green-400/30 bg-green-400/10" : "text-red-400 border-red-400/30 bg-red-400/10"}`}>{c.isActive ? "Active" : "Inactive"}</Badge></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "Never"}</td>
                  <td className="px-4 py-3"><Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400" onClick={() => handleDelete(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
