# AO IDP — Production Deployment Guide (Ubuntu)

## Prerequisites

- Ubuntu 22.04+
- Docker 24+ and Docker Compose plugin
- Nginx installed on host (configured manually)
- LDAP / Active Directory server accessible from this machine

---

## 1. Fill in Environment Variables

Edit `.env` before doing anything else:

```bash
nano .env
```

| Variable | Description |
|---|---|
| `DB_HOST` | PostgreSQL host (`postgres` when using Docker Compose) |
| `DB_PORT` | PostgreSQL port (`5432`) |
| `DB_NAME` | PostgreSQL database name |
| `DB_USERNAME` | PostgreSQL user |
| `DB_PASSWORD` | PostgreSQL password — use a strong one |
| `IDP_ISSUER` | Public URL of the IDP, e.g. `https://auth.ao.az` |
| `COOKIE_DOMAIN` | Cookie scope, e.g. `.ao.az` |

> LDAP is configured through the admin panel after first login, not via environment variables.

---

## Option A — Offline / USB Deployment (Docker Compose)

Use this when the target machine has no internet access.

### On the build machine (internet access required)

```bash
chmod +x scripts/build-export.sh
./scripts/build-export.sh
```

This builds `ao-images/idp-server:latest` and tags `ao-images/postgres:latest`, then saves both as `.tar` files into `./export/`.

Copy the following to USB:

```
export/idp-server.tar
export/postgres.tar
docker-compose.yml
.env
scripts/load-deploy.sh
```

### On the target machine (offline Ubuntu)

```bash
# Copy files from USB to server
cp /media/usb/idp-server.tar .
cp /media/usb/postgres.tar .
cp /media/usb/docker-compose.yml .
cp /media/usb/.env .
cp /media/usb/load-deploy.sh .

chmod +x load-deploy.sh
sudo ./load-deploy.sh
```

The script loads both images, creates the PostgreSQL data directory, and runs `docker compose up -d`.

---

## Option B — With Docker Compose (internet access)

### Step 1 — Prepare PostgreSQL data directory

```bash
sudo mkdir -p /opt/ao-idp/postgres
sudo chown -R 999:999 /opt/ao-idp/postgres
```

> The `999` UID is the `postgres` user inside the container. Data survives container deletion, volume removal, and Docker reinstalls because it is stored at `/opt/ao-idp/postgres` directly on disk — not in a Docker volume.

### Step 2 — Build images and start

```bash
chmod +x scripts/build-export.sh
./scripts/build-export.sh   # builds ao-images/idp-server:latest and ao-images/postgres:latest
docker compose up -d
```

### Step 3 — Verify

```bash
docker compose ps
docker compose logs -f idp-server
```

Application: `http://<server-ip>:8080`
Admin panel: `http://<server-ip>:8080/admin`

### Step 4 — Configure Nginx (host)

```nginx
server {
    listen 80;
    server_name auth.ao.az;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name auth.ao.az;

    ssl_certificate     /etc/ssl/certs/auth.ao.az.crt;
    ssl_certificate_key /etc/ssl/private/auth.ao.az.key;
    ssl_protocols       TLSv1.2 TLSv1.3;

    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;

    location / {
        proxy_pass            http://127.0.0.1:8080;
        proxy_set_header      Host              $host;
        proxy_set_header      X-Real-IP         $remote_addr;
        proxy_set_header      X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header      X-Forwarded-Proto $scheme;
        proxy_set_header      X-Forwarded-Host  $host;
        proxy_read_timeout    60s;
        proxy_connect_timeout 10s;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Useful commands

```bash
# Stop everything
docker compose down

# Restart app after image update
docker compose up -d idp-server

# View logs
docker compose logs -f idp-server
docker compose logs -f postgres

# Connect to database
docker compose exec postgres psql -U ao_idp -d ao_idp
```

> **Never run `docker compose down -v`** — PostgreSQL data is safe (bind mount on `/opt/ao-idp/postgres`), but the flag is a bad habit.

---

## Option C — Without Docker (manual / bare metal)

### Prerequisites

```bash
# Java 21
sudo apt install -y openjdk-21-jre-headless

# PostgreSQL 16
sudo apt install -y postgresql-16
```

### Step 1 — Set up PostgreSQL

```bash
sudo -u postgres psql <<EOF
CREATE USER ao_idp WITH PASSWORD 'your_password';
CREATE DATABASE ao_idp OWNER ao_idp;
GRANT ALL PRIVILEGES ON DATABASE ao_idp TO ao_idp;
EOF
```

### Step 2 — Build the JAR

```bash
cd admin && npm ci && npm run build && cd ..
cp -r admin/dist/* server/src/main/resources/static/admin/
cd server && ./gradlew clean bootJar && cd ..
```

JAR output: `server/build/libs/ao-idp-1.0.0.jar`

### Step 3 — Create systemd service

```bash
sudo nano /etc/systemd/system/ao-idp.service
```

```ini
[Unit]
Description=AO Identity Provider
After=network.target postgresql.service

[Service]
User=aoapp
Group=aoapp
WorkingDirectory=/opt/ao-idp

Environment=SPRING_PROFILES_ACTIVE=prod
Environment=DB_HOST=localhost
Environment=DB_PORT=5432
Environment=DB_NAME=ao_idp
Environment=DB_USERNAME=ao_idp
Environment=DB_PASSWORD=your_password
Environment=IDP_ISSUER=https://auth.ao.az
Environment=COOKIE_DOMAIN=.ao.az
Environment=JAVA_OPTS=-Xms256m -Xmx512m

ExecStart=/usr/bin/java $JAVA_OPTS -jar /opt/ao-idp/ao-idp-1.0.0.jar
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### Step 4 — Deploy and start

```bash
sudo useradd -r -s /bin/false aoapp
sudo mkdir -p /opt/ao-idp
sudo cp server/build/libs/ao-idp-1.0.0.jar /opt/ao-idp/
sudo chown -R aoapp:aoapp /opt/ao-idp

sudo systemctl daemon-reload
sudo systemctl enable ao-idp
sudo systemctl start ao-idp
sudo journalctl -u ao-idp -f
```

---

## Default Credentials

| Field | Value |
|---|---|
| Username | `superadmin` |
| Password | `admin123!` |

**Change this password immediately after first login.**
