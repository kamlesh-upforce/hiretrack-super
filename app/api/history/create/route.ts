import { NextResponse } from "next/server";
import History from "@/app/models/history";
import { connectToDatabase } from "@/lib/db";

// POST: Create a new history entry
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const { entityType, entityId, action, description, oldValue, newValue, notes, createdBy } = body;

    if (!entityType || !entityId || !action || !description) {
      return NextResponse.json(
        { error: "entityType, entityId, action, and description are required" },
        { status: 400 }
      );
    }

    if (!["client", "license"].includes(entityType)) {
      return NextResponse.json(
        { error: "entityType must be 'client' or 'license'" },
        { status: 400 }
      );
    }

    const historyEntry = new History({
      entityType,
      entityId,
      action,
      description,
      oldValue,
      newValue,
      notes,
      createdBy,
    });

    await historyEntry.save();

    return NextResponse.json({
      message: "History entry created successfully",
      history: historyEntry,
    });
  } catch (error) {
    console.error("Error creating history entry:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

