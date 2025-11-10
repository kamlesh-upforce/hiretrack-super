import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { validateLicense } from "@/lib/license";
import { licenseValidateSchema } from "@/lib/validators";

// POST: Validate a license
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json();

    // Validate request body
    const validationResult = licenseValidateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.message,
        },
        { status: 400 }
      );
    }

    const { licenseKey, machineCode, installedVersion } = body;

    // Validate the license
    const validationResult2 = await validateLicense(
      licenseKey,
      machineCode,
      installedVersion
    );

    if (!validationResult2.valid) {
      return NextResponse.json(
        {
          valid: false,
          message: validationResult2.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      asset: validationResult2.asset,
      licenseData: validationResult2.licenseData,
    });
  } catch (error: unknown) {
    console.error("Error validating license:", error);
    return NextResponse.json(
      { 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}
