# ============================================================
#  meetmydash. Dokploy lee este archivo, arma la app y la publica.
#  Etapa 1: instala todo, corre las PRUEBAS y arma las pantallas.
#           Si una prueba falla, el armado falla y NO se publica:
#           queda funcionando la versión anterior.
#  Etapa 2: la app final, liviana, solo con lo necesario para correr.
# ============================================================
FROM node:24-bookworm-slim AS armado
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm test
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY servidor ./servidor
COPY --from=armado /app/dist ./dist

# Los datos viven acá. En Dokploy hay que montar un volumen en /app/data;
# si no, se pierden en cada publicación.
RUN mkdir -p /app/data
ENV DATA_DIR=/app/data
ENV PORT=3000
# El contenedor corre en UTC; las fechas de la app se calculan en hora de Argentina.
ENV TZ=America/Argentina/Buenos_Aires
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "servidor/index.ts"]
