import { describeApiAccess } from '../support/api-access.suite';
import { createOfflineHarness } from '../support/offline-harness';

describeApiAccess('offline: embedded Postgres 17, offline token verifier', createOfflineHarness);
