"use client";

import { createContext, Dispatch, SetStateAction, useState } from "react";

export type Toast = {
  id: number | string;
  message: string;
  type: "success" | "error" | "warning" | "info";
};

type ToastContextType = {
  toasts: Toast[];
  setToasts: Dispatch<SetStateAction<Toast[]>>;
};

export const ToastContext = createContext<ToastContextType>({
  toasts: [],
  setToasts: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  return (
    <ToastContext.Provider value={{ setToasts, toasts }}>
      {children}
    </ToastContext.Provider>
  );
}
