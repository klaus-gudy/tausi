import type { Metadata } from "next";
import { NotFoundState } from "@/components/not-found-state";

export const metadata: Metadata = {
  title: "Page not found",
};

// Unknown URLs and notFound() calls without a closer not-found page.
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <NotFoundState />
    </main>
  );
}
