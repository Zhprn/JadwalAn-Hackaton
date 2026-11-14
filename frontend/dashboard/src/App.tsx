import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/auth";
import { queryClient } from "@/lib/query-client";
import { routeTree } from "./routeTree.gen";

const router = createRouter({ routeTree, context: { auth: undefined! }, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function InnerApp() {
  const auth = useAuth();

  // Jalankan ulang guard route saat status login berubah (login, logout, sesi habis).
  useEffect(() => {
    router.invalidate();
    if (!auth.isAuthenticated) queryClient.clear();
  }, [auth.isAuthenticated]);

  return <RouterProvider router={router} context={{ auth }} />;
}

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <InnerApp />
      </QueryClientProvider>
      <Toaster richColors closeButton position="top-right" />
    </AuthProvider>
  );
}
