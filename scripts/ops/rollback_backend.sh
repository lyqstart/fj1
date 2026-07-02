#!/bin/bash
#
# 后端回滚脚本（列备份 → 选择 → cp 覆盖 → 提示重启）
# Work Item: WI-0002 / TASK-W02-006
#
# 说明:
#   - 从远程备份目录列出历史 jar，交互选择后 cp 覆盖当前 jar
#   - sudo 受限，systemctl restart 需用户手动执行
#
set -euo pipefail

SSH_HOST="lg"
REMOTE_DIR="/opt/fj/api"
BACKUP_DIR="$REMOTE_DIR/backup"
JAR_NAME="fj-api-1.0.0.jar"

echo "===== 可用备份 ====="
# 列出备份
BACKUPS=$(ssh "$SSH_HOST" "ls -1 $BACKUP_DIR/*.jar 2>/dev/null | sort -r")
if [ -z "$BACKUPS" ]; then
  echo "没有可用备份"
  exit 1
fi
echo "$BACKUPS" | nl

echo ""
read -p "选择要回滚的备份编号（输入序号）: " CHOICE
SELECTED=$(echo "$BACKUPS" | sed -n "${CHOICE}p")
if [ -z "$SELECTED" ]; then
  echo "无效选择"
  exit 1
fi
echo "将回滚到: $SELECTED"
read -p "确认回滚？(yes): " CONFIRM
[ "$CONFIRM" != "yes" ] && echo "取消" && exit 0

# 执行回滚
ssh "$SSH_HOST" "cp $SELECTED $REMOTE_DIR/$JAR_NAME"
echo "已恢复 jar。请手动重启："
echo "  ssh $SSH_HOST 'systemctl restart fj-api'"
