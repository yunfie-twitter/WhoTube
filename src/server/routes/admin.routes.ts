import { FastifyInstance } from 'fastify';
import { NotificationService } from '../services/notification.service.js';
import { config } from '../lib/config.js';

export async function adminRoutes(fastify: FastifyInstance) {
  const secretToken = config.adminSecretToken;

  // Middleware-like check for admin routes
  fastify.addHook('preHandler', async (request, reply) => {
    if (!secretToken) {
      return reply.status(500).send({ error: 'ADMIN_SECRET_TOKEN is not configured on the server' });
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${secretToken}`) {
      return reply.status(401).send({ error: 'Unauthorized: Invalid or missing secret token' });
    }
  });

  // POST /api/admin/notifications
  fastify.post('/notifications', {
    schema: {
      summary: 'Send Global Notification',
      description: 'Sends a global notification to all users as an instance operator announcement.',
      tags: ['admin'],
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string' },
          type: { type: 'string', enum: ['info', 'warning', 'error', 'success'], default: 'info' }
        }
      }
    }
  }, async (request) => {
    const { message, type } = request.body as { message: string; type?: string };
    const notification = await NotificationService.addNotification(message, type);
    return { success: true, notification };
  });

  // DELETE /api/admin/notifications/:id
  fastify.delete('/notifications/:id', async (request) => {
    const { id } = request.params as { id: string };
    await NotificationService.deleteNotification(Number(id));
    return { success: true };
  });

  // DELETE /api/admin/notifications/clear
  fastify.delete('/notifications/clear', async () => {
    await NotificationService.clearAll();
    return { success: true };
  });
}
