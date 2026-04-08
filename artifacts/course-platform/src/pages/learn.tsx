import { useState } from "react";
import { useRoute } from "wouter";
import { useGetCourse, getGetCourseQueryKey, useGetCourseProgress, getGetCourseProgressQueryKey, useCompleteLesson } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Play, FileText, Lock, ChevronRight, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LearnPage() {
  const [, params] = useRoute("/learn/:courseId");
  const courseId = parseInt(params?.courseId ?? "0");
  const [selectedLesson, setSelectedLesson] = useState<{ id: number; title: string; type: string; content?: string | null; videoUrl?: string | null } | null>(null);
  const [expandedModules, setExpandedModules] = useState<number[]>([0]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: course } = useGetCourse(courseId, { query: { queryKey: getGetCourseQueryKey(courseId), enabled: courseId > 0 } });
  const { data: progress } = useGetCourseProgress(courseId, { query: { queryKey: getGetCourseProgressQueryKey(courseId), enabled: courseId > 0 } });
  const completeLesson = useCompleteLesson();

  const handleCompleteLesson = (lessonId: number) => {
    completeLesson.mutate({ lessonId }, {
      onSuccess: () => {
        toast({ title: "Lesson completed!", description: "Keep going!" });
        queryClient.invalidateQueries({ queryKey: getGetCourseProgressQueryKey(courseId) });
        queryClient.invalidateQueries({ queryKey: getGetCourseQueryKey(courseId) });
      },
    });
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-80 border-r border-border bg-card flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-bold text-sm line-clamp-2">{course?.title}</h2>
          <div className="flex items-center gap-2 mt-2">
            <Progress value={progress?.progressPercent ?? 0} className="flex-1 h-1.5" />
            <span className="text-xs text-muted-foreground">{progress?.progressPercent ?? 0}%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{progress?.completedLessons ?? 0}/{progress?.totalLessons ?? 0} lessons completed</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {(course?.modules ?? []).map((mod, idx) => (
            <div key={mod.id} className="mb-1">
              <button
                className="w-full flex items-center gap-2 p-2.5 rounded-lg hover:bg-background text-left text-sm font-medium"
                onClick={() => setExpandedModules(p => p.includes(idx) ? p.filter(i => i !== idx) : [...p, idx])}
              >
                {expandedModules.includes(idx) ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                <span className="line-clamp-2">{mod.title}</span>
              </button>
              {expandedModules.includes(idx) && (
                <div className="ml-4">
                  {(mod.lessons ?? []).map(lesson => (
                    <button
                      key={lesson.id}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-colors ${selectedLesson?.id === lesson.id ? "bg-primary/10 text-primary" : "hover:bg-background text-muted-foreground"}`}
                      onClick={() => setSelectedLesson(lesson)}
                    >
                      {lesson.isCompleted ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      ) : lesson.type === "video" ? (
                        <Play className="w-3.5 h-3.5 flex-shrink-0" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                      )}
                      <span className="line-clamp-2">{lesson.title}</span>
                      {lesson.durationMinutes && <span className="ml-auto flex-shrink-0 text-muted-foreground">{lesson.durationMinutes}m</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {!selectedLesson ? (
          <div className="flex-1 flex items-center justify-center flex-col gap-4 text-center p-8">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Play className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Ready to learn?</h2>
            <p className="text-muted-foreground max-w-sm">Select a lesson from the sidebar to get started.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{selectedLesson.title}</h2>
                <Badge variant="outline" className="mt-1 text-xs capitalize">{selectedLesson.type}</Badge>
              </div>
              <Button size="sm" onClick={() => handleCompleteLesson(selectedLesson.id)} disabled={completeLesson.isPending}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark Complete
              </Button>
            </div>
            <div className="p-8 max-w-3xl">
              {selectedLesson.type === "video" && selectedLesson.videoUrl ? (
                <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6">
                  <iframe src={selectedLesson.videoUrl} className="w-full h-full" allowFullScreen />
                </div>
              ) : selectedLesson.type === "video" ? (
                <div className="aspect-video bg-card rounded-xl flex items-center justify-center mb-6 border border-border">
                  <div className="text-center">
                    <Play className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">Video content will appear here</p>
                  </div>
                </div>
              ) : null}
              {selectedLesson.content && (
                <div className="prose prose-invert max-w-none">
                  <p className="text-foreground leading-relaxed">{selectedLesson.content}</p>
                </div>
              )}
              {!selectedLesson.content && selectedLesson.type !== "video" && (
                <div className="p-8 bg-card rounded-xl border border-border text-center">
                  <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Lesson content is being prepared.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
