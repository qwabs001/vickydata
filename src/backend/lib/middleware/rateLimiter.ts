import type { NextRequest } from "next/server";

export const rateLimiter = (request: NextRequest) => {
  void request;
  return true;
};
