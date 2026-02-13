# =============================================================================
# Fit Buddy - Multi-stage Docker Build
# Stage 1: Build React frontend with Node 20
# Stage 2: Run Flask API with Python 3.12, serve built frontend
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Frontend Build
# ---------------------------------------------------------------------------
FROM node:20-alpine AS frontend-build

WORKDIR /build

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --prefer-offline

# Copy frontend source
COPY index.html ./
COPY vite.config.js ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY src/ ./src/

# Build production bundle
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: Python API + Static Frontend
# ---------------------------------------------------------------------------
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy and install local garminconnect package
COPY python-garminconnect/ ./python-garminconnect/
RUN pip install --no-cache-dir -e ./python-garminconnect

# Copy application code
COPY app.py .
COPY auth.py .
COPY database.py .
COPY utils.py .

# Copy built frontend from Stage 1
COPY --from=frontend-build /build/dist ./dist

# Create directory for Garmin token persistence
RUN mkdir -p /root/.garminconnect

# Expose port
EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Run with gunicorn (2 workers - single user dashboard, no need for more)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "app:app"]
