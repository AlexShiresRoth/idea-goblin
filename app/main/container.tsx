export default function Container({ children }: { children: React.ReactNode }) {
  return <section className="flex flex-8 min-w-0 w-full">{children}</section>;
}
