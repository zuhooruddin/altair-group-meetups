import { emptyBodySchema, meetupDetailResponseSchema, meetupIdParamsSchema } from '@altair/shared';
import type { FastifyPluginAsync } from 'fastify';
import { actorOf } from '../../http/auth';
import { parseInput, toResponse } from '../../http/validation';
import type { RsvpsService } from './rsvps.service';

export function rsvpsRoutes(service: RsvpsService): FastifyPluginAsync {
  return async (app) => {
    // PUT: RSVP is idempotent (RSVPing twice leaves one RSVP).
    app.put('/meetups/:meetupId/rsvp', async (request) => {
      const actor = actorOf(request);
      const { meetupId } = parseInput(meetupIdParamsSchema, request.params, 'path parameters');
      parseInput(emptyBodySchema, request.body, 'request body');
      return toResponse(meetupDetailResponseSchema, { meetup: await service.rsvp(actor, meetupId) });
    });

    app.delete('/meetups/:meetupId/rsvp', async (request) => {
      const actor = actorOf(request);
      const { meetupId } = parseInput(meetupIdParamsSchema, request.params, 'path parameters');
      parseInput(emptyBodySchema, request.body, 'request body');
      return toResponse(meetupDetailResponseSchema, { meetup: await service.withdraw(actor, meetupId) });
    });
  };
}
