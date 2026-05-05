import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Code2,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Power,
  PowerOff,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Placement = "head" | "body_start" | "body_end";

interface Snippet {
  id: number;
  name: string;
  code: string;
  placement: Placement;
  enabled: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

const PLACEMENT_LABELS: Record<Placement, string> = {
  head: "Header (<head>)",
  body_start: "Body Start (after <body>)",
  body_end: "Footer (before </body>)",
};

const PLACEMENT_HELP: Record<Placement, string> = {
  head: "Loaded earliest. Best for analytics, tracking pixels, and meta tags.",
  body_start: "Loaded right after page opens. Best for chat widgets, GTM noscript, etc.",
  body_end: "Loaded last. Best for non-critical scripts that shouldn't block rendering.",
};

interface FormState {
  name: string;
  code: string;
  placement: Placement;
  enabled: boolean;
  position: number;
}

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  placement: "head",
  enabled: true,
  position: 0,
};

export default function AdminCodeSnippetsPage() {
  const { toast } = useToast();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<Snippet | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Snippet | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/code-snippets`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      const data = (await r.json()) as Snippet[];
      setSnippets(data);
    } catch {
      toast({ title: "Could not load snippets", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setCreating(true);
  }

  function openEdit(s: Snippet) {
    setForm({
      name: s.name,
      code: s.code,
      placement: s.placement,
      enabled: s.enabled,
      position: s.position,
    });
    setEditTarget(s);
    setCreating(false);
  }

  function closeForm() {
    setEditTarget(null);
    setCreating(false);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (!form.code.trim()) {
      toast({ title: "Code required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const url = editTarget
        ? `${API_BASE}/api/admin/code-snippets/${editTarget.id}`
        : `${API_BASE}/api/admin/code-snippets`;
      const method = editTarget ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed");
      }
      toast({
        title: editTarget ? "Snippet updated" : "Snippet created",
        description: "Changes will appear on the site after a refresh.",
      });
      closeForm();
      await load();
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(s: Snippet) {
    setTogglingId(s.id);
    try {
      const r = await fetch(`${API_BASE}/api/admin/code-snippets/${s.id}/toggle`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!r.ok) throw new Error();
      await load();
    } catch {
      toast({ title: "Toggle failed", variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/code-snippets/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error();
      toast({ title: "Snippet deleted" });
      setDeleteTarget(null);
      await load();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  const grouped: Record<Placement, Snippet[]> = {
    head: snippets.filter(s => s.placement === "head"),
    body_start: snippets.filter(s => s.placement === "body_start"),
    body_end: snippets.filter(s => s.placement === "body_end"),
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Code2 className="h-7 w-7 text-primary" />
            Code Snippets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add custom HTML / JavaScript code (analytics, chat widgets, tracking pixels)
            to the Header, Body or Footer of your site.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add Snippet
        </Button>
      </div>

      <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <strong className="text-foreground">Heads up:</strong> Code snippets run on every
            page of your site for every visitor. Only paste code from sources you trust —
            malicious scripts can steal user data or break your site.
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading snippets…
          </CardContent>
        </Card>
      ) : snippets.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Code2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-foreground font-medium mb-1">No snippets yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Add your first code snippet to inject custom scripts into your site.
            </p>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Add Snippet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {(Object.keys(PLACEMENT_LABELS) as Placement[]).map(placement => {
            const items = grouped[placement];
            if (items.length === 0) return null;
            return (
              <div key={placement}>
                <div className="mb-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    {PLACEMENT_LABELS[placement]}
                  </h2>
                  <p className="text-xs text-muted-foreground">{PLACEMENT_HELP[placement]}</p>
                </div>
                <div className="space-y-2">
                  {items.map(s => (
                    <Card key={s.id} className={s.enabled ? "" : "opacity-60"}>
                      <CardContent className="p-4 flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-semibold text-foreground truncate">
                              {s.name}
                            </span>
                            {s.enabled ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 inline-flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> ENABLED
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                DISABLED
                              </span>
                            )}
                          </div>
                          <pre className="text-[11px] text-muted-foreground bg-muted/40 rounded p-2 mt-1 overflow-x-auto max-h-24 font-mono whitespace-pre-wrap break-all">
                            {s.code.length > 240 ? s.code.slice(0, 240) + "…" : s.code}
                          </pre>
                        </div>
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggle(s)}
                            disabled={togglingId === s.id}
                            className="gap-1.5"
                            title={s.enabled ? "Disable" : "Enable"}
                          >
                            {togglingId === s.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : s.enabled ? (
                              <PowerOff className="h-3.5 w-3.5" />
                            ) : (
                              <Power className="h-3.5 w-3.5" />
                            )}
                            {s.enabled ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(s)}
                            className="gap-1.5"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteTarget(s)}
                            className="gap-1.5 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={creating || editTarget !== null} onOpenChange={open => !open && closeForm()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Snippet" : "Add Code Snippet"}</DialogTitle>
            <DialogDescription>
              Paste any HTML or JavaScript code. It will be injected into every page at the
              chosen position.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="snip-name">Name</Label>
              <Input
                id="snip-name"
                placeholder="e.g. Google Analytics, Tawk.to chat, Hotjar"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Just a label for you to remember what this is.
              </p>
            </div>

            <div>
              <Label htmlFor="snip-placement">Placement</Label>
              <Select
                value={form.placement}
                onValueChange={(v: Placement) => setForm(f => ({ ...f, placement: v }))}
                disabled={saving}
              >
                <SelectTrigger id="snip-placement">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PLACEMENT_LABELS) as Placement[]).map(p => (
                    <SelectItem key={p} value={p}>
                      {PLACEMENT_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {PLACEMENT_HELP[form.placement]}
              </p>
            </div>

            <div>
              <Label htmlFor="snip-code">Code (HTML / JavaScript)</Label>
              <Textarea
                id="snip-code"
                placeholder={'<script>\n  console.log("hello");\n</script>'}
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                rows={10}
                className="font-mono text-xs"
                disabled={saving}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="snip-enabled" className="cursor-pointer">
                  Enabled
                </Label>
                <p className="text-xs text-muted-foreground">
                  Disabled snippets stay saved but don't run on the site.
                </p>
              </div>
              <Switch
                id="snip-enabled"
                checked={form.enabled}
                onCheckedChange={v => setForm(f => ({ ...f, enabled: v }))}
                disabled={saving}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeForm} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editTarget ? "Save Changes" : "Add Snippet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this snippet?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-foreground">{deleteTarget?.name}</strong> will be
              permanently removed and stop running on your site immediately. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
