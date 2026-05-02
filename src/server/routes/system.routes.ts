import type { FastifyInstance } from 'fastify';
import { DiagnosticService } from '../services/diagnostic.service.js';
import { config } from '../lib/config.js';

export async function systemRoutes(fastify: FastifyInstance) {
  fastify.get('/health', {
    schema: {
      summary: 'Health Check',
      description: 'Returns the health status of the API.',
      tags: ['system']
    }
  }, async () => {
    const diagnostic = DiagnosticService.getLastResult();
    return { 
      status: diagnostic?.isHealthy !== false ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: diagnostic
    };
  });

  fastify.get('/metrics', {
    schema: {
      summary: 'System Metrics',
      description: 'Returns basic system metrics like memory usage and uptime.',
      tags: ['system']
    }
  }, async () => {
    const memoryUsage = process.memoryUsage();
    return {
      uptime: process.uptime(),
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100 + ' MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100 + ' MB',
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100 + ' MB',
        external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100 + ' MB',
      },
      config: {
        nodeEnv: config.nodeEnv,
        port: config.port
      }
    };
  });

  fastify.get('/openapi.json', {
    schema: {
      summary: 'OpenAPI JSON',
      description: 'Returns the generated OpenAPI specification.',
      tags: ['system']
    }
  }, async () => fastify.swagger());
}
