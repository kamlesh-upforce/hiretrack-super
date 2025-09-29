import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginSchema = signupSchema;

export const clientCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const licenseCreateSchema = z.object({
  clientId: z.string().min(1),
  allowedVersion: z.string().min(1),
  expiryDate: z.union([
    z.string().datetime(),
    z.string().refine((val) => val === "", {
      message: "Empty string is allowed and will be converted to null",
    }),
    z.null(),
    z.undefined(),
  ]),
});

export const licenseUpdateSchema = z.object({
  // status: z.enum(["active", "inactive", "revoked"]).optional(),
  // allowedVersion: z.string().optional(),
  // expiryDate: z.union([
  //   z.string().datetime(),
  //   z.string().refine((val) => val === "", {
  //     message: "Empty string is allowed and will be converted to null",
  //   }),
  //   z.null(),
  //   z.undefined(),
  // ]),
  licenseKey: z.string().min(1),
  machineCode: z.string().min(3).optional().nullable(),
  installedVersion: z.string().nullable().optional(),
});

export const licenseRegisterSchema = z.object({
  machineCode: z.string().min(3),
  version: z.string().min(1).optional().nullable(),
  email: z.string().email(),
  //   clientId: z.string().min(1),
  //   allowedVersion: z.string().min(1),
  //   expiryDate: z.union([
  //     z.string().datetime(),
  //     z.string().refine((val) => val === "", {
  //       message: "Empty string is allowed and will be converted to null",
  //     }),
  //     z.null(),
  //     z.undefined(),
  //   ]),
});

export const licenseValidateSchema = z.object({
  licenseKey: z.string().min(1),
  machineCode: z.string().min(3),
  installedVersion: z.string().optional(),
});
