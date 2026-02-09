#!/bin/bash

# Script de verificación pre-deployment para Railway
# Este script verifica que todo esté listo para deployment

echo "🔍 Verificando preparación para deployment en Railway..."
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

errors=0
warnings=0

# Función para marcar como OK
ok() {
    echo -e "${GREEN}✓${NC} $1"
}

# Función para marcar como error
error() {
    echo -e "${RED}✗${NC} $1"
    ((errors++))
}

# Función para marcar como warning
warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((warnings++))
}

# 1. Verificar archivos de configuración
echo "📁 Verificando archivos de configuración..."

if [ -f "railway.toml" ]; then
    ok "railway.toml existe"
else
    error "railway.toml no encontrado"
fi

if [ -f ".dockerignore" ]; then
    ok ".dockerignore existe"
else
    warn ".dockerignore no encontrado (opcional pero recomendado)"
fi

if [ -f ".gitignore" ]; then
    ok ".gitignore existe"
else
    warn ".gitignore no encontrado"
fi

if [ -f ".env.example" ]; then
    ok ".env.example existe"
else
    warn ".env.example no encontrado (recomendado para documentación)"
fi

echo ""

# 2. Verificar package.json
echo "📦 Verificando package.json..."

if [ -f "package.json" ]; then
    ok "package.json existe"

    # Verificar scripts importantes
    if grep -q '"start"' package.json; then
        ok "Script 'start' encontrado"
    else
        error "Script 'start' no encontrado en package.json"
    fi

    if grep -q '"build"' package.json; then
        ok "Script 'build' encontrado"
    else
        error "Script 'build' no encontrado en package.json"
    fi
else
    error "package.json no encontrado"
fi

echo ""

# 3. Verificar estructura de carpetas
echo "📂 Verificando estructura de carpetas..."

if [ -d "client" ]; then
    ok "Carpeta client/ existe"
    if [ -f "client/package.json" ]; then
        ok "client/package.json existe"
    else
        error "client/package.json no encontrado"
    fi
else
    error "Carpeta client/ no encontrada"
fi

if [ -d "server" ]; then
    ok "Carpeta server/ existe"
    if [ -f "server/package.json" ]; then
        ok "server/package.json existe"
    else
        error "server/package.json no encontrado"
    fi
else
    error "Carpeta server/ no encontrada"
fi

echo ""

# 4. Verificar archivos TypeScript críticos
echo "📝 Verificando archivos TypeScript críticos..."

if [ -f "server/src/server.ts" ]; then
    ok "server/src/server.ts existe"

    # Verificar que sirve archivos estáticos en producción
    if grep -q "express.static" server/src/server.ts; then
        ok "Configuración de archivos estáticos encontrada"
    else
        warn "No se encontró configuración de archivos estáticos (puede ser necesaria)"
    fi
else
    error "server/src/server.ts no encontrado"
fi

if [ -f "server/src/config/database.ts" ]; then
    ok "server/src/config/database.ts existe"
else
    error "server/src/config/database.ts no encontrado"
fi

if [ -f "server/src/config/env.ts" ]; then
    ok "server/src/config/env.ts existe"
else
    error "server/src/config/env.ts no encontrado"
fi

echo ""

# 5. Verificar Git
echo "🔀 Verificando repositorio Git..."

if [ -d ".git" ]; then
    ok "Repositorio Git inicializado"

    # Verificar si hay cambios sin commit
    if git diff-index --quiet HEAD --; then
        ok "No hay cambios sin commit"
    else
        warn "Hay cambios sin commit. Considera hacer commit antes de deployment."
    fi

    # Verificar si hay un remote configurado
    if git remote -v | grep -q "origin"; then
        ok "Remote 'origin' configurado"
    else
        warn "No hay remote 'origin' configurado. Necesitarás uno para Railway."
    fi
else
    error "No es un repositorio Git. Railway requiere Git."
fi

echo ""

# 6. Verificar Node modules (avisar si existen localmente)
echo "📚 Verificando dependencias..."

if [ -d "node_modules" ] || [ -d "client/node_modules" ] || [ -d "server/node_modules" ]; then
    warn "node_modules encontrados localmente (serán ignorados en deployment)"
fi

echo ""

# Resumen final
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Resumen de Verificación"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $errors -eq 0 ]; then
    if [ $warnings -eq 0 ]; then
        echo -e "${GREEN}✅ Todo listo para deployment!${NC}"
    else
        echo -e "${YELLOW}⚠ Hay $warnings advertencias, pero puedes proceder${NC}"
    fi
    echo ""
    echo "🚀 Próximos pasos:"
    echo "  1. Hacer commit de todos los cambios: git add . && git commit -m 'Preparar para deployment'"
    echo "  2. Hacer push al repositorio: git push origin main"
    echo "  3. Seguir la guía en DEPLOYMENT_RAILWAY.md"
    exit 0
else
    echo -e "${RED}❌ Hay $errors errores que deben corregirse${NC}"
    if [ $warnings -gt 0 ]; then
        echo -e "${YELLOW}⚠ También hay $warnings advertencias${NC}"
    fi
    echo ""
    echo "Por favor corrige los errores antes de proceder con el deployment."
    exit 1
fi
