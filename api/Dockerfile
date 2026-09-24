FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app

# fonts-liberation/carlito/caladea/dejavu (2026-09-24, theo yeu cau "khi
# chuyển đổi sang PDF, yêu cầu giữ nguyên font chữ, không tự đổi sang font
# chữ khác") - base image node:22-slim KHONG co san bat ky font Microsoft
# nao (Times New Roman/Arial/Calibri/Cambria...). Khi file .docx/.xlsx/.pptx
# tham chieu font khong ton tai, LibreOffice AM THAM thay bang font khac
# (thuong xau/lech dong) ma khong bao loi - day la nguyen nhan goc, khong
# phai loi cau hinh convert. 4 goi nay la font open-source duoc thiet ke
# KHOP CHINH XAC metric (kich thuoc/khoang cach ky tu) voi font Microsoft
# tuong ung: fonts-liberation ~ Times New Roman/Arial/Courier New,
# fonts-crosextra-carlito ~ Calibri, fonts-crosextra-caladea ~ Cambria,
# fonts-dejavu la fallback Unicode rong (bao gom dau tieng Viet) cho cac
# font khac khong co ban thay the rieng - LibreOffice tu dong map dung ten
# font trong file sang ban thay the co metric giong het, giu nguyen do dai
# dong/ngat trang.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    ghostscript \
    qpdf \
    fonts-liberation \
    fonts-crosextra-carlito \
    fonts-crosextra-caladea \
    fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV STORAGE_DIR=/data/storage
RUN mkdir -p /data/storage

EXPOSE 3000
CMD ["node", "dist/main.js"]
