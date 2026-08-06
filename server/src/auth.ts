import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { NextFunction, Request, Response } from 'express'
import { config } from './config'

export interface AuthUser {
  id: string
  email: string
  name: string
  role?: string
}

export const hashPassword = (password: string) => bcrypt.hash(password, 10)
export const verifyPassword = (password: string, hash: string) =>
  bcrypt.compare(password, hash)

export function signToken(user: AuthUser): string {
  return jwt.sign(user, config.jwtSecret, { expiresIn: '7d' })
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, config.jwtSecret) as AuthUser
  } catch {
    return null
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const user = verifyToken(token)
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  ;(req as unknown as { user: AuthUser }).user = user
  next()
}

export function requireUser(req: Request): AuthUser {
  return (req as unknown as { user: AuthUser }).user
}
