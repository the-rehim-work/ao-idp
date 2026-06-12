# ─── Stage 1: Build frontend ─────────────────────────────────────────────────
FROM node:20-alpine AS ui-builder

WORKDIR /app
COPY admin/package.json admin/package-lock.json* ./
RUN npm ci
COPY admin/ ./
RUN npm run build && \
    mkdir -p /app/fonts && \
    cp node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2 /app/fonts/jbm-400.woff2 2>/dev/null || true && \
    cp node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff2 /app/fonts/jbm-600.woff2 2>/dev/null || true && \
    cp node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2 /app/fonts/inter-400.woff2 2>/dev/null || true && \
    cp node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2 /app/fonts/inter-500.woff2 2>/dev/null || true && \
    cp node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2 /app/fonts/inter-600.woff2 2>/dev/null || true && \
    cp node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2 /app/fonts/inter-700.woff2 2>/dev/null || true && \
    cp node_modules/@fontsource/outfit/files/outfit-latin-400-normal.woff2 /app/fonts/outfit-400.woff2 2>/dev/null || true && \
    cp node_modules/@fontsource/outfit/files/outfit-latin-600-normal.woff2 /app/fonts/outfit-600.woff2 2>/dev/null || true && \
    cp node_modules/@fontsource/outfit/files/outfit-latin-700-normal.woff2 /app/fonts/outfit-700.woff2 2>/dev/null || true && \
    cp node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2 /app/fonts/dm-sans-400.woff2 2>/dev/null || true && \
    cp node_modules/@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff2 /app/fonts/dm-sans-500.woff2 2>/dev/null || true && \
    cp node_modules/@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff2 /app/fonts/dm-sans-700.woff2 2>/dev/null || true && \
    cp node_modules/@fontsource/nunito/files/nunito-latin-400-normal.woff2 /app/fonts/nunito-400.woff2 2>/dev/null || true && \
    cp node_modules/@fontsource/nunito/files/nunito-latin-600-normal.woff2 /app/fonts/nunito-600.woff2 2>/dev/null || true && \
    cp node_modules/@fontsource/nunito/files/nunito-latin-700-normal.woff2 /app/fonts/nunito-700.woff2 2>/dev/null || true && \
    cp node_modules/@fontsource/poppins/files/poppins-latin-400-normal.woff2 /app/fonts/poppins-400.woff2 2>/dev/null || true && \
    cp node_modules/@fontsource/poppins/files/poppins-latin-600-normal.woff2 /app/fonts/poppins-600.woff2 2>/dev/null || true && \
    cp node_modules/@fontsource/poppins/files/poppins-latin-700-normal.woff2 /app/fonts/poppins-700.woff2 2>/dev/null || true && \
    cp node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2 /app/fonts/jakarta-400.woff2 2>/dev/null || true && \
    cp node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff2 /app/fonts/jakarta-600.woff2 2>/dev/null || true && \
    cp node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff2 /app/fonts/jakarta-700.woff2 2>/dev/null || true

# ─── Stage 2: Build backend ──────────────────────────────────────────────────
FROM gradle:8.7-jdk21-alpine AS server-builder

WORKDIR /build
COPY server/settings.gradle server/build.gradle ./
COPY server/gradle ./gradle
COPY server/src ./src
COPY --from=ui-builder /app/dist ./src/main/resources/static/admin
COPY --from=ui-builder /app/fonts ./src/main/resources/static/fonts
RUN gradle --no-daemon clean bootJar

# ─── Stage 3: Combined runtime image ─────────────────────────────────────────
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=en_US.UTF-8
ENV PGDATA=/var/lib/postgresql/data/pgdata
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=25.0 -Djava.security.egd=file:/dev/urandom -Dfile.encoding=UTF-8 -Dsun.jnu.encoding=UTF-8"

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget gnupg lsb-release curl ca-certificates locales \
    && locale-gen en_US.UTF-8 \
    # PostgreSQL 16
    && wget -qO - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - \
    && echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update && apt-get install -y --no-install-recommends postgresql-16 \
    # Java 21
    && apt-get install -y --no-install-recommends openjdk-21-jre-headless \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Prepare app directory
WORKDIR /app
COPY --from=server-builder /build/build/libs/*.jar /app/app.jar
COPY docker/start.sh /app/start.sh
# Strip Windows CR so the shebang works even if git checked out CRLF on Windows
RUN sed -i 's/\r$//' /app/start.sh && chmod +x /app/start.sh \
    && mkdir -p /var/lib/postgresql/data \
    && chown -R postgres:postgres /var/lib/postgresql

EXPOSE 7000 5432

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
  CMD wget -qO- http://127.0.0.1:7000/actuator/health > /dev/null 2>&1 || exit 1

ENTRYPOINT ["/app/start.sh"]
