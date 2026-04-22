// Spec 5.4 - Admin paneli rol tabanli yetkilendirme metadata anahtari.
// RolesGuard bu metadata'yi okuyarak ADMIN / MODERATOR kontrolu yapar.
import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@motogram/shared';

export const ROLES_KEY = 'motogram:required-roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
