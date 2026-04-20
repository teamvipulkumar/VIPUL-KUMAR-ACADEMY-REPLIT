import { useRoute } from "wouter";
import { renderBlock, type Block } from "./admin/page-builder";
import { SiteFooter } from "@/components/layout/app-layout";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/app-layout";

const STORAGE_KEY = "vka_admin_pages";

interface StoredPage {
  id: string;
  title: string;
  slug: string;
  type: string;
  status: string;
  createdAt: string;
  views: number;
  content?: { blocks: Block[] };
}

function loadPageBySlug(slug: string): StoredPage | null {
  try {
    const pages: StoredPage[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return pages.find(p => p.slug === slug) ?? null;
  } catch { return null; }
}

export default function PageRendererPage() {
  const [, params] = useRoute("/p/:slug");
  const slug = params?.slug ?? "";
  const page = loadPageBySlug(slug);

  if (!page) {
    return <AppLayout><NotFound /></AppLayout>;
  }

  if (page.status !== "published") {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh] text-center px-4">
          <div>
            <p className="text-2xl font-bold text-foreground mb-2">Coming Soon</p>
            <p className="text-muted-foreground text-sm">This page is not published yet.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const blocks = page.content?.blocks ?? [];

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {blocks.length === 0 ? (
        <div className="flex items-center justify-center min-h-[60vh] text-center px-4">
          <div>
            <p className="text-xl font-bold text-slate-300 mb-2">{page.title}</p>
            <p className="text-slate-500 text-sm">This page has no content yet.</p>
          </div>
        </div>
      ) : (
        <main>
          {blocks.map(block => (
            <div key={block.id}>
              {renderBlock(block)}
            </div>
          ))}
        </main>
      )}
      <SiteFooter />
    </div>
  );
}
