import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '../../../generated/prisma/client';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  errors?: string[];
}

const PROBLEM_BASE_URI = 'https://errors.personal-finance-service.internal';

/**
 * Filtro global de errores -> application/problem+json (RFC 7807, regla 176/177 de la
 * guideline). Nunca devuelve stack traces ni mensajes internos de errores no controlados;
 * esos se loguean server-side y el cliente recibe un detail genérico.
 */
@Catch()
export class ProblemJsonFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const problem = this.toProblem(exception, request.url);

    if (problem.status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${problem.status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response
      .status(problem.status)
      .contentType('application/problem+json')
      .send(JSON.stringify(problem));
  }

  private toProblem(exception: unknown, instance: string): ProblemDetails {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception, instance);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaError(exception, instance);
    }

    return {
      type: `${PROBLEM_BASE_URI}/internal`,
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'An unexpected error occurred. Please retry or contact support.',
      instance,
    };
  }

  private fromHttpException(
    exception: HttpException,
    instance: string,
  ): ProblemDetails {
    const status = exception.getStatus();
    const body = exception.getResponse();
    const rawMessage: unknown =
      typeof body === 'string'
        ? body
        : ((body as Record<string, unknown> | undefined)?.message ??
          exception.message);

    const errors = Array.isArray(rawMessage)
      ? rawMessage.map((m) => (typeof m === 'string' ? m : JSON.stringify(m)))
      : undefined;
    const detail = errors
      ? errors.join('; ')
      : typeof rawMessage === 'string'
        ? rawMessage
        : exception.message;

    return {
      type: `${PROBLEM_BASE_URI}/${slug(exception.constructor.name)}`,
      title: humanize(exception.constructor.name),
      status,
      detail,
      instance,
      ...(errors ? { errors } : {}),
    };
  }

  private fromPrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
    instance: string,
  ): ProblemDetails {
    switch (exception.code) {
      case 'P2002':
        return {
          type: `${PROBLEM_BASE_URI}/conflict`,
          title: 'Conflict',
          status: HttpStatus.CONFLICT,
          detail: 'A resource with the same unique field already exists.',
          instance,
        };
      case 'P2025':
        return {
          type: `${PROBLEM_BASE_URI}/not-found`,
          title: 'Not Found',
          status: HttpStatus.NOT_FOUND,
          detail: 'The requested resource does not exist.',
          instance,
        };
      default:
        return {
          type: `${PROBLEM_BASE_URI}/internal`,
          title: 'Internal Server Error',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          detail:
            'An unexpected error occurred. Please retry or contact support.',
          instance,
        };
    }
  }
}

function slug(exceptionClassName: string): string {
  return humanize(exceptionClassName).toLowerCase().replace(/\s+/g, '-');
}

function humanize(exceptionClassName: string): string {
  return exceptionClassName
    .replace(/Exception$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
}
