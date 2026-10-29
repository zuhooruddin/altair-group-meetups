import type { GroupRepository } from '../../domain/ports';
import type { GroupRecord } from '../../domain/types';
import type { SqlClient } from '../db/sql-client';

export class PgGroupRepository implements GroupRepository {
  constructor(private readonly db: SqlClient) {}

  async listMine(): Promise<GroupRecord[]> {
    // RLS already limits groups to the caller's; the join states the intent.
    const { rows } = await this.db.query<{ id: string; name: string }>(
      `select g.id, g.name
         from public.groups g
         join public.group_memberships gm
           on gm.group_id = g.id and gm.user_id = app.current_user_id()
        order by g.name`,
    );
    return rows.map((r) => ({ id: r.id, name: r.name }));
  }

  async findVisible(groupId: string): Promise<GroupRecord | null> {
    const { rows } = await this.db.query<{ id: string; name: string }>(
      `select g.id, g.name from public.groups g where g.id = $1`,
      [groupId],
    );
    const row = rows[0];
    return row ? { id: row.id, name: row.name } : null;
  }
}
