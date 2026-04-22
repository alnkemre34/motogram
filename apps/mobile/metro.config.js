// Metro config tuned for pnpm + monorepo symlinks on Windows.
// This prevents "Unable to resolve @babel/runtime/..." when deps live in
// workspace-local node_modules folders.

const path = require('path');
const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;
config.resolver.disableHierarchicalLookup = true;

// Force a single React instance (prevents "Invalid hook call" / `useId` null).
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (_, name) => {
      // Prefer app-local deps when pnpm doesn't hoist them, otherwise use workspace root.
      const local = path.join(projectRoot, 'node_modules', name);
      if (fs.existsSync(local)) return local;
      return path.join(workspaceRoot, 'node_modules', name);
    },
  },
);

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.watchFolders = [workspaceRoot];

module.exports = config;

