// Expo's default Metro config detects the npm workspace (SDK 52+): it adds
// the repo root to watchFolders and resolves hoisted node_modules, which is
// what lets the app import the shared Zod contract from packages/shared.
// Stated explicitly here so the dependency on that is visible.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = Array.from(
  new Set([...(config.watchFolders ?? []), path.join(workspaceRoot, 'packages', 'shared')]),
);

module.exports = config;
