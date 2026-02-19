import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to Keldatagh to buy data, manage orders, and track rewards.",
  alternates: { canonical: "/signin" }
};

export { default } from "@/frontend/app/signin/page";
