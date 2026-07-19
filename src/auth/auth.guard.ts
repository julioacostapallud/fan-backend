import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!request.user) {
      throw new UnauthorizedException('No autenticado');
    }
    return request.user;
  },
);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthUser;
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token requerido');
    }

    const token = header.slice(7);
    const secret = this.config.get<string>('JWT_SECRET') || 'fan-bienal-dev-secret';

    try {
      const payload = jwt.verify(token, secret) as AuthUser & { sub?: string };
      request.user = {
        id: payload.id || payload.sub || '',
        username: payload.username,
        displayName: payload.displayName,
      };
      if (!request.user.id) {
        throw new UnauthorizedException('Token inválido');
      }
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
