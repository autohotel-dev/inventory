# Usar una imagen ligera de Node.js
FROM node:18-alpine

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias (solo producción)
RUN npm ci --only=production

# Copiar el resto del código
COPY scripts ./scripts
COPY .env.local ./

# El comando por defecto para iniciar el worker
CMD ["node", "scripts/tuya-poll.js"]
