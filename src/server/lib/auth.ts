import jwt from 'jsonwebtoken';
import { config } from './config.js';

const SECRET_KEY = config.jwtSecret;

export interface UserPayload {
  userId: string;
  cookie: string;
}

export class AuthLib {
  static sign(payload: UserPayload): string {
    return jwt.sign(payload, SECRET_KEY, { expiresIn: '7d' });
  }

  static verify(token: string): UserPayload | null {
    try {
      return jwt.verify(token, SECRET_KEY) as UserPayload;
    } catch (e) {
      return null;
    }
  }
}
