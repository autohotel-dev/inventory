"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

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
    <div className="min-w-0 flex-1">
      {/* Breadcrumb trail — hidden on mobile, visible on sm+ */}
      <nav className="hidden sm:block text-xs text-muted-foreground/50">
        {/* Desktop: full path */}
        <div className="flex items-center gap-1 whitespace-nowrap">
          {items.map((it, idx) => (
            <span key={it.href} className="flex items-center gap-1">
              {idx > 0 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 flex-shrink-0" />
              )}
              {idx < items.length - 1 ? (
                <Link
                  href={it.href}
                  className="hover:text-foreground/70 transition-colors duration-200"
                >
                  {it.label}
                </Link>
              ) : (
                <span className="text-foreground/60 font-medium">{it.label}</span>
              )}
            </span>
          ))}
        </div>
      </nav>

      {/* Page title */}
      <h1 className="text-lg md:text-xl font-semibold tracking-tight text-foreground/90 truncate">
        {title}
      </h1>
    </div>
  );
}
