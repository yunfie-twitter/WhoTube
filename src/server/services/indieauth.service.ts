import pg from 'pg';
import { config } from '../lib/config.js';
import crypto from 'node:crypto';

const pool = new pg.Pool({
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  port: config.db.port,
});

export interface IndieAuthCode {
  code: string;
  me: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  expiresAt: Date;
}

export interface IndieAuthToken {
  token: string;
  me: string;
  clientId: string;
  scope: string;
  issuedAt: Date;
}

export class IndieAuthService {
  static async init() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS indieauth_codes (
        code TEXT PRIMARY KEY,
        me TEXT NOT NULL,
        client_id TEXT NOT NULL,
        redirect_uri TEXT NOT NULL,
        scope TEXT,
        code_challenge TEXT,
        code_challenge_method TEXT,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS indieauth_tokens (
        token TEXT PRIMARY KEY,
        me TEXT NOT NULL,
        client_id TEXT NOT NULL,
        scope TEXT,
        issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  static async createCode(params: Omit<IndieAuthCode, 'code' | 'expiresAt'>): Promise<string> {
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await pool.query(
      `INSERT INTO indieauth_codes 
       (code, me, client_id, redirect_uri, scope, code_challenge, code_challenge_method, expires_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        code, 
        params.me, 
        params.clientId, 
        params.redirectUri, 
        params.scope, 
        params.codeChallenge, 
        params.codeChallengeMethod, 
        expiresAt
      ]
    );

    return code;
  }

  static async verifyCode(code: string, clientId: string, redirectUri: string, codeVerifier?: string): Promise<IndieAuthCode | null> {
    const res = await pool.query(
      'SELECT * FROM indieauth_codes WHERE code = $1 AND client_id = $2 AND redirect_uri = $3 AND expires_at > NOW()',
      [code, clientId, redirectUri]
    );

    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    const authCode: IndieAuthCode = {
      code: row.code,
      me: row.me,
      clientId: row.client_id,
      redirectUri: row.redirect_uri,
      scope: row.scope,
      codeChallenge: row.code_challenge,
      codeChallengeMethod: row.code_challenge_method,
      expiresAt: row.expires_at
    };

    // PKCE Verification
    if (authCode.codeChallenge) {
      if (!codeVerifier) return null;
      
      let challenge: string;
      if (authCode.codeChallengeMethod === 'S256') {
        challenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
      } else {
        challenge = codeVerifier; // plain
      }

      if (challenge !== authCode.codeChallenge) return null;
    }

    // Delete the code after use (one-time use)
    await pool.query('DELETE FROM indieauth_codes WHERE code = $1', [code]);

    return authCode;
  }

  static async issueToken(me: string, clientId: string, scope: string): Promise<string> {
    const token = crypto.randomBytes(48).toString('hex');
    
    await pool.query(
      'INSERT INTO indieauth_tokens (token, me, client_id, scope) VALUES ($1, $2, $3, $4)',
      [token, me, clientId, scope]
    );

    return token;
  }

  static async verifyToken(token: string): Promise<IndieAuthToken | null> {
    const res = await pool.query(
      'SELECT * FROM indieauth_tokens WHERE token = $1',
      [token]
    );

    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    return {
      token: row.token,
      me: row.me,
      clientId: row.client_id,
      scope: row.scope,
      issuedAt: row.issued_at
    };
  }
}
