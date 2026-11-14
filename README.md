Kamu adalah senior full-stack engineer. Bantu saya men-setup project baru dari nol dengan struktur, package, versi, dan konfigurasi yang SAMA PERSIS seperti spesifikasi di bawah. Jangan mengganti library, jangan menurunkan/menaikkan versi, dan jangan menambah library lain kecuali saya minta.

Yang saya butuhkan darimu:
1. Perintah terminal langkah demi langkah (Windows, bisa jalan di Git Bash / PowerShell) untuk membuat semua folder dan meng-install semua package.
2. Isi lengkap setiap file konfigurasi yang disebut di bawah.
3. File awal (boilerplate) minimal supaya `npm run dev` di ketiga app langsung jalan tanpa error.
4. Checklist verifikasi di akhir.

Jawab dalam bahasa Indonesia. Kerjakan bertahap: Backend dulu, lalu Frontend Dashboard, lalu Frontend Client. Kalau ada yang ambigu, tanyakan dulu sebelum menebak.

---

## 1. Struktur monorepo

```
<nama-project>/
├── backend/                 # REST API (Express + Prisma + PostgreSQL)
│   ├── prisma/schema.prisma
│   ├── src/
│   │   ├── index.ts         # entry point
│   │   ├── routes/          # index.ts menggabungkan semua router di bawah /api
│   │   ├── controllers/
│   │   └── middlewares/     # authMiddleware.ts, rateLimiter.ts
│   ├── Dockerfile
│   ├── .env / .env.example
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── dashboard/           # panel admin (React + Vite)
    └── client/              # aplikasi pelanggan (React + Vite) — setup identik dengan dashboard
```

Tidak ada root package.json / workspace. Masing-masing dari 3 folder app (`backend`, `frontend/dashboard`, `frontend/client`) punya `package.json` dan `node_modules` sendiri, dijalankan terpisah. Gunakan npm (bukan yarn/pnpm). Node.js 20+.

---

## 2. BACKEND (`backend/`)

### package.json
```json
{
  "name": "<nama-project>-backend",
  "version": "1.0.0",
  "main": "index.js",
  "type": "commonjs",
  "scripts": {
    "dev": "nodemon --watch src --ext ts --exec \"tsx src/index.ts\"",
    "build": "tsc",
    "start": "node dist/index.js",
    "postinstall": "prisma generate",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "lint": "eslint .",
    "format": "prettier --write ."
  },
  "dependencies": {
    "@google/genai": "^2.31.0",
    "@google/generative-ai": "^0.24.1",
    "@prisma/adapter-pg": "^7.10.1",
    "@prisma/client": "^6.19.3",
    "@scalar/express-api-reference": "^0.10.31",
    "@sparticuz/chromium": "^147.0.0",
    "bcrypt": "^6.0.0",
    "compression": "^1.8.2",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.6",
    "dotenv": "^18.0.9",
    "ejs": "^7.0.2",
    "exceljs": "^4.4.0",
    "express": "^5.3.0",
    "helmet": "^8.3.0",
    "jsonwebtoken": "^9.0.3",
    "midtrans-client": "^1.4.3",
    "multer": "^2.5.0",
    "pg": "^8.23.1",
    "pino": "^10.4.0",
    "pino-http": "^11.0.0",
    "pino-pretty": "^13.2.0",
    "puppeteer": "^25.16.0",
    "puppeteer-core": "^25.16.0",
    "swagger-jsdoc": "^6.3.0",
    "zod": "^4.6.7"
  },
  "devDependencies": {
    "@types/bcrypt": "^6.0.0",
    "@types/compression": "^1.8.1",
    "@types/cookie-parser": "^1.4.10",
    "@types/cors": "^2.8.19",
    "@types/ejs": "^3.1.5",
    "@types/express": "^5.0.6",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/midtrans-client": "^1.4.0",
    "@types/multer": "^2.3.0",
    "@types/node": "^26.6.5",
    "@types/pg": "^8.23.1",
    "@types/swagger-jsdoc": "^6.0.4",
    "nodemon": "^3.1.14",
    "prisma": "^6.19.3",
    "ts-node": "^10.9.2",
    "tsx": "^4.23.15",
    "typescript": "^7.0.2"
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "rootDir": "./src",
    "outDir": "./dist",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### .env.example
```
DATABASE_URL=        # Postgres (Supabase transaction pooler, port 6543)
DIRECT_URL=          # Postgres (Supabase session pooler, untuk migrasi)
GEMINI_API_KEY=
JWT_SECRET=
JWT_REFRESH_SECRET=
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false
PORT=4000
```

### prisma/schema.prisma (bagian atas)
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```
Buatkan satu model contoh `User` (id uuid, name, email unique, password, refreshToken String? @db.Text, role enum ADMIN/CUSTOMER default CUSTOMER, createdAt, updatedAt) agar `prisma generate` dan `prisma migrate dev` bisa dites.

