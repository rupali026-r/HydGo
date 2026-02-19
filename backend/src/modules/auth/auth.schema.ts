import { z } from 'zod';

export const registerSchema = z
  .object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    role: z.enum(['PASSENGER', 'DRIVER', 'ADMIN']).default('PASSENGER'),
    phone: z.string().optional(),
    adminSecretKey: z.string().optional(),
    licenseNumber: z.string().optional(),
    city: z.string().optional(),
  });

export const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
    role: z.enum(['PASSENGER', 'DRIVER', 'ADMIN']).optional(),
  });

export const googleSignInSchema = z
  .object({
    idToken: z.string().min(1),
    role: z.enum(['PASSENGER', 'DRIVER', 'ADMIN']).default('PASSENGER'),
  });

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict();

export const logoutSchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleSignInInput = z.infer<typeof googleSignInSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
