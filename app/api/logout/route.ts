import { NextResponse } from "next/server";
import { withoutAuthCookie } from "@/lib/auth";

// POST: Admin logout
export async function POST() {
  try {
    // Create a response
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    // Remove the auth cookie
    return withoutAuthCookie(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
