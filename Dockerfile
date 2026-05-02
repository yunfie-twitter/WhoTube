FROM node:22-bookworm-slim AS builder

WORKDIR /app

# 依存関係のインストール
COPY package*.json ./
RUN npm install

# アプリケーションのビルド
COPY . .
RUN npm run build

# 実行用イメージ
FROM node:22-bookworm-slim

WORKDIR /app

# Install streamlink and dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/streamlink-venv && \
    /opt/streamlink-venv/bin/pip install --no-cache-dir streamlink

ENV PATH="/opt/streamlink-venv/bin:$PATH"

# ビルドしたファイルと依存関係をコピー
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig*.json ./

# 環境変数の設定
ENV NODE_ENV=production
ENV PORT=3000

# ポートの公開
EXPOSE 3000

# アプリケーションの起動
CMD ["npx", "tsx", "--env-file=.env", "src/server/index.ts"]
