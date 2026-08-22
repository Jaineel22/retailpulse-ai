# RetailPulse AI — frontend (React/Vite) production image.
# Multi-stage: build the static bundle with Node, then serve it with nginx —
# the built container never runs a Node process, just static files.

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Vite inlines VITE_* variables into the bundle AT BUILD TIME, not at container
# runtime — so the backend URL must be supplied as a build arg, not a normal
# environment variable on the running container.
ARG VITE_API_URL=http://localhost:5000/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --spider http://localhost/ || exit 1
