import { Schema, Document, models, model } from "mongoose";

export interface IHistory extends Document {
  entityType: "client" | "license";
  entityId: string; // Client ID or License ID
  action: string; // e.g., "status_changed", "created", "updated", "license_activated", etc.
  description: string; // Human-readable description
  oldValue?: string; // Previous value (e.g., old status)
  newValue?: string; // New value (e.g., new status)
  notes?: string; // Additional notes
  createdBy?: string; // Admin/user who made the change (optional)
  createdAt: Date;
}

const HistorySchema = new Schema<IHistory>(
  {
    entityType: {
      type: String,
      required: true,
      enum: ["client", "license"],
    },
    entityId: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    oldValue: {
      type: String,
    },
    newValue: {
      type: String,
    },
    notes: {
      type: String,
    },
    createdBy: {
      type: String,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
HistorySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

// Avoid recompilation error in Next.js
const History = models.History || model<IHistory>("History", HistorySchema);

export default History;

