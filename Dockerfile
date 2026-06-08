FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Create required directories
RUN mkdir -p /data /videos /data/chrome-profile /app/uploads

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/index.js"]
