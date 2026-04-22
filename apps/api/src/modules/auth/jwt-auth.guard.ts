import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCodes } from '@motogram/shared';
import type { Request } from 'express';

import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

import { TokenService } from './token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = req.headers.authorization;
    if (!header || !header.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException({ error: 'missing_token', code: ErrorCodes.UNAUTHORIZED });
    }
    const token = header.slice(7).trim();

    try {
      const payload = await this.tokens.verifyAccess(token);
      if (payload.typ !== 'access') {
        throw new Error('wrong_token_type');
      }
      req.user = {
        userId: payload.sub,
        username: payload.username,
        role: payload.role ?? 'USER',
      };
      return true;
    } catch {
      throw new UnauthorizedException({ error: 'token_invalid', code: ErrorCodes.TOKEN_INVALID });
    }
  }
}
