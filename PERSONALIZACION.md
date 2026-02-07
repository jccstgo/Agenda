# 🎨 Guía de Personalización - Agenda Digital

Esta guía te ayudará a personalizar la aplicación según tus necesidades específicas.

## 🏷️ Cambiar el Logo

### Logo del Login
Edita: `client/src/pages/Login.tsx`

Busca la línea 28-33 y reemplaza el SVG con tu logo:

```tsx
<div className="logo-placeholder">
  <img src="/ruta/a/tu/logo.png" alt="Logo" width="80" height="80" />
</div>
```

### Logo del Header
Edita: `client/src/components/Header.tsx`

Busca la línea 17-22 y reemplaza el SVG:

```tsx
<div className="logo-placeholder">
  <img src="/ruta/a/tu/logo.png" alt="Logo" width="48" height="48" />
</div>
```

## 🎨 Cambiar Colores Institucionales

Edita: `client/src/styles/index.css`

Modifica las variables CSS (líneas 26-31):

```css
:root {
  --color-primary: #2D4A22;      /* Tu color primario */
  --color-secondary: #C4A035;    /* Tu color secundario */
  --color-white: #ffffff;
  --color-light-gray: #f8f9fa;
  --color-gray: #e0e0e0;
  --color-dark-gray: #666;
}
```

Los colores se aplicarán automáticamente en toda la aplicación.

## 📑 Modificar las Pestañas

### Opción 1: Archivo de Configuración

Edita: `server/src/config/tabs.ts`

```typescript
export const TABS_CONFIG: Omit<TabConfig, 'id'>[] = [
  { name: 'Tu Pestaña 1', order: 1 },
  { name: 'Tu Pestaña 2', order: 2 },
  { name: 'Tu Pestaña 3', order: 3 },
  // ... más pestañas
];
```

Luego:
1. Elimina la base de datos: `rm server/database.sqlite`
2. Reinicia el servidor: `npm run dev`

### Opción 2: Directamente en la Base de Datos

Edita: `server/src/config/database.ts`

Busca la sección donde se insertan las pestañas (línea 49-57) y modifica:

```typescript
const tabs = [
  { name: 'Tu Nueva Pestaña', order: 1 },
  { name: 'Otra Pestaña', order: 2 },
  // ... más pestañas
];
```

## 👤 Cambiar Usuarios por Defecto

Edita: `server/src/config/database.ts`

Busca la línea 42-44 y modifica:

```typescript
db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)')
  .run('tu_usuario_admin', adminPassword, 'admin');

db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)')
  .run('tu_usuario_lector', readerPassword, 'reader');
```

Para cambiar las contraseñas, modifica las líneas 40-41:

```typescript
const adminPassword = bcrypt.hashSync('tu_nueva_contraseña', 10);
const readerPassword = bcrypt.hashSync('otra_contraseña', 10);
```

## 🔒 Cambiar Secret de JWT

Edita: `server/.env`

```
JWT_SECRET=tu-secreto-super-seguro-aqui-2024
```

**IMPORTANTE**: Usa un secreto único y complejo en producción.

## 📏 Ajustar Límite de Tamaño de Archivo

Edita: `server/src/middleware/upload.ts`

Busca la línea 39-41 y modifica:

```typescript
limits: {
  fileSize: 100 * 1024 * 1024 // 100MB en lugar de 50MB
}
```

## 🌐 Cambiar Puertos

### Puerto del Backend
Edita: `server/.env`

```
PORT=3001  # Cambia a tu puerto deseado
```

### Puerto del Frontend
Edita: `client/vite.config.ts`

```typescript
server: {
  port: 3000,  // Cambia a tu puerto deseado
  proxy: {
    '/api': {
      target: 'http://localhost:3001',  // Apunta al puerto del backend
      changeOrigin: true
    }
  }
}
```

## 📝 Personalizar Textos de la Aplicación

### Título Principal
Edita: `client/index.html` (línea 7)

```html
<title>Tu Título Personalizado</title>
```

### Nombre de la Aplicación en Header
Edita: `client/src/components/Header.tsx` (líneas 24-25)

```tsx
<h1>Tu Nombre de Aplicación</h1>
<p>Tu Subtítulo Aquí</p>
```

### Textos del Login
Edita: `client/src/pages/Login.tsx`

Busca las líneas 25-27 para el título:

```tsx
<h1>Tu Título de Login</h1>
<p>Tu Descripción</p>
```

## 🗄️ Cambiar Ubicación de la Base de Datos

Edita: `server/.env`

```
DB_PATH=/ruta/completa/a/tu/base/de/datos.sqlite
```

O usa una ruta relativa:

```
DB_PATH=./mi-base-datos.sqlite
```

## 📁 Cambiar Ubicación de Uploads

Edita: `server/.env`

```
UPLOADS_DIR=/ruta/completa/a/carpeta/uploads
```

O usa una ruta relativa:

```
UPLOADS_DIR=../mis-documentos
```

## 🎭 Agregar Más Roles de Usuario

### 1. Actualizar el tipo de usuario
Edita: `client/src/types/index.ts`

```typescript
export interface User {
  id: number;
  username: string;
  role: 'admin' | 'reader' | 'editor';  // Agregar nuevo rol
}
```

### 2. Actualizar la base de datos
Edita: `server/src/config/database.ts` (línea 19)

```sql
role TEXT NOT NULL CHECK(role IN ('admin', 'reader', 'editor'))
```

### 3. Crear middleware específico
Edita: `server/src/middleware/auth.ts`

```typescript
export const requireEditor = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'editor' && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
};
```

## 🔧 Configuración Avanzada

### Agregar Variables de Entorno

1. Edita: `.env.example` y `server/.env`
2. Agrega tu variable: `MI_VARIABLE=valor`
3. Úsala en el código: `process.env.MI_VARIABLE`

### Personalizar Tiempo de Expiración del Token

Edita: `server/src/controllers/authController.ts` (línea 31)

```typescript
const token = jwt.sign(
  { id: user.id, username: user.username, role: user.role },
  secret,
  { expiresIn: '7d' }  // 7 días en lugar de 24h
);
```

## 📱 Ajustar para Diferentes Tamaños de Pantalla

### Cambiar Breakpoints
Edita los archivos CSS individuales y busca `@media`:

```css
/* Para tablets más pequeñas */
@media (max-width: 800px) {
  /* tus estilos */
}

/* Para tablets más grandes */
@media (min-width: 1280px) {
  /* tus estilos */
}
```

### Ajustar Tamaño de Fuente Base
Edita: `client/src/styles/index.css` (líneas 32-44)

```css
@media (min-width: 768px) {
  html {
    font-size: 18px;  /* Aumentar para pantallas más grandes */
  }
}
```

## 🚀 Optimización para Producción

### 1. Cambiar a modo producción
Edita: `server/.env`

```
NODE_ENV=production
```

### 2. Habilitar HTTPS

Necesitarás un certificado SSL. Edita `server/src/server.ts`:

```typescript
import https from 'https';
import fs from 'fs';

const options = {
  key: fs.readFileSync('path/to/private.key'),
  cert: fs.readFileSync('path/to/certificate.crt')
};

https.createServer(options, app).listen(443);
```

## 📚 Recursos Adicionales

- [React Documentation](https://react.dev)
- [Express Documentation](https://expressjs.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [react-pdf Documentation](https://github.com/wojtekmaj/react-pdf)

---

**💡 Tip**: Después de cada cambio importante, reinicia el servidor para que se apliquen los cambios.
