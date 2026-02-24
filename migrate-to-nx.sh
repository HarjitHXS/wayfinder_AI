#!/bin/bash
set -e

echo "🚀 Converting Wayfinder AI to Nx Monorepo..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Create apps directory
echo -e "${BLUE}Step 1: Creating apps directory structure...${NC}"
mkdir -p apps

# Step 2: Move backend
echo -e "${BLUE}Step 2: Moving backend to apps/backend...${NC}"
if [ -d "backend" ]; then
  mv backend apps/backend
  echo -e "${GREEN}✓ Backend moved${NC}"
else
  echo -e "${YELLOW}⚠ Backend already in apps/${NC}"
fi

# Step 3: Move frontend
echo -e "${BLUE}Step 3: Moving frontend to apps/frontend...${NC}"
if [ -d "frontend" ]; then
  mv frontend apps/frontend
  echo -e "${GREEN}✓ Frontend moved${NC}"
else
  echo -e "${YELLOW}⚠ Frontend already in apps/${NC}"
fi

# Step 4: Update backend tsconfig
echo -e "${BLUE}Step 4: Updating backend TypeScript config...${NC}"
cat > apps/backend/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2021",
    "outDir": "../../dist/apps/backend",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.spec.ts"]
}
EOF
echo -e "${GREEN}✓ Backend tsconfig updated${NC}"

# Step 5: Update frontend Angular config
echo -e "${BLUE}Step 5: Updating frontend Angular config...${NC}"
cat > apps/frontend/angular.json << 'EOF'
{
  "$schema": "../../node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "cli": {
    "packageManager": "yarn",
    "analytics": false
  },
  "newProjectRoot": "apps",
  "projects": {
    "frontend": {
      "projectType": "application",
      "schematics": {
        "@schematics/angular:component": {
          "style": "scss"
        }
      },
      "root": "apps/frontend",
      "sourceRoot": "apps/frontend/src",
      "prefix": "app",
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:browser",
          "options": {
            "outputPath": "dist/apps/frontend",
            "index": "apps/frontend/src/index.html",
            "main": "apps/frontend/src/main.ts",
            "polyfills": ["zone.js"],
            "tsConfig": "apps/frontend/tsconfig.app.json",
            "assets": [
              "apps/frontend/src/favicon.ico",
              "apps/frontend/src/assets"
            ],
            "styles": ["apps/frontend/src/styles.scss"],
            "scripts": []
          },
          "configurations": {
            "production": {
              "budgets": [
                {
                  "type": "initial",
                  "maximumWarning": "500kb",
                  "maximumError": "1mb"
                }
              ],
              "outputHashing": "all"
            },
            "development": {
              "buildOptimizer": false,
              "optimization": false,
              "vendorChunk": true,
              "extractLicenses": false,
              "sourceMap": true,
              "namedChunks": true
            }
          },
          "defaultConfiguration": "production"
        },
        "serve": {
          "builder": "@angular-devkit/build-angular:dev-server",
          "configurations": {
            "production": {
              "buildTarget": "frontend:build:production"
            },
            "development": {
              "buildTarget": "frontend:build:development"
            }
          },
          "defaultConfiguration": "development",
          "options": {
            "port": 3000,
            "host": "0.0.0.0"
          }
        }
      }
    }
  }
}
EOF
echo -e "${GREEN}✓ Angular config updated${NC}"

# Step 6: Update frontend tsconfig files
echo -e "${BLUE}Step 6: Updating frontend TypeScript configs...${NC}"
cat > apps/frontend/tsconfig.json << 'EOF'
{
  "compileOnSave": false,
  "compilerOptions": {
    "baseUrl": "./",
    "outDir": "./out-tsc/app",
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "sourceMap": true,
    "declaration": false,
    "downlevelIteration": true,
    "experimentalDecorators": true,
    "moduleResolution": "node",
    "importHelpers": true,
    "target": "ES2022",
    "module": "ES2022",
    "useDefineForClassFields": false,
    "lib": ["ES2022", "dom"]
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  }
}
EOF

cat > apps/frontend/tsconfig.app.json << 'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../out-tsc/app",
    "types": []
  },
  "files": ["src/main.ts"],
  "include": ["src/**/*.d.ts"]
}
EOF
echo -e "${GREEN}✓ Frontend tsconfig files updated${NC}"

