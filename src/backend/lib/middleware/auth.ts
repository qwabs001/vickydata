import type { NextRequest } from "next/server";

export const requireAuth = (request: NextRequest) => {
  const token = request.headers.get("authorization");
  return Boolean(token);
};
