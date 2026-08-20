"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home page which will show the login modal
    router.replace("/?auth=login");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-sm text-slate-600">Redirecting to sign in...</p>
      </div>
    </div>
  );
}
