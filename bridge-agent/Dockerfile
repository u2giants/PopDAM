FROM node:20-slim

# Install Ghostscript + Inkscape for AI/EPS rendering, and other utils
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    inkscape \
    file \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npx tsc

# Run
CMD ["node", "dist/index.js"]
