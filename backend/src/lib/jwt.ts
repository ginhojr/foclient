import jwt, { SignOptions } from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../config/env';

export interface JwtUserPayload {
  sub: string;
  tenantId: string;
  role: Role;
  email: string;
  name: string;
}

export function signAccessToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: Pick<JwtUserPayload, 'sub' | 'tenantId' | 'role'>): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): JwtUserPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtUserPayload;
}

export function verifyRefreshToken(
  token: string
): Pick<JwtUserPayload, 'sub' | 'tenantId' | 'role'> {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as Pick<
    JwtUserPayload,
    'sub' | 'tenantId' | 'role'
  >;
}
