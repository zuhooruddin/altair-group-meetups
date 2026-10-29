import Fastify, { type FastifyServerOptions } from 'fastify';
import type { TokenVerifier, UnitOfWork } from '../domain/ports';
import { GroupsService } from '../features/groups/groups.service';
import { groupsRoutes } from '../features/groups/groups.routes';
import { MeetupsService } from '../features/meetups/meetups.service';
import { meetupsRoutes } from '../features/meetups/meetups.routes';
import { RsvpsService } from '../features/rsvps/rsvps.service';
import { rsvpsRoutes } from '../features/rsvps/rsvps.routes';
import { authenticate } from './auth';
import { registerErrorHandling } from './error-handler';

export interface AppDependencies {
  uow: UnitOfWork;
  tokenVerifier: TokenVerifier;
  logger?: FastifyServerOptions['logger'];
}

/** Builds the HTTP app from its ports. No I/O happens here, so tests can inject fakes. */
export function buildApp({ uow, tokenVerifier, logger = false }: AppDependencies) {
  const app = Fastify({ logger, bodyLimit: 16 * 1024 });

  app.decorateRequest('actor', null);
  registerErrorHandling(app);

  app.get('/health', async () => ({ status: 'ok' }));

  app.register(
    async (v1) => {
      v1.addHook('onRequest', authenticate(tokenVerifier));
      await v1.register(groupsRoutes(new GroupsService(uow)));
      await v1.register(meetupsRoutes(new MeetupsService(uow)));
      await v1.register(rsvpsRoutes(new RsvpsService(uow)));
    },
    { prefix: '/v1' },
  );

  return app;
}
