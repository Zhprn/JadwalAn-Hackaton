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

// Supabase pooler hanya mendukung IPv4
dns.setDefaultResultOrder('ipv4first');

const app = express();

app.use(
  cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const openapiSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'Jadwalan API', version: '1.0.0' },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
});

app.use('/reference', apiReference({ theme: 'deepSpace', content: openapiSpec }));

app.use('/api', apiRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {  
  console.log(`Server di http://localhost:${PORT}`);
  console.log(`Docs di http://localhost:${PORT}/reference`);
});
