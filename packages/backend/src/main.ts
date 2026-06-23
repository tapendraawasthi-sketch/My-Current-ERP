import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import { Logger } from '@nestjs/common';
import * as pino from 'pino-http';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  
  // Security headers
  app.use(helmet());
  
  // Compression
  app.use(compression());
  
  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'https://busy.vercel.app',
    credentials: true,
  });
  
  // Logging with pino
  app.use(pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino/file',
      options: { destination: '/dev/stdout' }, // Log to stdout (Render requirement)
    },
  }));
  
  // Health check endpoint (required by Render)
  app.get('/api/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0'); // Bind to 0.0.0.0 (Render requirement)
  
  logger.log(`✅ Application listening on port ${port}`);
  logger.log(`📊 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  logger.log(`🔴 Redis: ${process.env.REDIS_URL ? 'Connected' : 'Not configured'}`);
}

bootstrap().catch((error) => {
  console.error('❌ Bootstrap failed:', error);
  process.exit(1);
});
