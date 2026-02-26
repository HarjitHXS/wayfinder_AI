FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install

COPY . .

RUN yarn build

FROM node:18-alpine

WORKDIR /app

RUN npm install -g http-server

COPY --from=builder /app/dist/autosteer-frontend ./dist

# Add a script to inject BACKEND_URL into window.__env__ at runtime
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'set -e' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo '# Create config script that injects environment variables' >> /app/entrypoint.sh && \
    echo 'cat > /app/dist/config.js << CONFIGEOF' >> /app/entrypoint.sh && \
    echo 'window.__env__ = {' >> /app/entrypoint.sh && \
    echo '  API_URL: "'\${BACKEND_URL:-http://localhost:3001}'",' >> /app/entrypoint.sh && \
    echo '  PRODUCTION: true' >> /app/entrypoint.sh && \
    echo '};' >> /app/entrypoint.sh && \
    echo 'CONFIGEOF' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo '# Start http-server' >> /app/entrypoint.sh && \
    echo 'exec http-server dist -p 8080 -c-1 --gzip' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

 # Add a simple health check script
RUN echo '#!/bin/sh' > /app/healthcheck.sh && \
  echo 'curl -f http://localhost:8080/ > /dev/null 2>&1' >> /app/healthcheck.sh && \
  chmod +x /app/healthcheck.sh

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD /app/healthcheck.sh

ENTRYPOINT ["/app/entrypoint.sh"]