### src/index.ts — pola yang harus diikuti
- `import 'dotenv/config'` di baris pertama.
- `dns.setDefaultResultOrder('ipv4first')` (Supabase pooler hanya IPv4).
- Middleware berurutan: `cors` (origin `*`, credentials true, methods GET/POST/PUT/DELETE/OPTIONS, allowedHeaders Content-Type & Authorization) → `helmet` dengan CSP default ditambah `script-src` `'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com` dan `img-src` `'self' data: https:` → `compression()` → `cookieParser()` → `express.json()` → `express.urlencoded({ extended: true })`.
- Dokumentasi API: `swagger-jsdoc` (openapi 3.0.0, securityScheme `bearerAuth` JWT, `apis: ['./src/routes/*.ts']`) lalu disajikan dengan `@scalar/express-api-reference` di `/reference` dengan `theme: 'deepSpace'`.
- Semua route di-mount di `app.use('/api', apiRoutes)`, di mana `src/routes/index.ts` adalah `Router()` yang memanggil `router.use('/auth', authRoutes)` dst.
- Setiap endpoint di file route diberi komentar JSDoc `@openapi`.
- `PORT = process.env.PORT || 4000`, log "Server nyala di http://localhost:PORT" dan "Docs di http://localhost:PORT/reference".

### Pola kode backend lain
- Controller: `async (req: Request, res: Response): Promise<any>`, validasi body dengan `zod` (`schema.parse`), tangkap `ZodError` → 400 `{ error: error.issues }`, error lain → 500 `{ error: message }`. Respons sukses `{ success: true, data }`.
- `PrismaClient` dibuat per file controller: `const prisma = new PrismaClient()`.
- `middlewares/authMiddleware.ts`: `verifyToken` membaca header `Authorization: Bearer <token>`, verifikasi `jsonwebtoken` dengan `JWT_SECRET`, menolak token yang ada di `tokenBlacklist` (Set in-memory, diisi saat logout), interface `AuthRequest extends Request { user?: any }`.
- `middlewares/rateLimiter.ts`: rate limiter login in-memory per IP (Map), kunci 15 menit setelah 5 kali gagal; ekspor `loginRateLimiter`, `recordFailedLogin(ip)`, `resetLoginAttempts(ip)`.
- Password di-hash dengan `bcrypt`. Access token + refresh token (refresh token disimpan di kolom `refreshToken`).
- AI: `@google/generative-ai` → `new GoogleGenerativeAI(process.env.GEMINI_API_KEY)`, `getGenerativeModel({ model: 'gemini-3.5-flash-lite' })`.
- Pembayaran: `midtrans-client` `CoreApi` (QRIS) + endpoint webhook.

