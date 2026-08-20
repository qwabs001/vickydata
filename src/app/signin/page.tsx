import type { Metadata } from "next";
import { Suspense } from "react";
import SignInPageClient from "@/frontend/app/signin/page";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to VickyData to buy data, manage orders, and track rewards.",
  alternates: { canonical: "/signin" }
};

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f5f3ef]" />}>
      <SignInPageClient />
    </Suspense>
  );
}
