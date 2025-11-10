import { Schema, Document, models, model } from "mongoose";

export interface IClient extends Document {
  email: string;
  name?: string;
  notes?: string; // additional notes about the client
  licenseKey?: string; // stored license
  machineCode?: string; // system identifier
  currentVersion?: string; // latest version allowed
  createdAt: Date;
  updatedAt: Date;
  status: "active" | "deactivated";
}

const ClientSchema = new Schema<IClient>(
  {
    email: { type: String, required: true, unique: true },
    name: { type: String },
    notes: { type: String },
    licenseKey: { type: String, default: null },
    machineCode: { type: String },
    currentVersion: { type: String, default: null },
    status: { type: String, enum: ["active", "deactivated"], default: "active" },
  },
  { timestamps: true }
);

// Avoid recompilation error in Next.js
const Client = models.Client || model<IClient>("Client", ClientSchema);

export default Client;
