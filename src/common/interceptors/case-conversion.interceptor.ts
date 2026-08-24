import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { camelToSnakeDeep, snakeToCamelDeep } from '../case/case-convert.util';

/**
 * Traduce el wire format snake_case (regla 118 de la guideline) al camelCase idiomático
 * de TS/Nest, y viceversa en la respuesta.
 *
 * Solo toca `request.body`: en Express 5 `request.query` es un getter derivado del parseo
 * de la URL y reasignarlo se ignora en silencio, así que los query params snake_case se
 * resuelven con `@Expose({ name: '...' })` en los DTOs de query, no acá.
 */
@Injectable()
export class CaseConversionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.body && typeof request.body === 'object') {
      request.body = snakeToCamelDeep(request.body);
    }

    return next.handle().pipe(map((data) => camelToSnakeDeep(data)));
  }
}
