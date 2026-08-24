import { of } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { CaseConversionInterceptor } from './case-conversion.interceptor';

function createContext(body?: unknown): {
  context: ExecutionContext;
  request: { body?: unknown };
} {
  const request: { body?: unknown } = { body };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

function handlerReturning(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

describe('CaseConversionInterceptor', () => {
  let interceptor: CaseConversionInterceptor;

  beforeEach(() => {
    interceptor = new CaseConversionInterceptor();
  });

  it('convierte el body entrante de snake_case a camelCase antes de continuar', (done) => {
    const { context, request } = createContext({
      group_id: 'g1',
      payment_method_id: 'pm1',
    });

    interceptor.intercept(context, handlerReturning({})).subscribe(() => {
      expect(request.body).toEqual({ groupId: 'g1', paymentMethodId: 'pm1' });
      done();
    });
  });

  it('no toca el body si no es un objeto', (done) => {
    const { context, request } = createContext(undefined);

    interceptor.intercept(context, handlerReturning({})).subscribe(() => {
      expect(request.body).toBeUndefined();
      done();
    });
  });

  it('convierte la respuesta saliente de camelCase a snake_case', (done) => {
    const { context } = createContext({});

    interceptor
      .intercept(context, handlerReturning({ isDefault: true, createdAt: 'x' }))
      .subscribe((result) => {
        expect(result).toEqual({ is_default: true, created_at: 'x' });
        done();
      });
  });
});
