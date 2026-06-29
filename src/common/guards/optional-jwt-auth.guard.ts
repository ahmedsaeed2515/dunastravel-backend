import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
      return true;
    } catch {
      return true;
    }
  }

  handleRequest<TUser = any>(err: any, user: any): TUser {
    if (user) {
      return user as TUser;
    }
    return null as unknown as TUser;
  }
}
