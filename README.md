# personal-finance-service

Microservicio NestJS de finanzas personales y grupales, multi-usuario, con auth vía Keycloak
y soporte para que un agente MCP opere en nombre de cada usuario mediante API Keys propias.

> Fase 1 de la spec en `~/Downloads/finance-microservice-spec.md`: scaffold, infra local,
> auth, y los módulos `groups`, `payment-methods`, `expenses`, `api-keys`. Quedan para fases
> siguientes: `recurring-expenses` + cron, `card-statements` + matching, y el servidor MCP.

## Stack

NestJS · TypeScript · PostgreSQL · Prisma 7 · Keycloak (OIDC/JWT) · Docker Compose

## Levantar en local

```bash
cp .env.example .env
docker compose up -d          # api-db, keycloak-db, keycloak, api
```

- API: http://localhost:3000
- Swagger: http://localhost:3000/docs
- Keycloak admin: http://localhost:8080 (admin/admin — solo dev)

El realm `personal-finance` se importa automáticamente desde `keycloak/realm-export.json`,
con un usuario de prueba (`testuser` / `testpassword`) y un client `personal-finance-dev-test`
habilitado para password grant, para poder pedir un JWT sin pasar por un flujo OAuth completo:

```bash
curl -s -X POST http://localhost:8080/realms/personal-finance/protocol/openid-connect/token \
  -d client_id=personal-finance-dev-test \
  -d grant_type=password \
  -d username=testuser \
  -d password=testpassword \
  | jq -r .access_token
```

Con ese token:

```bash
curl http://localhost:3000/groups -H "Authorization: Bearer <token>"
```

### Solo la base de datos (sin Docker para la API)

Para correr la API con `npm run start:dev` en vez de en Docker (más rápido para iterar):

```bash
docker compose up -d api-db keycloak-db keycloak
npm run start:dev
```

## Scripts

| Script | Qué hace |
|---|---|
| `npm run start:dev` | API en watch mode |
| `npm run build` / `npm run lint` | build / lint |
| `npm run test` | unit tests |
| `npm run test:e2e` | smoke test end-to-end (requiere `api-db`+`keycloak` levantados) |

## Convenciones de diseño de API

Sigue el skill `backend/rest-api-guidelines` (basado en las guías de Zalando): JSON en
snake_case en el wire (el código interno es camelCase — ver
`src/common/interceptors/case-conversion.interceptor.ts`), paginación cursor-based con
objeto `page`, errores en `application/problem+json`, etc.

## Estructura

```
src/
  common/          guards (Keycloak JWT + API Key + compuesto), filtro de errores,
                   interceptor de casing, paginación cursor-based compartida
  prisma/          PrismaService (driver adapter pg, Prisma 7)
  auth/            módulo global que expone los guards
  users/           sync de User desde el JWT (find-or-create on primer request)
  groups/          grupos + auto-creación del grupo "Personal"
  payment-methods/ medios de pago (CASH/DEBIT/CREDIT)
  expenses/        gastos + splits (EQUAL/PERCENTAGE/ROMANA) para grupos no-Personal
  api-keys/        API Keys para el futuro agente MCP (hash SHA-256, guard propio)
  health/          healthcheck sin auth
```

## Decisiones de esta fase (por si hace falta revisarlas)

- **Casing:** wire format snake_case vía interceptor global; DTOs de query usan
  `@Expose({name: '...'})` porque `request.query` no es mutable de forma confiable en
  Express 5.
- **Dinero:** `amount` (centavos, `Int`) + `currency` planos en `Expense`, tal cual la spec —
  no el objeto `Money` anidado de la guideline.
- **Paginación:** cursor-based en todas las colecciones (no estaba en la spec para
  `/expenses`, la agrega la guideline).
- **Auth JWT sin dependencias extra:** JWK → clave pública vía `node:crypto` en vez de
  `jwks-rsa`/`jwk-to-pem` (evita `jose` ESM-only y una vulnerabilidad sin fix en `elliptic`).
- **Issuer de Keycloak fijo (`KC_HOSTNAME`):** si no, el `iss` del JWT depende del host con el
  que se pidió el token (`localhost` vs `keycloak` en la red de compose) y la validación
  rompe según quién llame. Por eso `KEYCLOAK_ISSUER_URL` (issuer esperado) y
  `KEYCLOAK_JWKS_URI` (a dónde pedir las claves) son variables separadas.
- **`POST /groups/:id/invite` no está implementado** — la spec lo marca como decisión
  pendiente (invitación por email vs. lookup directo).
- **`isRecurring`/`installments` no están en el body de `POST /expenses`** todavía — se
  resuelven junto con el módulo `recurring-expenses` (fase 2).
- **Permisos de escritura en `expenses`:** cualquier miembro del grupo puede editar/borrar,
  no solo quien lo creó (la spec no lo restringe explícitamente).
