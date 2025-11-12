import { Schema, Document, models, model } from "mongoose";

export interface IValidationHistory extends Document {
  licenseKey: string;
  email: string;
  machineCode: string;
  valid: boolean;
  message?: string;
  installedVersion?: string;
  licenseId?: string; // Reference to license document
  createdAt: Date;
}

const ValidationHistorySchema = new Schema<IValidationHistory>(
  {
    licenseKey: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    machineCode: {
      type: String,
      required: true,
    },
    valid: {
      type: Boolean,
      required: true,
    },
    message: {
      type: String,
    },
    installedVersion: {
      type: String,
    },
    licenseId: {
      type: String,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
ValidationHistorySchema.index({ licenseKey: 1, createdAt: -1 });
ValidationHistorySchema.index({ email: 1, createdAt: -1 });
ValidationHistorySchema.index({ licenseId: 1, createdAt: -1 });

// Avoid recompilation error in Next.js
const ValidationHistory = models.ValidationHistory || model<IValidationHistory>("ValidationHistory", ValidationHistorySchema);

export default ValidationHistory;

