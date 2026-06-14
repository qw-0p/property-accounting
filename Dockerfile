FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip \
      tesseract-ocr tesseract-ocr-ukr \
      libglib2.0-0 libgl1 \
 && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --break-system-packages \
      opencv-python-headless numpy pytesseract

RUN corepack enable && corepack prepare pnpm@10.30.2 --activate

WORKDIR /app

COPY . .

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

ENV NODE_ENV=production

WORKDIR /app/server

EXPOSE 3000

CMD ["node", "src/index.js"]