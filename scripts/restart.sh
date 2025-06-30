# nginx: 启动或重启
NGINX_ID=$(docker compose ps -q nginx)

if [[ -z "$NGINX_ID" ]] || [[ "$(docker inspect -f '{{.State.Running}}' "$NGINX_ID" 2>/dev/null)" != "true" ]]; then
  echo "🚀 nginx 未启动，开始启动 nginx"
  docker compose up -d nginx
else
  echo "🔁 nginx 已在运行，执行重启"
  docker compose restart nginx
fi
