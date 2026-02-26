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

EXPOSE 3000

CMD ["http-server", "dist", "-p", "3000", "-c-1", "--gzip"]
