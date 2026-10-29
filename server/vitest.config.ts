import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
        },
      },
      {
        // Real Postgres (PGlite, PG 17) with the real migrations + seed. No network.
        test: {
          name: 'offline',
          include: ['test/offline/**/*.test.ts'],
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
      {
        // Hosted Supabase: real Auth, PostgREST and Postgres. Needs .env.
        test: {
          name: 'hosted',
          include: ['test/hosted/**/*.test.ts'],
          testTimeout: 60_000,
          hookTimeout: 120_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
