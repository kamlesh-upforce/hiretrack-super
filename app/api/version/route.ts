import { NextResponse } from "next/server";

// GET: Fetch version information and download URL from GitHub releases
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const version = searchParams.get("v");
    const platform = searchParams.get("platform") || "windows"; // Default to windows

    if (!version) {
      return NextResponse.json(
        { error: "Version parameter is required" },
        { status: 400 }
      );
    }

    // Fetch releases from GitHub API
    const githubResponse = await fetch(
      "https://api.github.com/repos/rahulp162/hiretrack-release/releases",
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "License-Admin-App",
        },
      }
    );

    if (!githubResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch releases from GitHub" },
        { status: 500 }
      );
    }

    const releases = await githubResponse.json();

    // Find the specific version
    const targetRelease = releases.find((release: any) => {
      // Remove 'v' prefix if present and compare versions
      const releaseVersion = release.tag_name.replace(/^v/, "");
      return releaseVersion === version;
    });

    if (!targetRelease) {
      return NextResponse.json(
        { error: `Version ${version} not found` },
        { status: 404 }
      );
    }

    // Find the appropriate asset based on platform
    let asset = null;
    const assets = targetRelease.assets || [];

    // Define platform-specific file patterns
    const platformPatterns = {
      windows: [".exe", ".msi", "windows", "win"],
      mac: [".dmg", ".pkg", "mac", "macos", "darwin"],
      linux: [".deb", ".rpm", ".AppImage", "linux"],
    };

    const patterns =
      platformPatterns[platform as keyof typeof platformPatterns] ||
      platformPatterns.windows;

    // Find asset matching the platform
    asset = assets.find((asset: any) => {
      const fileName = asset.name.toLowerCase();
      return patterns.some((pattern) =>
        fileName.includes(pattern.toLowerCase())
      );
    });

    // If no platform-specific asset found, return the first available asset
    if (!asset && assets.length > 0) {
      asset = assets[0];
    }

    if (!asset) {
      return NextResponse.json(
        { error: `No downloadable asset found for version ${version}` },
        { status: 404 }
      );
    }

    // Return the download URL and additional info
    return NextResponse.json({
      version: version,
      platform: platform,
      asset: asset.browser_download_url,
      assetName: asset.name,
      assetSize: asset.size,
      releaseNotes: targetRelease.body,
      publishedAt: targetRelease.published_at,
      releaseUrl: targetRelease.html_url,
    });
  } catch (error) {
    console.error("Error fetching version info:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
