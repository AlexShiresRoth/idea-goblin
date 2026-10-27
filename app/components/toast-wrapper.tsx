"use client";

import clsx from "clsx";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircleIcon,
  InfoIcon,
} from "lucide-react";
import { useContext, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { type Toast, ToastContext } from "../context/toast.provider";

function Toast({ toast }: { toast: Toast }) {
  const { setToasts } = useContext(ToastContext);
  useEffect(() => {
    setTimeout(() => {
      setToasts((toasts) => toasts.filter((t) => t.id !== toast.id));
    }, 5000);
  });
  return (
    <div
      data-testid="toast"
      data-type={toast.type}
      className={clsx(
        "p-1 px-3 text-sm bg-black border min-w-fit flex items-center gap-2 rounded animate-toast",
        toast.type === "success" && "border-green-500/40 text-white/80",
        toast.type === "error" && "border-red-500/40 text-white/80",
        toast.type === "warning" && "border-yellow-500/40 text-white/80",
        toast.type === "info" && "border-blue-500/40 text-white/80",
      )}
    >
      {toast.type === "success" && <CheckCircleIcon className="w-3 h-3" />}
      {toast.type === "error" && <AlertOctagon className="w-3 h-3" />}
      {toast.type === "warning" && <AlertTriangle className="w-3 h-3" />}
      {toast.type === "info" && <InfoIcon className="w-3 h-3" />}
      {toast.message}
    </div>
  );
}

const noopSubscribe = () => () => {};

export function ToastWrapper({ children }: { children: React.ReactNode }) {
  const { toasts } = useContext(ToastContext);
  // False during server render and hydration, true after, so the portal
  // only targets document.body in the browser.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  return (
    <div>
      {children}
      {mounted &&
        createPortal(
          <div
            data-testid="toast-container"
            className="flex flex-col gap-2 fixed top-0 right-0 p-4 z-1000"
          >
            {toasts.map((toast) => (
              <Toast key={toast.id} toast={toast} />
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
