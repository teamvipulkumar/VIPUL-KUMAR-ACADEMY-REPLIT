import { useState } from "react";
import { HelpCircle, Search, BookOpen, CreditCard, UserCircle, Play, Share2, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";

const categories = [
  { icon: UserCircle, label: "Account & Profile", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  { icon: BookOpen, label: "Courses & Content", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  { icon: CreditCard, label: "Billing & Payments", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  { icon: Play, label: "Video Playback", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  { icon: Share2, label: "Affiliate Program", color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
  { icon: ShieldCheck, label: "Security & Privacy", color: "text-teal-400", bg: "bg-teal-500/10 border-teal-500/20" },
];

const allArticles = [
  {
    category: "Account & Profile",
    questions: [
      {
        q: "How do I create an account?",
        a: "Click 'Get Started' on the homepage or visit /register. Enter your name, email, mobile number, and a secure password. You'll receive a verification email — click the link to activate your account.",
      },
      {
        q: "I forgot my password. How do I reset it?",
        a: "Go to the Login page and click 'Forgot Password'. Enter your registered email and we'll send you a reset link. The link is valid for 1 hour.",
      },
      {
        q: "How do I update my profile information?",
        a: "After logging in, click your name or avatar in the top-right corner and select your profile. You can update your name, mobile number, and avatar from there.",
      },
      {
        q: "Can I change my registered email address?",
        a: "For security reasons, email changes require identity verification. Please contact our support team at support@vipulkumaracademy.com with your request.",
      },
      {
        q: "How do I verify my email?",
        a: "After registering, check your inbox for a verification email from us. Click the link inside to verify. If you didn't receive it, use the 'Resend Verification Email' option on the platform.",
      },
    ],
  },
  {
    category: "Courses & Content",
    questions: [
      {
        q: "How long do I have access to a course?",
        a: "Lifetime access. Once purchased, the course is yours forever — including all future content updates at no extra charge.",
      },
      {
        q: "Can I access courses on mobile?",
        a: "Yes! Our platform is fully responsive and works on all modern browsers on mobile, tablet, and desktop. Just log in from any device.",
      },
      {
        q: "How do I track my course progress?",
        a: "Course progress is tracked automatically as you complete lessons. Your dashboard shows overall progress per course, and each lesson is marked complete once you've watched or finished it.",
      },
      {
        q: "Are there downloadable resources?",
        a: "Many courses include supplemental PDFs, templates, and worksheets that can be downloaded from the lesson page. Check each lesson for attached resources.",
      },
      {
        q: "What if a video won't play?",
        a: "Try refreshing the page or switching to a different browser. Ensure your internet connection is stable. If the issue persists, clear your browser cache or contact our support team.",
      },
    ],
  },
  {
    category: "Billing & Payments",
    questions: [
      {
        q: "What payment methods do you accept?",
        a: "We accept all major credit and debit cards, UPI, net banking, and popular wallets via our payment partners Razorpay and Stripe.",
      },
      {
        q: "Is my payment information secure?",
        a: "Yes. We never store your card details directly. All payments are processed through PCI-DSS compliant gateways (Razorpay / Stripe) over encrypted HTTPS connections.",
      },
      {
        q: "Do you offer refunds?",
        a: "We have a 7-day refund policy. If you're not satisfied with a course within 7 days of purchase and have completed less than 20% of the content, you're eligible for a full refund. Email support@vipulkumaracademy.com to request one.",
      },
      {
        q: "I was charged but didn't get access. What do I do?",
        a: "This sometimes happens due to payment gateway delays. Wait up to 15 minutes and refresh your dashboard. If the course still isn't showing, email support@vipulkumaracademy.com with your transaction ID and we'll resolve it immediately.",
      },
      {
        q: "Will I receive an invoice?",
        a: "Yes. A payment receipt is sent to your registered email after every successful purchase. For a GST invoice, please contact support with your GSTIN.",
      },
    ],
  },
  {
    category: "Affiliate Program",
    questions: [
      {
        q: "How does the affiliate program work?",
        a: "After enrolling in any paid course, you get access to your personal affiliate dashboard. Share your unique referral link — when someone purchases through it, you earn a commission on the sale.",
      },
      {
        q: "When do I get paid?",
        a: "Commissions are processed after the referral's refund window clears (typically 7 days). Payouts are processed weekly to your bank account once your balance crosses the minimum threshold.",
      },
      {
        q: "What is the commission rate?",
        a: "Commission rates vary by course and campaign. Log into your affiliate dashboard to see current rates for each course.",
      },
      {
        q: "How do I add my bank account for payouts?",
        a: "Go to Affiliate → Bank Details in your dashboard and enter your account number, IFSC code, and account holder name. KYC verification may be required for first-time withdrawals.",
      },
    ],
  },
];

function ArticleAccordion({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        className="w-full flex items-center justify-between gap-3 py-4 text-left text-sm font-medium text-foreground hover:text-primary transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span>{q}</span>
        {open ? <ChevronUp className="w-4 h-4 flex-shrink-0 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <div className="pb-4 text-sm text-muted-foreground leading-relaxed pr-8">
          {a}
        </div>
      )}
    </div>
  );
}

export default function HelpCenterPage() {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? allArticles.map(cat => ({
        ...cat,
        questions: cat.questions.filter(
          ({ q, a }) =>
            q.toLowerCase().includes(search.toLowerCase()) ||
            a.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(cat => cat.questions.length > 0)
    : allArticles;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b border-border" style={{ backgroundColor: "var(--footer-bg)" }}>
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-16 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">Help Center</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-4">How can we help you?</h1>
          <p className="text-muted-foreground mb-8">Search our knowledge base or browse by category below.</p>

          {/* Search */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search for answers…"
              className="pl-10 bg-background h-11"
            />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-8 py-12">
        {/* Categories */}
        {!search && (
          <>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-5">Browse by Topic</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-12">
              {categories.map(({ icon: Icon, label, color, bg }) => (
                <button
                  key={label}
                  onClick={() => setSearch(label.split(" ")[0])}
                  className={`flex items-center gap-2.5 p-4 rounded-xl border text-left hover:scale-[1.02] transition-transform ${bg}`}
                >
                  <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${color}`} />
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Articles */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <HelpCircle className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-foreground font-semibold mb-2">No results found</p>
            <p className="text-sm text-muted-foreground">Try different keywords, or <a href="mailto:support@vipulkumaracademy.com" className="text-primary hover:underline">contact our support team</a>.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {filtered.map(({ category, questions }) => (
              <div key={category}>
                <h2 className="text-lg font-bold text-foreground mb-1">{category}</h2>
                <div className="rounded-xl border border-border bg-card px-5">
                  {questions.map(({ q, a }) => (
                    <ArticleAccordion key={q} q={q} a={a} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Still need help */}
        <div className="mt-14 rounded-xl border border-border bg-card p-6 text-center">
          <h2 className="font-bold text-foreground mb-2">Still need help?</h2>
          <p className="text-sm text-muted-foreground mb-5">Our support team is happy to assist with anything not covered above.</p>
          <a
            href="/contact-us"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
