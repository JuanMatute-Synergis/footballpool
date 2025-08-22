# Use Node.js as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm install

# Install frontend dependencies and build
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# Copy backend source
WORKDIR /app/backend
COPY backend/src ./src
COPY backend/seeds ./seeds
COPY backend/migrations ./migrations
COPY backend/.env.example .env

# Copy built frontend to backend public directory
RUN mkdir -p public
COPY frontend/dist/nfl-picks/* ./public/

# Expose port
EXPOSE 3000

# Create database directory
RUN mkdir -p /app/data

# Start command
CMD ["npm", "start"]
