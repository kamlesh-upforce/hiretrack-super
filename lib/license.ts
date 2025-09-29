import crypto from "crypto";
import jwt from "jsonwebtoken";
import License from "@/app/models/license";
import { connectToDatabase } from "./db";

const LICENSE_SECRET =
  process.env.LICENSE_SECRET || "license-secret-change-in-production";

// Generate a unique license key
export function generateLicenseKey(email: string, machineCode: string): string {
  const secret = process.env.LICENSE_SECRET || "development-secret";
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${email}:${machineCode}`);
  const digest = hmac.digest("hex");
  // Format in blocks for readability XXXX-XXXX-...
  return digest
    .substring(0, 32)
    .toUpperCase()
    .match(/.{1,4}/g)!
    .join("-");
}

export function safeJson<T>(value: unknown): T {
  return value as T;
}

// Validate if a license is valid based on multiple criteria
export async function validateLicense(
  licenseKey: string,
  machineCode: string,
  installedVersion?: string
): Promise<{
  valid: boolean;
  asset?: string;
  message?: string;
  licenseData?: any;
}> {
  try {
    await connectToDatabase();

    // Find the license in the database
    const license = await License.findOne({ licenseKey });

    if (!license) {
      return { valid: false, message: "License not found" };
    }

    // Check if the license is active
    if (license.status !== "active") {
      return { valid: false, message: `License is ${license.status}` };
    }

    // If machine code is already set, check if it matches
    if (license.machineCode && license.machineCode !== machineCode) {
      return {
        valid: false,
        message: "License is bound to a different machine",
      };
    }

    // If no machine code is set yet, update it
    if (!license.machineCode) {
      license.machineCode = machineCode;
      await license.save();
    }

    // Update installed version if provided
    if (installedVersion && installedVersion !== license.installedVersion) {
      license.installedVersion = installedVersion;
      await license.save();
    }

    // Fetch the asset from GitHub releases
    let assetUrl: string | undefined = undefined;
    try {
      const response = await fetch(
        "https://api.github.com/repos/rahulp162/hiretrack-release/releases"
      );
      if (!response.ok) {
        throw new Error("Failed to fetch release data from GitHub");
      }
      const releases = await response.json();

      let release;
      if (installedVersion) {
        // Try to find a release with tag_name matching v{installedVersion} or {installedVersion}
        release =
          releases.find(
            (r: any) =>
              r.tag_name === installedVersion ||
              r.tag_name === `v${installedVersion}` ||
              r.tag_name === installedVersion.replace(/^v/, "")
          ) ||
          releases.find(
            (r: any) =>
              r.tag_name === `v${installedVersion}` ||
              r.tag_name === installedVersion
          );
      }
      // If not found, fallback to latest release
      if (
        (!release || !release.assets || release.assets.length === 0) &&
        Array.isArray(releases) &&
        releases.length > 0
      ) {
        release = releases[0];
      }

      if (
        release &&
        Array.isArray(release.assets) &&
        release.assets.length > 0
      ) {
        // Find the first asset with a browser_download_url
        const asset = release.assets.find((a: any) => a.browser_download_url);
        if (asset) {
          assetUrl = asset.browser_download_url;
        }
      }
    } catch (err) {
      // If fetching asset fails, just don't include asset url
      assetUrl = undefined;
    }

    return {
      valid: true,
      asset: assetUrl || "NOT FOUND",
      // licenseData: {
      //   licenseKey: license.licenseKey,
      //   email: license.email,
      //   status: license.status,
      //   machineCode: license.machineCode,
      //   allowedVersion: license.allowedVersion,
      //   installedVersion: license.installedVersion,
      // },
    };
  } catch (error) {
    return { valid: false, message: "Error validating license" };
  }
}
