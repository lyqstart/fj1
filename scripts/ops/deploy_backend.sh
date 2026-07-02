#!/bin/bash
#
# 后端部署脚本（本地构建 fat jar + scp + 提示用户重启）
# Work Item: WI-0002 / TASK-W02-006
#
# 说明:
#   - 服务器 svr-lg 无 Java/Maven，部署策略为本地构建 fat jar 后 scp（决策 D5-A）
#   - sudo 受限，systemctl restart 需用户手动执行
#   - Maven 默认 JDK8，每次必须显式设置 JAVA_HOME=JDK17
#
set -euo pipefail

# ===== 配置 =====
JAVA_HOME="/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64"
MVN="/opt/module/apache-maven-3.9.6/bin/mvn"
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/fj-backend"
SSH_HOST="lg"          # ssh lg 配置
REMOTE_DIR="/opt/fj/api"
REMOTE_USER="root"
JAR_NAME="fj-api-1.0.0.jar"
BACKUP_DIR="$REMOTE_DIR/backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# ===== 1. 本地构建 =====
echo "===== Step 1: Building fat jar (JDK17) ====="
export JAVA_HOME
"$MVN" -f "$BACKEND_DIR/pom.xml" package -DskipTests -q
JAR_PATH="$BACKEND_DIR/fj-api/target/$JAR_NAME"
if [ ! -f "$JAR_PATH" ]; then
  echo "ERROR: JAR not found at $JAR_PATH"
  exit 1
fi
JAR_SIZE=$(du -h "$JAR_PATH" | cut -f1)
echo "Built: $JAR_PATH ($JAR_SIZE)"

# ===== 2. 备份远程旧 jar =====
echo "===== Step 2: Backing up remote old jar ====="
ssh "$SSH_HOST" "mkdir -p $BACKUP_DIR"
ssh "$SSH_HOST" "if [ -f $REMOTE_DIR/$JAR_NAME ]; then cp $REMOTE_DIR/$JAR_NAME $BACKUP_DIR/${JAR_NAME%.jar}_$TIMESTAMP.jar && echo 'Backed up old jar'; else echo 'No old jar to backup'; fi"

# ===== 3. scp jar + 配置 =====
echo "===== Step 3: Copying jar to server ====="
scp "$JAR_PATH" "$SSH_HOST:$REMOTE_DIR/$JAR_NAME"

# 同时 scp application-prod.yml（如果 deploy/config 下有）
if [ -f "$PROJECT_ROOT/deploy/config/application-prod.yml" ]; then
  scp "$PROJECT_ROOT/deploy/config/application-prod.yml" "$SSH_HOST:$REMOTE_DIR/application-prod.yml"
  echo "Copied application-prod.yml"
fi

# ===== 4. 提示用户重启（sudo 受限）=====
echo "===== Step 4: Restart required ====="
echo "由于 sudo 受限，请手动执行以下命令重启服务："
echo "  ssh $SSH_HOST 'systemctl restart fj-api'"
echo ""
echo "重启后验证："
echo "  ssh $SSH_HOST 'systemctl status fj-api'"
echo "  ssh $SSH_HOST 'curl -sf http://localhost:8080/api/actuator/health'"
echo ""
echo "如需回滚，执行： scripts/ops/rollback_backend.sh"
