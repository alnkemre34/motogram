import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { UserRole } from '@motogram/shared';
import type { Request } from 'express';

export interface AuthenticatedUser {
  userId: string;
  username: string;
  // Spec 5.4 - RolesGuard tarafindan okunur. Eski tokenlarda olmayabilir;
  // o durumda 'USER' kabul edilir (geriye donuk uyum).
  role: UserRole;
}

export const CurrentUser = createParamDecorator(
  (
    key: keyof AuthenticatedUser | 'id' | undefined,
    ctx: ExecutionContext,
  ): AuthenticatedUser | AuthenticatedUser[keyof AuthenticatedUser] => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user) {
      throw new Error('CurrentUser decorator used on an unauthenticated route');
    }
    if (key === undefined) {
      return user;
    }
    // JWT payload'da kullanici id genelde userId; route'larda @CurrentUser('id') sözdizimi yaygin.
    if (key === 'id') {
      return user.userId;
    }
    return user[key];
  },
);
