import { useState } from "react";
import { Link } from "wouter";
import { useAdminListCourses, getAdminListCoursesQueryKey, useCreateCourse, useUpdateCourse, useDeleteCourse } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";

export default function AdminCoursesPage() {
  const { data: courses, isLoading } = useAdminListCourses({ query: { queryKey: getAdminListCoursesQueryKey() } });
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const deleteCourse = useDeleteCourse();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", price: "", category: "Affiliate Marketing", level: "beginner", status: "draft" });

  const handleCreate = () => {
    createCourse.mutate({ data: { ...form, price: parseFloat(form.price) || 0 } as Parameters<typeof createCourse.mutate>[0]['data'], }, {
      onSuccess: () => { toast({ title: "Course created!" }); setOpen(false); setForm({ title: "", description: "", price: "", category: "Affiliate Marketing", level: "beginner", status: "draft" }); queryClient.invalidateQueries({ queryKey: getAdminListCoursesQueryKey() }); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  const handleToggleStatus = (id: number, current: string) => {
    const newStatus = current === "published" ? "draft" : "published";
    updateCourse.mutate({ courseId: id, data: { status: newStatus as "draft" | "published" } }, {
      onSuccess: () => { toast({ title: `Course ${newStatus}!` }); queryClient.invalidateQueries({ queryKey: getAdminListCoursesQueryKey() }); },
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this course? This cannot be undone.")) return;
    deleteCourse.mutate({ courseId: id }, {
      onSuccess: () => { toast({ title: "Course deleted" }); queryClient.invalidateQueries({ queryKey: getAdminListCoursesQueryKey() }); },
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Courses</h1><p className="text-muted-foreground">{courses?.length ?? 0} total courses</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-2" />New Course</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader><DialogTitle>Create Course</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <Input placeholder="Course title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="bg-background" />
              <textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full p-3 rounded-md bg-background border border-border text-sm resize-none h-24" />
              <Input placeholder="Price (USD)" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="bg-background" />
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Affiliate Marketing">Affiliate Marketing</SelectItem><SelectItem value="E-commerce">E-commerce</SelectItem><SelectItem value="Dropshipping">Dropshipping</SelectItem></SelectContent></Select>
              <Select value={form.level} onValueChange={v => setForm(f => ({ ...f, level: v }))}><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="beginner">Beginner</SelectItem><SelectItem value="intermediate">Intermediate</SelectItem><SelectItem value="advanced">Advanced</SelectItem></SelectContent></Select>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem></SelectContent></Select>
              <Button className="w-full" onClick={handleCreate} disabled={createCourse.isPending}>Create Course</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-card rounded animate-pulse" />)}</div> : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-card border-b border-border"><tr>{["Title", "Category", "Price", "Status", "Students", "Actions"].map(h => <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {(courses ?? []).map(c => (
                <tr key={c.id} className="hover:bg-card/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-sm max-w-xs"><p className="truncate">{c.title}</p></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{c.category}</td>
                  <td className="px-4 py-3 text-sm font-bold">${c.price}</td>
                  <td className="px-4 py-3"><Badge className={`text-xs cursor-pointer ${c.status === "published" ? "text-green-400 border-green-400/30 bg-green-400/10" : "text-yellow-400 border-yellow-400/30 bg-yellow-400/10"}`} onClick={() => handleToggleStatus(c.id, c.status)}>{c.status}</Badge></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{c.enrollmentCount}</td>
                  <td className="px-4 py-3 flex items-center gap-2">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild><Link href={`/admin/courses/${c.id}/edit`}><Pencil className="w-3.5 h-3.5" /></Link></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" onClick={() => handleDelete(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
