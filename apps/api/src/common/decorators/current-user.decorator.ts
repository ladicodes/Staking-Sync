import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtUser } from '../../auth/types/jwt-user.type';

interface RequestWithUser {
  user?: JwtUser;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtUser => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  if (!request.user) {
    throw new Error('Authenticated user was not attached to the request');
  }
  return request.user;
});
