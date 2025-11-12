import { NextResponse } from "next/server";
import { generateLicenseKey } from "@/lib/license";

// POST: Generate a license key from email and machineCode
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, machineCode } = body;

    if (!email || !machineCode) {
      return NextResponse.json(
        { error: "Email and machineCode are required" },
        { status: 400 }
      );
    }

    // Generate license key using the secret from environment
    const licenseKey = generateLicenseKey(email, machineCode);

    return NextResponse.json({
      licenseKey,
    });
  } catch (error) {
    console.error("Error generating license key:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

