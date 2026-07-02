#!/bin/bash
set -euo pipefail

# ===== 飞检系统数据库初始化 =====
# 前置条件：install_pg16.sh 已成功执行
# 执行身份：root（通过 su - postgres 执行 psql）

# 检查环境变量
if [ -z "${FJ_DB_PASSWORD:-}" ]; then
  echo "ERROR: 请先设置 FJ_DB_PASSWORD 环境变量"
  echo "  export FJ_DB_PASSWORD='your_secure_password'"
  exit 1
fi

DB_NAME="fj_inspect"
DB_USER="fj_app"
DB_PASSWORD="$FJ_DB_PASSWORD"

echo "===== 初始化数据库 ====="
echo "数据库: $DB_NAME"
echo "用户: $DB_USER"
echo ""

# 检查用户是否已存在
USER_EXISTS=$(su - postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'\"" 2>/dev/null || echo "0")
if [ "$USER_EXISTS" = "1" ]; then
  echo "用户 $DB_USER 已存在，跳过创建"
else
  echo "创建用户 $DB_USER ..."
  su - postgres -c "psql -c \"CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD'\""
  echo "用户 $DB_USER 创建成功"
fi

# 检查数据库是否已存在
DB_EXISTS=$(su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='$DB_NAME'\"" 2>/dev/null || echo "0")
if [ "$DB_EXISTS" = "1" ]; then
  echo "数据库 $DB_NAME 已存在，跳过创建"
else
  echo "创建数据库 $DB_NAME ..."
  su - postgres -c "createdb -O $DB_USER $DB_NAME"
  echo "数据库 $DB_NAME 创建成功（owner: $DB_USER）"
fi

# 授予权限（幂等 — GRANT 重复执行无副作用）
echo "授予权限 ..."
su - postgres -c "psql -d $DB_NAME -c \"GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER\""
su - postgres -c "psql -d $DB_NAME -c \"GRANT ALL PRIVILEGES ON SCHEMA public TO $DB_USER\""

# 验证连接
echo ""
echo "===== 验证连接 ====="
if PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -h 127.0.0.1 -c "SELECT version();" > /dev/null 2>&1; then
  echo "✅ 连接成功：$DB_USER@$DB_NAME"
else
  echo "❌ 连接失败，请检查 pg_hba.conf 和密码"
  exit 1
fi

echo ""
echo "数据库初始化完成。"
echo "后续：Flyway 迁移将在后端首次启动时自动执行（V1~V7）。"
