import { FastifyInstance } from 'fastify';
import { IndieAuthService } from '../services/indieauth.service.js';
import { config } from '../lib/config.js';
import { AuthLib } from '../lib/auth.js';

export async function indieAuthRoutes(fastify: FastifyInstance) {
  // Metadata endpoint (Discovery)
  fastify.get('/.well-known/oauth-authorization-server', async () => {
    return {
      issuer: config.appBaseUrl,
      authorization_endpoint: `${config.appBaseUrl}/api/auth`,
      token_endpoint: `${config.appBaseUrl}/api/auth/token`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256']
    };
  });

  // Authorization Endpoint
  fastify.get('/auth', {
    schema: {
      querystring: {
        type: 'object',
        required: ['client_id', 'redirect_uri', 'response_type'],
        properties: {
          me: { type: 'string' },
          client_id: { type: 'string' },
          redirect_uri: { type: 'string' },
          state: { type: 'string' },
          response_type: { type: 'string' },
          scope: { type: 'string' },
          code_challenge: { type: 'string' },
          code_challenge_method: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const query = request.query as any;

    if (query.response_type !== 'code') {
      return reply.status(400).send({ error: 'unsupported_response_type' });
    }

    // In IndieAuth, 'me' is optional but if present must be verified.
    // For this simple implementation, we represent one user (the owner).
    const me = query.me || config.appBaseUrl;
    
    // Redirect to UI consent page
    const params = new URLSearchParams({
      me,
      client_id: query.client_id,
      redirect_uri: query.redirect_uri,
      state: query.state || '',
      scope: query.scope || '',
      code_challenge: query.code_challenge || '',
      code_challenge_method: query.code_challenge_method || ''
    });

    return reply.redirect(`/auth/indieauth?${params.toString()}`);
  });

  // Consent Approval Handler (called by the UI)
  fastify.post('/auth/approve', {
    schema: {
      body: {
        type: 'object',
        required: ['client_id', 'redirect_uri', 'me'],
        properties: {
          me: { type: 'string' },
          client_id: { type: 'string' },
          redirect_uri: { type: 'string' },
          state: { type: 'string' },
          scope: { type: 'string' },
          code_challenge: { type: 'string' },
          code_challenge_method: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    // 1. Verify user is authenticated
    // We check for the Bearer token (ADMIN_SECRET_TOKEN) or a valid session cookie/JWT.
    // In this app, users might be using Logto or ADMIN_SECRET_TOKEN.
    
    const authHeader = request.headers.authorization;
    const isAdmin = authHeader === `Bearer ${config.adminSecretToken}`;
    
    // If not admin, check if there's a valid JWT from the browser session
    let isAuthenticated = isAdmin;
    if (!isAuthenticated) {
      const token = request.cookies?.token;
      if (token && AuthLib.verify(token)) {
        isAuthenticated = true;
      }
    }

    if (!isAuthenticated) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const body = request.body as any;

    // 2. Generate authorization code
    const code = await IndieAuthService.createCode({
      me: body.me,
      clientId: body.client_id,
      redirectUri: body.redirect_uri,
      scope: body.scope,
      codeChallenge: body.code_challenge,
      codeChallengeMethod: body.code_challenge_method
    });

    // 3. Return the code (UI will redirect)
    return { code, state: body.state };
  });

  // Token Endpoint
  fastify.post('/auth/token', async (request, reply) => {
    const body = request.body as any;
    
    // Support both application/x-www-form-urlencoded and application/json
    const params = typeof body === 'string' ? Object.fromEntries(new URLSearchParams(body)) : body;

    if (params.grant_type === 'authorization_code') {
      const authCode = await IndieAuthService.verifyCode(
        params.code,
        params.client_id,
        params.redirect_uri,
        params.code_verifier
      );

      if (!authCode) {
        return reply.status(400).send({ error: 'invalid_grant' });
      }

      // If scope is requested, issue a token. 
      // If it's just an identification request, just return 'me'.
      if (authCode.scope) {
        const accessToken = await IndieAuthService.issueToken(authCode.me, authCode.clientId, authCode.scope);
        return {
          me: authCode.me,
          access_token: accessToken,
          token_type: 'Bearer',
          scope: authCode.scope
        };
      } else {
        return {
          me: authCode.me
        };
      }
    }

    // Token Verification (used by Resource Servers)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const verified = await IndieAuthService.verifyToken(token);
      if (verified) {
        return {
          me: verified.me,
          client_id: verified.clientId,
          scope: verified.scope
        };
      }
    }

    return reply.status(400).send({ error: 'invalid_request' });
  });
}
