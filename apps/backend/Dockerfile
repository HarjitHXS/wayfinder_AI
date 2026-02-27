FROM node:18-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./
RUN yarn install && yarn cache clean

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build
RUN yarn build

# Production stage
FROM node:18-slim

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    dumb-init \
    wget \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libxss1 \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -g 1001 nodejs && \
  useradd -m -u 1001 -g nodejs nodejs

WORKDIR /app

# Copy dependencies from builder
COPY --chown=nodejs:nodejs package.json yarn.lock ./
RUN yarn install --production && yarn cache clean

# Pin Playwright browser install path so build + runtime agree
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers

# Install Playwright browsers to the pinned path
RUN npx playwright install --with-deps chromium

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Chromium needs a writable tmp directory for profiles/crashes (Cloud Run root fs is read-only)
ENV TMPDIR=/tmp
ENV XDG_CACHE_HOME=/tmp/.cache
ENV XDG_CONFIG_HOME=/tmp/.config

# Cloud Run injects PORT env var (usually 8080); fall back to 3001 for local
ENV PORT=8080
EXPOSE ${PORT}

# Use non-root user
USER nodejs

# Health check — reads the same PORT env var Cloud Run sets
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "const p=process.env.PORT||8080;require('http').get('http://localhost:'+p+'/health',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]
