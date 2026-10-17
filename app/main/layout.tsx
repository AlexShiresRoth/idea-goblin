import { getSession } from "@/lib/auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ToastWrapper } from "../components/toast-wrapper";
import { ToastProvider } from "../context/toast.provider";
import Container from "./container";
import Header from "./header";
import Sidebar from "./sidebar";
import SidebarContent from "./sidebar-content";

export const metadata: Metadata = {
  title: "Workspace",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default async function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();

  if (!session || !session.id) {
    redirect("/");
  }
  return (
    <ToastProvider>
      <ToastWrapper>
        <main className="flex flex-col items-center h-screen">
          <Header />
          <div className="flex w-full h-full">
            <Sidebar>
              <SidebarContent name={session.user_metadata?.name} />
            </Sidebar>
            <Container>{children}</Container>
          </div>
        </main>
      </ToastWrapper>
    </ToastProvider>
  );
}
