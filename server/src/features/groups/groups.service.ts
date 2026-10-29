import type { MyGroupsResponse } from '@altair/shared';
import type { UnitOfWork } from '../../domain/ports';
import type { Actor } from '../../domain/types';

export class GroupsService {
  constructor(private readonly uow: UnitOfWork) {}

  listMine(actor: Actor): Promise<MyGroupsResponse> {
    return this.uow.read(actor, async (repos) => ({ groups: await repos.groups.listMine() }));
  }
}
