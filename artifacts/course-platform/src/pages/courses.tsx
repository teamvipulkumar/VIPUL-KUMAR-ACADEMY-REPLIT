import { useState, useEffect } from "react";
import { useListCourses, getListCoursesQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Package, Star, ChevronRight } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type BundleCourse = { id: number; title: string; price: number; thumbnailUrl: string | null; category: string; level: string };
type Bundle = {
  id: number; name: string; slug: string; description: string | null;
  thumbnailUrl: string | null; price: number; compareAtPrice: number | null;
  isActive: boolean; courses: BundleCourse[];
};

function useBundles() {
  return useQuery<Bundle[]>({
    queryKey: ["public-bundles"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/bundles`);
      if (!res.ok) return [];
      return res.json();
    },
  });
}

function BundleCard({ bundle }: { bundle: Bundle }) {
  const savings = bundle.compareAtPrice ? bundle.compareAtPrice - bundle.price : null;
  const savingsPct = savings && bundle.compareAtPrice ? Math.round((savings / bundle.compareAtPrice) * 100) : null;

  return (
    <Link href={`/bundles/${bundle.id}`}>
      <div className="relative bg-gradient-to-br from-primary/10 via-card to-blue-950/40 border border-primary/30 rounded-2xl overflow-hidden hover:border-primary/60 transition-all duration-200 cursor-pointer group hover:shadow-lg hover:shadow-primary/10">
        {savingsPct && (
          <div className="absolute top-3 right-3 z-10 bg-primary text-white text-xs font-bold px-2 py-1 rounded-full">
            {savingsPct}% OFF
          </div>
        )}
        {bundle.thumbnailUrl ? (
          <div className="w-full aspect-video overflow-hidden">
            <img src={bundle.thumbnailUrl} alt={bundle.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          </div>
        ) : (
          <div className="w-full aspect-video bg-gradient-to-br from-primary/20 to-blue-900/40 flex items-center justify-center">
            <Package className="w-12 h-12 text-primary/40" />
          </div>
        )}
        <div className="p-5">
          <div className="flex items-center gap-1.5 mb-2">
            <Star className="w-3.5 h-3.5 text-primary fill-primary" />
            <span className="text-xs text-primary font-semibold uppercase tracking-wide">Bundle</span>
            <span className="text-xs text-muted-foreground">· {bundle.courses.length} courses</span>
          </div>
          <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors mb-1">{bundle.name}</h3>
          {bundle.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{bundle.description}</p>}

          {/* Course list preview */}
          <div className="space-y-1.5 mb-4">
            {bundle.courses.slice(0, 4).map(c => (
              <div key={c.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-1 h-1 rounded-full bg-primary/60 flex-shrink-0" />
                <span className="truncate">{c.title}</span>
              </div>
            ))}
            {bundle.courses.length > 4 && (
              <p className="text-xs text-primary ml-3">+{bundle.courses.length - 4} more courses</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold text-foreground">₹{bundle.price}</span>
              {bundle.compareAtPrice && (
                <span className="ml-2 text-sm text-muted-foreground line-through">₹{bundle.compareAtPrice}</span>
              )}
            </div>
            <Button size="sm" className="gap-1 text-xs">Get Bundle <ChevronRight className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function CoursesPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  const { data, isLoading } = useListCourses(
    { search: debouncedSearch || undefined, category: category === "all" ? undefined : category, limit: 20, offset: 0 },
    { query: { queryKey: getListCoursesQueryKey({ search: debouncedSearch, category }) } }
  );
  const { data: bundles, isLoading: bundlesLoading } = useBundles();

  const courses = data?.courses ?? [];

  const handleSearch = (v: string) => {
    setSearch(v);
    setTimeout(() => setDebouncedSearch(v), 400);
  };

  const levelColors: Record<string, string> = {
    beginner: "bg-green-500/10 text-green-400 border-green-500/20",
    intermediate: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    advanced: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const activeBundles = (bundles ?? []).filter(b => b.isActive);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="mb-6 md:mb-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Course Catalog</h1>
          <p className="text-muted-foreground text-sm md:text-base">Proven systems to build and scale your online income.</p>
        </div>

        {/* ── Bundles Section ── */}
        {!bundlesLoading && activeBundles.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">Packages Available</h2>
              <span className="text-sm text-muted-foreground">— Best value packages</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {activeBundles.map(bundle => <BundleCard key={bundle.id} bundle={bundle} />)}
            </div>
            <div className="mt-6 border-t border-border" />
          </div>
        )}

        {/* ── Individual Courses ── */}
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-4">Individual Courses</h2>
          <div className="flex flex-col sm:flex-row gap-3 mb-6 md:mb-8">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input placeholder="Search courses..." value={search} onChange={e => handleSearch(e.target.value)} className="pl-9 bg-card border-border w-full" />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-52 bg-card border-border"><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Affiliate Marketing">Affiliate Marketing</SelectItem>
                <SelectItem value="E-commerce">E-commerce</SelectItem>
                <SelectItem value="Dropshipping">Dropshipping</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-72 bg-card rounded-xl animate-pulse" />)}
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">No courses found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {courses.map(course => (
              <Link href={`/courses/${course.id}`} key={course.id}>
                <Card className="h-full bg-card border-border hover:border-primary/50 transition-all duration-200 cursor-pointer group">
                  {course.thumbnailUrl ? (
                    <div className="w-full aspect-video overflow-hidden rounded-t-lg">
                      <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full aspect-video bg-gradient-to-br from-primary/20 to-blue-900/30 rounded-t-lg flex items-center justify-center">
                      <div className="text-4xl font-black text-primary/30 select-none">{course.category.charAt(0)}</div>
                    </div>
                  )}
                  <CardHeader className="pb-2 px-4 pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${levelColors[course.level] ?? ""}`}>{course.level}</span>
                      <span className="text-xs text-muted-foreground truncate">{course.category}</span>
                    </div>
                    <h3 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 text-sm md:text-base">{course.title}</h3>
                  </CardHeader>
                  <CardContent className="px-4 pb-2">
                    <p className="text-sm text-muted-foreground line-clamp-2">{course.description}</p>
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span>{Math.round(course.durationMinutes / 60)}h of content</span>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0 px-4 pb-4">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xl font-bold text-foreground">₹{course.price}</span>
                      <Button size="sm" className="text-xs h-8 px-4">View details</Button>
                    </div>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
