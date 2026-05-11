import { env } from '../config';
import { createDatabaseClient } from '../lib/database';
import { applyDataRetentionPolicy } from '../lib/data-retention';

async function main() {
  const database = createDatabaseClient();

  try {
    const summary = await applyDataRetentionPolicy(database, new Date(), {
      authAuditLogRetentionDays: env.AUTH_AUDIT_LOG_RETENTION_DAYS,
      privacyRequestRetentionDays: env.PRIVACY_REQUEST_RETENTION_DAYS,
      sessionRetentionDays: env.SESSION_RETENTION_DAYS,
      tokenRetentionDays: env.TOKEN_RETENTION_DAYS,
    });

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await database.close();
  }
}

void main();