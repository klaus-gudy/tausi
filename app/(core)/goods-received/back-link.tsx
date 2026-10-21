import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Back to the goods received list, above a receipt's own page. */
export function BackLink() {
  return (
    <Link
      href="/goods-received"
      className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Goods received
    </Link>
  );
}
