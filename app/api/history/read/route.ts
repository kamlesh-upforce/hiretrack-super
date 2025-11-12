import { NextResponse } from "next/server";
import History from "@/app/models/history";
import { connectToDatabase } from "@/lib/db";

// GET: Retrieve history entries for a specific entity
export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "entityType and entityId are required" },
        { status: 400 }
      );
    }

    if (!["client", "license"].includes(entityType)) {
      return NextResponse.json(
        { error: "entityType must be 'client' or 'license'" },
        { status: 400 }
      );
    }

    // Fetch history entries for the entity, sorted by most recent first
    const history = await History.find({
      entityType,
      entityId,
    })
      .sort({ createdAt: -1 })
      .limit(100); // Limit to last 100 entries

    return NextResponse.json(history);
  } catch (error) {
    console.error("Error retrieving history:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

