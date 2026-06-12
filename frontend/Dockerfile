# Usar una imagen ligera de Node.js
FROM node:22-alpine

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias (solo producción)
RUN npm ci --omit=dev

# Copiar el resto del código
COPY scripts ./scripts

# El comando por defecto para iniciar el worker
CMD ["node", "scripts/tuya-poll.js"]
