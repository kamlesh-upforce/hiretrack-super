import { NextResponse } from "next/server";

// GET: List all available versions from GitHub releases
export async function GET() {
  try {
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

    // Process releases to extract version info
    const versions = releases.map((release: any) => {
      const version = release.tag_name.replace(/^v/, "");
      const assets = release.assets || [];

      // Get available platforms
      const platforms = [];
      if (
        assets.some(
          (asset: any) =>
            asset.name.toLowerCase().includes(".exe") ||
            asset.name.toLowerCase().includes("windows")
        )
      ) {
        platforms.push("windows");
      }
      if (
        assets.some(
          (asset: any) =>
            asset.name.toLowerCase().includes(".dmg") ||
            asset.name.toLowerCase().includes("mac")
        )
      ) {
        platforms.push("mac");
      }
      if (
        assets.some(
          (asset: any) =>
            asset.name.toLowerCase().includes(".deb") ||
            asset.name.toLowerCase().includes(".rpm") ||
            asset.name.toLowerCase().includes("linux")
        )
      ) {
        platforms.push("linux");
      }

      return {
        version: version,
        tagName: release.tag_name,
        platforms: platforms,
        publishedAt: release.published_at,
        isPrerelease: release.prerelease,
        isDraft: release.draft,
        releaseNotes: release.body,
        releaseUrl: release.html_url,
        assetCount: assets.length,
      };
    });

    return NextResponse.json({
      totalVersions: versions.length,
      latestVerson: versions[0]?.version || null,
      versions: versions,
    });
  } catch (error) {
    console.error("Error fetching version list:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
