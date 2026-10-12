import SignoutButton from "./signout-button";

export default function SidebarContent({ name }: { name: string }) {
  return (
    <div className="w-full p-4 px-4 flex border-r border-white/10 flex-col gap-2">
      <p className="text-sm">{name}</p>
      <SignoutButton />
    </div>
  );
}
