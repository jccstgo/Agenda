# Despliegue en CentOS con Docker

Esta guía deja la Agenda Digital ejecutándose en un servidor CentOS con contenedores y HTTPS local (requisito para modo offline/PWA en iPad Safari).

## 1) Instalar Docker Engine + Compose plugin

Comandos para CentOS Stream 9:

```bash
sudo dnf -y install dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

Cierra sesión y vuelve a entrar para aplicar el grupo `docker`.

## 2) Preparar carpetas en el servidor

```bash
sudo mkdir -p /opt/agenda
sudo mkdir -p /opt/agenda/data/uploads
sudo chown -R $USER:$USER /opt/agenda
```

Copia el proyecto a `/opt/agenda` (git clone, rsync o scp).

## 3) Configurar variables de entorno runtime

Dentro de `/opt/agenda`:

```bash
cp .env.runtime.example .env.runtime
```

Edita `.env.runtime` y define valores reales:
- `JWT_SECRET` (32+ caracteres)
- `DEFAULT_SUPERADMIN_PASSWORD`, `DEFAULT_ADMIN_PASSWORD`, `DEFAULT_READER_PASSWORD` (contraseñas fuertes)

## 4) Levantar contenedores

```bash
cd /opt/agenda
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f agenda-app
```

## 5) Abrir firewall

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## 6) HTTPS local para iPad (necesario para offline)

El stack usa Caddy con `tls internal`. Esto crea una CA local.

Exporta el certificado raíz:

```bash
docker compose exec caddy sh -c 'cat /data/caddy/pki/authorities/local/root.crt' > caddy-local-root.crt
```

Instala y confía este certificado en los iPad/PC que usarán la Agenda.

Si no confías este certificado, la app podrá abrirse, pero funciones PWA/offline pueden no registrarse correctamente en Safari.

## 7) Verificación

- Healthcheck:

```bash
curl -k https://IP_DEL_SERVIDOR/health
```

- App:

```text
https://IP_DEL_SERVIDOR
```

## 8) Actualizar versión de la app

```bash
cd /opt/agenda
git pull
docker compose build
docker compose up -d
```

## 9) Backup de datos

Datos persistentes:
- SQLite: `/opt/agenda/data/database.sqlite`
- PDFs: `/opt/agenda/data/uploads/`

Backup rápido:

```bash
tar -czf agenda-backup-$(date +%F).tar.gz /opt/agenda/data
```

## 10) Comandos útiles

```bash
docker compose logs -f
docker compose restart
docker compose down
docker compose up -d
```
