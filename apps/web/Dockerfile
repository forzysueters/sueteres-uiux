FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --workspace @forzy/web --include-workspace-root
COPY apps/web ./apps/web
EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace", "@forzy/web", "--", "--host", "0.0.0.0"]
