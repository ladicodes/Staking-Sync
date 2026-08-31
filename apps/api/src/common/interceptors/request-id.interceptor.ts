import { randomUUID } from 'crypto';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

interface RequestWithId {
  headers: Record<string, string | string[] | undefined>;
  requestId?: string;
}

interface ResponseWithHeader {
  setHeader(name: string, value: string): void;
}

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const response = context.switchToHttp().getResponse<ResponseWithHeader>();
    const incoming = request.headers['x-request-id'];
    const requestId = Array.isArray(incoming) ? incoming[0] : incoming;
    request.requestId = requestId || randomUUID();
    response.setHeader('x-request-id', request.requestId);
    return next.handle();
  }
}
