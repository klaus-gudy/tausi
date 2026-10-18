import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { login } from "../actions";
import { NextField } from "@/components/next-field";
import { RedirectIfSignedIn } from "@/components/redirect-if-signed-in";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = {
  title: "Log in",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Card>
      <Suspense>
        <SignedInRedirect searchParams={searchParams} />
      </Suspense>
      <CardHeader>
        <CardTitle>Log in to your account</CardTitle>
        <CardDescription>
          Enter your email and password to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={login}>
          <Suspense>
            <NextField />
          </Suspense>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field>
              <Button type="submit">Log in</Button>
              <FieldDescription className="text-center">
                Don&apos;t have an account? <Link href="/sign-up">Sign up</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

async function SignedInRedirect({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  return <RedirectIfSignedIn next={next} />;
}
