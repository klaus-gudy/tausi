import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Back to the roles list, above a role's own page. */
export function BackLink() {
  return (
    <Link
      href="/roles"
      className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Roles & permissions
    </Link>
  );
}
