"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface PrintCenterContextType {
  isOpen: boolean;
  openPrintCenter: (defaultTab?: string) => void;
  closePrintCenter: () => void;
}

const PrintCenterContext = createContext<PrintCenterContextType | undefined>(undefined);

export function PrintCenterProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("recent");

  const openPrintCenter = (defaultTab?: string) => {
    if (defaultTab) setActiveTab(defaultTab);
    setIsOpen(true);
  };

  const closePrintCenter = () => setIsOpen(false);

  return (
    <PrintCenterContext.Provider value={{ isOpen, openPrintCenter, closePrintCenter }}>
      {children}
    </PrintCenterContext.Provider>
  );
}

export function usePrintCenter() {
  const context = useContext(PrintCenterContext);
  if (context === undefined) {
    throw new Error("usePrintCenter must be used within a PrintCenterProvider");
  }
  return context;
}
