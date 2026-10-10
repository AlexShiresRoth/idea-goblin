"use client";

import { useContext } from "react";
import { type Toast, ToastContext } from "../context/toast.provider";

function Toast({ toast }: { toast: Toast }) {
  return <div>{toast.message}</div>;
}

// TODO - need to deelte idea buvkets
export function ToastWrapper({ children }: { children: React.ReactNode }) {
  const { toasts } = useContext(ToastContext);
  return <div>
    {children}
    {toasts.map((toast) => (
        <Toast key={toast.message} toast={toast} />
      ))}
    </div>
  );
}
