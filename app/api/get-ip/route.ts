import { NextRequest, NextResponse } from "next/server";
import { getClientIP } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  const ip = await getClientIP(request);
  return NextResponse.json({ ip });
}