import { NextResponse } from "next/server";
import Client from "../../../models/client";
import { connectToDatabase } from "@/lib/db";
import { GITHUB_PAT, GITHUB_REPO } from "@/app/configs/github.config";

// POST: Verify client and return GitHub credentials if active
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const { email } = await req.json();

    // Validate email is provided
    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    // Find the client by email
    const client = await Client.findOne({ email });

    // Check if client exists
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Client not found" },
        { status: 404 }
      );
    }

    // Check if client is active
    if (client.status !== "active") {
      return NextResponse.json(
        { success: false, error: `Client status is ${client.status}` },
        { status: 403 }
      );
    }

    // Return GitHub credentials
    return NextResponse.json({
      success: true,
      github_pat: GITHUB_PAT,
      github_repo: GITHUB_REPO,
    });
  } catch (error) {
    console.error("Error verifying client:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

