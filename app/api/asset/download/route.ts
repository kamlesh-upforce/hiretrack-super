import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Client from "@/app/models/client";
import {
  GITHUB_API_URL,
  GITHUB_PAT,
  GITHUB_REPO,
} from "@/app/configs/github.config";

type GithubAsset = {
  id: number;
  name: string;
  browser_download_url?: string;
  size?: number;
};

type GithubRelease = {
  tag_name: string;
  assets?: GithubAsset[];
};

// GET: Download asset from GitHub after verifying client
export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const version = searchParams.get("version");

    // Validate email is provided
    if (!email) {
      return NextResponse.json(
        { status: false, error: "Email parameter is required" },
        { status: 400 }
      );
    }

    // Verify client exists and is active
    const client = await Client.findOne({ email });
    if (!client) {
      return NextResponse.json(
        { status: false, error: "Client not found" },
        { status: 404 }
      );
    }

    if (client.status !== "active") {
      return NextResponse.json(
        { status: false, error: `Client status is ${client.status}` },
        { status: 403 }
      );
    }

    // Fetch releases from GitHub
    const githubHeaders: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "License-Admin-App",
    };

    if (GITHUB_PAT) {
      githubHeaders.Authorization = `Bearer ${GITHUB_PAT}`;
    }

    const githubResponse = await fetch(GITHUB_API_URL, {
      headers: githubHeaders,
    });

    if (!githubResponse.ok) {
      return NextResponse.json(
        { status: false, error: "Failed to fetch releases from GitHub" },
        { status: 500 }
      );
    }

    const releases = (await githubResponse.json()) as GithubRelease[];

    // Find the target release
    let targetRelease: GithubRelease | undefined;

    if (version) {
      // Find specific version
      targetRelease = releases.find((release) => {
        const releaseVersion = release.tag_name.replace(/^v/, "");
        return (
          releaseVersion === version ||
          release.tag_name === version ||
          release.tag_name === `v${version}`
        );
      });

      if (!targetRelease) {
        return NextResponse.json(
          { status: false, error: `Version ${version} not found` },
          { status: 404 }
        );
      }
    } else {
      // Get latest release (first in the array, as GitHub returns them sorted by date)
      if (releases.length === 0) {
        return NextResponse.json(
          { status: false, error: "No releases found" },
          { status: 404 }
        );
      }
      targetRelease = releases[0];
    }

    // Get the first available asset
    const assets = targetRelease.assets || [];
    if (assets.length === 0) {
      return NextResponse.json(
        {
          status: false,
          error: `No downloadable asset found for version ${targetRelease.tag_name}`,
        },
        { status: 404 }
      );
    }

    const asset = assets.find((a) => a.browser_download_url) || assets[0];
    if (!asset || !asset.id) {
      return NextResponse.json(
        { status: false, error: "Asset not available" },
        { status: 404 }
      );
    }

    // Use GitHub API endpoint to download the asset (browser_download_url doesn't work for programmatic access)
    if (!GITHUB_REPO) {
      return NextResponse.json(
        { status: false, error: "GitHub repository not configured" },
        { status: 500 }
      );
    }

    // Construct the GitHub API asset download URL
    const assetDownloadUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases/assets/${asset.id}`;

    // Fetch the asset from GitHub API
    const downloadHeaders: Record<string, string> = {
      Accept: "application/octet-stream",
      "User-Agent": "License-Admin-App",
    };

    if (GITHUB_PAT) {
      downloadHeaders.Authorization = `Bearer ${GITHUB_PAT}`;
    }
    const assetResponse = await fetch(assetDownloadUrl, {
      headers: downloadHeaders,
      redirect: "follow", // Follow redirects
    });
    if (!assetResponse.ok) {
      return NextResponse.json(
        { status: false, error: "Failed to fetch asset from GitHub" },
        { status: assetResponse.status }
      );
    }

    // Get the filename
    let filename = asset.name;
    const contentDisposition = assetResponse.headers.get("content-disposition");
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(
        /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
      );
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, "");
      }
    }

    console.log("filename", filename);
    // Get the content type
    const contentType =
      assetResponse.headers.get("content-type") || "application/octet-stream";

    // Stream the file back to the client
    const fileBuffer = await assetResponse.arrayBuffer();

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": fileBuffer.byteLength.toString(),
      },
    });
  } catch (error: unknown) {
    console.error("Error downloading asset:", error);
    return NextResponse.json(
      {
        status: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
