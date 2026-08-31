import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '../interfaces/api-response.interface';

interface RequestWithId {
  requestId?: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    return next.handle().pipe(
      map((value) => {
        if (this.isApiResponse(value)) {
          return { ...value, requestId: request.requestId };
        }
        return {
          success: true,
          message: 'Request completed successfully',
          data: value,
          requestId: request.requestId
        };
      })
    );
  }

  private isApiResponse(value: T | ApiResponse<T>): value is ApiResponse<T> {
    return Boolean(value && typeof value === 'object' && 'success' in value && 'message' in value);
  }
}
