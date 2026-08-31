import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { Response } from 'express';
import { ApiErrorDetail, ApiResponse } from '../interfaces/api-response.interface';

interface RequestWithId {
  requestId?: string;
}

interface ValidationResponse {
  message?: string | string[];
  error?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttpException ? exception.getResponse() : undefined;
    const body = this.formatPayload(payload, status);

    response.status(status).json({
      success: false,
      message: body.message,
      errors: body.errors,
      requestId: request.requestId
    } satisfies ApiResponse<never>);
  }

  private formatPayload(payload: string | object | undefined, status: number): { message: string; errors: ApiErrorDetail[] } {
    if (typeof payload === 'string') {
      return { message: payload, errors: [{ message: payload }] };
    }

    const body = (payload ?? {}) as ValidationResponse;
    if (Array.isArray(body.message)) {
      return {
        message: 'Validation failed',
        errors: body.message.map((message) => this.toErrorDetail(message))
      };
    }

    const message = body.message ?? (status === HttpStatus.INTERNAL_SERVER_ERROR ? 'Internal server error' : 'Request failed');
    return { message, errors: [{ message }] };
  }

  private toErrorDetail(message: string): ApiErrorDetail {
    const [field, ...rest] = message.split(' ');
    return {
      field: field || undefined,
      message: rest.length > 0 ? `${field} ${rest.join(' ')}` : message
    };
  }
}
