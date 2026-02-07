# 🚀 Inicio Rápido - Agenda Digital

## Pasos para Ejecutar la Aplicación

### 1. Verificar que las dependencias estén instaladas

Si acabas de clonar o descargar el proyecto, ejecuta:

```bash
npm run install-all
```

### 2. Iniciar la aplicación

```bash
npm run dev
```

Esto iniciará:
- **Backend** en: http://localhost:3001
- **Frontend** en: http://localhost:3000

### 3. Acceder a la aplicación

Abre tu navegador (preferiblemente Chrome o Safari) y ve a:

**http://localhost:3000**

### 4. Iniciar Sesión

Usa uno de estos usuarios de prueba:

**Administrador:**
- Usuario: `admin`
- Contraseña: `admin123`

**Principal:**
- Usuario: `Director`
- Contraseña: `director123`

## ✅ Funcionalidades

### Como Administrador:
1. ✅ Ver todas las pestañas
2. ✅ Subir archivos PDF en cualquier pestaña
3. ✅ Visualizar PDFs embebidos
4. ✅ Eliminar documentos
5. ✅ Descargar PDFs

### Como Principal:
1. ✅ Ver todas las pestañas
2. ✅ Visualizar PDFs embebidos
3. ✅ Descargar PDFs
4. ❌ No puede subir ni eliminar documentos

## 📱 Uso en Tableta

Para usar en una tableta:

1. Asegúrate de que tu tableta y computadora estén en la misma red
2. Averigua la IP local de tu computadora:
   - Mac/Linux: `ifconfig | grep inet`
   - Windows: `ipconfig`
3. En la tableta, accede a: `http://[IP-DE-TU-COMPUTADORA]:3000`

Ejemplo: `http://192.168.1.100:3000`

## 🛑 Detener la Aplicación

Presiona `Ctrl + C` en la terminal donde está ejecutándose

## 🔧 Solución de Problemas

### El puerto 3000 o 3001 ya está en uso

Edita los archivos de configuración:
- Frontend: `client/vite.config.ts` - cambiar el puerto en `server.port`
- Backend: `server/.env` - cambiar la variable `PORT`

### No aparecen las pestañas

1. Detén el servidor
2. Elimina el archivo: `server/database.sqlite`
3. Vuelve a ejecutar `npm run dev`

### Los PDFs no se cargan

Verifica que la carpeta `uploads` tenga permisos de lectura/escritura:

```bash
chmod -R 755 uploads
```

## 📚 Más Información

Consulta el archivo [README.md](README.md) para documentación completa.

---

**¡Listo para usar! 🎉**
