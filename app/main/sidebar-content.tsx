"use client";

export default function SidebarContent({ name }: { name: string }) {
  return (
    <aside className="hidden min-h-full md:flex flex-col gap-4 border-r border-white/20 py-10">
      <div className="w-full p-2 border-b border-white/20">
        <p className="text-sm">{name}</p>
      </div>
    </aside>
  );
}
