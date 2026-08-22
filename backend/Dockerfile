# RetailPulse AI — backend (Node/Express) production image.
FROM node:22-alpine

WORKDIR /app

# Install only production dependencies — jest/nodemon/supertest/mongodb-memory-server
# (devDependencies) are never needed at runtime and are excluded here.
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
EXPOSE 5000

# No curl/wget in node:alpine by default — use Node's own http client instead
# of adding a package just for the healthcheck.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get({host:'localhost',port:process.env.PORT||5000,path:'/health'},res=>process.exit(res.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
