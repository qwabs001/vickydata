import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const {
    apiUser,
    pubKey,
    accountNumber,
    channel = "13",
    currency = "GHS",
    amount,
    payer
  } = payload as {
    apiUser?: string;
    pubKey?: string;
    accountNumber?: string;
    channel?: string;
    currency?: string;
    amount?: number;
    payer?: string;
  };

  if (!accountNumber || !payer || !amount) {
    return NextResponse.json(
      { error: "Missing required fields: accountNumber, payer, amount." },
      { status: 400 }
    );
  }

  const resolvedUser = apiUser ?? process.env.MOOLRE_USER;
  const resolvedKey = pubKey ?? process.env.MOOLRE_PUB_KEY;

  if (!resolvedUser || !resolvedKey) {
    return NextResponse.json(
      { error: "Moolre credentials are missing." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch("https://api.moolre.com/open/transact/payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-USER": resolvedUser,
        "X-API-PUBKEY": resolvedKey
      },
      body: JSON.stringify({
        type: 1,
        channel,
        currency,
        amount,
        payer,
        externalref: `ADMIN_TEST_${Date.now()}`,
        accountnumber: accountNumber
      })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(
        { error: data?.message ?? "Moolre request failed." },
        { status: response.status }
      );
    }

    return NextResponse.json(data ?? { status: "ok" });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to reach Moolre API." },
      { status: 502 }
    );
  }
}
