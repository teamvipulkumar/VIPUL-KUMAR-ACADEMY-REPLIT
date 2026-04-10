import { useListCourses, getListCoursesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { TrendingUp, Users, BookOpen, BadgeIndianRupee, CheckCircle, ArrowRight, Star, Zap, Shield, Award } from "lucide-react";

const STATS = [
  { label: "Active Students", value: "2,400+", icon: Users },
  { label: "Revenue Generated", value: "₹4.2Cr+", icon: BadgeIndianRupee },
  { label: "Courses Available", value: "15+", icon: BookOpen },
  { label: "Avg. Student ROI", value: "640%", icon: TrendingUp },
];

const FEATURES = [
  { icon: Zap, title: "Action-First Curriculum", desc: "No fluff. Every module is built around one executable action that moves your business forward." },
  { icon: Shield, title: "Proven by Operators", desc: "All content is created and vetted by people who actively run the businesses they teach." },
  { icon: Award, title: "Lifetime Access", desc: "Buy once, access forever. Get all future updates to the course at no additional cost." },
  { icon: TrendingUp, title: "Affiliate Program", desc: "Earn 20% commission on every referral. Share your link and earn while you learn." },
];

const TESTIMONIALS = [
  { name: "Marcus T.", role: "Affiliate Marketer", text: "Made my first ₹10L in 60 days after finishing the affiliate course. The step-by-step structure is unlike anything else out there.", stars: 5 },
  { name: "Priya S.", role: "E-commerce Founder", text: "Went from ₹0 to ₹2.5L/month in 4 months using the e-commerce blueprint. Worth every penny.", stars: 5 },
  { name: "James K.", role: "Dropshipper", text: "Finally found a course that doesn't hold back the real numbers. Applied the supplier strategy and landed a 60% margin product.", stars: 5 },
];

const levelColors: Record<string, string> = {
  beginner: "text-green-400",
  intermediate: "text-yellow-400",
  advanced: "text-red-400",
};

export default function Home() {
  const { data: coursesData, isLoading } = useListCourses({ limit: 3 }, {
    query: { queryKey: getListCoursesQueryKey({ limit: 3 }) }
  });

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative py-14 md:py-24 px-4 md:px-12 flex flex-col items-center text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-8">
          <Star className="w-3.5 h-3.5 mr-2 fill-primary" />
          Premium Business Education
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-6 max-w-4xl">
          Master the Systems{" "}
          <span className="text-primary block">That Print Revenue.</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl">
          Actionable, data-driven courses on Affiliate Marketing, E-commerce, and Dropshipping. Built by operators — for operators.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button size="lg" className="h-12 px-10 text-base font-semibold" asChild>
            <Link href="/courses">
              Explore the Catalog <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-12 px-10 text-base" asChild>
            <Link href="/affiliate">Join the Affiliate Program</Link>
          </Button>
        </div>

        {/* Trust bar */}
        <div className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
          {["No fluff", "Real numbers", "30-day guarantee", "Lifetime access"].map(t => (
            <div key={t} className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>{t}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-card/50 py-12 px-6">
        <div className="container mx-auto max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <s.icon className="w-5 h-5 text-primary mx-auto mb-2" />
              <div className="text-2xl md:text-3xl font-extrabold text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Courses */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-2">Featured Programs</h2>
              <p className="text-muted-foreground">The exact playbooks to start scaling.</p>
            </div>
            <Button variant="ghost" size="sm" className="text-primary" asChild>
              <Link href="/courses">View all <ArrowRight className="w-3.5 h-3.5 ml-1" /></Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={i} className="h-80 bg-card rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(coursesData?.courses ?? []).map(course => (
                <Link href={`/courses/${course.id}`} key={course.id}>
                  <Card className="h-full bg-card border-border hover:border-primary/50 transition-all duration-200 cursor-pointer group overflow-hidden">
                    <div className="w-full aspect-video bg-gradient-to-br from-primary/20 to-blue-900/30 flex items-center justify-center relative rounded-t-xl">
                      <span className="text-5xl font-black text-primary/20 select-none">{course.category.charAt(0)}</span>
                      <div className="absolute top-3 left-3">
                        <span className={`text-xs font-bold capitalize ${levelColors[course.level] ?? "text-muted-foreground"}`}>
                          {course.level}
                        </span>
                      </div>
                    </div>
                    <CardHeader className="pb-2">
                      <div className="text-xs text-primary font-medium uppercase tracking-wider mb-1">{course.category}</div>
                      <CardTitle className="text-base leading-snug group-hover:text-primary transition-colors line-clamp-2">{course.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <p className="text-sm text-muted-foreground line-clamp-2">{course.description}</p>
                      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                        <span>{Math.round(course.durationMinutes / 60)}h of content</span>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-0 flex items-center justify-between">
                      <span className="text-lg font-bold">₹{course.price}</span>
                      <Button size="sm" className="text-xs h-8 px-4">Enroll now</Button>
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-card/30 border-y border-border">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Why Vipul Kumar Academy?</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">We built the platform we wished existed when we were starting out.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="flex gap-4 p-6 rounded-xl bg-card border border-border">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">What Students Say</h2>
            <p className="text-muted-foreground">Real results from real operators.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="p-6 rounded-xl bg-card border border-border">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">"{t.text}"</p>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 bg-gradient-to-b from-primary/10 to-background border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Stop consuming. Start executing.</h2>
          <p className="text-muted-foreground text-lg mb-8">
            The difference between reading and revenue is execution. Get the exact blueprints today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="h-14 px-10 text-base font-semibold" asChild>
              <Link href="/register">Create Free Account <ArrowRight className="w-4 h-4 ml-2" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-10 text-base" asChild>
              <Link href="/courses">Browse Courses</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
