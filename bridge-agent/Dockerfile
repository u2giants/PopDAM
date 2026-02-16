FROM node:20-slim

# Install Ghostscript + Inkscape for AI/EPS rendering, and other utils
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    inkscape \
    imagemagick \
    file \
    && rm -rf /var/lib/apt/lists/* \
    && sed -i 's/rights="none" pattern="PS"/rights="read|write" pattern="PS"/' /etc/ImageMagick-6/policy.xml || true \
    && sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/' /etc/ImageMagick-6/policy.xml || true \
    && sed -i 's/rights="none" pattern="XPS"/rights="read|write" pattern="XPS"/' /etc/ImageMagick-6/policy.xml || true

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN ./node_modules/.bin/tsc

# Run
CMD ["node", "dist/index.js"]
