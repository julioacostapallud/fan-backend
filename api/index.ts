import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';

let cachedApp: INestApplication | undefined;
let cachedExpress: Express | undefined;

async function bootstrap(): Promise<Express> {
  if (cachedExpress) {
    return cachedExpress;
  }

  const expressApp = express();
  const maxBytes = Number(process.env.MAX_PROCESSED_IMAGE_BYTES ?? 409600);
  const bodyLimit = Math.max(maxBytes * 8, 5 * 1024 * 1024);

  expressApp.use(express.json({ limit: bodyLimit }));
  expressApp.use(express.urlencoded({ extended: true, limit: bodyLimit }));
  expressApp.use(helmet());

  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { bodyParser: false },
  );

  const corsOrigin = process.env.CORS_ORIGIN ?? '*';
  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Idempotency-Key', 'Authorization'],
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (process.env.ENABLE_SWAGGER === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Fan! Bienal 2026 API')
      .setDescription('API de registro de ventas')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.init();
  cachedApp = app;
  cachedExpress = expressApp;
  return expressApp;
}

export default async function handler(req: Request, res: Response) {
  const server = await bootstrap();
  return server(req, res);
}

// Keep reference to avoid unused warning in some bundlers
void cachedApp;
