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
  },
  { timestamps: true }
);

// Avoid recompilation error in Next.js
const License = models.License || model<ILicense>("License", LicenseSchema);

export default License;
