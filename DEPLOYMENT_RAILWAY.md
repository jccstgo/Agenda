# 🚂 Guía de Deployment en Railway

Esta guía te llevará paso a paso para desplegar tu Agenda Digital en Railway con almacenamiento persistente.

## 📋 Prerequisitos

1. Cuenta en [Railway.app](https://railway.app)
2. Repositorio Git del proyecto (GitHub, GitLab, o Bitbucket)
3. Contraseñas fuertes preparadas para producción

---

## 🚀 Paso 1: Preparar el Repositorio

### 1.1 Hacer commit de todos los cambios

```bash
git add .
git commit -m "Preparar proyecto para deployment en Railway"
git push origin main
```

### 1.2 Verificar archivos importantes

Asegúrate de que estos archivos estén en tu repositorio:
- ✅ `railway.toml` - Configuración de Railway
- ✅ `.dockerignore` - Archivos a excluir del build
- ✅ `.gitignore` - Archivos a excluir de Git
- ✅ `package.json` - Scripts de build y start actualizados

---

## 🏗️ Paso 2: Crear Proyecto en Railway

1. **Inicia sesión en Railway**: https://railway.app
2. **Crea un nuevo proyecto**: Click en "New Project"
3. **Conecta tu repositorio**:
   - Selecciona "Deploy from GitHub repo"
   - Autoriza a Railway para acceder a tus repositorios
   - Selecciona el repositorio de Agenda Digital
   - Click en "Deploy Now"

Railway comenzará a construir tu aplicación automáticamente.

---

## 💾 Paso 3: Crear Volumen para Datos Persistentes

**⚠️ IMPORTANTE**: Sin un volumen, tu base de datos y archivos se perderán en cada redeploy.

1. **En tu proyecto de Railway**, ve a la pestaña del servicio
2. **Click en "Settings" → "Volumes"**
3. **Click en "New Volume"**:
   - **Mount Path**: `/data`
   - Click en "Add Volume"

Este volumen almacenará:
- La base de datos SQLite (`/data/database.sqlite`)
- Los archivos PDF subidos (`/data/uploads`)

---

## 🔐 Paso 4: Configurar Variables de Entorno

Ve a la pestaña **"Variables"** de tu servicio en Railway y agrega las siguientes variables:

### Variables Obligatorias

```bash
NODE_ENV=production
```

```bash
JWT_SECRET=
```
**Genera un secreto fuerte** (mínimo 32 caracteres):
```bash
# En tu terminal local, ejecuta:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```bash
DB_PATH=/data/database.sqlite
```

```bash
UPLOADS_DIR=/data/uploads
```

### Credenciales de Usuarios

**⚠️ IMPORTANTE**: Define contraseñas fuertes (mínimo 12 caracteres con mayúsculas, minúsculas, números y símbolos)

```bash
DEFAULT_ADMIN_USERNAME=admin
```

```bash
DEFAULT_ADMIN_PASSWORD=
```
Ejemplo: `Adm1n@Secure2024!`

```bash
DEFAULT_READER_USERNAME=Director
```

```bash
DEFAULT_READER_PASSWORD=
```
Ejemplo: `D1rect0r@Secure2024!`

---

## 📝 Resumen de Variables de Entorno

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Modo de ejecución |
| `JWT_SECRET` | Tu secreto único | Token de autenticación (min 32 chars) |
| `DB_PATH` | `/data/database.sqlite` | Ruta de la base de datos |
| `UPLOADS_DIR` | `/data/uploads` | Directorio de archivos PDF |
| `DEFAULT_ADMIN_USERNAME` | `admin` | Usuario administrador |
| `DEFAULT_ADMIN_PASSWORD` | Tu contraseña fuerte | Contraseña del admin |
| `DEFAULT_READER_USERNAME` | `Director` | Usuario lector |
| `DEFAULT_READER_PASSWORD` | Tu contraseña fuerte | Contraseña del director |

---

## 🌐 Paso 5: Generar Dominio Público

1. **Ve a "Settings" → "Networking"**
2. **Click en "Generate Domain"**
3. Railway te asignará un dominio como: `agenda-digital-production.up.railway.app`

---

## ✅ Paso 6: Verificar el Deployment

### 6.1 Revisar Logs

1. Ve a la pestaña **"Deployments"**
2. Click en el deployment más reciente
3. Revisa los logs para asegurarte de que no hay errores

Deberías ver:
```
✓ Usuarios por defecto creados
✓ Pestañas por defecto creadas
✓ Base de datos inicializada correctamente
🚀 Servidor ejecutándose en http://localhost:XXXX
```

### 6.2 Probar la Aplicación

1. **Abre el dominio** generado en tu navegador
2. **Inicia sesión** con las credenciales que configuraste
3. **Sube un PDF** (si iniciaste sesión como admin)
4. **Verifica** que el PDF se visualiza correctamente

---

## 🔄 Paso 7: Redeploys y Actualizaciones

### Actualizar la Aplicación

Cada vez que hagas push a tu repositorio, Railway automáticamente:
1. Detectará los cambios
2. Construirá una nueva versión
3. La desplegará sin perder datos (gracias al volumen)

```bash
# Hacer cambios en tu código
git add .
git commit -m "Actualización de funcionalidades"
git push origin main
```

Railway automáticamente desplegará los cambios.

---

## 📊 Monitoreo y Mantenimiento

### Ver Logs en Tiempo Real

En Railway, ve a la pestaña **"Deployments"** y selecciona tu deployment activo para ver logs en tiempo real.

### Métricas

Railway proporciona métricas de:
- 📈 CPU Usage
- 💾 Memory Usage
- 🌐 Network Traffic

Disponibles en la pestaña **"Metrics"**.

---

## 🛠️ Solución de Problemas

### El servidor no inicia

**Error**: `En producción, JWT_SECRET es obligatorio`

**Solución**: Verifica que `JWT_SECRET` esté configurado y tenga al menos 32 caracteres.

---

### Error de contraseñas débiles

**Error**: `DEFAULT_ADMIN_PASSWORD debe tener al menos 12 caracteres...`

**Solución**: Usa contraseñas que cumplan:
- Mínimo 12 caracteres
- Al menos 1 mayúscula
- Al menos 1 minúscula
- Al menos 1 número
- Al menos 1 símbolo

---

### Los PDFs desaparecen al redeploy

**Problema**: No configuraste un volumen

**Solución**: Sigue el **Paso 3** para crear un volumen en `/data`

---

### Base de datos se resetea

**Problema**: `DB_PATH` no apunta al volumen

**Solución**: Asegúrate de que `DB_PATH=/data/database.sqlite`

---

## 🔒 Seguridad en Producción

### ✅ Checklist de Seguridad

- [x] JWT_SECRET único y fuerte (32+ caracteres)
- [x] Contraseñas fuertes para admin y director
- [x] NODE_ENV=production configurado
- [x] Base de datos y uploads en volumen persistente
- [x] HTTPS habilitado por defecto en Railway
- [ ] (Opcional) Configurar dominio personalizado con SSL
- [ ] (Opcional) Configurar backup automático del volumen

---

## 💰 Costos de Railway

Railway ofrece:
- **Plan Hobby**: $5/mes de crédito gratuito
- **Plan Pro**: Pago por uso

Para esta aplicación (uso moderado):
- Costo estimado: ~$1-3/mes
- Volumen: $0.25/GB/mes

---

## 🎯 Dominio Personalizado (Opcional)

### Configurar tu propio dominio

1. **Compra un dominio** (ej: GoDaddy, Namecheap)
2. **En Railway**, ve a "Settings" → "Networking"
3. **Click en "Custom Domain"**
4. **Ingresa tu dominio**: `agenda.tudominio.com`
5. **Configura DNS** en tu proveedor:
   ```
   Tipo: CNAME
   Nombre: agenda
   Valor: [dominio generado por Railway]
   ```
6. **Espera** la propagación DNS (5-30 minutos)

Railway automáticamente proveerá certificado SSL gratuito.

---

## 📚 Recursos Adicionales

- [Railway Docs](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
- [Railway Status](https://status.railway.app)

---

## ✅ Checklist Final

Antes de considerar el deployment completo:

- [ ] Proyecto creado en Railway
- [ ] Repositorio conectado
- [ ] Volumen creado y montado en `/data`
- [ ] Todas las variables de entorno configuradas
- [ ] Contraseñas fuertes establecidas
- [ ] Dominio público generado
- [ ] Aplicación accesible desde navegador
- [ ] Login funciona correctamente
- [ ] PDFs se pueden subir y visualizar
- [ ] Datos persisten después de redeploy

---

## 🎉 ¡Listo!

Tu Agenda Digital está ahora en producción y lista para usar. Los usuarios pueden acceder desde cualquier tableta o navegador usando el dominio proporcionado.

**URL de tu aplicación**: `https://[tu-proyecto].up.railway.app`

---

**Desarrollado con ❤️ para tabletas | Desplegado en Railway**
