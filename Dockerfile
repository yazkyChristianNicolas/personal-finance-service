# --- deps: install once, reused by build and (via prune) by runtime ---
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build: compile Nest + generate Prisma client (node_modules stays unpruned here,
# so both 'migrate' and 'runtime' below can each decide what they need from it) ---
FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- migrate: one-shot job (docker-compose 'migrate' service) that applies pending
# migrations before 'api' starts. Needs the full Prisma CLI, so it does NOT prune. ---
FROM node:24-alpine AS migrate
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/generated ./generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/package.json ./package.json
CMD ["npx", "prisma", "migrate", "deploy"]

# --- runtime: minimal image, non-root user, no Prisma CLI (schema mutation happens only
# in the 'migrate' job above, never as a side effect of the long-running app process) ---
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/generated ./generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
RUN npm prune --omit=dev
USER app
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
