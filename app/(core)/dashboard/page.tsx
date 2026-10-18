import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Suspense fallback={<Skeleton className="mt-1 h-5 w-64" />}>
          <Welcome />
        </Suspense>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
          <CardDescription>
            Add pages under app/(core) and link them from
            components/app-sidebar.tsx.
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
}

async function Welcome() {
  const user = await getCurrentUser();
  return (
    <p className="text-muted-foreground">
      Welcome back{user.name ? `, ${user.name}` : ""}.
      {user.organization ? ` You're in ${user.organization.name}.` : null}
    </p>
  );
}
