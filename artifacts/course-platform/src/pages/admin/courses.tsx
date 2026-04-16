import { useState } from "react";
import { Link } from "wouter";
import { useAdminListCourses, getAdminListCoursesQueryKey, useCreateCourse, useUpdateCourse, useDeleteCourse, CreateCourseBody } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Package, BookOpen, Check, Eye, EyeOff } from "lucide-react";
import { ImageUploader } from "@/components/image-uploader";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const INITIAL_FORM = { title: "", description: "", thumbnailUrl: "", price: "", category: "Affiliate Marketing", level: "beginner" as const, status: "draft" as const };
const INITIAL_BUNDLE_FORM = { name: "", description: "", thumbnailUrl: "", price: "", compareAtPrice: "", isActive: true, courseIds: [] as number[] };

type Tab = "courses" | "bundles";

type BundleWithCourses = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  isActive: boolean;
  createdAt: string;
  courses: Array<{ id: number; title: string; price: number; thumbnailUrl: string | null; category: string; level: string }>;
};

function useBundles() {
  return useQuery<BundleWithCourses[]>({
    queryKey: ["admin-bundles"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/bundles/admin/list`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch bundles");
      return res.json();
    },
  });
}

export default function AdminCoursesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("courses");

  /* ── Courses ── */
  const { data: courses, isLoading } = useAdminListCourses({ query: { queryKey: getAdminListCoursesQueryKey() } });
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const deleteCourse = useDeleteCourse();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  /* ── Bundles ── */
  const { data: bundles, isLoading: bundlesLoading } = useBundles();
  const [bundleOpen, setBundleOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<BundleWithCourses | null>(null);
  const [bundleForm, setBundleForm] = useState(INITIAL_BUNDLE_FORM);
  const [bundleSaving, setBundleSaving] = useState(false);

  /* ── Course handlers ── */
  const handleCreate = () => {
    if (!form.title.trim()) { toast({ title: "Course title is required", variant: "destructive" }); return; }
    const body: CreateCourseBody = {
      title: form.title, description: form.description,
      thumbnailUrl: form.thumbnailUrl || null, price: parseFloat(form.price) || 0,
      category: form.category, level: form.level, status: form.status,
    };
    createCourse.mutate({ data: body }, {
      onSuccess: () => { toast({ title: "Course created!" }); setOpen(false); setForm(INITIAL_FORM); queryClient.invalidateQueries({ queryKey: getAdminListCoursesQueryKey() }); },
      onError: () => toast({ title: "Failed to create course", variant: "destructive" }),
    });
  };

  const handleToggleStatus = (id: number, current: string) => {
    const newStatus = current === "published" ? "draft" : "published";
    updateCourse.mutate({ courseId: id, data: { status: newStatus as "draft" | "published" } }, {
      onSuccess: () => { toast({ title: `Course ${newStatus}!` }); queryClient.invalidateQueries({ queryKey: getAdminListCoursesQueryKey() }); },
    });
  };

  const handleToggleWebsite = (id: number, current: boolean) => {
    fetch(`${API_BASE}/api/courses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ showOnWebsite: !current }),
    }).then(r => {
      if (!r.ok) throw new Error();
      toast({ title: !current ? "Course is now visible on website" : "Course hidden from website" });
      queryClient.invalidateQueries({ queryKey: getAdminListCoursesQueryKey() });
    }).catch(() => toast({ title: "Failed to update visibility", variant: "destructive" }));
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this course? This cannot be undone.")) return;
    deleteCourse.mutate({ courseId: id }, {
      onSuccess: () => { toast({ title: "Course deleted" }); queryClient.invalidateQueries({ queryKey: getAdminListCoursesQueryKey() }); },
      onError: () => toast({ title: "Failed to delete course", variant: "destructive" }),
    });
  };

  /* ── Bundle handlers ── */
  const openCreateBundle = () => {
    setEditingBundle(null);
    setBundleForm(INITIAL_BUNDLE_FORM);
    setBundleOpen(true);
  };

  const openEditBundle = (b: BundleWithCourses) => {
    setEditingBundle(b);
    setBundleForm({
      name: b.name, description: b.description ?? "", thumbnailUrl: b.thumbnailUrl ?? "",
      price: String(b.price), compareAtPrice: b.compareAtPrice ? String(b.compareAtPrice) : "",
      isActive: b.isActive, courseIds: b.courses.map(c => c.id),
    });
    setBundleOpen(true);
  };

  const handleSaveBundle = async () => {
    if (!bundleForm.name.trim()) { toast({ title: "Bundle name is required", variant: "destructive" }); return; }
    if (!bundleForm.price || isNaN(parseFloat(bundleForm.price))) { toast({ title: "Valid price is required", variant: "destructive" }); return; }
    if (bundleForm.courseIds.length === 0) { toast({ title: "Select at least one course", variant: "destructive" }); return; }
    setBundleSaving(true);
    try {
      const body = {
        name: bundleForm.name, description: bundleForm.description || null,
        thumbnailUrl: bundleForm.thumbnailUrl || null, price: parseFloat(bundleForm.price),
        compareAtPrice: bundleForm.compareAtPrice ? parseFloat(bundleForm.compareAtPrice) : null,
        isActive: bundleForm.isActive, courseIds: bundleForm.courseIds,
      };
      const url = editingBundle ? `${API_BASE}/api/bundles/admin/${editingBundle.id}` : `${API_BASE}/api/bundles/admin`;
      const method = editingBundle ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Failed to save bundle");
      toast({ title: editingBundle ? "Bundle updated!" : "Bundle created!" });
      setBundleOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-bundles"] });
    } catch {
      toast({ title: "Failed to save bundle", variant: "destructive" });
    } finally {
      setBundleSaving(false);
    }
  };

  const handleDeleteBundle = async (id: number) => {
    if (!confirm("Delete this bundle? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API_BASE}/api/bundles/admin/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
      toast({ title: "Bundle deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-bundles"] });
    } catch {
      toast({ title: "Failed to delete bundle", variant: "destructive" });
    }
  };

  const toggleCourseInBundle = (courseId: number) => {
    setBundleForm(f => ({
      ...f,
      courseIds: f.courseIds.includes(courseId) ? f.courseIds.filter(id => id !== courseId) : [...f.courseIds, courseId],
    }));
  };

  return (
    <div className="p-6">
      {/* Header with tabs */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Courses & Bundles</h1>
          <div className="flex gap-1 mt-3">
            <button
              onClick={() => setActiveTab("courses")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === "courses" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-card"}`}
            >
              <BookOpen className="w-3.5 h-3.5" />Courses ({courses?.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab("bundles")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === "bundles" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-card"}`}
            >
              <Package className="w-3.5 h-3.5" />Bundles ({bundles?.length ?? 0})
            </button>
          </div>
        </div>

        {activeTab === "courses" ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-2" />New Course</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-lg">
              <DialogHeader><DialogTitle>Create New Course</DialogTitle><DialogDescription>Fill in the details to publish a new course.</DialogDescription></DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Title *</label>
                  <Input placeholder="Course title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="bg-background" />
                </div>
                <ImageUploader label="Thumbnail / Banner" value={form.thumbnailUrl} onChange={url => setForm(f => ({ ...f, thumbnailUrl: url }))} aspectRatio="video" hint="Optional · JPG, PNG, WebP · Max 10 MB" />
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Description</label>
                  <textarea placeholder="What will students learn?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full p-3 rounded-md bg-background border border-border text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Price (INR ₹)</label>
                    <Input placeholder="0.00" type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="bg-background" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Category</label>
                    <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Affiliate Marketing">Affiliate Marketing</SelectItem>
                        <SelectItem value="E-commerce">E-commerce</SelectItem>
                        <SelectItem value="Dropshipping">Dropshipping</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Level</label>
                    <Select value={form.level} onValueChange={v => setForm(f => ({ ...f, level: v as typeof form.level }))}>
                      <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Status</label>
                    <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as typeof form.status }))}>
                      <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={createCourse.isPending}>
                  {createCourse.isPending ? "Creating..." : "Create Course"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <Button size="sm" onClick={openCreateBundle}><Plus className="w-4 h-4 mr-2" />New Bundle</Button>
        )}
      </div>

      {/* ── COURSES TAB ── */}
      {activeTab === "courses" && (
        isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-card rounded animate-pulse" />)}</div>
        ) : !courses || courses.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No courses yet. Create your first one!</div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-card border-b border-border">
                <tr>{["Title", "Category", "Level", "Price", "Status", "On Website", "Students", "Actions"].map(h => <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {courses.map(c => {
                  const showOnWebsite = (c as unknown as { showOnWebsite: boolean }).showOnWebsite !== false;
                  return (
                  <tr key={c.id} className="hover:bg-card/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-sm max-w-xs"><p className="truncate">{c.title}</p></td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{c.category}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{c.level}</td>
                    <td className="px-4 py-3 text-sm font-bold">₹{c.price}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs cursor-pointer select-none ${c.status === "published" ? "text-green-400 border-green-400/30 bg-green-400/10" : "text-yellow-400 border-yellow-400/30 bg-yellow-400/10"}`} onClick={() => handleToggleStatus(c.id, c.status)} title="Click to toggle">{c.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleWebsite(c.id, showOnWebsite)}
                        title={showOnWebsite ? "Visible on website – click to hide" : "Hidden from website – click to show"}
                        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${showOnWebsite ? "bg-blue-400/10 border-blue-400/30 text-blue-400 hover:bg-blue-400/20" : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"}`}
                      >
                        {showOnWebsite ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {showOnWebsite ? "Visible" : "Hidden"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{c.enrollmentCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                          <Link href={`/admin/courses/${c.id}/edit`}><Pencil className="w-3.5 h-3.5" /></Link>
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" onClick={() => handleDelete(c.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── BUNDLES TAB ── */}
      {activeTab === "bundles" && (
        bundlesLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-card rounded animate-pulse" />)}</div>
        ) : !bundles || bundles.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No bundles yet. Create your first package!</p>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-card border-b border-border">
                <tr>{["Bundle Name", "Courses", "Bundle Price", "Compare At", "Status", "Actions"].map(h => <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bundles.map(b => (
                  <tr key={b.id} className="hover:bg-card/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm">{b.name}</p>
                      {b.description && <p className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">{b.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {b.courses.slice(0, 3).map(c => <span key={c.id} className="text-xs bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5 truncate max-w-[120px]">{c.title}</span>)}
                        {b.courses.length > 3 && <span className="text-xs text-muted-foreground">+{b.courses.length - 3} more</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-primary">₹{b.price}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground line-through">{b.compareAtPrice ? `₹${b.compareAtPrice}` : "—"}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${b.isActive ? "text-green-400 border-green-400/30 bg-green-400/10" : "text-yellow-400 border-yellow-400/30 bg-yellow-400/10"}`}>
                        {b.isActive ? "active" : "inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditBundle(b)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" onClick={() => handleDeleteBundle(b.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Bundle Create/Edit Dialog ── */}
      <Dialog open={bundleOpen} onOpenChange={setBundleOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBundle ? "Edit Bundle" : "Create New Bundle"}</DialogTitle>
            <DialogDescription>Group multiple courses into a single package for students to purchase.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Bundle Name *</label>
              <Input placeholder="e.g. Pro Package, Supreme Bundle" value={bundleForm.name} onChange={e => setBundleForm(f => ({ ...f, name: e.target.value }))} className="bg-background" />
            </div>
            <ImageUploader label="Thumbnail / Banner" value={bundleForm.thumbnailUrl} onChange={url => setBundleForm(f => ({ ...f, thumbnailUrl: url }))} aspectRatio="video" hint="Optional · JPG, PNG, WebP · Max 10 MB" />
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <textarea placeholder="What makes this bundle special?" value={bundleForm.description} onChange={e => setBundleForm(f => ({ ...f, description: e.target.value }))} className="w-full p-3 rounded-md bg-background border border-border text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Bundle Price (₹) *</label>
                <Input placeholder="e.g. 799" type="number" min="0" value={bundleForm.price} onChange={e => setBundleForm(f => ({ ...f, price: e.target.value }))} className="bg-background" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Compare At Price (₹)</label>
                <Input placeholder="Original value (crossed out)" type="number" min="0" value={bundleForm.compareAtPrice} onChange={e => setBundleForm(f => ({ ...f, compareAtPrice: e.target.value }))} className="bg-background" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Status</label>
              <button
                type="button"
                onClick={() => setBundleForm(f => ({ ...f, isActive: !f.isActive }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${bundleForm.isActive ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${bundleForm.isActive ? "translate-x-4" : "translate-x-1"}`} />
              </button>
              <span className="text-sm text-muted-foreground">{bundleForm.isActive ? "Active (visible to students)" : "Inactive (hidden)"}</span>
            </div>

            {/* Course selector */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Include Courses * <span className="text-muted-foreground font-normal">({bundleForm.courseIds.length} selected)</span>
              </label>
              {!courses || courses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No courses available. Create courses first.</p>
              ) : (
                <div className="border border-border rounded-lg divide-y divide-border max-h-52 overflow-y-auto">
                  {courses.map(c => {
                    const selected = bundleForm.courseIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCourseInBundle(c.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${selected ? "bg-primary/10" : "hover:bg-card/50"}`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected ? "bg-primary border-primary" : "border-border"}`}>
                          {selected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.title}</p>
                          <p className="text-xs text-muted-foreground">{c.category} · ₹{c.price}</p>
                        </div>
                        <Badge className={`text-xs ${c.status === "published" ? "text-green-400 border-green-400/30 bg-green-400/10" : "text-yellow-400 border-yellow-400/30 bg-yellow-400/10"}`}>{c.status}</Badge>
                      </button>
                    );
                  })}
                </div>
              )}
              {bundleForm.courseIds.length > 0 && courses && (
                <p className="text-xs text-muted-foreground mt-2">
                  Individual total: ₹{courses.filter(c => bundleForm.courseIds.includes(c.id)).reduce((s, c) => s + parseFloat(String(c.price)), 0).toFixed(0)}
                  {bundleForm.price && ` · Bundle saves ₹${Math.max(0, courses.filter(c => bundleForm.courseIds.includes(c.id)).reduce((s, c) => s + parseFloat(String(c.price)), 0) - parseFloat(bundleForm.price)).toFixed(0)}`}
                </p>
              )}
            </div>

            <Button className="w-full" onClick={handleSaveBundle} disabled={bundleSaving}>
              {bundleSaving ? "Saving..." : editingBundle ? "Update Bundle" : "Create Bundle"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
