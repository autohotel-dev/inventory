"use client";
import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";

export type Option = { value: string; label: string };

type Props = {
  id: string;
  name: string;
  options: Option[];
  placeholder?: string;
  className?: string;
  defaultValue?: string;
  required?: boolean;
  onChange?: (value: string) => void;
};

export function SearchableSelect({ id, name, options, placeholder = "Select...", className, defaultValue, required, onChange }: Props) {
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

  // Sincronizar el valor interno con defaultValue cuando cambie
  React.useEffect(() => {
    if (defaultValue !== undefined) {
      setValue(defaultValue);
    }
  }, [defaultValue]);

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const selectedOption = options.find((o) => o.value === value);
  const hasValue = !!value;

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setValue("");
    setQuery("");
    if (onChange) {
      onChange("");
    }
  };

  return (
    <div ref={ref} className={className}>
      <input type="hidden" id={id} name={name} value={value} required={required} />
      <div
        className={`
          border rounded-lg px-3 py-2 flex items-center gap-2 cursor-pointer transition-all
          ${open ? 'ring-2 ring-blue-500/20 border-blue-500' : 'border-input hover:border-blue-400'}
          ${hasValue ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-400' : 'bg-background'}
        `}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {hasValue && selectedOption ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span className="font-medium text-foreground truncate">{selectedOption.label}</span>
            </div>
          ) : (
            <input
              className="outline-none flex-1 bg-transparent text-sm placeholder:text-muted-foreground"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onFocus={() => setOpen(true)}
            />
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasValue && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-destructive/10 rounded transition-colors"
              title="Limpiar selección"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          )}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>
      {open && (
        <div className="border rounded-lg mt-1 max-h-64 overflow-auto bg-background shadow-lg animate-in fade-in-0 zoom-in-95 duration-100">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground text-center">No se encontraron resultados</div>
          )}
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`
                w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center justify-between gap-2
                ${o.value === value ? "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-medium" : ""}
              `}
              onClick={() => {
                setValue(o.value);
                setOpen(false);
                setQuery("");
                if (onChange) {
                  onChange(o.value);
                }
              }}
            >
              <span className="flex-1">{o.label}</span>
              {o.value === value && (
                <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
