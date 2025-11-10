import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import License from "@/app/models/license";

// GET: Retrieve all licenses or a specific license by key or client email
export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const licenseKey = searchParams.get("licenseKey");
    const email = searchParams.get("email");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "1000"); // Default to large number for backward compatibility
    const search = searchParams.get("search") || "";

    // If license key is provided, return that specific license
    if (licenseKey) {
      const license = await License.findById(licenseKey );
      if (!license) {
        return NextResponse.json(
          { error: "License not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(license);
    }

    // Build query
    const query: Record<string, unknown> = {};
    
    // If email is provided, filter by email (for backward compatibility)
    // Note: email filter takes precedence over search
    if (email && !search) {
      query.email = email;
    }
    
    // If search is provided, search in licenseKey and email
    if (search) {
      query.$or = [
        { licenseKey: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await License.countDocuments(query);
    
    // Fetch licenses with pagination
    const licenses = await License.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Always return paginated response if page parameter is provided
    // Otherwise return array for backward compatibility
    if (searchParams.has("page")) {
      return NextResponse.json({
        data: licenses,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    // Backward compatibility: return array
    return NextResponse.json(licenses);
  } catch (error: unknown) {
    console.error("Error retrieving licenses:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
