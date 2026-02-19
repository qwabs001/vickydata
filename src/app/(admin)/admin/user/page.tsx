"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminUserRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/users");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-sm text-slate-600">Redirecting...</p>
      </div>
    </div>
  );
}
