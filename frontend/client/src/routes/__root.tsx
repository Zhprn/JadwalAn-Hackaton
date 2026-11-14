import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { MessageCircle } from "lucide-react";
import type { AuthState } from "@/auth";
import { Button } from "@/components/ui/button";

export const Route = createRootRouteWithContext<{ auth: AuthState }>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="min-h-svh">
      {/* Navbar atas */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="font-runestars text-2xl">
            Jadwalan
          </Link>
          <div className="flex items-center gap-6 text-sm font-medium">
            <Link to="/" className="[&.active]:text-primary text-muted-foreground">
              Beranda
            </Link>
          </div>
        </nav>
      </header>

      <Outlet />

      {/* Tombol chat AI melayang (UI saja, belum terhubung) */}
      <Button size="icon" className="fixed right-6 bottom-6 size-14 rounded-full shadow-lg" aria-label="Chat AI">
        <MessageCircle className="size-6" />
      </Button>

      <TanStackRouterDevtools position="bottom-left" />
    </div>
  );
}
