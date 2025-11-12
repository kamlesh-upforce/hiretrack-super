import { NextResponse } from "next/server";
import ValidationHistory from "@/app/models/validationHistory";
import { connectToDatabase } from "@/lib/db";

// GET: Retrieve validation history for a license
export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const licenseKey = searchParams.get("licenseKey");
    const licenseId = searchParams.get("licenseId");
    const email = searchParams.get("email");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!licenseKey && !licenseId && !email) {
      return NextResponse.json(
        { error: "licenseKey, licenseId, or email is required" },
        { status: 400 }
      );
    }

    // Build query
    const query: Record<string, unknown> = {};
    if (licenseKey) {
      query.licenseKey = licenseKey;
    }
    if (licenseId) {
      query.licenseId = licenseId;
    }
    if (email) {
      query.email = email;
    }

    // Fetch validation history, sorted by most recent first
    const history = await ValidationHistory.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    return NextResponse.json(history);
  } catch (error) {
    console.error("Error retrieving validation history:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

