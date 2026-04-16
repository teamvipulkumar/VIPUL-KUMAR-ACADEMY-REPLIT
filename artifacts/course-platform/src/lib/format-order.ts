import { useQuery } from "@tanstack/react-query";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function formatOrderNo(id: number | string, prefix = "ORD", suffix = ""): string {
  return `#${prefix}${id}${suffix}`;
}

export function useOrderFormat() {
  const { data } = useQuery<Record<string, unknown>>({
    queryKey: ["platform-settings-order-format"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/settings`, { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const prefix = (data?.orderPrefix as string) ?? "ORD";
  const suffix = (data?.orderSuffix as string) ?? "";

  return {
    fmt: (id: number | string) => formatOrderNo(id, prefix, suffix),
    prefix,
    suffix,
  };
}
