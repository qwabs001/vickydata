import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";
import { getRequestIp, recordActivity } from "@/backend/lib/activityLog";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { hashPassword } from "@/backend/lib/utils/hash";
import { createAgentCredential } from "@/backend/services/reseller/credentials";

const createAgentSchema = z.object({
  username: z.string().min(3).max(40),
  phoneNumber: z.string().min(6).max(20),
  password: z.string().min(6).max(120),
  status: z.enum(["ACTIVE", "SUSPENDED"]).default("ACTIVE"),
  initialBalance: z.number().min(0).max(1_000_000).default(0),
  generateApiCredentials: z.boolean().default(false),
  credentialName: z.string().max(120).optional(),
  rateLimitPerMin: z.number().int().min(1).max(5000).optional(),
  ipAllowlist: z.array(z.string()).optional()
});

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const adminId = request.headers.get("x-user-id");
    const body = await request.json().catch(() => null);
    const parsed = createAgentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid agent payload.", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username: data.username }, { phoneNumber: data.phoneNumber }]
      },
      select: { id: true }
    });
    if (existing) {
      return NextResponse.json(
        { error: "Username or phone number already exists." },
        { status: 409 }
      );
    }

    if (data.generateApiCredentials && data.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "API credentials can only be generated for active agents." },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(data.password);
    const initialBalance = roundMoney(data.initialBalance);

    const agent = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: data.username,
          phoneNumber: data.phoneNumber,
          password: hashedPassword,
          role: "AGENT",
          status: data.status
        }
      });

      await tx.walletBalance.create({
        data: {
          userId: created.id,
          totalAdded: initialBalance,
          totalSpent: 0,
          currentBalance: initialBalance
        }
      });

      if (initialBalance > 0) {
        await tx.walletTransaction.create({
          data: {
            userId: created.id,
            type: "ADDED",
            amount: initialBalance,
            balanceBefore: 0,
            balanceAfter: initialBalance,
            description: "Initial agent wallet funding"
          }
        });
      }

      return created;
    });

    let credential: Awaited<ReturnType<typeof createAgentCredential>> | null = null;
    if (data.generateApiCredentials) {
      credential = await createAgentCredential({
        agentId: agent.id,
        name: data.credentialName,
        rateLimitPerMin: data.rateLimitPerMin,
        ipAllowlist: data.ipAllowlist
      });
    }

    await recordActivity({
      userId: adminId,
      action: "Created agent account",
      resource: `${agent.username} (${agent.phoneNumber})`,
      category: "Agents",
      details: {
        initialBalance,
        generatedApiKey: Boolean(credential)
      },
      ipAddress: getRequestIp(request)
    });

    return NextResponse.json(
      {
        agent: {
          id: agent.id,
          username: agent.username,
          phoneNumber: agent.phoneNumber,
          status: agent.status,
          walletBalance: initialBalance,
          createdAt: agent.createdAt.toISOString()
        },
        credential
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin create agent error:", error);
    return NextResponse.json({ error: "Unable to create agent." }, { status: 500 });
  }
}
