# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.6.0

# Copy monorepo files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared + backend
WORKDIR /app/packages/backend
RUN pnpm build

# Stage 2: Runtime
FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.6.0

# Copy package files
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/backend/package.json ./packages/backend/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Health check (Render expects this)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production

# Run migrations on startup, then start app
CMD ["sh", "-c", "cd packages/backend && pnpm db:migrate && pnpm start"]
