import mongoose, { Schema, Document, models, model } from "mongoose";

export interface ILicense extends Document {
  licenseKey: string;
  status: "active" | "inactive" | "revoked";
  machineCode?: string;
  email: string;
  // allowedVersion: string;
  installedVersion?: string;
  // expiryDate?: Date;
  lastValidatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  revoked?: {
    reason?: string;
    revokedAt: Date;
    revokedBy: mongoose.Types.ObjectId | string;
  };
}

const LicenseSchema = new Schema<ILicense>(
  {
    licenseKey: { type: String, required: true, unique: true },
    status: {
      type: String,
      required: true,
      enum: ["active", "inactive", "revoked"],
      default: "active",
    },
    email: { type: String, required: true },
    machineCode: { type: String },
    // allowedVersion: { type: String, required: true },
    installedVersion: { type: String },
    // expiryDate: { type: Date },
    lastValidatedAt: { type: Date },
    revoked: {
      reason: { type: String },
      revokedAt: { type: Date },
      revokedBy: { type: Schema.Types.Mixed },
    },
  },
  { timestamps: true }
);

// Ensure schema updates (like new enum values) take effect during hot reload
if (mongoose.models.License) {
  const statusPath = mongoose.models.License.schema.path("status");
  const allowedStatuses = (statusPath?.options as { enum?: string[] })?.enum;

  if (!Array.isArray(allowedStatuses) || !allowedStatuses.includes("revoked")) {
    delete mongoose.models.License;
  }
}

// Avoid recompilation error in Next.js
const License = models.License || model<ILicense>("License", LicenseSchema);

export default License;
