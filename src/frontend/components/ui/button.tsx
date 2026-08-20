import * as React from "react";
import { cn } from "./utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-md font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50 disabled:pointer-events-none";

  const variants: Record<string, string> = {
    primary: "bg-brand-500 text-white hover:bg-brand-600",
    secondary: "bg-slate-900 text-white hover:bg-slate-800",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
    outline: "border border-slate-200 text-slate-700 hover:bg-slate-100"
  };

  const sizes: Record<string, string> = {
    sm: "h-9 px-4 text-sm",
    md: "h-11 px-5 text-sm",
    lg: "h-14 px-6 text-base"
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
