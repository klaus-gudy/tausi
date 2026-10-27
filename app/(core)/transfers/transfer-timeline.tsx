"use client";

import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type TimelineStep = {
  label: string;
  /** Set once the step has happened: "Oct 27, 2026", "9:20 AM" and who did it. */
  done: { date: string; time: string; by: string | null } | null;
};

/** A transfer's steps in order, the ones still to come shown faintly. */
export function TransferTimeline({
  name,
  route,
  steps,
}: {
  /** "TR-0007" */
  name: string;
  /** "Main store to Juma" */
  route: string;
  steps: TimelineStep[];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`View ${name}`}>
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>{route}</DialogDescription>
        </DialogHeader>
        <ol className="grid gap-5 py-2">
          {steps.map((step, index) => (
            <li key={step.label} className="relative flex gap-3">
              {index < steps.length - 1 ? (
                <span aria-hidden className="absolute top-4 -bottom-5 left-[4.5px] w-px bg-border" />
              ) : null}
              <span
                aria-hidden
                className={cn(
                  "relative mt-1.5 size-2.5 shrink-0 rounded-full",
                  step.done ? "bg-primary" : "border border-muted-foreground/40 bg-background"
                )}
              />
              <div className="grid gap-0.5 text-sm">
                <span className={step.done ? "font-medium" : "text-muted-foreground"}>{step.label}</span>
                <span className="text-muted-foreground">
                  {step.done
                    ? `${step.done.date} at ${step.done.time}${step.done.by ? ` · ${step.done.by}` : ""}`
                    : "Not yet"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
