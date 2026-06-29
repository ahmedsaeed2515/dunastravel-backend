ARG NODE_VERSION=20-alpine

# Builder Stage
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --production

# Runner Stage
FROM node:${NODE_VERSION}
ENV NODE_ENV=production
WORKDIR /app

# Run as non-root user for security
RUN chown -R node:node /app
USER node

# Copy dependencies and build
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/prisma ./prisma

EXPOSE 3000

# Add healthcheck to Dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "dist/main.js"]
