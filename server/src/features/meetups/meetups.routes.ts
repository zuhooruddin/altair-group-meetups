import {
  attendeesResponseSchema,
  createMeetupRequestSchema,
  emptyBodySchema,
  groupIdParamsSchema,
  groupMapResponseSchema,
  listMeetupsResponseSchema,
  meetupDetailResponseSchema,
  meetupIdParamsSchema,
  meetupMapResponseSchema,
  updateMeetupRequestSchema,
} from '@altair/shared';
import type { FastifyPluginAsync } from 'fastify';
import { actorOf } from '../../http/auth';
import { parseInput, toResponse } from '../../http/validation';
import type { MeetupsService } from './meetups.service';

export function meetupsRoutes(service: MeetupsService): FastifyPluginAsync {
  return async (app) => {
    app.get('/groups/:groupId/meetups', async (request) => {
      const { groupId } = parseInput(groupIdParamsSchema, request.params, 'path parameters');
      return toResponse(
        listMeetupsResponseSchema,
        await service.listForGroup(actorOf(request), groupId),
      );
    });

    app.get('/groups/:groupId/map', async (request) => {
      const { groupId } = parseInput(groupIdParamsSchema, request.params, 'path parameters');
      return toResponse(
        groupMapResponseSchema,
        await service.getGroupMap(actorOf(request), groupId),
      );
    });

    app.get('/meetups/:meetupId', async (request) => {
      const { meetupId } = parseInput(meetupIdParamsSchema, request.params, 'path parameters');
      const meetup = await service.getDetail(actorOf(request), meetupId);
      return toResponse(meetupDetailResponseSchema, { meetup });
    });

    app.get('/meetups/:meetupId/attendees', async (request) => {
      const { meetupId } = parseInput(meetupIdParamsSchema, request.params, 'path parameters');
      return toResponse(
        attendeesResponseSchema,
        await service.getAttendees(actorOf(request), meetupId),
      );
    });

    app.get('/meetups/:meetupId/map', async (request) => {
      const { meetupId } = parseInput(meetupIdParamsSchema, request.params, 'path parameters');
      return toResponse(
        meetupMapResponseSchema,
        await service.getMeetupMap(actorOf(request), meetupId),
      );
    });

    // ---- writes: validated with the shared contract before anything else ----

    app.post('/meetups', async (request, reply) => {
      const actor = actorOf(request);
      const input = parseInput(createMeetupRequestSchema, request.body, 'meetup');
      const meetup = await service.create(actor, input);
      return reply.status(201).send(toResponse(meetupDetailResponseSchema, { meetup }));
    });

    // Bonus: creator-only edit.
    app.patch('/meetups/:meetupId', async (request) => {
      const actor = actorOf(request);
      const { meetupId } = parseInput(meetupIdParamsSchema, request.params, 'path parameters');
      const input = parseInput(updateMeetupRequestSchema, request.body, 'meetup changes');
      return toResponse(meetupDetailResponseSchema, {
        meetup: await service.update(actor, meetupId, input),
      });
    });

    app.post('/meetups/:meetupId/cancel', async (request) => {
      const actor = actorOf(request);
      const { meetupId } = parseInput(meetupIdParamsSchema, request.params, 'path parameters');
      parseInput(emptyBodySchema, request.body, 'request body');
      return toResponse(meetupDetailResponseSchema, {
        meetup: await service.cancel(actor, meetupId),
      });
    });
  };
}
