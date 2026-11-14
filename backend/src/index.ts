import 'dotenv/config';
import dns from 'node:dns';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import swaggerJsdoc from 'swagger-jsdoc';
import { apiReference } from '@scalar/express-api-reference';
import apiRoutes from './routes';
import { errorMiddleware, notFoundMiddleware } from './lib/http';
import { startScheduler } from './jobs/scheduler';
import prisma from './lib/prisma';

// Supabase pooler hanya mendukung IPv4
dns.setDefaultResultOrder('ipv4first');

const app = express();

// Supaya req.ip benar saat di belakang proxy (Railway/Render/Nginx) → rate limiter per IP akurat.
app.set('trust proxy', 1);

app.use(
  cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
        'img-src': ["'self'", 'data:', 'https:'],
      },
    },
  }),
);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const openapiSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Jadwalan API',
      version: '1.0.0',
      description:
        'API rental PlayStation: booking, pembayaran QRIS (Midtrans), live chat dengan AI multi-agent (Gemini), CRM promo, dan dashboard. Semua jam dalam WIB.',
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        SlotInput: {
          type: 'object',
          required: ['stationId', 'date', 'startTime', 'durationHours'],
          properties: {
            stationId: { type: 'string', format: 'uuid' },
            date: { type: 'string', example: '2026-11-15', description: 'YYYY-MM-DD (WIB)' },
            startTime: { type: 'string', example: '16:00', description: 'HH:mm (WIB)' },
            durationHours: { type: 'integer', example: 2 },
            promoCode: { type: 'string', example: 'WEEKEND20' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
});

app.use('/reference', apiReference({ theme: 'deepSpace', content: openapiSpec }));
app.get('/openapi.json', (_req, res) => res.json(openapiSpec));

app.use('/api', apiRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`Server nyala di http://localhost:${PORT}`);
  console.log(`Docs di http://localhost:${PORT}/reference`);
  startScheduler();
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
