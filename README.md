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

## Base de datos y migraciones

Prisma Migrate versiona el schema (equivalente a Flyway/Liquibase): cada cambio queda como
un `.sql` con timestamp en `prisma/migrations/`, commiteado a git — es el historial
controlado de cómo se armaron las tablas.

**Al levantar `docker compose up -d`, las migraciones pendientes se aplican solas.** Hay un
servicio `migrate` (mismo `Dockerfile`, target `migrate`) que corre `prisma migrate deploy`
una vez y termina; `api` tiene un `depends_on: migrate: condition: service_completed_successfully`,
así que nunca arranca contra un schema desactualizado — ni en un clone nuevo, ni en CI.
`migrate deploy` solo aplica lo que ya existe en `prisma/migrations/`; nunca crea ni resetea
nada, es seguro correrlo repetidas veces.

**Para cambiar el schema** (agregar una tabla/columna, etc.) durante desarrollo:

```bash
docker compose up -d api-db        # necesita la db levantada
# editar prisma/schema.prisma
npx prisma migrate dev --name describir_el_cambio
```

Esto genera el nuevo archivo en `prisma/migrations/`, lo aplica a la `api-db` local, y
regenera el Prisma Client. Commiteá el `.sql` generado junto con el cambio de código que lo
motivó — nunca edites un `.sql` de migración ya aplicado/commiteado a mano; si hace falta
corregir algo, es una migración nueva.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run start:dev` | API en watch mode |
| `npm run build` / `npm run lint` | build / lint |
| `npm run test` | unit tests |
| `npm run test:e2e` | smoke test end-to-end (requiere `api-db`+`keycloak` levantados) |

## Convenciones de diseño de API

Sigue el skill `backend/rest-api-guidelines` (basado en las guías de Zalando) salvo en
naming de métodos y paginación (ver más abajo, decisión explícita del proyecto): JSON en
snake_case en el wire (el código interno es camelCase — ver
`src/common/interceptors/case-conversion.interceptor.ts`), errores en
`application/problem+json`, etc.

### Naming de controllers/servicios

Todos los controllers (y sus servicios) siguen el mismo patrón, derivado del método HTTP y
si el recurso es singular o colección:

| HTTP | Ruta | Método |
|---|---|---|
| `POST` | `/recurso` | `create()` |
| `GET` | `/recurso/:id` | `findById()` |
| `GET` | `/recurso` | `search()` |
| `PATCH` | `/recurso/:id` | `patch()` |
| `PUT` | `/recurso/:id` | `update()` (no usado todavía — todos los updates son parciales) |
| `DELETE` | `/recurso/:id` | `delete()` |

### Paginación y `search`

Todo `search()` devuelve un `GenericSearchResponse` (offset-based, no cursor-based — ver
`src/common/pagination/pagination.util.ts`):

```json
{
  "data": [ /* objetos minificados */ ],
  "meta": {
    "current_page": 1,
    "total_pages": 3,
    "page_size": 20,
    "total_elements": 42
  }
}
```

Query params: `page` (1-indexed, default 1) y `size` (default 20, máx 100) — no `limit`/`cursor`.

`data` es un objeto **minificado**, distinto del que devuelve `findById` (donde existe). Por
ejemplo `GET /expenses` (search) no trae `splits`/`payment_method_id`/`created_at`; para el
objeto completo hay que pedir `GET /expenses/:id` (findById). Qué campos exactos va cada
`search()` es una decisión por revisar/ajustar caso a caso — están en
`src/*/dto/*-search-result.dto.ts` de cada módulo.

`created_at` se persiste siempre que se crea un recurso (`@default(now())` en
`prisma/schema.prisma`, para todos los modelos).

## Estructura

```
src/
  common/          guards (Keycloak JWT + API Key + compuesto), filtro de errores,
                   interceptor de casing, paginación offset-based compartida
                   (GenericSearchResponse)
  prisma/          PrismaService (driver adapter pg, Prisma 7)
  auth/            módulo global que expone los guards
  users/           sync de User desde el JWT (find-or-create on primer request)
  groups/          grupos + auto-creación del grupo "Personal"
  payment-methods/ medios de pago (CASH/DEBIT/CREDIT)
  expenses/        gastos + splits (EQUAL/PERCENTAGE/ROMANA) para grupos no-Personal
  api-keys/        API Keys para el futuro agente MCP (hash SHA-256, guard propio)
  health/          healthcheck sin auth
```

### Capas dentro de cada módulo

Cada módulo de negocio (`expenses/`, `groups/`, `payment-methods/`, `api-keys/`,
`users/`) sigue el skill `microservice-layered-architecture`, adaptado al layout
módulo-por-feature de NestJS:

```
expenses/
  expenses.controller.ts   # HTTP: guards, params, delega al service
  expenses.service.ts      # lógica de negocio; llama a su Repository y a los
                            # Services (no Repositories) de otros módulos
  expenses.repository.ts   # único lugar que importa PrismaService/generated/prisma
  expenses.mapper.ts       # estático: fila Prisma <-> Model <-> DTO de respuesta
  model/expense.model.ts   # entidad de dominio, desacoplada de Prisma
  dto/
    request/                # inputs (create/update/query)
    response/                # outputs (completo para findById, minificado para search)
```

Regla de oro: un Service nunca importa el Repository de otro módulo — si
necesita datos de otro recurso, llama al Service dueño de ese recurso (ej.
`ExpensesService` llama a `GroupsService.getMemberUserIds()` para calcular
splits, nunca a `GroupsRepository` directo).

## Decisiones de esta fase (por si hace falta revisarlas)

- **Casing:** wire format snake_case vía interceptor global; DTOs de query usan
  `@Expose({name: '...'})` porque `request.query` no es mutable de forma confiable en
  Express 5.
- **Dinero:** `amount` (centavos, `Int`) + `currency` planos en `Expense`, tal cual la spec —
  no el objeto `Money` anidado de la guideline.
- **Paginación offset-based (`page`/`size`) con `total_elements`, no cursor-based:** decisión
  explícita del proyecto, distinta de lo que recomienda la guideline (regla 160 prefiere
  cursor; regla 254 evita `total_count` por el costo del `COUNT(*)`). Con volumen alto esto
  puede pesar — si en algún momento hace falta cursor-based para alguna colección puntual,
  es un cambio localizado a ese `search()` y su query DTO.
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
