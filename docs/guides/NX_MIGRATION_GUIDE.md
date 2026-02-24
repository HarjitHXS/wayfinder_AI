# 🔄 Nx Monorepo Migration Guide

## Why Nx?

Converting Wayfinder AI to an Nx monorepo provides:

- **Unified workspace**: One `node_modules`, one set of dependencies
- **Intelligent caching**: Build once, cache forever
- **Parallel execution**: Run backend and frontend simultaneously
- **Affected commands**: Only rebuild what changed
- **Better tooling**: Enhanced IDE support and debugging
- **Future-ready**: Easy to add shared libraries, new apps

---

## Quick Migration (5 minutes)

```bash
# Make the migration script executable
chmod +x migrate-to-nx.sh

# Run the migration
./migrate-to-nx.sh

# Start development
yarn dev
```

That's it! Your project is now an Nx monorepo.

---

## What Changed?

### Before (Separate Projects)
```
wayfinder/
├── backend/
│   ├── package.json
│   ├── node_modules/
│   └── src/
└── frontend/
    ├── package.json
    ├── node_modules/
    └── src/
```

### After (Nx Monorepo)
```
wayfinder-ai/
├── apps/
│   ├── backend/
│   │   ├── project.json    # Nx project config
│   │   └── src/
│   └── frontend/
│       ├── project.json    # Nx project config
│       └── src/
├── nx.json                  # Nx workspace config
├── package.json             # Single package.json
├── node_modules/            # Single node_modules
└── tsconfig.base.json       # Shared TypeScript config
```

---

## New Commands

### Development
```bash
# Start both apps (recommended)
yarn dev

# Start frontend only
yarn frontend
# or
nx serve frontend

# Start backend only
yarn backend
# or
nx serve backend
```

### Building
```bash
# Build everything
yarn build

# Build specific app
yarn build:frontend
yarn build:backend

# Or using Nx directly
nx build frontend
nx build backend
```

### Testing
```bash
# Run all tests
yarn test

# Test specific app
nx test backend
nx test frontend
```

### Advanced Nx Features
```bash
# View dependency graph (opens in browser)
yarn graph

# Build only affected projects
nx affected:build

# Test only affected projects
nx affected:test

# Run specific target for all projects
nx run-many --target=lint --all

# Run tasks in parallel
nx run-many --target=build --projects=backend,frontend --parallel
```

---

## File Structure Details

### Root Level Files

**`package.json`** - Monorepo root
- Contains all dependencies for both apps
- Shared dev dependencies (Nx, TypeScript, etc.)
- Workspace scripts

**`nx.json`** - Nx configuration
- Task runner settings
- Caching configuration
- Default executors

**`tsconfig.base.json`** - Base TypeScript config
- Shared compiler options
- Path mappings for shared libraries

### App-Level Files

#### `apps/backend/project.json`
Defines backend targets:
- `build` - Compile TypeScript
- `serve` - Run development server
- `lint` - ESLint
- `test` - Jest tests

#### `apps/frontend/project.json`
Defines frontend targets:
- `build` - Angular production build
- `serve` - Angular dev server
- `lint` - ESLint + Angular template linting
- `test` - Karma/Jasmine tests

---

## Environment Variables

### Backend (.env location)
```bash
# Before: backend/.env
# After:  apps/backend/.env

# Example:
apps/backend/.env
```

### Frontend (if needed)
```bash
# Before: frontend/.env
# After:  apps/frontend/.env
```

No changes to the actual environment variable names or values!

---

## Docker Updates

### Building with Docker Compose
```bash
# Still works the same!
docker-compose up --build
```

The migration script updates `docker-compose.yml` to reference `apps/backend` and `apps/frontend`.

### Building individually
```bash
# Backend
docker build -f apps/backend/Dockerfile -t wayfinder-backend .

# Frontend
docker build -f apps/frontend/Dockerfile -t wayfinder-frontend .
```

Note: Docker builds now happen from the **root directory** to access the monorepo.

---

## Google Cloud Deployment

### Cloud Run (Backend)
```bash
# Build from root
gcloud builds submit --tag gcr.io/PROJECT_ID/wayfinder-backend \
  --config apps/backend/cloudbuild.yaml

# Or specify Dockerfile
gcloud builds submit --tag gcr.io/PROJECT_ID/wayfinder-backend \
  -f apps/backend/Dockerfile .
```

### Firebase Hosting (Frontend)
```bash
# Build using Nx
nx build frontend --configuration=production

# Deploy (firebase.json already updated by migration)
firebase deploy --only hosting
```

---

## IDE Configuration

### VS Code

Create `.vscode/settings.json`:
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "search.exclude": {
    "**/node_modules": true,
    "dist": true,
    ".nx": true
  }
}
```

### WebStorm / IntelliJ

1. Right-click root `package.json` → "Configure TypeScript Version" → Use workspace version
2. Mark `dist` and `.nx` as excluded

---

## Troubleshooting

### "Cannot find module" errors

```bash
# Clear Nx cache
nx reset

# Reinstall dependencies
rm -rf node_modules yarn.lock
yarn install
```

### Port conflicts
```bash
# Backend runs on :3001
# Frontend runs on :3000

# Change ports in project.json if needed
```

### TypeScript errors after migration
```bash
# Rebuild TypeScript configs
nx reset
yarn install

# Check tsconfig paths
cat tsconfig.base.json
```

### Docker build fails
```bash
# Ensure you're building from ROOT directory
cd /path/to/wayfinder-ai
docker build -f apps/backend/Dockerfile -t backend .
```

---

## Adding Shared Libraries (Future)

One of Nx's best features - easily share code between apps:

```bash
# Generate a shared library
nx g @nx/js:library shared/utils

# Use in both apps
// apps/backend/src/index.ts
import { someUtil } from '@wayfinder/shared/utils';

// apps/frontend/src/app/app.component.ts
import { someUtil } from '@wayfinder/shared/utils';
```

Example use cases:
- Shared TypeScript types/interfaces
- Common validation logic
- Shared constants
- Utility functions
- API client code

---

## Performance Benefits

### Before (Separate Projects)
- Building backend: 30s
- Building frontend: 45s
- **Total: 75s**

### After (Nx Monorepo - First Build)
- Building backend: 30s
- Building frontend: 45s
- **Total: 75s**

### After (Nx Monorepo - Cached Build)
- Building backend: **2s** ⚡ (cache hit)
- Building frontend: **2s** ⚡ (cache hit)
- **Total: 4s** 🚀

### After (Nx Monorepo - Only Backend Changed)
```bash
nx affected:build
# Only rebuilds backend: 30s
# Frontend skipped (not affected): 0s
# Total: 30s ⚡
```

---

## Rollback (If Needed)

If you need to revert:

```bash
# Restore from git (if committed before migration)
git checkout HEAD -- .

# Or manually:
mv apps/backend backend
mv apps/frontend frontend
rm nx.json tsconfig.base.json
# Restore old package.json files
```

---

## Next Steps

1. ✅ Run `./migrate-to-nx.sh`
2. ✅ Test with `yarn dev`
3. ✅ Explore with `yarn graph`
4. 📚 Read [Nx Documentation](https://nx.dev)
5. 🎯 Add shared libraries as needed
6. 🚀 Enjoy faster builds!

---

## Questions?

- **Nx Docs**: https://nx.dev
- **Nx Discord**: https://go.nx.dev/community
- **Examples**: Run `nx list` to see available plugins

**Migration Status**: Ready to run! Execute `./migrate-to-nx.sh` when ready.