### Dockerfile
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
```

---

## 3. FRONTEND DASHBOARD (`frontend/dashboard/`)

Stack: React 19 + Vite 7 + TypeScript 5.9 + TanStack Router (file-based routing) + TanStack Query + Tailwind CSS v4 (plugin Vite, TANPA tailwind.config.js) + shadcn/ui (style new-york) + lucide-react + sonner.

Buat dengan `npm create vite@latest dashboard -- --template react-ts`, lalu ganti package.json menjadi:

### package.json
```json
{
  "name": "dashboard",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@radix-ui/react-alert-dialog": "^1.1.15",
    "@radix-ui/react-checkbox": "^1.3.3",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-label": "^2.1.7",
    "@radix-ui/react-popover": "^1.1.15",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-separator": "^1.1.7",
    "@radix-ui/react-slot": "^1.2.3",
    "@radix-ui/react-tooltip": "^1.2.8",
    "@tailwindcss/vite": "^4.1.14",
    "@tanstack/react-query": "^5.90.5",
    "@tanstack/react-router": "^1.133.13",
    "@tanstack/react-router-devtools": "^1.133.13",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "jspdf": "^4.2.1",
    "jspdf-autotable": "^5.0.9",
    "lucide-react": "^0.546.0",
    "next-themes": "^0.4.6",
    "novel": "^1.0.2",
    "qrcode.react": "^4.2.0",
    "react": "^19.1.1",
    "react-day-picker": "^9.11.1",
    "react-dom": "^19.1.1",
    "react-qr-code": "^2.2.0",
    "recharts": "^3.10.1",
    "socket.io-client": "^4.8.3",
    "sonner": "^1.7.4",
    "sweetalert2": "^11.26.25",
    "tailwind-merge": "^3.3.1",
    "tailwindcss": "^4.1.14",
    "xss": "^1.0.15"
  },
  "devDependencies": {
    "@eslint/js": "^9.36.0",
    "@tanstack/eslint-plugin-query": "^5.91.2",
    "@tanstack/router-devtools": "^1.133.13",
    "@tanstack/router-plugin": "^1.133.13",
    "@types/node": "^24.8.1",
    "@types/react": "^19.1.16",
    "@types/react-dom": "^19.1.9",
    "@vitejs/plugin-react": "^5.0.4",
    "eslint": "^9.36.0",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.22",
    "globals": "^16.4.0",
    "tw-animate-css": "^1.4.0",
    "typescript": "~5.9.3",
    "typescript-eslint": "^8.45.0",
    "vite": "^7.1.7"
  }
}
```

### vite.config.ts
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }), // HARUS sebelum react()
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

### tsconfig.json
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

### tsconfig.app.json
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "types": ["vite/client"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

### tsconfig.node.json
Sama seperti bawaan template Vite: target/lib `ES2023`, `types: ["node"]`, `moduleResolution: "bundler"`, `noEmit: true`, opsi linting strict yang sama seperti di atas, `include: ["vite.config.ts"]`.

### eslint.config.js
Flat config: `globalIgnores(['dist'])`, untuk `**/*.{ts,tsx}` extends `js.configs.recommended`, `tseslint.configs.recommended`, `reactHooks.configs['recommended-latest']`, `reactRefresh.configs.vite`; `languageOptions: { ecmaVersion: 2020, globals: globals.browser }`.

### components.json (shadcn/ui)
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "registries": {}
}
```
Lalu tambahkan komponen shadcn ini: `alert-dialog button calendar card checkbox dialog dropdown-menu input label popover select separator sheet sidebar skeleton sonner table textarea tooltip` (perintah: `npx shadcn@latest add ...`).

### src/index.css
- Baris paling atas: import Google Font **Plus Jakarta Sans**, lalu `@import "tailwindcss";` dan `@import "tw-animate-css";`.
- `@font-face` untuk font lokal `runestars` dari `/fonts/runestars.ttf` (taruh di `public/fonts/`).
- `@custom-variant dark (&:is(.dark *));`
- Blok `@theme inline` berisi `--font-jakarta`, `--font-runestars`, variabel radius, dan semua token warna shadcn (`--color-background`, `--color-primary`, …, `--color-sidebar-*`, `--color-chart-1..5`).
- `:root` dan `.dark` dengan nilai default shadcn base color neutral (format `oklch`), `--radius: 0.625rem`.
- `@layer base` → body memakai font Plus Jakarta Sans.

### Struktur `src/`
```
src/
├── main.tsx            # createRoot + <StrictMode><App/></StrictMode>
├── App.tsx             # provider: AuthProvider > QueryClientProvider > RouterProvider, plus <Toaster richColors closeButton /> dari sonner
├── auth.tsx            # AuthContext (isAuthenticated, user, login, logout) berbasis localStorage "accessToken" & "user-data"
├── index.css
├── routeTree.gen.ts    # DIBUAT OTOMATIS oleh plugin, jangan diedit
├── routes/
│   ├── __root.tsx      # createRootRouteWithContext<{ auth: AuthState }>(), render <Outlet/> + <TanStackRouterDevtools/>
│   ├── index.tsx       # redirect ke /dashboard
│   ├── login.tsx
│   ├── _authenticated.tsx            # layout route: beforeLoad cek localStorage accessToken, kalau kosong redirect ke /login
│   └── _authenticated/dashboard/index.tsx
├── components/
│   ├── ui/             # komponen shadcn
│   └── layout/dashboard-layout.tsx   # sidebar + topbar + <Outlet/>
├── services/auth.service.ts          # pemanggilan API auth
├── hooks/use-mobile.ts
└── lib/
    ├── api-client.ts   # wrapper fetch
    ├── query-client.ts
    ├── utils.ts        # cn() = twMerge(clsx(...)) + formatDateIndo() (Intl id-ID, timeZone Asia/Jakarta, akhiran " WIB")
    └── xss-filter.ts   # sanitasi HTML dengan library "xss" (whitelist tag rich-text)
```

### App.tsx
```tsx
const router = createRouter({ routeTree, context: { auth: undefined! } });
declare module "@tanstack/react-router" { interface Register { router: typeof router } }
function InnerApp() { const auth = useAuth(); return <RouterProvider router={router} context={{ auth }} />; }
// App: <AuthProvider><QueryClientProvider client={queryClient}><InnerApp/></QueryClientProvider><Toaster richColors closeButton/></AuthProvider>
```

### lib/query-client.ts
QueryClient dengan `staleTime: 5 * 60 * 1000`, `refetchOnWindowFocus: false`, `retry`: jangan retry untuk error status 4xx, selain itu maksimal 2 kali; mutations `retry: 0`.

### lib/api-client.ts
- `API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api"`.
- Tipe `ApiResponse<TData, TMeta> = { statusCode, message, data, meta? }` dan class `ApiError extends Error { statusCode, details }`.
- Fungsi `apiFetch` otomatis menambahkan header `Authorization: Bearer <localStorage.accessToken>`, set `Content-Type: application/json` kecuali body FormData, parse JSON, lempar `ApiError` dengan `rawPayload.error` jika tidak ok, dan ambil `rawPayload.data` jika ada.
- Ekspor `apiClient = { get, post, put, patch, delete }`.

### .env
```
VITE_API_BASE_URL=http://localhost:4000/api
```

### vercel.json (deploy SPA)
Rewrite semua path `/(.*)` ke `/index.html`, dan header keamanan: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.

---

## 4. FRONTEND CLIENT (`frontend/client/`)

Setup-nya IDENTIK dengan dashboard (package.json, vite.config.ts, semua tsconfig, eslint, components.json, index.css, struktur lib/, vercel.json, .env), dengan perbedaan:
- Tidak memakai `jspdf` dan `jspdf-autotable` (hapus dari dependencies).
- Routing tanpa layout `_authenticated`; `__root.tsx` berisi navbar atas (logo + menu) dan tombol chat AI melayang, lalu `<Outlet/>`.
- Jalankan di port berbeda dari dashboard saat development (mis. `npx vite --port 5174`).

---

## 5. Checklist verifikasi
Berikan perintah untuk mengecek:
- `cd backend && npm install && npm run dev` → server jalan di port 4000 dan `/reference` menampilkan dokumentasi API.
- `npx prisma migrate dev --name init` berhasil.
- `cd frontend/dashboard && npm install && npm run dev` → halaman muncul, `routeTree.gen.ts` terbentuk otomatis, alias `@/` berfungsi, kelas Tailwind teraplikasi.
- Sama untuk `frontend/client`.
- `npm run build` dan `npm run lint` lolos di kedua frontend.
