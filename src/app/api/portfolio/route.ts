import { NextResponse } from "next/server";
import { getPortfolio } from "@/lib/data/getPortfolio";

export async function GET() {
  const snap = await getPortfolio();
  return NextResponse.json(snap);
}
