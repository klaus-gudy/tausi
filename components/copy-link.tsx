"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** An invitation link in a read-only box, with a button that copies it. */
export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      return true;
    } catch {
      return false;
    }
  }

  return (
    <div className="flex gap-2">
      <Input value={link} readOnly aria-label="Invitation link" onFocus={(e) => e.target.select()} />
      <Button
        variant="outline"
        size="icon"
        aria-label="Copy link"
        onClick={async () => {
          if (!(await copy())) {
            toast.error("Couldn't copy. Select the link and copy it instead.");
          }
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}
