#!/bin/bash
set -euo pipefail

# 检查当前目录
REQUIRED_DIR="/root/deploy/navydev.top"
CURRENT_DIR="$(pwd)"

if [[ "$CURRENT_DIR" != "$REQUIRED_DIR" ]]; then
  echo "❌ 错误：请在 $REQUIRED_DIR 目录下运行此脚本 (当前: $CURRENT_DIR)"
  exit 1
fi

# === 配置 ===
CERTBOT_DIR="/root/deploy/navydev.top/data/certbot/conf"
LIVE_DIR="$CERTBOT_DIR/live"
ARCHIVE_DIR="$CERTBOT_DIR/archive"
RENEWAL_DIR="$CERTBOT_DIR/renewal"
BACKUP_DIR="/root/certbot-backup-$(date +%F-%H%M%S)"

DOMAINS=(
  "navydev.top"
  "crabtris.navydev.top"
  "rss.navydev.top"
  "obz.navydev.top"
)

echo "=== 1. 备份证书目录到 $BACKUP_DIR ==="
mkdir -p "$BACKUP_DIR"
cp -r "$CERTBOT_DIR" "$BACKUP_DIR"

echo "=== 2. 删除重复目录（保留主目录） ==="
for domain in "${DOMAINS[@]}"; do
  echo "处理 $domain ..."
  find "$LIVE_DIR" -maxdepth 1 -type d -name "${domain}-*" | while read -r dupdir; do
    echo "  -> 删除重复目录: $dupdir"
    rm -rf "$dupdir"
  done
  find "$ARCHIVE_DIR" -maxdepth 1 -type d -name "${domain}-*" | while read -r dupdir; do
    echo "  -> 删除 archive 重复目录: $dupdir"
    rm -rf "$dupdir"
  done
  find "$RENEWAL_DIR" -maxdepth 1 -type f -name "${domain}-*.conf" | while read -r duprenew; do
    echo "  -> 删除 renewal 配置: $duprenew"
    rm -f "$duprenew"
  done
done

echo "=== 3. 使用 Certbot 重新签发证书 ==="

# 通用参数
WEBROOT="$(pwd)/data/certbot/www"
CONFIG_DIR="$(pwd)/data/certbot/conf"
WORK_DIR="$(pwd)/data/certbot/conf"
LOGS_DIR="$(pwd)/data/certbot/conf/logs"
EMAIL="wsgggws@gmail.com"

for DOMAIN in "${DOMAINS[@]}"; do
  echo "==== 正在为 $DOMAIN 申请证书 ===="
  certbot certonly --webroot \
    --webroot-path="$WEBROOT" \
    --config-dir="$CONFIG_DIR" \
    --work-dir="$WORK_DIR" \
    --logs-dir="$LOGS_DIR" \
    --cert-name "$DOMAIN" \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email
done

echo "✅ 所有证书申请完成"

echo "=== 完成！证书已清理并重新签发。 ==="
