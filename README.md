# 📱 Agenda Digital

Aplicación web completa de agenda digital optimizada para tabletas, con sistema de gestión de documentos PDF, autenticación de usuarios y visualización embebida de archivos.

## 🎯 Características

- **Sistema de Autenticación JWT**: Login seguro con roles de administrador y lector
- **Gestión de Documentos PDF**: Subir, visualizar y eliminar archivos PDF organizados por temas
- **Visor PDF Embebido**: Visualización directa en la aplicación con controles de zoom y navegación
- **Interfaz Optimizada para Tableta**: Diseño responsive con elementos táctiles de tamaño adecuado
- **Sistema de Pestañas**: Organización por temas configurable
- **Colores Institucionales**: Verde militar oscuro (#2D4A22) y dorado (#C4A035)

## 🏗️ Arquitectura

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Base de Datos**: SQLite (con better-sqlite3)
- **Autenticación**: JWT (jsonwebtoken)
- **Visualización PDF**: react-pdf
- **Almacenamiento**: Sistema de archivos local en carpeta `/uploads`

## 📁 Estructura del Proyecto

```
agenda-digital/
├── client/                 # Aplicación React
│   ├── src/
│   │   ├── components/    # Componentes reutilizables
│   │   ├── pages/         # Páginas (Login, Dashboard)
│   │   ├── services/      # Servicios API
│   │   ├── styles/        # Archivos CSS
│   │   ├── types/         # Tipos TypeScript
│   │   └── utils/         # Utilidades
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── server/                # API Backend
│   ├── src/
│   │   ├── config/       # Configuración DB y constantes
│   │   ├── controllers/  # Controladores de rutas
│   │   ├── middleware/   # Middleware de autenticación
│   │   └── routes/       # Definición de rutas
│   ├── package.json
│   └── tsconfig.json
├── uploads/              # PDFs organizados por pestaña
├── .env.example          # Variables de entorno de ejemplo
├── .gitignore
├── package.json          # Scripts principales
└── README.md
```

## 🚀 Instalación y Uso

### Prerequisitos

- Node.js 18+ y npm instalados

### Instalación

1. **Clonar o descargar el proyecto**

2. **Copiar el archivo de variables de entorno**
```bash
cp .env.example server/.env
```

3. **Editar el archivo `.env` con tus configuraciones** (opcional, los valores por defecto funcionan)

4. **Instalar todas las dependencias**
```bash
npm run install-all
```

O instalar manualmente:
```bash
npm install
cd client && npm install
cd ../server && npm install
```

### Ejecución en Desarrollo

**Ejecutar toda la aplicación (frontend + backend):**
```bash
npm run dev
```

Esto iniciará:
- Backend en http://localhost:3001
- Frontend en http://localhost:3000

**Ejecutar solo el backend:**
```bash
npm run server
```

**Ejecutar solo el frontend:**
```bash
npm run client
```

### Build para Producción

```bash
npm run build
```

Luego ejecutar:
```bash
npm start
```

## 👥 Usuarios por Defecto

Al iniciar el servidor por primera vez, se crean automáticamente estos usuarios:

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| admin | admin123 | Administrador |
| lector | lector123 | Lector |

**⚠️ IMPORTANTE**: Cambiar estas contraseñas en producción.

## 📋 Roles y Permisos

### Administrador
- ✅ Visualizar y descargar PDFs
- ✅ Subir nuevos PDFs
- ✅ Eliminar PDFs existentes
- ✅ Acceso a todas las pestañas

### Lector
- ✅ Visualizar y descargar PDFs
- ❌ No puede subir PDFs
- ❌ No puede eliminar PDFs
- ✅ Acceso a todas las pestañas

## 🗂️ Pestañas de la Agenda

Las pestañas por defecto son:

1. Apertura
2. Tema 1 - Planeación Conjunta
3. Tema 2 - Logística Operacional
4. Tema 3 - Derechos Humanos
5. Tema 4 - Pensamiento Estratégico
6. Documentos de Apoyo
7. Directorio

### Configurar Pestañas

Para modificar las pestañas, edita el archivo:
```
server/src/config/tabs.ts
```

Luego reinicia el servidor y ejecuta:
```bash
rm server/database.sqlite
```

La base de datos se recreará con las nuevas pestañas.

## 🔌 API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/verify` - Verificar token

### Pestañas
- `GET /api/tabs` - Listar todas las pestañas

### Documentos
- `GET /api/documents/:tabId` - Listar documentos de una pestaña
- `POST /api/documents/:tabId` - Subir PDF (solo admin)
- `DELETE /api/documents/:id` - Eliminar PDF (solo admin)
- `GET /api/documents/file/:filename` - Descargar/Ver PDF

## 🎨 Personalización

### Colores Institucionales

Los colores se definen en `client/src/styles/index.css`:

```css
:root {
  --color-primary: #2D4A22;      /* Verde militar oscuro */
  --color-secondary: #C4A035;    /* Dorado */
  --color-white: #ffffff;
  --color-light-gray: #f8f9fa;
  --color-gray: #e0e0e0;
  --color-dark-gray: #666;
}
```

### Logo

El logo es un placeholder SVG. Reemplaza el código SVG en:
- `client/src/pages/Login.tsx` (líneas 28-33)
- `client/src/components/Header.tsx` (líneas 17-22)

## 🔒 Seguridad

- Las contraseñas se almacenan hasheadas con bcrypt
- Los tokens JWT tienen expiración de 24 horas
- Solo archivos PDF son permitidos para subir
- Límite de tamaño de archivo: 50MB
- Middleware de autenticación en todas las rutas protegidas

**⚠️ Para producción:**
1. Cambiar `JWT_SECRET` en el archivo `.env`
2. Cambiar las contraseñas de los usuarios por defecto
3. Configurar HTTPS
4. Revisar límites de tamaño de archivo según necesidades

## 📱 Optimización para Tableta

- Tamaño mínimo recomendado: 1024x768px
- Botones y elementos táctiles de mínimo 48x48px
- Tipografía legible: mínimo 16px
- Pestañas amplias y fáciles de tocar
- Scrolling suave optimizado para táctil

## 🛠️ Tecnologías Utilizadas

### Frontend
- React 18
- TypeScript
- Vite
- react-pdf
- Axios

### Backend
- Node.js
- Express
- TypeScript
- better-sqlite3
- jsonwebtoken
- bcryptjs
- multer

## 📝 Notas de Desarrollo

- La base de datos SQLite se crea automáticamente en `server/database.sqlite`
- Los PDFs se organizan en carpetas por pestaña: `uploads/tab-{id}/`
- El worker de PDF.js se carga desde CDN para simplificar el build
- Los estilos están modularizados por componente

## 🐛 Solución de Problemas

### El servidor no inicia
- Verificar que el puerto 3001 no esté en uso
- Revisar que todas las dependencias estén instaladas

### Los PDFs no se visualizan
- Verificar que el archivo sea un PDF válido
- Comprobar la consola del navegador para errores
- Asegurar que el worker de PDF.js se cargue correctamente

### Error de autenticación
- Limpiar localStorage del navegador
- Verificar que JWT_SECRET esté configurado
- Revisar que la base de datos tenga los usuarios creados

## 📄 Licencia

Este proyecto es de código abierto para uso educativo y comercial.

## 👨‍💻 Soporte

Para reportar bugs o solicitar funcionalidades, crear un issue en el repositorio del proyecto.

---

**Desarrollado con ❤️ para tabletas**
