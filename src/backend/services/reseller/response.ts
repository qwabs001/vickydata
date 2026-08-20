import { NextResponse } from "next/server";
import type { ResellerErrorCode, ResellerErrorShape } from "@/backend/services/reseller/types";

export function resellerError(
  status: number,
  code: ResellerErrorCode,
  message: string,
  details?: unknown,
  headers?: HeadersInit
): NextResponse<ResellerErrorShape> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {})
      }
    },
    {
      status,
      ...(headers ? { headers } : {})
    }
  );
}

export function resellerOk<T>(data: T, status = 200, headers?: HeadersInit): NextResponse<T> {
  return NextResponse.json(data, {
    status,
    ...(headers ? { headers } : {})
  });
}
