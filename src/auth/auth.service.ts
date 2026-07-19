import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import type { AuthUser } from './auth.guard';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const username = dto.username.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    const payload: AuthUser = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
    };

    const secret = this.config.get<string>('JWT_SECRET') || 'fan-bienal-dev-secret';
    const accessToken = jwt.sign(payload, secret, { expiresIn: '7d' });

    return {
      accessToken,
      user: payload,
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, displayName: true },
    });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    return user;
  }
}
