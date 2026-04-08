import { useState } from "react";
import { useRoute } from "wouter";
import { useGetCourse, getGetCourseQueryKey, useCreateModule, useDeleteModule, useCreateLesson, useDeleteLesson, useUpdateCourse } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";

export default function AdminCourseEditPage() {
  const [, params] = useRoute("/admin/courses/:id/edit");
  const courseId = parseInt(params?.id ?? "0");
  const { data: course, isLoading } = useGetCourse(courseId, { query: { queryKey: getGetCourseQueryKey(courseId), enabled: courseId > 0 } });
  const createModule = useCreateModule();
  const deleteModule = useDeleteModule();
  const createLesson = useCreateLesson();
  const deleteLesson = useDeleteLesson();
  const updateCourse = useUpdateCourse();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expandedModules, setExpandedModules] = useState<number[]>([]);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newLesson, setNewLesson] = useState<Record<number, { title: string; type: string }>>({});

  const handleAddModule = () => {
    if (!newModuleTitle.trim()) return;
    createModule.mutate({ courseId, data: { title: newModuleTitle, order: (course?.modules?.length ?? 0) + 1 } }, {
      onSuccess: () => { toast({ title: "Module added" }); setNewModuleTitle(""); queryClient.invalidateQueries({ queryKey: getGetCourseQueryKey(courseId) }); },
    });
  };

  const handleDeleteModule = (moduleId: number) => {
    if (!confirm("Delete this module and all its lessons?")) return;
    deleteModule.mutate({ courseId, moduleId }, {
      onSuccess: () => { toast({ title: "Module deleted" }); queryClient.invalidateQueries({ queryKey: getGetCourseQueryKey(courseId) }); },
    });
  };

  const handleAddLesson = (moduleId: number, order: number) => {
    const lesson = newLesson[moduleId];
    if (!lesson?.title?.trim()) return;
    createLesson.mutate({ courseId, moduleId, data: { title: lesson.title, type: lesson.type as "video" | "text" | "pdf" | "quiz" || "video", order, isFree: false } }, {
      onSuccess: () => { toast({ title: "Lesson added" }); setNewLesson(l => ({ ...l, [moduleId]: { title: "", type: "video" } })); queryClient.invalidateQueries({ queryKey: getGetCourseQueryKey(courseId) }); },
    });
  };

  const handleDeleteLesson = (moduleId: number, lessonId: number) => {
    deleteLesson.mutate({ courseId, moduleId, lessonId }, {
      onSuccess: () => { toast({ title: "Lesson deleted" }); queryClient.invalidateQueries({ queryKey: getGetCourseQueryKey(courseId) }); },
    });
  };

  if (isLoading) return <div className="p-6"><div className="h-8 w-48 bg-card rounded animate-pulse" /></div>;
  if (!course) return <div className="p-6 text-muted-foreground">Course not found.</div>;

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Edit Course</h1>
        <p className="text-muted-foreground text-sm">{course.title}</p>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Modules & Lessons</h2>
        <div className="space-y-3">
          {(course.modules ?? []).map((mod, idx) => (
            <div key={mod.id} className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-3 bg-card">
                <button onClick={() => setExpandedModules(p => p.includes(idx) ? p.filter(i => i !== idx) : [...p, idx])}>
                  {expandedModules.includes(idx) ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </button>
                <span className="font-medium text-sm flex-1">{mod.title}</span>
                <span className="text-xs text-muted-foreground">{mod.lessons?.length ?? 0} lessons</span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400" onClick={() => handleDeleteModule(mod.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
              {expandedModules.includes(idx) && (
                <div className="p-3 bg-background/50">
                  <div className="space-y-1 mb-3">
                    {(mod.lessons ?? []).map(lesson => (
                      <div key={lesson.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-card text-sm">
                        <span className="flex-1">{lesson.title}</span>
                        <span className="text-xs text-muted-foreground capitalize">{lesson.type}</span>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400" onClick={() => handleDeleteLesson(mod.id, lesson.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Lesson title" className="bg-card border-border text-sm h-8" value={newLesson[mod.id]?.title ?? ""} onChange={e => setNewLesson(l => ({ ...l, [mod.id]: { ...l[mod.id], title: e.target.value, type: l[mod.id]?.type ?? "video" } }))} />
                    <Select value={newLesson[mod.id]?.type ?? "video"} onValueChange={v => setNewLesson(l => ({ ...l, [mod.id]: { ...l[mod.id], title: l[mod.id]?.title ?? "", type: v } }))}>
                      <SelectTrigger className="w-24 h-8 text-xs bg-card"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="video">Video</SelectItem><SelectItem value="text">Text</SelectItem><SelectItem value="pdf">PDF</SelectItem><SelectItem value="quiz">Quiz</SelectItem></SelectContent>
                    </Select>
                    <Button size="sm" className="h-8 px-3" onClick={() => handleAddLesson(mod.id, (mod.lessons?.length ?? 0) + 1)}><Plus className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          <Input placeholder="New module title" value={newModuleTitle} onChange={e => setNewModuleTitle(e.target.value)} className="bg-card border-border" onKeyDown={e => e.key === "Enter" && handleAddModule()} />
          <Button onClick={handleAddModule} disabled={createModule.isPending}><Plus className="w-4 h-4 mr-2" />Add Module</Button>
        </div>
      </div>
    </div>
  );
}
