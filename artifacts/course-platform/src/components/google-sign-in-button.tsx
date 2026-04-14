import { useGoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

const GOOGLE_CREDS_KEY = "admin_google_oauth_creds";
const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function getGoogleConfig(): { clientId: string } | null {
  try {
    const raw = localStorage.getItem(GOOGLE_CREDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.enabled || !parsed.clientId?.trim()) return null;
    return { clientId: parsed.clientId.trim() };
  } catch {
    return null;
  }
}

interface GoogleSignInButtonProps {
  mode?: "signin" | "signup";
}

export function GoogleSignInButton({ mode = "signin" }: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/auth/google-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ accessToken: tokenResponse.access_token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Google sign-in failed");
        queryClient.setQueryData(getGetMeQueryKey(), data.user ?? data);
        await queryClient.refetchQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: mode === "signup" ? "Account created!" : "Signed in!", description: "Welcome to Vipul Kumar Academy" });
        setLocation("/my-courses");
      } catch (err: unknown) {
        toast({ variant: "destructive", title: "Google sign-in failed", description: (err as Error).message });
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      toast({ variant: "destructive", title: "Google sign-in failed", description: "Could not complete Google authentication." });
    },
    flow: "implicit",
  });

  return (
    <button
      type="button"
      onClick={() => login()}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-md border border-border bg-background hover:bg-muted transition-colors text-sm font-medium text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
      )}
      {loading ? "Signing in…" : mode === "signup" ? "Sign up with Google" : "Continue with Google"}
    </button>
  );
}
