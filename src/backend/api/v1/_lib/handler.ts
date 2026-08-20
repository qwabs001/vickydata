import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authenticateResellerRequest, logResellerRequest, type ResellerAuthContext } from "@/backend/services/reseller/auth";
import { resellerError } from "@/backend/services/reseller/response";
import { processPendingWebhookDeliveries } from "@/backend/services/reseller/webhooks";

type HandlerParams<TBody> = {
  auth: ResellerAuthContext;
  body: TBody;
  rawBody: string;
};

type HandlerOptions = {
  parseJsonBody?: boolean;
  processWebhooks?: boolean;
};

export async function withResellerAuth<TBody>(
  request: NextRequest,
  handler: (params: HandlerParams<TBody>) => Promise<Response>,
  options: HandlerOptions = {}
): Promise<Response> {
  const startedAt = Date.now();
  const parseJsonBody = options.parseJsonBody ?? ["POST", "PUT", "PATCH"].includes(request.method.toUpperCase());
  const rawBody = parseJsonBody ? await request.clone().text() : "";

  const authResult = await authenticateResellerRequest(request, rawBody);

  if (!authResult.ok) {
    await logResellerRequest({
      agentId: authResult.agentId,
      credentialId: authResult.credentialId,
      requestId: authResult.requestId,
      method: request.method,
      path: new URL(request.url).pathname,
      statusCode: authResult.response.status,
      durationMs: Date.now() - startedAt,
      errorCode: authResult.errorCode
    });
    return authResult.response;
  }

  let body: TBody = {} as TBody;
  if (parseJsonBody && rawBody.length > 0) {
    try {
      body = JSON.parse(rawBody) as TBody;
    } catch {
      const response = resellerError(400, "INVALID_REQUEST", "Invalid JSON payload.");
      await logResellerRequest({
        agentId: authResult.context.agentId,
        credentialId: authResult.context.credentialId,
        requestId: authResult.context.requestId,
        method: request.method,
        path: authResult.context.pathWithQuery,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
        ipAddress: authResult.context.ipAddress,
        errorCode: "INVALID_REQUEST"
      });
      return response;
    }
  }

  let response: Response;
  try {
    response = await handler({
      auth: authResult.context,
      body,
      rawBody
    });
  } catch (error) {
    console.error("Reseller API handler error:", error);
    response = NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unexpected server error."
        }
      },
      { status: 500 }
    );
  }

  await logResellerRequest({
    agentId: authResult.context.agentId,
    credentialId: authResult.context.credentialId,
    requestId: authResult.context.requestId,
    method: request.method,
    path: authResult.context.pathWithQuery,
    statusCode: response.status,
    durationMs: Date.now() - startedAt,
    ipAddress: authResult.context.ipAddress,
    errorCode: response.status >= 400 ? "REQUEST_FAILED" : undefined
  });

  if (options.processWebhooks !== false) {
    await processPendingWebhookDeliveries(10);
  }

  return response;
}
