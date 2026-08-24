import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ProblemJsonFilter } from './problem-json.filter';
import { Prisma } from '../../../generated/prisma/client';

function fakePrismaError(code: string): Prisma.PrismaClientKnownRequestError {
  const err = Object.create(
    Prisma.PrismaClientKnownRequestError.prototype,
  ) as Prisma.PrismaClientKnownRequestError;
  Object.assign(err, { code, message: 'fake prisma error' });
  return err;
}

function createMockHost(): {
  host: ArgumentsHost;
  response: {
    status: jest.Mock;
    contentType: jest.Mock;
    send: jest.Mock<unknown, [string]>;
  };
} {
  const response = {
    status: jest.fn().mockReturnThis(),
    contentType: jest.fn().mockReturnThis(),
    send: jest.fn<unknown, [string]>().mockReturnThis(),
  };
  const request = { method: 'GET', url: '/expenses/1' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('ProblemJsonFilter', () => {
  let filter: ProblemJsonFilter;

  beforeEach(() => {
    filter = new ProblemJsonFilter();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('mapea un HttpException simple a problem+json con el status/detail originales', () => {
    const { host, response } = createMockHost();
    filter.catch(new NotFoundException('expense_not_found'), host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.contentType).toHaveBeenCalledWith(
      'application/problem+json',
    );
    const body = JSON.parse(response.send.mock.calls[0][0]) as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({
      status: 404,
      detail: 'expense_not_found',
      instance: '/expenses/1',
    });
  });

  it('mapea un HttpException con array de mensajes (validación) a errors[] y un detail unido', () => {
    const { host, response } = createMockHost();
    filter.catch(
      new BadRequestException([
        'name should not be empty',
        'type must be valid',
      ]),
      host,
    );

    const body = JSON.parse(response.send.mock.calls[0][0]) as {
      errors: string[];
      detail: string;
    };
    expect(body.errors).toEqual([
      'name should not be empty',
      'type must be valid',
    ]);
    expect(body.detail).toBe('name should not be empty; type must be valid');
  });

  it('mapea P2002 (constraint única) a 409 Conflict', () => {
    const { host, response } = createMockHost();
    filter.catch(fakePrismaError('P2002'), host);
    expect(response.status).toHaveBeenCalledWith(409);
  });

  it('mapea P2025 (registro no encontrado) a 404 Not Found', () => {
    const { host, response } = createMockHost();
    filter.catch(fakePrismaError('P2025'), host);
    expect(response.status).toHaveBeenCalledWith(404);
  });

  it('mapea cualquier otro código de Prisma a 500 genérico', () => {
    const { host, response } = createMockHost();
    filter.catch(fakePrismaError('P2003'), host);
    expect(response.status).toHaveBeenCalledWith(500);
  });

  it('nunca expone el mensaje/stack real de un error no controlado', () => {
    const { host, response } = createMockHost();
    filter.catch(new Error('leaked secret connection string'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    const body = JSON.parse(response.send.mock.calls[0][0]) as {
      detail: string;
    };
    expect(body.detail).not.toContain('leaked secret connection string');
  });

  it('loguea (server-side) los errores 500, no los 4xx', () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { host: host404 } = createMockHost();
    filter.catch(new NotFoundException(), host404);
    expect(errorSpy).not.toHaveBeenCalled();

    const { host: host500 } = createMockHost();
    filter.catch(new Error('boom'), host500);
    expect(errorSpy).toHaveBeenCalled();
  });
});