# Step 7: Create base tsconfig
echo -e "${BLUE}Step 7: Creating base TypeScript config...${NC}"
cat > tsconfig.base.json << 'EOF'
{
  "compileOnSave": false,
  "compilerOptions": {
    "rootDir": ".",
    "sourceMap": true,
    "declaration": false,
    "moduleResolution": "node",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "importHelpers": true,
    "target": "ES2021",
    "module": "esnext",
    "lib": ["ES2021", "dom"],
    "skipLibCheck": true,
    "skipDefaultLibCheck": true,
    "baseUrl": ".",
    "paths": {}
  },
  "exclude": ["node_modules", "tmp"]
}
EOF
echo -e "${GREEN}✓ Base tsconfig created${NC}"

# Step 8: Clean up old node_modules
echo -e "${BLUE}Step 8: Cleaning up old dependencies...${NC}"
rm -rf apps/backend/node_modules 2>/dev/null || true
rm -rf apps/frontend/node_modules 2>/dev/null || true
echo -e "${GREEN}✓ Old node_modules removed${NC}"

# Step 9: Install Nx and dependencies
echo -e "${BLUE}Step 9: Installing Nx and dependencies...${NC}"
echo -e "${YELLOW}This may take a few minutes...${NC}"
yarn install

# Step 10: Update docker-compose
echo -e "${BLUE}Step 10: Updating docker-compose.yml...${NC}"
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - PORT=3001
    env_file:
      - apps/backend/.env
    volumes:
      - ./apps/backend/src:/app/apps/backend/src
      - /app/node_modules
    command: yarn nx serve backend

  frontend:
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    volumes:
      - ./apps/frontend/src:/app/apps/frontend/src
      - /app/node_modules
    depends_on:
      - backend
    command: yarn nx serve frontend
EOF
echo -e "${GREEN}✓ docker-compose.yml updated${NC}"

# Step 11: Update Dockerfiles
echo -e "${BLUE}Step 11: Updating Dockerfiles for monorepo...${NC}"
cat > apps/backend/Dockerfile << 'EOF'
FROM node:18-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package.json yarn.lock ./
COPY nx.json tsconfig.base.json ./

# Copy backend-specific files
COPY apps/backend ./apps/backend

# Install dependencies
RUN yarn install --frozen-lockfile

# Build backend
RUN yarn nx build backend

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/dist/apps/backend ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/.env* ./

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/index.js"]
EOF

cat > apps/frontend/Dockerfile << 'EOF'
FROM node:18-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package.json yarn.lock ./
COPY nx.json tsconfig.base.json ./

# Copy frontend-specific files
COPY apps/frontend ./apps/frontend

# Install dependencies
RUN yarn install --frozen-lockfile

# Build frontend
RUN yarn nx build frontend --configuration=production

# Production stage - serve with nginx
FROM nginx:alpine

COPY --from=builder /app/dist/apps/frontend /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOF
echo -e "${GREEN}✓ Dockerfiles updated${NC}"

# Step 12: Create .gitignore updates
echo -e "${BLUE}Step 12: Updating .gitignore...${NC}"
if ! grep -q ".nx" .gitignore 2>/dev/null; then
  cat >> .gitignore << 'EOF'

# Nx
.nx
EOF
fi
echo -e "${GREEN}✓ .gitignore updated${NC}"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Nx Monorepo Conversion Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📦 New Project Structure:${NC}"
echo "  wayfinder-ai/"
echo "  ├── apps/"
echo "  │   ├── backend/     (Node.js + Express)"
echo "  │   └── frontend/    (Angular 17)"
echo "  ├── nx.json"
echo "  ├── package.json     (monorepo root)"
echo "  └── tsconfig.base.json"
echo ""
echo -e "${BLUE}🚀 Available Commands:${NC}"
echo "  yarn frontend        # Start frontend only"
echo "  yarn backend         # Start backend only"
echo "  yarn dev            # Start both apps in parallel"
echo "  yarn build          # Build all apps"
echo "  yarn test           # Test all apps"
echo "  yarn graph          # View dependency graph"
echo ""
echo -e "${BLUE}📊 Nx Benefits:${NC}"
echo "  ✓ Unified dependency management"
echo "  ✓ Intelligent build caching"
echo "  ✓ Run tasks in parallel"
echo "  ✓ Affected commands (only build what changed)"
echo "  ✓ Visual dependency graph"
echo "  ✓ Better IDE support"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Run 'yarn dev' to start both apps"
echo "  2. Run 'yarn graph' to see the project structure"
echo "  3. Check apps/backend/.env and apps/frontend/.env"
echo ""
