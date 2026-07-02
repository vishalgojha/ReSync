FROM node:22-alpine
WORKDIR /app

# Backend dependencies
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm install

# Build frontend
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm install
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Backend source
COPY backend/ ./backend/

EXPOSE 4000
CMD ["npx", "tsx", "backend/src/index.ts"]
