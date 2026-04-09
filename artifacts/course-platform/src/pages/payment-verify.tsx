import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Loader2, CheckCircle2, XCircle, AlertCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type VerifyState = "verifying" | "success" | "pending" | "failed" | "error";

type SuccessData = {
  courseId: number;
  courseTitle: string;
  alreadyEnrolled?: boolean;
};

export default function PaymentVerifyPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const orderId = params.get("order_id");
  const gateway = params.get("gateway") ?? "cashfree";

  const [state, setState] = useState<VerifyState>("verifying");
  const [message, setMessage] = useState("");
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  useEffect(() => {
    if (!orderId) { setState("error"); setMessage("No order ID found in the URL."); return; }

    const verify = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/payments/${gateway}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ orderId }),
        });
        const data = await res.json();

        if (!res.ok) {
          setState("error");
          setMessage(data.error ?? "Verification failed. Please contact support.");
          return;
        }

        if (data.success && (data.enrolled || data.alreadyEnrolled)) {
          setState("success");
          setSuccessData({ courseId: data.courseId, courseTitle: data.courseTitle, alreadyEnrolled: data.alreadyEnrolled });
        } else if (data.pending) {
          setState("pending");
          setMessage(data.message ?? "Payment is processing. Please wait a moment.");
        } else {
          setState("failed");
          setMessage(data.message ?? "Payment was not completed. Please try again.");
        }
      } catch {
        setState("error");
        setMessage("Could not connect to payment server. Please contact support.");
      }
    };

    verify();
  }, [orderId, gateway]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md p-8 text-center shadow-xl">

        {state === "verifying" && (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Verifying Payment</h2>
            <p className="text-sm text-muted-foreground">Please wait while we confirm your payment with the gateway…</p>
            <div className="flex justify-center gap-1 mt-5">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </>
        )}

        {state === "success" && successData && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-1">
              {successData.alreadyEnrolled ? "Already Enrolled!" : "Payment Successful!"}
            </h2>
            <p className="text-sm text-muted-foreground mb-1">
              {successData.alreadyEnrolled
                ? `You're already enrolled in`
                : `You've been enrolled in`}
            </p>
            <p className="font-semibold text-foreground mb-6">"{successData.courseTitle}"</p>
            <Button onClick={() => navigate(`/learn/${successData.courseId}`)} className="w-full bg-primary gap-2">
              <BookOpen className="w-4 h-4" />Start Learning Now
            </Button>
            <Button variant="ghost" onClick={() => navigate("/")} className="w-full mt-2 text-muted-foreground">
              Back to Home
            </Button>
          </>
        )}

        {state === "pending" && (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-9 h-9 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Payment Processing</h2>
            <p className="text-sm text-muted-foreground mb-6">{message}</p>
            <Button onClick={() => window.location.reload()} variant="outline" className="w-full border-border mb-2">
              Check Again
            </Button>
            <Button variant="ghost" onClick={() => navigate("/courses")} className="w-full text-muted-foreground">
              Browse Courses
            </Button>
          </>
        )}

        {(state === "failed" || state === "error") && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-9 h-9 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              {state === "failed" ? "Payment Failed" : "Verification Error"}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">{message}</p>
            <Button onClick={() => navigate("/courses")} className="w-full bg-primary mb-2">
              Browse Courses
            </Button>
            <Button variant="ghost" onClick={() => navigate("/")} className="w-full text-muted-foreground">
              Back to Home
            </Button>
          </>
        )}

        {/* Order reference */}
        {orderId && (
          <p className="text-[10px] text-muted-foreground/50 mt-6 font-mono">
            Order: {orderId}
          </p>
        )}
      </div>
    </div>
  );
}
