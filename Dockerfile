FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (use npm install instead of npm ci)
RUN npm install

# Install Playwright browsers
RUN npx playwright install chromium

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Remove devDependencies after build
RUN npm prune --production

# Create required directories
RUN mkdir -p /data /videos /data/chrome-profile /app/uploads

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/index.js"]
