import { describeApiAccess } from '../support/api-access.suite';
import { createHostedHarness } from '../support/hosted-harness';

describeApiAccess('hosted Supabase: real Auth tokens, real Postgres', createHostedHarness);
