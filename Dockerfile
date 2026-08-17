# Koyeb 单服务部署：Express 同时托管 API 与前端静态页
FROM node:20-alpine
WORKDIR /app

# 先拷贝依赖清单以利用镜像层缓存
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev

COPY server ./server
COPY client ./client

ENV NODE_ENV=production
EXPOSE 8000
CMD ["node", "server/src/server.js"]
