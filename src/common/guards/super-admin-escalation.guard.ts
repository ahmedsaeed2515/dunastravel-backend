import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { AuthenticatedUser } from '../types';

interface RequestWithUserAndBody extends Request {
  user?: AuthenticatedUser;
  body: {
    role?: string;
  };
}

@Injectable()
export class SuperAdminEscalationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUserAndBody>();
    const user = request.user;
    const body = request.body;

    if (
      body &&
      body.role === UserRole.SUPER_ADMIN &&
      user?.role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN can create or grant a SUPER_ADMIN role',
      );
    }

    return true;
  }
}
