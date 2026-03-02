FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install

COPY . .

RUN yarn build

FROM node:18-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist/autosteer-frontend ./dist

# Add a script to inject BACKEND_URL into window.__env__ at runtime
RUN printf '#!/bin/sh\nset -e\necho "window.__env__ = { API_URL: \\"${BACKEND_URL:-http://localhost:3001}\\", PRODUCTION: true };" > /app/dist/config.js\nexec serve -s dist -l 8080\n' > /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

 # Add a simple health check script
RUN echo '#!/bin/sh' > /app/healthcheck.sh && \
  echo 'curl -f http://localhost:8080/ > /dev/null 2>&1' >> /app/healthcheck.sh && \
  chmod +x /app/healthcheck.sh

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD /app/healthcheck.sh

ENTRYPOINT ["/app/entrypoint.sh"]
