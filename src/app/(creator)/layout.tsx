import { CreatorSidebar } from "@/components/layout/creator-sidebar";

export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <CreatorSidebar />
      <main className="ml-60 flex-1 bg-brand-bone p-6">{children}</main>
    </div>
  );
}
