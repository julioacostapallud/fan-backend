import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { HelmetOptions } from 'helmet';

/**
 * Helmet defaults set Cross-Origin-Resource-Policy: same-origin,
 * which blocks browser reads from a different Vercel frontend origin.
 */
export const helmetOptions: HelmetOptions = {
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
};

export function buildCorsOptions(): CorsOptions {
  const raw = process.env.CORS_ORIGIN?.trim();

  // Reflect any origin when unset or "*" (dev / first deploy convenience).
  if (!raw || raw === '*') {
    return {
      origin: true,
      credentials: true,
      allowedHeaders: ['Content-Type', 'Idempotency-Key', 'Authorization'],
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    };
  }

  const allowed = raw.split(',').map((o) => o.trim()).filter(Boolean);

  return {
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean | string) => void,
    ) => {
      if (!requestOrigin) {
        callback(null, true);
        return;
      }
      if (allowed.includes(requestOrigin)) {
        callback(null, requestOrigin);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Idempotency-Key', 'Authorization'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  };
}
