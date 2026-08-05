import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/auth.guard';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  check() {
    return { status: 'ok', service: 'Fan! Bienal 2026 API' };
  }

  /** Ping liviano para medir latencia de red en el celular (sin auth ni DB). */
  @Public()
  @SkipThrottle()
  @Get('ping')
  @ApiOperation({ summary: 'Ping de conectividad (latencia)' })
  ping() {
    return { ok: true as const, t: Date.now() };
  }
}
