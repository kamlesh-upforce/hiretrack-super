import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import License from "@/app/models/license";

// POST: Revoke a license
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const { licenseKey } = await req.json();

    if (!licenseKey) {
      return NextResponse.json(
        { error: "License key is required" },
        { status: 400 }
      );
    }

    // Find and update the license status to revoked
    const revokedLicense = await License.findOneAndUpdate(
      { licenseKey },
      { status: "revoked" },
      { new: true }
    );

    if (!revokedLicense) {
      return NextResponse.json({ error: "License not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "License revoked successfully",
      license: {
        licenseKey: revokedLicense.licenseKey,
        clientId: revokedLicense.clientId,
        status: revokedLicense.status,
      },
    });
  } catch (error) {
    console.error("Error revoking license:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
