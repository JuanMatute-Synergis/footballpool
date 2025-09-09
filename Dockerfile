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
COPY backend/scripts ./scripts
COPY backend/public ./public

# Copy built frontend to backend public directory
RUN rm -rf ./public/index.html ./public/assets 2>/dev/null || true
RUN cp -r /app/frontend/dist/nfl-picks/* ./public/ || cp -r /app/frontend/dist/* ./public/

# Copy production environment file
COPY .env.production .env

# Expose port
EXPOSE 3001

# Create database directory (this will be replaced by volume mount in production)
RUN mkdir -p /app/data

# Start command with volume mount verification - no seed execution needed
CMD ["sh", "-c", "\
echo 'Starting NFL Picks application...'; \
\
# Wait for volume mount to be ready (production deployment timing fix) \
if [ \"$NODE_ENV\" = \"production\" ]; then \
  echo 'Production mode: Waiting for volume mount to be ready...'; \
  for i in $(seq 1 10); do \
    if mountpoint -q /app/data 2>/dev/null || [ -w /app/data ]; then \
      echo 'Volume mount is ready'; \
      break; \
    fi; \
    echo \"Waiting for volume mount... attempt $i/10\"; \
    sleep 2; \
  done; \
  \
  # Verify we can write to the data directory \
  if [ ! -w /app/data ]; then \
    echo 'ERROR: /app/data is not writable - volume mount may have failed'; \
    exit 1; \
  fi; \
  \
  echo 'Volume mount verified, proceeding with application startup...'; \
fi; \
\
# Database schema will be automatically initialized by the application \
echo 'Database schema will be initialized by application on startup...'; \
\
# Start the application \
echo 'Starting application server...'; \
npm start"]
