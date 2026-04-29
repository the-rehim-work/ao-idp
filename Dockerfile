FROM node:20-alpine AS ui-builder

WORKDIR /app
COPY admin/package.json admin/package-lock.json* ./
RUN npm ci --prefer-offline
COPY admin/ ./
RUN npm run build

FROM gradle:8.7-jdk21-alpine AS server-builder

WORKDIR /build
COPY server/settings.gradle server/build.gradle ./
COPY server/gradle ./gradle
COPY server/src ./src
COPY --from=ui-builder /app/dist ./src/main/resources/static/admin
RUN gradle --no-daemon clean bootJar

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

RUN addgroup -S idp && adduser -S idp -G idp \
    && mkdir -p /app \
    && chown -R idp:idp /app

COPY --from=server-builder /build/build/libs/*.jar /app/app.jar

USER idp

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=25.0 -Djava.security.egd=file:/dev/urandom"

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
  CMD sh -c "wget -qO- http://127.0.0.1:8080/actuator/health > /dev/null 2>&1 || exit 1"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
