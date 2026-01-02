import { NextResponse } from "next/server";
import { getClientIP } from "@/lib/ratelimit";

export async function GET() {
  const ip = await getClientIP();
  return NextResponse.json({ ip });
}