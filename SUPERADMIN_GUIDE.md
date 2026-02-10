# 👑 Guía del Super Administrador

Sistema completo de auditoría y gestión de usuarios para la Agenda Digital.

---

## 🎯 ¿Qué es el Super Administrador?

El **Super Administrador** es un rol especial con capacidades de:

✅ **Gestión de usuarios** - Cambiar contraseñas y roles
✅ **Auditoría completa** - Ver todas las acciones de todos los usuarios
✅ **Monitoreo** - Estadísticas y análisis de actividad
✅ **Control total** - Todos los permisos de admin + capacidades de supervisión

---

## 🔐 Credenciales

### Desarrollo Local
```
Usuario: superadmin
Contraseña: superadmin123
```

### Producción en Railway
Genera contraseñas seguras con:
```bash
./generate-secrets.sh
```

---

## 📊 Sistema de Auditoría

### ¿Qué se Registra?

**TODAS** las acciones de usuarios autenticados:

| Acción | Descripción | Qué se registra |
|--------|-------------|-----------------|
| `LOGIN` | Inicio de sesión | Usuario, hora CDMX, IP |
| `VIEW_DOCUMENT` | Visualizar PDF | Usuario, documento, pestaña, hora |
| `DOWNLOAD_DOCUMENT` | Descargar PDF | Usuario, documento, hora |
| `UPLOAD_DOCUMENT` | Subir PDF | Usuario, documento, tamaño, pestaña, hora |
| `DELETE_DOCUMENT` | Eliminar PDF | Usuario, documento eliminado, hora |
| `LIST_DOCUMENTS` | Listar documentos | Usuario, pestaña consultada, hora |
| `CHANGE_USER_PASSWORD` | Cambiar contraseña | Superadmin, usuario afectado, hora |
| `CHANGE_USER_ROLE` | Cambiar rol | Superadmin, usuario, rol anterior y nuevo |
| `VIEW_AUDIT_LOGS` | Consultar logs | Superadmin, filtros usados, hora |
| `VIEW_USER_ACTIVITY` | Ver actividad de usuario | Superadmin, usuario consultado, hora |

### Zona Horaria

⏰ **Todas las fechas se registran en hora de CDMX (America/Mexico_City)**

Cada registro incluye:
- `timestamp_utc` - Hora UTC del servidor
- `timestamp_cdmx` - Hora convertida a CDMX (formato: DD/MM/YYYY, HH:MM:SS)

---

## 🌐 Endpoints Disponibles

### 1. Gestión de Usuarios

#### Listar todos los usuarios
```http
GET /api/superadmin/users
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "users": [
    {
      "id": 1,
      "username": "superadmin",
      "role": "superadmin",
      "created_at": "2024-02-09T12:00:00.000Z",
      "last_password_change": "2024-02-09T12:00:00.000Z"
    },
    {
      "id": 2,
      "username": "admin",
      "role": "admin",
      "created_at": "2024-02-09T12:00:00.000Z",
      "last_password_change": "2024-02-09T12:00:00.000Z"
    }
  ]
}
```

#### Cambiar contraseña de un usuario
```http
POST /api/superadmin/users/{userId}/change-password
Authorization: Bearer {token}
Content-Type: application/json

{
  "newPassword": "NuevaContraseñaSegura123!"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Contraseña actualizada para admin"
}
```

#### Cambiar rol de un usuario
```http
POST /api/superadmin/users/{userId}/change-role
Authorization: Bearer {token}
Content-Type: application/json

{
  "newRole": "reader"
}
```

**Roles válidos:** `admin`, `reader`

**Nota:** No se puede cambiar el rol de otro superadmin.

---

### 2. Logs de Auditoría

#### Ver todos los logs
```http
GET /api/superadmin/audit-logs?limit=100&offset=0
Authorization: Bearer {token}
```

**Parámetros opcionales:**
- `userId` - Filtrar por ID de usuario
- `action` - Filtrar por tipo de acción
- `startDate` - Fecha inicio (UTC)
- `endDate` - Fecha fin (UTC)
- `limit` - Número de registros (default: 100)
- `offset` - Saltar registros (para paginación)

**Respuesta:**
```json
{
  "logs": [
    {
      "id": 1,
      "user_id": 2,
      "username": "admin",
      "action": "UPLOAD_DOCUMENT",
      "resource_type": "document",
      "resource_id": 5,
      "resource_name": "reporte.pdf",
      "details": "Subió el documento \"reporte.pdf\" (1.5 MB) a la pestaña \"Apertura\"",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "timestamp_utc": "2024-02-09T18:30:00.000Z",
      "timestamp_cdmx": "09/02/2024, 12:30:00"
    }
  ],
  "total": 150,
  "limit": 100,
  "offset": 0
}
```

#### Ver actividad de un usuario específico
```http
GET /api/superadmin/audit-logs/user/{userId}?limit=50
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "user": {
    "username": "admin",
    "role": "admin"
  },
  "logs": [...],
  "total": 25
}
```

#### Estadísticas de actividad
```http
GET /api/superadmin/audit-logs/stats
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "total": 1500,
  "topActions": [
    { "action": "VIEW_DOCUMENT", "count": 450 },
    { "action": "LIST_DOCUMENTS", "count": 320 },
    { "action": "UPLOAD_DOCUMENT", "count": 85 }
  ],
  "topUsers": [
    {
      "user_id": 2,
      "username": "admin",
      "role": "admin",
      "actions_count": 650
    }
  ],
  "dailyActivity": [
    { "date": "2024-02-09", "count": 125 },
    { "date": "2024-02-08", "count": 98 }
  ]
}
```

