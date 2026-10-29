import { z } from 'zod';
import { uuidSchema } from './common';

export const groupSchema = z.object({
  id: uuidSchema,
  name: z.string(),
});
export type Group = z.infer<typeof groupSchema>;

/** GET /v1/me/groups: only the caller's own groups. */
export const myGroupsResponseSchema = z.object({
  groups: z.array(groupSchema),
});
export type MyGroupsResponse = z.infer<typeof myGroupsResponseSchema>;

export const groupIdParamsSchema = z.strictObject({ groupId: uuidSchema });
export type GroupIdParams = z.infer<typeof groupIdParamsSchema>;
