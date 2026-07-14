import { AdminSidebar } from "@/components/layout/admin-sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-surface flex min-h-screen">
      <AdminSidebar />
      <main className="ml-60 flex-1 bg-brand-bone p-6 print:ml-0 print:bg-white print:p-0">
        {/* Cap + center the content on wide screens — pages hugged the full
            width, which read as "not centered" next to the sidebar. */}
        <div className="mx-auto w-full max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
