"use client";

import { Suspense } from "react";
import Theme5 from "@/frontend/components/landing/Theme5";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vickydata.com";

function HomePageContent() {
  return <Theme5 />;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <HomePageContent />
    </Suspense>
  );
}
