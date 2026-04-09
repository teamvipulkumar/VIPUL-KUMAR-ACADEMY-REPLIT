import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useGetCourse, getGetCourseQueryKey, useGetCourseProgress, getGetCourseProgressQueryKey, useCompleteLesson } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Play, FileText, HelpCircle, ChevronRight, ChevronDown, ArrowLeft, Check, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type LessonEntry = {
  id: number;
  title: string;
  type: string;
  content?: string | null;
  videoUrl?: string | null;
  durationMinutes?: number | null;
  isCompleted: boolean;
  isFree: boolean;
};

export default function LearnPage() {
  const [, params] = useRoute("/learn/:courseId");
  const courseId = parseInt(params?.courseId ?? "0");
  const [selectedLesson, setSelectedLesson] = useState<LessonEntry | null>(null);
  const [expandedModules, setExpandedModules] = useState<number[]>([0]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: course } = useGetCourse(courseId, {
    query: { queryKey: getGetCourseQueryKey(courseId), enabled: courseId > 0 }
  });
  const { data: progress } = useGetCourseProgress(courseId, {
    query: { queryKey: getGetCourseProgressQueryKey(courseId), enabled: courseId > 0 }
  });
  const completeLesson = useCompleteLesson();

  const handleCompleteLesson = (lessonId: number) => {
    completeLesson.mutate({ lessonId }, {
      onSuccess: () => {
        toast({ title: "Lesson completed! 🎉", description: "Great work, keep it up!" });
        queryClient.invalidateQueries({ queryKey: getGetCourseProgressQueryKey(courseId) });
        queryClient.invalidateQueries({ queryKey: getGetCourseQueryKey(courseId) });
      },
      onError: () => toast({ title: "Error", description: "Could not mark lesson as complete.", variant: "destructive" }),
    });
  };

  const lessonIcon = (type: string, completed: boolean) => {
    if (completed) return <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />;
    if (type === "video") return <Play className="w-3.5 h-3.5 flex-shrink-0" />;
    if (type === "quiz") return <HelpCircle className="w-3.5 h-3.5 flex-shrink-0" />;
    return <FileText className="w-3.5 h-3.5 flex-shrink-0" />;
  };

  const allLessons = (course?.modules ?? []).flatMap(m => m.lessons ?? []);
  const currentIndex = selectedLesson ? allLessons.findIndex(l => l.id === selectedLesson.id) : -1;
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="h-12 border-b border-border bg-card flex items-center px-4 gap-4 flex-shrink-0">
        <Link href={`/courses/${courseId}`}>
          <Button variant="ghost" size="sm" className="text-xs gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Course
          </Button>
        </Link>
        <div className="h-4 w-px bg-border" />
        <span className="text-sm font-medium truncate flex-1">{course?.title}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Progress value={progress?.progressPercent ?? 0} className="w-24 h-1.5" />
          <span className="text-xs text-muted-foreground">{progress?.progressPercent ?? 0}%</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 border-r border-border bg-card flex-shrink-0 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border">
            <p className="text-xs text-muted-foreground">
              {progress?.completedLessons ?? 0} of {progress?.totalLessons ?? 0} lessons completed
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {(course?.modules ?? []).map((mod, idx) => (
              <div key={mod.id} className="mb-1">
                <button
                  className="w-full flex items-center gap-2 p-2.5 rounded-lg hover:bg-background/70 text-left text-sm font-medium transition-colors"
                  onClick={() => setExpandedModules(p => p.includes(idx) ? p.filter(i => i !== idx) : [...p, idx])}
                >
                  {expandedModules.includes(idx)
                    ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                  <span className="line-clamp-2">{mod.title}</span>
                </button>
                {expandedModules.includes(idx) && (
                  <div className="ml-3">
                    {(mod.lessons ?? []).map(lesson => (
                      <button
                        key={lesson.id}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-colors ${selectedLesson?.id === lesson.id ? "bg-primary/15 text-primary" : "hover:bg-background/70 text-muted-foreground hover:text-foreground"}`}
                        onClick={() => setSelectedLesson(lesson as LessonEntry)}
                      >
                        {lessonIcon(lesson.type, lesson.isCompleted)}
                        <span className={`line-clamp-2 flex-1 ${lesson.isCompleted ? "text-green-400" : ""}`}>{lesson.title}</span>
                        {lesson.durationMinutes && (
                          <span className="ml-auto text-muted-foreground flex-shrink-0 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />{lesson.durationMinutes}m
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {!selectedLesson ? (
            <div className="flex-1 flex items-center justify-center flex-col gap-4 text-center p-8">
              <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Play className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Ready to learn?</h2>
              <p className="text-muted-foreground max-w-sm">Select a lesson from the sidebar to begin.</p>
              {allLessons.length > 0 && (
                <Button onClick={() => {
                  const firstUnfinished = allLessons.find(l => !l.isCompleted) ?? allLessons[0];
                  setSelectedLesson(firstUnfinished as LessonEntry);
                  const modIdx = course?.modules?.findIndex(m => m.lessons?.some(l => l.id === firstUnfinished.id)) ?? 0;
                  setExpandedModules(p => p.includes(modIdx) ? p : [...p, modIdx]);
                }}>
                  {allLessons.some(l => l.isCompleted) ? "Continue Learning" : "Start First Lesson"}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* Lesson header */}
              <div className="p-5 border-b border-border bg-card/50 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold">{selectedLesson.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs capitalize">{selectedLesson.type}</Badge>
                    {selectedLesson.durationMinutes && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />{selectedLesson.durationMinutes} min
                      </span>
                    )}
                    {selectedLesson.isCompleted && (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle className="w-3 h-3" />Completed
                      </span>
                    )}
                  </div>
                </div>
                {!selectedLesson.isCompleted && (
                  <Button size="sm" onClick={() => handleCompleteLesson(selectedLesson.id)} disabled={completeLesson.isPending}>
                    <Check className="w-4 h-4 mr-1.5" />
                    {completeLesson.isPending ? "Saving..." : "Mark Complete"}
                  </Button>
                )}
              </div>

              {/* Lesson body */}
              <div className="p-6 max-w-3xl">
                {selectedLesson.type === "video" ? (
                  selectedLesson.videoUrl ? (
                    <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6">
                      <iframe src={selectedLesson.videoUrl} className="w-full h-full" allowFullScreen title={selectedLesson.title} />
                    </div>
                  ) : (
                    <div className="aspect-video bg-card rounded-xl flex flex-col items-center justify-center mb-6 border border-border">
                      <Play className="w-14 h-14 text-muted-foreground mb-3" />
                      <p className="text-muted-foreground text-sm">Video content</p>
                      <p className="text-xs text-muted-foreground mt-1">Upload a video URL via the admin panel to display content here.</p>
                    </div>
                  )
                ) : selectedLesson.type === "quiz" ? (
                  <div className="p-8 bg-card rounded-xl border border-border text-center mb-6">
                    <HelpCircle className="w-12 h-12 text-primary mx-auto mb-3" />
                    <h3 className="font-semibold mb-2">Quiz Lesson</h3>
                    <p className="text-muted-foreground text-sm">Quiz content is managed through the admin course editor.</p>
                  </div>
                ) : null}

                {selectedLesson.content ? (
                  <div className="prose prose-invert max-w-none">
                    <div className="text-foreground leading-relaxed whitespace-pre-wrap">{selectedLesson.content}</div>
                  </div>
                ) : (
                  !selectedLesson.videoUrl && (
                    <div className="p-8 bg-card rounded-xl border border-border text-center">
                      <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">Lesson content will appear here.</p>
                      <p className="text-xs text-muted-foreground mt-1">Add content via the admin course editor.</p>
                    </div>
                  )
                )}
              </div>

              {/* Navigation */}
              <div className="p-5 border-t border-border flex items-center justify-between bg-card/30">
                <Button variant="outline" size="sm" disabled={!prevLesson} onClick={() => prevLesson && setSelectedLesson(prevLesson as LessonEntry)}>
                  ← Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Lesson {currentIndex + 1} of {allLessons.length}
                </span>
                <Button size="sm" disabled={!nextLesson} onClick={() => nextLesson && setSelectedLesson(nextLesson as LessonEntry)}>
                  Next →
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
