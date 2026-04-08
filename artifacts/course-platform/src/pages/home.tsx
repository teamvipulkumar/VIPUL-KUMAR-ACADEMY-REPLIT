import { useListCourses, getListCoursesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

export default function Home() {
  const { data: coursesData, isLoading } = useListCourses({ limit: 3 }, { query: { queryKey: getListCoursesQueryKey({ limit: 3 }) } });

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="py-24 px-6 md:px-12 flex flex-col items-center text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-8">
          Premium Business Education
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
          Master the Systems <br className="hidden md:block"/>
          <span className="text-primary">That Print Revenue.</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl">
          Actionable, data-driven courses on Affiliate Marketing, E-commerce, and Dropshipping. Build scalable businesses with exact blueprints from operators who actually do it.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button size="lg" className="h-12 px-8 text-md" asChild>
            <Link href="/courses">Explore the Catalog</Link>
          </Button>
          <Button size="lg" variant="outline" className="h-12 px-8 text-md" asChild>
            <Link href="/affiliate">Join the Affiliate Program</Link>
          </Button>
        </div>
      </section>

      {/* Featured Courses */}
      <section className="py-20 bg-card border-y border-border">
        <div className="container mx-auto px-6">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-2">Featured Programs</h2>
              <p className="text-muted-foreground">The exact playbooks to start scaling.</p>
            </div>
            <Button variant="link" asChild>
              <Link href="/courses">View all courses &rarr;</Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-80 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {coursesData?.courses.map((course) => (
                <Card key={course.id} className="flex flex-col overflow-hidden bg-background border-border hover:border-primary/50 transition-colors">
                  {course.thumbnailUrl ? (
                    <div className="h-48 w-full bg-cover bg-center" style={{ backgroundImage: `url(${course.thumbnailUrl})` }} />
                  ) : (
                    <div className="h-48 w-full bg-muted flex items-center justify-center border-b border-border">
                      <span className="text-muted-foreground font-mono text-sm uppercase tracking-widest">{course.category}</span>
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-medium text-primary uppercase tracking-wider">{course.category}</span>
                      <span className="text-sm text-muted-foreground">{course.level}</span>
                    </div>
                    <CardTitle className="text-xl line-clamp-2">{course.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <CardDescription className="line-clamp-3">
                      {course.description}
                    </CardDescription>
                  </CardContent>
                  <CardFooter className="border-t border-border pt-4 flex justify-between items-center bg-card/50">
                    <span className="font-bold text-lg">${course.price}</span>
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={`/courses/${course.id}`}>Details</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 text-center max-w-4xl mx-auto">
        <h2 className="text-4xl font-bold mb-6">Stop consuming. Start executing.</h2>
        <p className="text-lg text-muted-foreground mb-10">
          The difference between reading and revenue is execution. Get the exact blueprints and start building today.
        </p>
        <Button size="lg" className="h-14 px-10 text-lg" asChild>
          <Link href="/register">Create Your Free Account</Link>
        </Button>
      </section>
    </div>
  );
}
