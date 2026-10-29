import { myGroupsResponseSchema } from '@altair/shared';
import type { FastifyPluginAsync } from 'fastify';
import { actorOf } from '../../http/auth';
import { toResponse } from '../../http/validation';
import type { GroupsService } from './groups.service';

export function groupsRoutes(service: GroupsService): FastifyPluginAsync {
  return async (app) => {
    app.get('/me/groups', async (request) =>
      toResponse(myGroupsResponseSchema, await service.listMine(actorOf(request))),
    );
  };
}
