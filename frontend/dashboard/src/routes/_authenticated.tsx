import { createFileRoute, redirect } from "@tanstack/react-router";
import DashboardLayout from "@/components/layout/dashboard-layout";

// Semua halaman di bawah /_authenticated wajib login sebagai admin.
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: DashboardLayout,
});
