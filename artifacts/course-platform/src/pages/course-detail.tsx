import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetCourse, getGetCourseQueryKey, useCreateCheckout, useVerifyPayment, getGetMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight, Play, Lock, FileText, HelpCircle } from "lucide-react";

export default function CourseDetailPage() {
  const [, params] = useRoute("/courses/:id");
  const courseId = parseInt(params?.id ?? "0");
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedModules, setExpandedModules] = useState<number[]>([0]);
  const [purchasing, setPurchasing] = useState(false);

  const { data: course, isLoading } = useGetCourse(courseId, { query: { queryKey: getGetCourseQueryKey(courseId), enabled: courseId > 0 } });
  const checkout = useCreateCheckout();
  const verify = useVerifyPayment();

  const handleEnroll = async () => {
    if (!isAuthenticated) { navigate("/login"); return; }
    setPurchasing(true);
    checkout.mutate({ data: { courseId, gateway: "stripe" } }, {
      onSuccess: async (session) => {
        verify.mutate({ data: { sessionId: session.sessionId } }, {
          onSuccess: (result) => {
            if (result.success) {
              toast({ title: "Enrolled!", description: "You can now access the course." });
              queryClient.invalidateQueries({ queryKey: getGetCourseQueryKey(courseId) });
              navigate(`/learn/${courseId}`);
            }
          },
          onError: () => toast({ title: "Error", description: "Payment failed.", variant: "destructive" }),
          onSettled: () => setPurchasing(false),
        });
      },
      onError: () => { toast({ title: "Error", description: "Could not start checkout.", variant: "destructive" }); setPurchasing(false); },
    });
  };

  const lessonIcon = (type: string) => {
    if (type === "video") return <Play className="w-3.5 h-3.5" />;
    if (type === "pdf") return <FileText className="w-3.5 h-3.5" />;
    if (type === "quiz") return <HelpCircle className="w-3.5 h-3.5" />;
    return <FileText className="w-3.5 h-3.5" />;
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 rounded-full border-b-2 border-primary" /></div>;
  if (!course) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Course not found.</div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-b from-primary/10 to-background border-b border-border py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <span>{course.category}</span>
            <span>/</span>
            <span className="capitalize">{course.level}</span>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">{course.title}</h1>
              <p className="text-muted-foreground leading-relaxed mb-6">{course.description}</p>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>{course.enrollmentCount} students enrolled</span>
                <span>{course.lessonCount} lessons</span>
                <span>{Math.round(course.durationMinutes / 60)} hours</span>
                <span>{course.moduleCount} modules</span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-6 h-fit">
              <div className="text-3xl font-bold mb-4">${course.price}</div>
              {course.isEnrolled ? (
                <Button className="w-full" size="lg" onClick={() => navigate(`/learn/${courseId}`)}>
                  Continue Learning
                </Button>
              ) : (
                <Button className="w-full" size="lg" onClick={handleEnroll} disabled={purchasing}>
                  {purchasing ? "Processing..." : "Enroll Now"}
                </Button>
              )}
              <p className="text-xs text-muted-foreground text-center mt-3">30-day money-back guarantee</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-2xl font-bold mb-6">Course Curriculum</h2>
        <div className="space-y-3">
          {(course.modules ?? []).map((mod, idx) => (
            <div key={mod.id} className="border border-border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 bg-card hover:bg-card/80 transition-colors text-left"
                onClick={() => setExpandedModules(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])}
              >
                <div className="flex items-center gap-3">
                  {expandedModules.includes(idx) ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <span className="font-medium">{mod.title}</span>
                </div>
                <span className="text-sm text-muted-foreground">{mod.lessons?.length ?? 0} lessons</span>
              </button>
              {expandedModules.includes(idx) && (
                <div className="divide-y divide-border">
                  {(mod.lessons ?? []).map(lesson => (
                    <div key={lesson.id} className="flex items-center gap-3 px-6 py-3 bg-background/50">
                      <span className="text-muted-foreground">{lessonIcon(lesson.type)}</span>
                      <span className="flex-1 text-sm">{lesson.title}</span>
                      {lesson.isFree ? (
                        <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">Free</Badge>
                      ) : !course.isEnrolled ? (
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : null}
                      {lesson.durationMinutes && <span className="text-xs text-muted-foreground">{lesson.durationMinutes}m</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
