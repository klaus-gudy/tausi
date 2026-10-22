"use client";

import { useTransition } from "react";
import { PackageCheck } from "lucide-react";
import { toast } from "sonner";

import { acknowledgeTransfer } from "./actions";
import { Button } from "@/components/ui/button";

/** The salesperson confirms a transfer's stock reached them. */
export function AcknowledgeButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      disabled={pending}
      aria-label={`Acknowledge ${name}`}
      onClick={() =>
        startTransition(async () => {
          const result = await acknowledgeTransfer(id);
          if (result.success) toast.success(result.message);
          else toast.error(result.message);
        })
      }
    >
      <PackageCheck data-icon="inline-start" />
      {pending ? "Acknowledging…" : "Acknowledge receipt"}
    </Button>
  );
}
