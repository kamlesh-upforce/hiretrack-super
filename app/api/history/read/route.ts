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
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = parseInt(searchParams.get("skip") || "0");

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

    // Build query
    const query = {
      entityType,
      entityId,
    };

    // Get total count for pagination
    const total = await History.countDocuments(query);

    // Fetch history entries for the entity, sorted by most recent first
    const history = await History.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Return paginated response
    return NextResponse.json({
      data: history,
      pagination: {
        skip,
        limit,
        total,
        hasMore: skip + limit < total,
      },
    });
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

