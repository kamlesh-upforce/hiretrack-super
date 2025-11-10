import { NextResponse } from "next/server";
import Client from "../../../models/client";
import { connectToDatabase } from "@/lib/db";
import { Types } from "mongoose";

// GET: Retrieve all clients or a specific client by email or ID
export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("_id");
    const email = searchParams.get("email");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "100"); // Default to large number for backward compatibility
    const search = searchParams.get("search") || "";

    // If specific client is requested by email or ID, return single client
    if (email) {
      const client = await Client.findOne({ email });
      if (!client) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(client);
    }

    if (id) {
      const client = await Client.findOne({ _id: new Types.ObjectId(id) });
      if (!client) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(client);
    }

    // Build query for search
    const query: Record<string, unknown> = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await Client.countDocuments(query);

    // Fetch clients with pagination
    const clients = await Client.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Always return paginated response if page parameter is provided
    // Otherwise return array for backward compatibility
    if (searchParams.has("page")) {
      return NextResponse.json({
        data: clients,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    // Backward compatibility: return array
    return NextResponse.json(clients);
  } catch (error) {
    console.error("Error retrieving clients:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
