import { FastifyRequest, FastifyReply } from 'fastify';
import { getYouTube } from '../lib/youtube.js';
import { AuthLib } from '../lib/auth.js';

export class AuthHandler {
  static async authenticate(request: FastifyRequest, reply: FastifyReply) {
    const { cookie } = request.body as { cookie: string };
    if (!cookie) return reply.status(400).send({ error: 'Cookie is required' });

    try {
      // クッキーが有効か確認するために一度ログイン済みの情報を取得
      const yt = await getYouTube('WEB', 'temp-auth', cookie);
      if (!yt.session.logged_in) {
        return reply.status(401).send({ error: 'Invalid or expired cookie' });
      }

      const info = await (yt as any).getAccountInfo?.();
      const userId = info?.account_name
        || info?.contents?.item?.(0)?.account_name?.text
        || `user-${Date.now()}`;

      const token = AuthLib.sign({ userId, cookie });
      return { token, userId, logged_in: true };
    } catch (e) {
      return reply.status(500).send({ error: 'Authentication failed', details: String(e) });
    }
  }
}
