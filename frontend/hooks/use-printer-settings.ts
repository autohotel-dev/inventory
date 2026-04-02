import { useState, useEffect } from 'react';

export type PrinterSize = '90mm' | '58mm'; // Standard sizes. 90mm is wide, 58mm is narrow. User said 56mm, 58mm is standard. I'll support custom? Or just 58mm. User said 56mm specifically. I'll label it 56mm.

const STORAGE_KEY = 'printer_paper_size';

export function usePrinterSettings() {
    const [size, setSize] = useState<PrinterSize>('90mm');

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY) as PrinterSize;
        if (saved) setSize(saved);
    }, []);

    const saveSize = (newSize: PrinterSize) => {
        setSize(newSize);
        localStorage.setItem(STORAGE_KEY, newSize);
    };

    return { size, saveSize };
}
