import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: ['src/server.ts'],
  format: ['cjs'],
  noExternal: ['@shf/contracts', '@shf/domain-core'],
  platform: 'node',
});