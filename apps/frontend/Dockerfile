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
RUN cat > /app/entrypoint.sh << 'EOF'
#!/bin/sh
set -e

# Create config script that injects environment variables
cat > /app/dist/config.js << CONFIGEOF
window.__env__ = {
  API_URL: '${BACKEND_URL:-http://localhost:3001}',
  PRODUCTION: true
};
CONFIGEOF

# Start http-server
exec http-server dist -p 3000 -c-1 --gzip
EOF
chmod +x /app/entrypoint.sh

# Add a simple health check script
RUN echo '#!/bin/sh' > /app/healthcheck.sh && \
    echo 'curl -f http://localhost:3000/ > /dev/null 2>&1' >> /app/healthcheck.sh && \
    chmod +x /app/healthcheck.sh

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD /app/healthcheck.sh

ENTRYPOINT ["/app/entrypoint.sh"]
