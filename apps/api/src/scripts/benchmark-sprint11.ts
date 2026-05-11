import { performance } from 'node:perf_hooks';

import { newDb } from 'pg-mem';

type BenchmarkSummary = {
  averageMs: number;
  iterations: number;
  maxMs: number;
  minMs: number;
  p95Ms: number;
  scenario: string;
};

async function main() {
  process.env.NODE_ENV = 'test';
  process.env.AUTH_RATE_LIMIT_MAX = '500';
  process.env.EXPENSIVE_READ_RATE_LIMIT_MAX = '500';
  process.env.PASSWORD_RECOVERY_RATE_LIMIT_MAX = '500';

  const [
    { buildApp },
    { ensureDatabaseSchema },
    { createDatabaseClientFromPool },
    { makeRegisterInputFixture },
  ] = await Promise.all([
    import('../app'),
    import('../lib/database-bootstrap'),
    import('../lib/database'),
    import('@economy-cash/test-fixtures'),
  ]);

  const database = newDb({ autoCreateForeignKeyIndices: true });
  const pgAdapter = database.adapters.createPg();
  const pool = new pgAdapter.Pool();
  const databaseClient = createDatabaseClientFromPool(pool);

  await ensureDatabaseSchema(databaseClient);

  const app = buildApp({
    database: databaseClient,
    now: () => new Date('2026-05-11T12:00:00.000Z'),
  });

  try {
    const registerInput = makeRegisterInputFixture({
      email: 'benchmark@example.com',
      name: 'Benchmark User',
    });
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: {
        origin: 'http://localhost:5173',
      },
      payload: registerInput,
    });

    if (registerResponse.statusCode !== 201) {
      throw new Error(`Falha ao preparar benchmark: ${registerResponse.body}`);
    }

    const sessionCookie = registerResponse.headers['set-cookie'] as string;

    const scenarios: Array<{
      iterations: number;
      name: string;
      run: () => Promise<void>;
    }> = [
      {
        name: 'auth-login',
        iterations: 15,
        run: async () => {
          const response = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            headers: {
              origin: 'http://localhost:5173',
            },
            payload: {
              email: registerInput.email,
              password: registerInput.password,
            },
          });

          if (response.statusCode !== 200) {
            throw new Error(`Login benchmark falhou com status ${response.statusCode}`);
          }
        },
      },
      {
        name: 'horizon-read',
        iterations: 20,
        run: async () => {
          const response = await app.inject({
            method: 'GET',
            url: '/api/v1/horizon',
            headers: {
              cookie: sessionCookie,
            },
          });

          if (response.statusCode !== 200) {
            throw new Error(`Horizon benchmark falhou com status ${response.statusCode}`);
          }
        },
      },
      {
        name: 'analytics-read',
        iterations: 20,
        run: async () => {
          const response = await app.inject({
            method: 'GET',
            url: '/api/v1/analytics',
            headers: {
              cookie: sessionCookie,
            },
          });

          if (response.statusCode !== 200) {
            throw new Error(`Analytics benchmark falhou com status ${response.statusCode}`);
          }
        },
      },
    ];

    const summaries: BenchmarkSummary[] = [];

    for (const scenario of scenarios) {
      for (let warmupIndex = 0; warmupIndex < 3; warmupIndex += 1) {
        await scenario.run();
      }

      const samples: number[] = [];

      for (let index = 0; index < scenario.iterations; index += 1) {
        const startedAt = performance.now();
        await scenario.run();
        samples.push(performance.now() - startedAt);
      }

      const orderedSamples = [...samples].sort((left, right) => left - right);
      const p95Index = Math.max(Math.ceil(orderedSamples.length * 0.95) - 1, 0);
      const averageMs =
        samples.reduce((sum, currentValue) => sum + currentValue, 0) / samples.length;

      summaries.push({
        averageMs: roundMetric(averageMs),
        iterations: scenario.iterations,
        maxMs: roundMetric(orderedSamples[orderedSamples.length - 1] ?? 0),
        minMs: roundMetric(orderedSamples[0] ?? 0),
        p95Ms: roundMetric(orderedSamples[p95Index] ?? 0),
        scenario: scenario.name,
      });
    }

    console.log(JSON.stringify(summaries, null, 2));
  } finally {
    await app.close();
  }
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

void main();