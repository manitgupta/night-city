# Stage 1: Build Frontend
FROM node:18-alpine as frontend-build

WORKDIR /app/frontend
COPY schema-agent-ui/package*.json ./
RUN npm ci
COPY schema-agent-ui/ ./
# Build the frontend - this produces /app/frontend/dist
RUN npm run build

# Stage 2: Backend & Final Image
FROM python:3.13-slim

WORKDIR /app

# Install system dependencies and command-line tools for app migration agent
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    maven \
    gradle \
    default-jdk \
    findutils \
    grep \
    coreutils \
    curl \
    wget \
    jq \
    unzip \
    tar \
    nodejs \
    npm \
    golang-go \
    make \
    tree \
    sed \
    gawk \
    gnupg \
    apt-transport-https \
    && rm -rf /var/lib/apt/lists/*

# Install Google Cloud CLI
RUN curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/cloud.google-archive-keyring.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list && \
    apt-get update && apt-get install -y google-cloud-cli && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY schema-agent-backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY schema-agent-backend/ .
RUN chmod +x start.sh

# Copy built frontend assets to app/static
# The backend expects static files in "app/static" as per main.py configuration
# 'dist' contains 'assets' folder and index.html
COPY --from=frontend-build /app/frontend/dist /app/app/static

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Expose port (Cloud Run defaults to 8080)
EXPOSE 8080

# Run the application
# We use hostname 0.0.0.0 for container networking
CMD ["./start.sh"]
