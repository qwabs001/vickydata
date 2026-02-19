import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";

const updateSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1).optional(),
  phoneNumber: z.string().min(6).optional()
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Missing userId." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        phoneNumber: true,
        role: true,
        status: true
      }
    });

    if (!user || user.status === "DELETED") {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      username: user.username,
      phoneNumber: user.phoneNumber,
      role: user.role
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json({ error: "Unable to load profile." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid profile payload." }, { status: 400 });
    }

    const { userId, username, phoneNumber } = parsed.data;
    if (username) {
      const existing = await prisma.user.findFirst({
        where: {
          username,
          id: { not: userId }
        }
      });
      if (existing) {
        return NextResponse.json({ error: "Username already in use." }, { status: 400 });
      }
    }

    if (phoneNumber) {
      const existing = await prisma.user.findFirst({
        where: {
          phoneNumber,
          id: { not: userId }
        }
      });
      if (existing) {
        return NextResponse.json({ error: "Phone number already in use." }, { status: 400 });
      }
    }

    const updates: { username?: string; phoneNumber?: string } = {};
    if (username) updates.username = username;
    if (phoneNumber) updates.phoneNumber = phoneNumber;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided." }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        username: true,
        phoneNumber: true,
        role: true
      }
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Unable to update profile." }, { status: 500 });
  }
}
