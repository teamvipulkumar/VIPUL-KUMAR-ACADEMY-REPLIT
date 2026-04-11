import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useLocation } from "wouter";
import { useResetPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";

const formSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const resetPassword = useResetPassword();
  const [token, setToken] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    setToken(t);
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!token) {
      toast({ title: "Invalid link", description: "No reset token found in the URL.", variant: "destructive" });
      return;
    }
    resetPassword.mutate(
      { data: { token, password: values.password } },
      {
        onSuccess: () => {
          setDone(true);
          toast({ title: "Password reset!", description: "You can now sign in with your new password." });
          setTimeout(() => navigate("/login"), 3000);
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? "Invalid or expired reset link.";
          toast({ title: "Reset failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card border-border">
          <CardContent className="pt-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
            <h2 className="text-lg font-semibold text-foreground">Invalid Reset Link</h2>
            <p className="text-sm text-muted-foreground">
              The reset link is missing a token. Please use the link from the email exactly as sent.
            </p>
            <Button asChild variant="outline" className="mt-2">
              <Link href="/forgot-password">Request a New Link</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card border-border">
          <CardContent className="pt-8 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
            <h2 className="text-lg font-semibold text-foreground">Password Reset!</h2>
            <p className="text-sm text-muted-foreground">
              Your password has been updated. Redirecting you to sign in…
            </p>
            <Button asChild className="bg-primary">
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
          <CardDescription>Enter a strong password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPw ? "text" : "password"}
                          placeholder="Min. 8 characters"
                          {...field}
                          className="bg-background pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirm ? "text" : "password"}
                          placeholder="Repeat your password"
                          {...field}
                          className="bg-background pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-primary" disabled={resetPassword.isPending}>
                {resetPassword.isPending ? "Resetting…" : "Reset Password"}
              </Button>
            </form>
          </Form>
          <div className="text-center mt-4">
            <Link href="/login" className="text-sm text-primary hover:underline">Back to login</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
