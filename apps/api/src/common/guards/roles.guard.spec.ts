// Spec 5.4 - RolesGuard testleri.
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from './roles.guard';

function ctx(user: { role: string } | undefined) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as never;
}

describe('RolesGuard', () => {
  function guardWith(required: string[] | undefined) {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);
    return new RolesGuard(reflector);
  }

  it('allows when no role requirement defined', () => {
    const guard = guardWith(undefined);
    expect(guard.canActivate(ctx({ role: 'USER' }))).toBe(true);
  });

  it('throws when user missing', () => {
    const guard = guardWith(['ADMIN']);
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });

  it('allows when user role matches', () => {
    const guard = guardWith(['ADMIN', 'MODERATOR']);
    expect(guard.canActivate(ctx({ role: 'ADMIN' }))).toBe(true);
    expect(guard.canActivate(ctx({ role: 'MODERATOR' }))).toBe(true);
  });

  it('rejects USER when ADMIN required', () => {
    const guard = guardWith(['ADMIN']);
    expect(() => guard.canActivate(ctx({ role: 'USER' }))).toThrow(ForbiddenException);
  });

  it('rejects MODERATOR when only ADMIN required', () => {
    const guard = guardWith(['ADMIN']);
    expect(() => guard.canActivate(ctx({ role: 'MODERATOR' }))).toThrow(ForbiddenException);
  });
});
