#!/bin/bash

# Script para generar secretos seguros para Railway
# Genera JWT_SECRET y contraseñas fuertes para producción

echo "🔐 Generador de Secretos para Railway"
echo "======================================"
echo ""

# Función para generar una contraseña fuerte
generate_password() {
    # Genera una contraseña de 16 caracteres con mayúsculas, minúsculas, números y símbolos
    LC_ALL=C tr -dc 'A-Za-z0-9!@#$%^&*()_+=' < /dev/urandom | head -c 16
}

# Generar JWT_SECRET (64 caracteres hexadecimales)
echo "📝 JWT_SECRET (para autenticación):"
if command -v node &> /dev/null; then
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    echo "JWT_SECRET=$JWT_SECRET"
else
    # Alternativa sin Node.js
    JWT_SECRET=$(LC_ALL=C tr -dc 'a-f0-9' < /dev/urandom | head -c 64)
    echo "JWT_SECRET=$JWT_SECRET"
fi
echo ""

# Generar contraseña para Admin
echo "👤 DEFAULT_ADMIN_PASSWORD (para usuario administrador):"
ADMIN_PASS=$(generate_password)
echo "DEFAULT_ADMIN_PASSWORD=$ADMIN_PASS"
echo ""

# Generar contraseña para Director
echo "👤 DEFAULT_READER_PASSWORD (para usuario Director):"
DIRECTOR_PASS=$(generate_password)
echo "DEFAULT_READER_PASSWORD=$DIRECTOR_PASS"
echo ""

# Resumen completo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Variables de Entorno Completas para Railway"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Copia y pega estas variables en la sección 'Variables' de Railway:"
echo ""
echo "NODE_ENV=production"
echo "JWT_SECRET=$JWT_SECRET"
echo "DB_PATH=/data/database.sqlite"
echo "UPLOADS_DIR=/data/uploads"
echo "DEFAULT_ADMIN_USERNAME=admin"
echo "DEFAULT_ADMIN_PASSWORD=$ADMIN_PASS"
echo "DEFAULT_READER_USERNAME=Director"
echo "DEFAULT_READER_PASSWORD=$DIRECTOR_PASS"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  IMPORTANTE: Guarda estas contraseñas en un lugar seguro!"
echo "    No podrás recuperarlas después."
echo ""
echo "🔑 Credenciales de acceso a tu aplicación:"
echo "   Usuario Admin: admin"
echo "   Contraseña Admin: $ADMIN_PASS"
echo ""
echo "   Usuario Director: Director"
echo "   Contraseña Director: $DIRECTOR_PASS"
echo ""
