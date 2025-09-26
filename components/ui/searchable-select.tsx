"use client";
import * as React from "react";

export type Option = { value: string; label: string };

type Props = {
  id: string;
  name: string;
  options: Option[];
  placeholder?: string;
  className?: string;
  defaultValue?: string;
  required?: boolean;
};

export function SearchableSelect({ id, name, options, placeholder = "Select...", className, defaultValue, required }: Props) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(defaultValue ?? "");
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div ref={ref} className={className}>
      <input type="hidden" id={id} name={name} value={value} required={required} />
      <div className="border rounded px-3 py-2 flex items-center gap-2" onClick={() => setOpen((v) => !v)}>
        <input
          className="outline-none flex-1 bg-transparent"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
        />
        <span className="text-xs text-muted-foreground">{value ? options.find((o) => o.value === value)?.label : ""}</span>
      </div>
      {open && (
        <div className="border rounded mt-1 max-h-64 overflow-auto bg-background">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No results</div>
          )}
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${o.value === value ? "bg-muted" : ""}`}
              onClick={() => {
                setValue(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
