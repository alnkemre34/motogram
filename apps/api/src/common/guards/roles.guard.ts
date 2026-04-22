// Spec 5.4 - Admin paneli rol tabanli erisim kontrolu.
// JwtAuthGuard'dan SONRA calisir; req.user.role alanini kontrol eder.
// Metadata'da rol yoksa (decorator kullanilmamis) izin verir.
// Rol USER olanlar ADMIN/MODERATOR gerektiren endpoint'lere 403 alir.
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCodes, type UserRole } from '@motogram/shared';
import type { Request } from 'express';

import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException({
        error: 'authentication_required',
        code: ErrorCodes.UNAUTHORIZED,
      });
    }

    if (!required.includes(user.role)) {
      throw new ForbiddenException({
        error: 'insufficient_role',
        code: ErrorCodes.FORBIDDEN,
        message: `Required role: ${required.join(' | ')}, got: ${user.role}`,
      });
    }

    return true;
  }
}
