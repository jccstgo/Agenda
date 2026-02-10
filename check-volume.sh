#!/bin/bash

# Script para verificar el contenido del volumen de uploads
# Puede ejecutarse localmente o mediante Railway CLI

echo "📁 Verificación del Volumen de Uploads"
echo "======================================="
echo ""

# Determinar la ruta de uploads
if [ -n "$UPLOADS_DIR" ]; then
    UPLOAD_PATH="$UPLOADS_DIR"
else
    UPLOAD_PATH="./uploads"
fi

echo "📂 Ruta de uploads: $UPLOAD_PATH"
echo ""

# Verificar si el directorio existe
if [ ! -d "$UPLOAD_PATH" ]; then
    echo "❌ El directorio no existe aún"
    echo "   Se creará automáticamente cuando subas el primer archivo"
    exit 0
fi

# Listar estructura
echo "📋 Estructura de directorios:"
echo ""
tree -L 3 "$UPLOAD_PATH" 2>/dev/null || find "$UPLOAD_PATH" -type d -print 2>/dev/null | sed 's|[^/]*/|  |g'
echo ""

# Contar archivos por pestaña
echo "📊 Archivos por pestaña:"
echo ""

total_files=0
total_size=0

for tab_dir in "$UPLOAD_PATH"/tab-*; do
    if [ -d "$tab_dir" ]; then
        tab_name=$(basename "$tab_dir")
        file_count=$(find "$tab_dir" -type f | wc -l | tr -d ' ')

        if [ "$file_count" -gt 0 ]; then
            # Calcular tamaño
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                size=$(find "$tab_dir" -type f -exec stat -f%z {} + | awk '{s+=$1} END {print s}')
            else
                # Linux
                size=$(find "$tab_dir" -type f -exec stat -c%s {} + | awk '{s+=$1} END {print s}')
            fi

            size_mb=$(echo "scale=2; $size / 1048576" | bc 2>/dev/null || echo "0")

            echo "  $tab_name: $file_count archivos ($size_mb MB)"

            total_files=$((total_files + file_count))
            total_size=$((total_size + size))
        fi
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 Total: $total_files archivos"

if command -v bc >/dev/null 2>&1; then
    total_mb=$(echo "scale=2; $total_size / 1048576" | bc)
    total_gb=$(echo "scale=2; $total_size / 1073741824" | bc)
    echo "💾 Tamaño total: $total_mb MB ($total_gb GB)"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Listar archivos recientes
echo "🕐 Últimos 10 archivos modificados:"
echo ""

if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    find "$UPLOAD_PATH" -type f -print0 | xargs -0 stat -f "%m %N" | sort -rn | head -10 | while read timestamp file; do
        date_str=$(date -r "$timestamp" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "N/A")
        echo "  $date_str - $(basename "$file")"
    done
else
    # Linux
    find "$UPLOAD_PATH" -type f -printf "%T@ %p\n" | sort -rn | head -10 | while read timestamp file; do
        date_str=$(date -d "@${timestamp%.*}" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "N/A")
        echo "  $date_str - $(basename "$file")"
    done
fi

echo ""
