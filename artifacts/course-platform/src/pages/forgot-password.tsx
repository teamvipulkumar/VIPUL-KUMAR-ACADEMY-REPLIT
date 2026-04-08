import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link } from "wouter";
import { useForgotPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const formSchema = z.object({ email: z.string().email() });

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const forgotPassword = useForgotPassword();
  const [sent, setSent] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({ resolver: zodResolver(formSchema), defaultValues: { email: "" } });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    forgotPassword.mutate({ data: values }, {
      onSuccess: () => { setSent(true); toast({ title: "Reset email sent", description: "Check your inbox." }); },
      onError: () => toast({ title: "Error", description: "Something went wrong.", variant: "destructive" }),
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
          <CardDescription>{sent ? "If that email exists, a reset link has been sent." : "Enter your email to receive a reset link."}</CardDescription>
        </CardHeader>
        <CardContent>
          {!sent ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" placeholder="you@example.com" {...field} className="bg-background" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
                  {forgotPassword.isPending ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">Check your email for the reset link.</p>
              <Button variant="outline" asChild><Link href="/login">Back to Login</Link></Button>
            </div>
          )}
          <div className="text-center mt-4">
            <Link href="/login" className="text-sm text-primary hover:underline">Back to login</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
