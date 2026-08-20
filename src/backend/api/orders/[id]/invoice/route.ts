import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";

const escapePdfText = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const buildPdf = (lines: string[]) => {
  const contentLines = lines.map((line, index) => {
    const y = 760 - index * 18;
    return `1 0 0 1 72 ${y} Tm (${escapePdfText(line)}) Tj`;
  });
  const stream = `BT\n/F1 12 Tf\n${contentLines.join("\n")}\nET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj",
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj"
  ];

  let offset = Buffer.byteLength("%PDF-1.4\n");
  const offsets = objects.map((obj) => {
    const current = offset;
    offset += Buffer.byteLength(`${obj}\n`);
    return current;
  });

  const xrefStart = offset;
  const xrefLines = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f "
  ];

  offsets.forEach((pos) => {
    xrefLines.push(`${String(pos).padStart(10, "0")} 00000 n `);
  });

  const trailer = [
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefStart),
    "%%EOF"
  ];

  const pdf = [
    "%PDF-1.4",
    ...objects,
    ...xrefLines,
    ...trailer
  ].join("\n");

  return Buffer.from(pdf, "binary");
};

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: { network: true, dataPlan: true, user: true }
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const lines = [
      "VickyData Purchase Receipt",
      `Order ID: ${order.orderNumber}`,
      `Date: ${order.createdAt.toLocaleString("en-US")}`,
      `Customer: ${order.user.username ?? order.user.phoneNumber}`,
      `Recipient: ${order.recipientNumber}`,
      `Network: ${order.network?.displayName ?? order.network?.name ?? "—"}`,
      `Plan: ${order.dataPlan?.dataAmount ?? order.dataPlan?.name ?? "—"}${order.dataPlan?.validity ? ` (${order.dataPlan.validity})` : ""}`,
      `Amount: ${order.currency} ${order.amount.toFixed(2)}`,
      `Status: ${order.status}`
    ];

    const pdfBuffer = buildPdf(lines);
    const filename = `vickydata-${order.orderNumber}.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    console.error("Invoice download error:", error);
    return NextResponse.json({ error: "Unable to generate invoice." }, { status: 500 });
  }
}
