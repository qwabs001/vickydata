import * as React from "react";
import { cn } from "./utils";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-gold-500 px-2.5 py-0.5 text-xs font-semibold text-white",
        className
      )}
      {...props}
    />
  );
}
