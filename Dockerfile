# ===== SIAKAD MBS Poncowati — image untuk Cloud Run =====
FROM node:20-bookworm-slim

# Alat build untuk modul native (better-sqlite3) bila prebuilt tidak tersedia
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependency (manfaatkan cache layer)
COPY package*.json ./
RUN npm install --omit=dev

# Salin kode aplikasi
COPY . .

ENV NODE_ENV=production
# Database ditulis ke lokasi writable di Cloud Run
ENV DATA_DIR=/tmp/data
# Cloud Run akan menyuntikkan PORT (default 8080); server memakai process.env.PORT
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
