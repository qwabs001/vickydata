import * as React from "react";
import { cn } from "./utils";

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full text-sm text-slate-700", className)}
      {...props}
    />
  );
}
