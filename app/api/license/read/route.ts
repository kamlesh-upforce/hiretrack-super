import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import License from "@/app/models/license";

// GET: Retrieve all licenses or a specific license by key or client ID
export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const licenseKey = searchParams.get("licenseKey");
    const email = searchParams.get("email");

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

    // If client ID is provided, return all licenses for that client
    if (email) {
      const licenses = await License.findOne({ email });
         if (!licenses) {
        return NextResponse.json(
          { error: "License not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(licenses);
    }

    // Otherwise return all licenses
    const licenses = await License.find();
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
