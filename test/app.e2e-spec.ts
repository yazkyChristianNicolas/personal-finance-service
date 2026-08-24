import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { CaseConversionInterceptor } from '../src/common/interceptors/case-conversion.interceptor';
import { ProblemJsonFilter } from '../src/common/filters/problem-json.filter';

/**
 * Smoke test end-to-end: requiere `docker compose up -d api-db keycloak-db keycloak`
 * corriendo (usa el realm/testuser de keycloak/realm-export.json para obtener un JWT real).
 */
describe('App (e2e)', () => {
  let app: INestApplication<App>;
  const issuer =
    process.env.KEYCLOAK_ISSUER_URL ??
    'http://localhost:8080/realms/personal-finance';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new CaseConversionInterceptor());
    app.useGlobalFilters(new ProblemJsonFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health responde 200 sin auth', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('GET /groups sin token responde 401 application/problem+json', async () => {
    const response = await request(app.getHttpServer())
      .get('/groups')
      .expect(401);
    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect((response.body as { status: number }).status).toBe(401);
  });

  it('GET /groups con un JWT válido crea/devuelve el grupo Personal', async () => {
    const token = await getTestAccessToken(issuer);

    const response = await request(app.getHttpServer())
      .get('/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = response.body as { items: Array<Record<string, unknown>> };
    expect(body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Personal', is_default: true }),
      ]),
    );
  });
});

async function getTestAccessToken(issuer: string): Promise<string> {
  const response = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'personal-finance-dev-test',
      grant_type: 'password',
      username: 'testuser',
      password: 'testpassword',
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Could not obtain a test token from Keycloak (${response.status}). Is docker compose up?`,
    );
  }
  const body = (await response.json()) as { access_token: string };
  return body.access_token;
}
