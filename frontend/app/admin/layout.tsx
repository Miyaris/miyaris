import { Container } from "@/components/shared/Container";

import { AdminSidebar } from "./AdminSidebar";

export const metadata = {
  title: {
    default: "Yönetim Paneli",
    template: "%s | Yönetim",
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Container size="wide" className="py-10">
      <div className="grid lg:grid-cols-[220px_1fr] gap-12">
        <AdminSidebar />
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
