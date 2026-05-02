import Fastify from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { youtubeRoutes } from './routes/youtube.routes.js';
import { invidiousRoutes } from './routes/invidious.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { indieAuthRoutes } from './routes/indieauth.routes.js';
import { metaRoutes } from './routes/meta.routes.js';
import { initAllClients } from './lib/youtube.js';
import { DiagnosticService } from './services/diagnostic.service.js';
import { IndieAuthService } from './services/indieauth.service.js';
import { YouTubeService } from './services/youtube.service.js';
import { config, validateConfig } from './lib/config.js';

// Configuration validation
validateConfig();

const fastify = Fastify({ 
  logger: {
    level: config.isDev ? 'info' : 'warn',
    transport: config.isDev ? {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    } : undefined
  },
  exposeHeadRoutes: false 
});

// Run diagnostics and pre-warming in background
(async () => {
  try {
    await initAllClients();
    await IndieAuthService.init();
    YouTubeService.initJobs();
    DiagnosticService.runStartupTests(fastify.log).catch(e => fastify.log.error(e, '[Diagnostic] Error during startup tests'));
  } catch (e) {
    fastify.log.error(e, '[Startup] Error during initialization');
  }
})();

process.on('uncaughtException', (err) => {
  fastify.log.fatal(err, 'uncaughtException');
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  fastify.log.fatal(reason as Error, 'unhandledRejection');
  process.exit(1);
});

await fastify.register(cors, { origin: true });
await fastify.register(compress, { global: true });
import cookie from '@fastify/cookie';
await fastify.register(cookie);

await fastify.register(swagger, {
  openapi: {
    info: {
      title: 'Wholphin Music API',
      version: '4.0.0'
    },
    tags: [
      { name: 'youtube', description: 'YouTube and playback endpoints' },
      { name: 'user', description: 'Local user data and subscription endpoints' },
      { name: 'system', description: 'System health and metrics' }
    ]
  }
});
await fastify.register(swaggerUi, { routePrefix: '/docs' });

import { systemRoutes } from './routes/system.routes.js';

// APIルートの登録 (静的ファイルより先に登録)
await fastify.register(systemRoutes);
await fastify.register(youtubeRoutes, { prefix: '/api' });
await fastify.register(invidiousRoutes, { prefix: '/api/v1' });
await fastify.register(userRoutes, { prefix: '/api/user' });
await fastify.register(adminRoutes, { prefix: '/api/admin' });
await fastify.register(indieAuthRoutes, { prefix: '/api' });
await fastify.register(metaRoutes);

const clientDist = path.resolve(process.cwd(), 'dist');
const publicDir = path.resolve(process.cwd(), 'public');
const hasClientBuild = existsSync(path.join(clientDist, 'index.html'));

if (hasClientBuild) {
  await fastify.register(fastifyStatic, {
    root: clientDist,
    prefix: '/',
    maxAge: '1d',
    immutable: true
  });
} else if (existsSync(publicDir)) {
  await fastify.register(fastifyStatic, {
    root: publicDir,
    prefix: '/',
    maxAge: '1h'
  });
}

fastify.setNotFoundHandler((request, reply) => {
  const isApi = request.url.startsWith('/api');
  const isAsset = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf|map)$/.test(request.url);

  if (!isApi && !isAsset && hasClientBuild) {
    return reply.type('text/html').sendFile('index.html');
  }

  reply.status(404).send({
    error: isApi ? 'API endpoint not found' : 'Not found',
  });
});

// Graceful Shutdown
const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
for (const signal of signals) {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await fastify.close();
      fastify.log.info('Server closed');
      process.exit(0);
    } catch (err) {
      fastify.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  });
}

const start = async () => {
  try {
    const port = config.port;
    await fastify.listen({ port, host: '0.0.0.0' });
    // Note: Fastify logger already logs the listening address
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
