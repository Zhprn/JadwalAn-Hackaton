import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => (
    <main className="mx-auto flex max-w-6xl items-center justify-center px-4 py-24">
      <h1 className="text-2xl font-bold">Client siap 🚀</h1>
    </main>
  ),
});
