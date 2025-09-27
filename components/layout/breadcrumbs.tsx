"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

function toTitle(segment: string) {
  if (!segment) return "";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const parts = (pathname || "/").split("/").filter(Boolean);

  const items = [
    { href: "/", label: "Dashboard" },
    ...parts.map((_, i) => {
      const href = "/" + parts.slice(0, i + 1).join("/");
      const label = toTitle(parts[i].replace(/\[|\]/g, ""));
      return { href, label };
    }),
  ];

  const title = items[items.length - 1]?.label ?? "";

  return (
    <div className="space-y-2">
      <nav className="text-xs text-muted-foreground overflow-x-auto">
        <div className="flex items-center whitespace-nowrap">
          {items.map((it, idx) => (
            <span key={it.href} className="flex items-center">
              {idx > 0 && <span className="mx-1 text-muted-foreground/50">/</span>}
              {idx < items.length - 1 ? (
                <Link href={it.href} className="hover:underline hover:text-foreground transition-colors">{it.label}</Link>
              ) : (
                <span className="text-foreground font-medium">{it.label}</span>
              )}
            </span>
          ))}
        </div>
      </nav>
      <h1 className="text-lg md:text-xl font-semibold">{title}</h1>
    </div>
  );
}
