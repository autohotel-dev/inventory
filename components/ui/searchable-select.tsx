"use client";
import * as React from "react";
import { Check, ChevronDown, X, Barcode } from "lucide-react";
import { usePOSConfigRead } from "@/hooks/use-pos-config";

export type Option = { value: string; label: string; sku?: string; barcode?: string };

type Props = {
  id: string;
  name: string;
  options: Option[];
  placeholder?: string;
  className?: string;
  defaultValue?: string;
  required?: boolean;
  onChange?: (value: string) => void;
  /** Habilitar modo escáner con detección automática */
  scannerMode?: boolean;
  /** 
   * Modo escaneo continuo: el input siempre está listo para escanear.
   * Después de cada escaneo exitoso, se limpia y llama a onScan.
   * Ideal para inventario rápido o entrada de mercancía.
   */
  continuousScan?: boolean;
  /** Callback cuando se escanea un producto en modo continuo */
  onScan?: (option: Option) => void;
};

export function SearchableSelect({
  id,
  name,
  options,
  placeholder = "Select...",
  className,
  defaultValue,
  required,
  onChange,
  scannerMode = false,
  continuousScan = false,
  onScan
}: Props) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(defaultValue ?? "");
  const ref = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Para detección de escaneo automático
  const lastInputTimeRef = React.useRef<number>(0);
  const scanTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const rapidInputRef = React.useRef<boolean>(false);

  // Configuración del sistema
  const posConfig = usePOSConfigRead();

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

  // Limpiar timeouts al desmontar
  React.useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  // Buscar por barcode, SKU o label
  const findOptionByCode = React.useCallback((code: string): Option | undefined => {
    const codeLower = code.toLowerCase().trim();

    // 1. Buscar por barcode exacto
    const byBarcode = options.find(o =>
      o.barcode?.toLowerCase() === codeLower
    );
    if (byBarcode) return byBarcode;

    // 2. Buscar por SKU exacto
    const bySku = options.find(o =>
      o.sku?.toLowerCase() === codeLower
    );
    if (bySku) return bySku;

    // 3. Buscar por value exacto
    const byValue = options.find(o =>
      o.value.toLowerCase() === codeLower
    );
    if (byValue) return byValue;

    // 4. Si hay exactamente un resultado en el filtro, usarlo
    const filtered = options.filter(o =>
      o.label.toLowerCase().includes(codeLower)
    );
    if (filtered.length === 1) return filtered[0];

    return undefined;
  }, [options]);

  // Procesar código escaneado
  const processScannedCode = React.useCallback((code: string) => {
    if (!code.trim()) return;

    const foundOption = findOptionByCode(code);

    if (foundOption) {
      if (continuousScan) {
        // Modo continuo: limpiar y notificar, no persistir valor
        setQuery("");
        setOpen(false);
        if (onScan) {
          onScan(foundOption);
        }
        // Re-enfocar input para el siguiente escaneo
        setTimeout(() => inputRef.current?.focus(), 50);
      } else {
        // Modo normal: persistir valor
        setValue(foundOption.value);
        setOpen(false);
        setQuery("");
        if (onChange) {
          onChange(foundOption.value);
        }
      }
      // Auto-selección exitosa
      rapidInputRef.current = false;
    }
  }, [findOptionByCode, onChange, continuousScan, onScan]);

  // Manejar cambio de input con detección de escaneo
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const now = Date.now();
    const timeSinceLastInput = now - lastInputTimeRef.current;

    setQuery(newValue);
    lastInputTimeRef.current = now;

    // Solo procesar detección automática si está habilitado y en modo escáner
    if (!scannerMode || !posConfig.autoScanDetection) {
      return;
    }

    // Limpiar timeout anterior
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    // Detectar si es entrada rápida (típico de escáner)
    if (timeSinceLastInput < posConfig.scanSpeedThreshold && newValue.length > 1) {
      rapidInputRef.current = true;
    }

    // Si estamos en modo de escaneo rápido, esperar un momento y procesar
    if (rapidInputRef.current && newValue.length >= posConfig.minScanLength) {
      scanTimeoutRef.current = setTimeout(() => {
        if (rapidInputRef.current) {
          processScannedCode(newValue);
        }
      }, posConfig.scanCompleteDelay);
    }
  };

  // Manejar Enter manual
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault();
      // Limpiar timeout de escaneo automático
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }

      // Buscar por código exacto primero
      const foundOption = findOptionByCode(query);
      if (foundOption) {
        if (continuousScan) {
          // Modo continuo: limpiar y notificar
          setQuery("");
          setOpen(false);
          if (onScan) {
            onScan(foundOption);
          }
          setTimeout(() => inputRef.current?.focus(), 50);
        } else {
          // Modo normal
          setValue(foundOption.value);
          setOpen(false);
          setQuery("");
          if (onChange) {
            onChange(foundOption.value);
          }
        }
      } else {
        // Si no hay match exacto pero hay opciones filtradas, seleccionar la primera
        const filtered = options.filter(o =>
          o.label.toLowerCase().includes(query.toLowerCase())
        );
        if (filtered.length > 0) {
          if (continuousScan) {
            setQuery("");
            setOpen(false);
            if (onScan) {
              onScan(filtered[0]);
            }
            setTimeout(() => inputRef.current?.focus(), 50);
          } else {
            setValue(filtered[0].value);
            setOpen(false);
            setQuery("");
            if (onChange) {
              onChange(filtered[0].value);
            }
          }
        }
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery("");
    }
  };

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
    // Re-enfocar el input después de limpiar
    setTimeout(() => inputRef.current?.focus(), 50);
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
        onClick={() => {
          setOpen((v) => !v);
          if (!open && !hasValue) {
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
      >
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {scannerMode && !hasValue && (
            <Barcode className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          {hasValue && selectedOption ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span className="font-medium text-foreground truncate">{selectedOption.label}</span>
            </div>
          ) : (
            <input
              ref={inputRef}
              className="outline-none flex-1 bg-transparent text-sm placeholder:text-muted-foreground"
              placeholder={scannerMode ? "Escanear o buscar..." : placeholder}
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
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
        <div className="border rounded-lg mt-1 max-h-64 overflow-auto bg-background shadow-lg animate-in fade-in-0 zoom-in-95 duration-100 z-50 relative">
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
              <div className="flex-1 min-w-0">
                <span className="block truncate">{o.label}</span>
                {(o.sku || o.barcode) && (
                  <span className="text-xs text-muted-foreground">
                    {o.sku && `SKU: ${o.sku}`}
                    {o.sku && o.barcode && " • "}
                    {o.barcode && `Código: ${o.barcode}`}
                  </span>
                )}
              </div>
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
