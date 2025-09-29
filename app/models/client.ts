import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IClient extends Document {
  email: string;
  name?: string;
  licenseKey?: string; // stored license
  machineCode?: string; // system identifier
  currentVersion?: string; // latest version allowed
  createdAt: Date;
  updatedAt: Date;
}

const ClientSchema = new Schema<IClient>(
  {
    email: { type: String, required: true, unique: true },
    name: { type: String },
    licenseKey: { type: String, default: null },
    machineCode: { type: String },
    currentVersion: { type: String, default: null },
  },
  { timestamps: true }
);

// Avoid recompilation error in Next.js
const Client = models.Client || model<IClient>("Client", ClientSchema);

export default Client;
