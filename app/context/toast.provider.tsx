"use client";

import { createContext, useEffect, useState } from "react";

export type Toast = {
  message: string;
  type: "success" | "error" | "warning" | "info";
};

type ToastContextType = {
  toasts: Toast[];
  setToast: (toast: Toast[]) => void;
};

export const ToastContext = createContext<ToastContextType>({
  toasts: [],
  setToast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToast] = useState<Toast[]>([]);

  useEffect(() => {}, [toasts]);

  return (
    <ToastContext.Provider value={{ setToast, toasts }}>
      {children}
    </ToastContext.Provider>
  );
}
