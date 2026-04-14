import { useState } from "react";
import { Mail, MessageSquare, Phone, MapPin, Clock, Send, Loader2, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const contactMethods = [
  {
    icon: Mail,
    title: "Email Us",
    detail: "hello@vipulkumaracademy.com",
    description: "For general enquiries and course questions.",
    href: "mailto:hello@vipulkumaracademy.com",
  },
  {
    icon: MessageSquare,
    title: "Support Ticket",
    detail: "support@vipulkumaracademy.com",
    description: "Technical issues, billing, or account help.",
    href: "mailto:support@vipulkumaracademy.com",
  },
  {
    icon: Phone,
    title: "WhatsApp",
    detail: "+91 98765 43210",
    description: "Quick queries — Mon to Sat, 10am–6pm IST.",
    href: "https://wa.me/919876543210",
  },
];

const faqs = [
  {
    q: "How long do I have access to a course after purchase?",
    a: "Lifetime access. Once you buy a course, it's yours — including all future updates.",
  },
  {
    q: "Do you offer refunds?",
    a: "Yes, we have a 7-day no-questions-asked refund policy. See our Refund Policy page for full details.",
  },
  {
    q: "Can I download the course videos?",
    a: "Course videos are available for streaming on the platform. Downloadable PDFs, worksheets, and resources are available where applicable.",
  },
  {
    q: "Is there a student community I can join?",
    a: "Absolutely. Every paid student gets access to our private community where you can connect with peers, ask questions, and share wins.",
  },
  {
    q: "Do you offer group or corporate pricing?",
    a: "Yes! If you're looking to enrol your team or organisation, email us at hello@vipulkumaracademy.com and we'll put together a custom quote.",
  },
];

export default function ContactUsPage() {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast({ variant: "destructive", title: "Please fill in all required fields." });
      return;
    }
    setSending(true);
    await new Promise(r => setTimeout(r, 1200));
    setSending(false);
    setSent(true);
    toast({ title: "Message sent!", description: "We'll get back to you within 24 hours." });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <span className="text-xs font-semibold text-primary uppercase tracking-widest">Get in Touch</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-4">Contact Us</h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-12">
          Have a question, need support, or just want to say hi? We'd love to hear from you. Our team typically responds within 24 hours.
        </p>

        {/* Contact methods */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {contactMethods.map(({ icon: Icon, title, detail, description, href }) => (
            <a
              key={title}
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="block p-5 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <p className="font-semibold text-foreground text-sm mb-0.5">{title}</p>
              <p className="text-xs text-primary font-medium mb-1.5">{detail}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </a>
          ))}
        </div>

        {/* Hours */}
        <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card mb-12">
          <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Support Hours</p>
            <p className="text-xs text-muted-foreground">Monday – Saturday, 10:00 AM – 6:00 PM IST. We aim to reply to all emails within 24 hours on business days.</p>
          </div>
        </div>

        {/* Contact form */}
        <div className="rounded-xl border border-border bg-card p-6 mb-14">
          <h2 className="text-xl font-bold text-foreground mb-1">Send Us a Message</h2>
          <p className="text-sm text-muted-foreground mb-6">Fill in the form below and we'll get back to you as soon as possible.</p>

          {sent ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
              <h3 className="text-lg font-bold text-foreground mb-2">Message Received!</h3>
              <p className="text-sm text-muted-foreground max-w-xs">Thank you for reaching out. We'll review your message and reply within 24 hours.</p>
              <button
                className="mt-6 text-sm text-primary hover:underline"
                onClick={() => { setSent(false); setForm({ name: "", email: "", subject: "", message: "" }); }}
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm mb-1.5 block">Full Name <span className="text-red-400">*</span></Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Rahul Sharma"
                    className="bg-background"
                  />
                </div>
                <div>
                  <Label className="text-sm mb-1.5 block">Email Address <span className="text-red-400">*</span></Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="rahul@example.com"
                    className="bg-background"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">Subject</Label>
                <Input
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Course access issue / Billing query / General question"
                  className="bg-background"
                />
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">Message <span className="text-red-400">*</span></Label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Describe your question or issue in detail..."
                  rows={5}
                  className="w-full p-3 rounded-md bg-background border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "Sending…" : "Send Message"}
              </Button>
            </form>
          )}
        </div>

        {/* Office */}
        <div className="flex items-start gap-3 p-5 rounded-xl border border-border bg-card mb-14">
          <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-foreground mb-1">Registered Office</p>
            <p className="text-sm text-muted-foreground leading-relaxed">Vipul Kumar Academy<br />India — Remote-first company<br />GST & Legal details available on request</p>
          </div>
        </div>

        {/* FAQs */}
        <h2 className="text-2xl font-bold text-foreground mb-6">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {faqs.map(({ q, a }) => (
            <div key={q} className="p-5 rounded-xl border border-border bg-card">
              <p className="font-semibold text-foreground mb-2">{q}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
