# 📁 Administrar Volumen de Railway

Guía completa para ver y administrar los archivos en el volumen montado de Railway.

---

## 🎯 Métodos Disponibles

### 1️⃣ Endpoints de Administración (Recomendado para uso web)

He agregado endpoints API que puedes usar desde tu navegador o Postman:

#### Ver todos los archivos del volumen

```bash
GET /api/admin/volume/files
```

**Requiere**: Token de autenticación como Admin

**Respuesta**:
```json
{
  "uploadsDir": "/data/uploads",
  "contents": {
    "path": "/",
    "files": [],
    "directories": [...]
  },
  "totalFiles": 42
}
```

#### Ver estadísticas del volumen

```bash
GET /api/admin/volume/stats
```

**Respuesta**:
```json
{
  "uploadsDir": "/data/uploads",
  "totalSize": 157286400,
  "sizeInMB": "150.00 MB",
  "sizeInGB": "0.15 GB",
  "exists": true
}
```

#### Ver archivos de una pestaña específica

```bash
GET /api/admin/volume/tab/:tabId
```

**Ejemplo**: `GET /api/admin/volume/tab/1`

**Respuesta**:
```json
{
  "tabId": "1",
  "path": "/data/uploads/tab-1",
  "files": [
    {
      "name": "documento.pdf",
      "size": 1048576,
      "sizeInMB": "1.00",
      "modified": "2024-02-09T10:30:00.000Z",
      "created": "2024-02-09T10:30:00.000Z"
    }
  ],
  "totalFiles": 1,
  "totalSize": 1048576
}
```

---

### 2️⃣ Usar desde el Navegador (Fácil)

1. **Inicia sesión** en tu aplicación como `admin`
2. **Abre la consola del navegador** (F12)
3. **Ejecuta este código**:

```javascript
// Obtener token
const token = localStorage.getItem('token');

// Ver todos los archivos
fetch('/api/admin/volume/files', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => console.log(data));

// Ver estadísticas
fetch('/api/admin/volume/stats', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => console.log(data));

// Ver archivos de pestaña 1
fetch('/api/admin/volume/tab/1', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => console.log(data));
```

---

### 3️⃣ Railway CLI (Acceso Directo)

#### Instalación

```bash
# macOS
brew install railway

# O con npm
npm i -g @railway/cli
```

#### Uso

```bash
# 1. Autenticarte
railway login

# 2. Vincularte al proyecto
railway link

# 3. Ejecutar comandos en el contenedor en Railway
railway run bash

# Dentro del contenedor, puedes ejecutar:
ls -la /data
ls -la /data/uploads
ls -la /data/uploads/tab-1
ls -la /data/database.sqlite

# Ver estadísticas
du -sh /data/*
find /data/uploads -type f | wc -l
```

#### Ejecutar script de verificación

```bash
# Desde Railway CLI
railway run ./check-volume.sh
```

---

### 4️⃣ Script Local (Para desarrollo)

He creado un script que puedes ejecutar localmente:

```bash
./check-volume.sh
```

**Salida ejemplo**:
```
📁 Verificación del Volumen de Uploads
=======================================

📂 Ruta de uploads: ./uploads

📋 Estructura de directorios:

./uploads
  tab-1
    documento1.pdf
    documento2.pdf
  tab-2
    reporte.pdf

📊 Archivos por pestaña:

  tab-1: 2 archivos (5.32 MB)
  tab-2: 1 archivos (2.10 MB)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 Total: 3 archivos
💾 Tamaño total: 7.42 MB (0.01 GB)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🔐 Seguridad

- ✅ Todos los endpoints requieren autenticación
- ✅ Solo usuarios con rol `admin` pueden acceder
- ✅ No se pueden descargar archivos directamente (solo metadata)
- ✅ Los archivos PDF se sirven mediante el endpoint existente de documentos

---

## 📝 Comandos Útiles con Railway CLI

### Ver logs en tiempo real

```bash
railway logs
```

### Ver base de datos

```bash
railway run bash
sqlite3 /data/database.sqlite
.tables
SELECT * FROM users;
SELECT * FROM tabs;
SELECT * FROM documents;
.exit
```

### Ver espacio en disco

```bash
railway run df -h /data
```

### Crear backup del volumen

```bash
# Desde Railway CLI
railway run tar -czf /tmp/backup.tar.gz /data
railway run cat /tmp/backup.tar.gz > backup-$(date +%Y%m%d).tar.gz
```

---

## 🚀 Ejemplo Completo con cURL

Si tienes el token de autenticación, puedes usar cURL:

```bash
# Obtener token (login)
TOKEN=$(curl -X POST https://tu-app.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"tu-password"}' \
  | jq -r '.token')

# Ver estadísticas del volumen
curl https://tu-app.railway.app/api/admin/volume/stats \
  -H "Authorization: Bearer $TOKEN" | jq

# Ver todos los archivos
curl https://tu-app.railway.app/api/admin/volume/files \
  -H "Authorization: Bearer $TOKEN" | jq

# Ver archivos de pestaña específica
curl https://tu-app.railway.app/api/admin/volume/tab/1 \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 🛠️ Próximos Pasos

Después de hacer deployment con las nuevas rutas:

1. **Inicia sesión como admin**
2. **Usa los endpoints** para ver tus archivos
3. **Instala Railway CLI** si necesitas acceso directo
4. **Ejecuta `./check-volume.sh`** localmente para verificar archivos locales

---

## 📊 Monitoreo

Para producción, puedes:

1. **Agregar alertas** si el volumen excede cierto tamaño
2. **Crear backups automáticos** con un cron job
3. **Implementar limpieza** de archivos antiguos si es necesario

---

**¿Necesitas ayuda con alguno de estos métodos?** Avísame y te guío paso a paso.
