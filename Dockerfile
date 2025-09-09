# Use Node.js as base image
FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files and Angular config
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY frontend/angular.json ./frontend/
COPY frontend/tsconfig*.json ./frontend/
COPY frontend/tailwind.config.js ./frontend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm install

# Install frontend dependencies and build
WORKDIR /app/frontend
COPY frontend/src ./src
RUN npm install
RUN npx ng build --configuration=production --aot
RUN ls -la dist/

# Copy backend source
WORKDIR /app/backend
COPY backend/src ./src
COPY backend/seeds ./seeds
COPY backend/scripts ./scripts
COPY backend/public ./public

# Copy built frontend to backend public directory
RUN rm -rf ./public/index.html ./public/assets 2>/dev/null || true
RUN cp -r /app/frontend/dist/nfl-picks/* ./public/ || cp -r /app/frontend/dist/* ./public/

# Copy production environment file
COPY .env.production .env

# Expose port
EXPOSE 3001

# Create database directory
RUN mkdir -p /app/data

# Initialize database on startup
RUN chmod +x seeds/seed.js

# Start command with database initialization
CMD ["sh", "-c", "node seeds/seed.js && npm start"]