---

## 💻 Uso desde el Navegador

### 1. Iniciar sesión como superadmin

```javascript
// En la consola del navegador después de hacer login
const token = localStorage.getItem('token');
```

### 2. Ver todos los usuarios

```javascript
fetch('/api/superadmin/users', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => console.table(data.users));
```

### 3. Cambiar contraseña de un usuario

```javascript
fetch('/api/superadmin/users/2/change-password', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    newPassword: 'NuevaPassword123!'
  })
})
.then(r => r.json())
.then(data => console.log(data));
```

### 4. Ver logs de auditoría

```javascript
// Últimos 50 logs
fetch('/api/superadmin/audit-logs?limit=50', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => console.table(data.logs));

// Actividad de un usuario específico
fetch('/api/superadmin/audit-logs/user/2', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => {
  console.log(`Usuario: ${data.user.username} (${data.user.role})`);
  console.table(data.logs);
});

// Estadísticas
fetch('/api/superadmin/audit-logs/stats', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => {
  console.log('📊 Estadísticas de Auditoría');
  console.log(`Total de logs: ${data.total}`);
  console.log('Acciones más comunes:');
  console.table(data.topActions);
  console.log('Usuarios más activos:');
  console.table(data.topUsers);
});
```

### 5. Filtrar logs por acción

```javascript
// Solo ver subidas de documentos
fetch('/api/superadmin/audit-logs?action=UPLOAD_DOCUMENT&limit=20', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => console.table(data.logs));

// Solo ver eliminaciones
fetch('/api/superadmin/audit-logs?action=DELETE_DOCUMENT&limit=20', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => console.table(data.logs));
```

---

## 🔒 Seguridad

### Restricciones

- ✅ Solo usuarios con rol `superadmin` pueden acceder a estos endpoints
- ✅ No se puede cambiar la contraseña de otro superadmin
- ✅ No se puede cambiar el rol de un superadmin
- ✅ Todas las acciones del superadmin también se auditan
- ✅ Las contraseñas se hashean con bcrypt (10 rounds)

### Mejores Prácticas

1. **Contraseñas fuertes** - Usa `generate-secrets.sh` en producción
2. **Monitorea regularmente** - Revisa los logs semanalmente
3. **Rota contraseñas** - Cambia las contraseñas cada 3-6 meses
4. **Respalda los logs** - Los logs son evidencia de auditoría
5. **Limita acceso** - Solo personal autorizado debe tener rol superadmin

---

## 📈 Casos de Uso Comunes

### Auditar actividad de un admin

```javascript
// 1. Obtener ID del usuario
fetch('/api/superadmin/users', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => {
  const admin = data.users.find(u => u.username === 'admin');
  console.log('Admin ID:', admin.id);

  // 2. Ver su actividad
  return fetch(`/api/superadmin/audit-logs/user/${admin.id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
})
.then(r => r.json())
.then(data => {
  console.log(`Actividad de ${data.user.username}:`);
  console.table(data.logs);
});
```

### Resetear contraseña de un usuario

```javascript
// Ejemplo: Resetear contraseña del admin (userId = 2)
fetch('/api/superadmin/users/2/change-password', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    newPassword: 'Admin@NewPass2024'
  })
})
.then(r => r.json())
.then(data => console.log(data.message));
```

### Ver qué PDFs se subieron hoy

```javascript
const hoy = new Date().toISOString().split('T')[0];

fetch(`/api/superadmin/audit-logs?action=UPLOAD_DOCUMENT&startDate=${hoy}`, {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => {
  console.log(`📄 PDFs subidos hoy: ${data.total}`);
  console.table(data.logs);
});
```

### Ver documentos eliminados

```javascript
fetch('/api/superadmin/audit-logs?action=DELETE_DOCUMENT', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => {
  console.log(`🗑️ Documentos eliminados: ${data.total}`);
  console.table(data.logs);
});
```

---

## 🚀 Deployment en Railway

Variables de entorno adicionales para superadmin:

```env
DEFAULT_SUPERADMIN_USERNAME=superadmin
DEFAULT_SUPERADMIN_PASSWORD=TuPasswordSuperFuerte123!@#
```

**⚠️ CRÍTICO:** En producción, el superadmin **DEBE** tener una contraseña fuerte generada con `generate-secrets.sh`.

---

## 📝 Estructura de la Base de Datos

### Tabla `audit_logs`

```sql
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id INTEGER,
  resource_name TEXT,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  timestamp_utc DATETIME DEFAULT CURRENT_TIMESTAMP,
  timestamp_cdmx TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Índices

```sql
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp_utc);
```

---

## 🛠️ Troubleshooting

### No puedo acceder a los endpoints

✅ Verifica que estés logueado como `superadmin`
✅ Revisa que el token sea válido
✅ Confirma que el servidor esté corriendo

### Los logs no aparecen

✅ Verifica que la tabla `audit_logs` exista
✅ Confirma que haya actividad de usuarios
✅ Revisa los logs del servidor para errores

### No puedo cambiar contraseña de otro superadmin

✅ **Esto es intencional por seguridad**
✅ Solo puedes cambiar tu propia contraseña de superadmin
✅ Puedes cambiar contraseñas de admin y reader

---

**¿Preguntas o problemas?** Consulta los logs del servidor o contacta al desarrollador.
