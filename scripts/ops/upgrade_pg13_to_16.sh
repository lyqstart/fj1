#!/usr/bin/env bash
#
# PostgreSQL 13 → 16 升级脚本
# Work Item: WI-0001 / TASK-001
# 关联设计: DD-7
#
# ⚠️ 实施前必须由 DBA 确认现有 PG13 中是否有需要保留的数据。
# 本脚本默认采用 "备份 → 卸载 → 安装 → 恢复" 路径。
# 如确认无数据需保留，可使用 --fresh 参数走全新安装路径。
#
# 用法:
#   sudo bash upgrade_pg13_to_16.sh             # 保留数据路径（默认）
#   sudo bash upgrade_pg13_to_16.sh --fresh     # 全新安装路径
#   bash upgrade_pg13_to_16.sh --dry-run        # 仅打印步骤不执行
#
set -euo pipefail

# ---------- 可配置变量 ----------
BACKUP_DIR="/data/backup"
BACKUP_FILE="${BACKUP_DIR}/pg13_full_backup_$(date +%Y%m%d_%H%M%S).sql"
PG16_VERSION="16"
PG16_DATA="/var/lib/pgsql/${PG16_VERSION}/data"
PG16_BIN="/usr/pgsql-${PG16_VERSION}/bin"
PG16_SERVICE="postgresql-${PG16_VERSION}"
OLD_SERVICE="postgresql"
DB_NAME="fj_inspect"
DB_USER="fj_app"

DRY_RUN=0
FRESH=0

# ---------- 参数解析 ----------
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        --fresh)   FRESH=1 ;;
        *) echo "未知参数: $arg"; exit 2 ;;
    esac
done

# ---------- 工具函数 ----------
log()  { echo "[upgrade_pg] $*"; }
fail() { echo "[upgrade_pg][ERROR] $*" >&2; exit 1; }

run() {
    if [ "$DRY_RUN" -eq 1 ]; then
        echo "[dry-run] $*"
    else
        echo "[exec] $*"
        eval "$@"
    fi
}

# ---------- 前置检查 ----------
preflight() {
    log "=== 前置检查 ==="

    if [ "$(id -u)" -ne 0 ]; then
        fail "本脚本需要 root 权限运行（请使用 sudo）"
    fi

    if [ "$DRY_RUN" -eq 1 ]; then
        log "[dry-run] 跳过 root 权限实际校验"
    fi

    local cur_ver
    cur_ver=$(psql --version 2>/dev/null | grep -oP '\d+' | head -1 || echo "unknown")
    log "当前 PostgreSQL 版本: ${cur_ver}"

    if [ "$cur_ver" = "$PG16_VERSION" ]; then
        log "已经是 PG${PG16_VERSION}，无需升级"
        exit 0
    fi

    if [ "$cur_ver" != "13" ]; then
        fail "预期当前版本为 13，实际检测到 ${cur_ver}。请人工确认升级路径。"
    fi

    log "磁盘剩余空间检查..."
    local avail_mb
    avail_mb=$(df -m /data 2>/dev/null | awk 'NR==2{print $4}' || echo 0)
    if [ "$avail_mb" -gt 0 ] && [ "$avail_mb" -lt 10240 ]; then
        fail "/data 剩余空间不足 10GB（当前 ${avail_mb}MB），备份可能失败"
    fi

    log "前置检查通过"
}

# ---------- 备份路径 ----------
backup_path() {
    log "=== 步骤 1: 备份 PG13 数据 ==="

    run "mkdir -p ${BACKUP_DIR}"

    log "备份文件: ${BACKUP_FILE}"
    if [ "$DRY_RUN" -eq 0 ]; then
        if ! command -v pg_dumpall >/dev/null 2>&1; then
            fail "pg_dumpall 未找到，无法备份"
        fi
    fi

    run "pg_dumpall -U postgres > '${BACKUP_FILE}'"

    log "备份完成，大小: $(du -h "${BACKUP_FILE}" 2>/dev/null | cut -f1 || echo 'unknown')"
}

# ---------- 停止旧服务 ----------
stop_old_service() {
    log "=== 步骤 2: 停止 PG13 服务 ==="
    run "systemctl stop ${OLD_SERVICE}"
    run "systemctl disable ${OLD_SERVICE} || true"
}

# ---------- 卸载 PG13 ----------
uninstall_pg13() {
    log "=== 步骤 3: 卸载 PG13 ==="
    # 不删除 PG13 数据目录，留作回滚
    run "dnf remove -y postgresql-server postgresql || true"
}

# ---------- 安装 PG16 ----------
install_pg16() {
    log "=== 步骤 4: 安装 PG16 ==="

    log "启用 PGDG 仓库（如尚未启用）"
    run "dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-\$(rpm -E %{rhel})-x86_64/pgdg-redhat-repo-latest.noarch.rpm || true"

    run "dnf -qy module disable postgresql || true"
    run "dnf install -y postgresql${PG16_VERSION}-server postgresql${PG16_VERSION}"
}

# ---------- 初始化 PG16 ----------
init_pg16() {
    log "=== 步骤 5: 初始化 PG16 ==="

    if [ "$FRESH" -eq 1 ]; then
        log "全新安装路径：直接 initdb"
        run "su - postgres -c '${PG16_BIN}/initdb -D ${PG16_DATA}'"
    else
        log "保留数据路径：initdb 后通过 psql 恢复"
        run "su - postgres -c '${PG16_BIN}/initdb -D ${PG16_DATA}'"
    fi
}

# ---------- 恢复数据 ----------
restore_data() {
    log "=== 步骤 6: 恢复数据 ==="

    if [ "$FRESH" -eq 1 ]; then
        log "全新安装路径：跳过恢复，创建业务库和用户"
        run "su - postgres -c \"${PG16_BIN}/psql -c \\\"CREATE USER ${DB_USER} WITH PASSWORD 'CHANGE_ME';\\\"\""
        run "su - postgres -c \"${PG16_BIN}/psql -c \\\"CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};\\\"\""
        return
    fi

    log "从备份恢复: ${BACKUP_FILE}"
    run "su - postgres -c \"${PG16_BIN}/psql -f '${BACKUP_FILE}'\""
}

# ---------- 配置 PG16 ----------
configure_pg16() {
    log "=== 步骤 7: 配置 PG16 ==="

    run "cp '${PG16_DATA}/postgresql.conf' '${PG16_DATA}/postgresql.conf.bak.$(date +%s)'"

    CONFIG_DIR="$(cd "$(dirname "$0")/../.." && pwd)/deploy/config"
    if [ -f "${CONFIG_DIR}/postgresql-16.conf" ]; then
        log "应用 deploy/config/postgresql-16.conf"
        run "cp '${CONFIG_DIR}/postgresql-16.conf' '${PG16_DATA}/postgresql.conf'"
    else
        log "deploy/config/postgresql-16.conf 不存在，跳过覆盖（请手动同步配置）"
    fi

    if [ -f "${CONFIG_DIR}/pg_hba.conf" ]; then
        log "应用 deploy/config/pg_hba.conf"
        run "cp '${CONFIG_DIR}/pg_hba.conf' '${PG16_DATA}/pg_hba.conf'"
    fi
}

# ---------- 启动 PG16 ----------
start_pg16() {
    log "=== 步骤 8: 启动 PG16 并设置开机自启 ==="
    run "systemctl enable ${PG16_SERVICE}"
    run "systemctl start ${PG16_SERVICE}"
}

# ---------- 验证 ----------
verify_pg16() {
    log "=== 步骤 9: 验证 ==="
    run "psql -c \"SELECT version();\""
    run "psql -c \"SELECT current_setting('shared_buffers');\""
    run "psql -c \"SELECT current_setting('max_connections');\""
    log "升级完成"
}

# ---------- 主流程 ----------
main() {
    log "PostgreSQL 13 → ${PG16_VERSION} 升级开始"
    log "模式: $([ "$FRESH" -eq 1 ] && echo '全新安装' || echo '保留数据') ; DryRun: $([ "$DRY_RUN" -eq 1 ] && echo 'YES' || echo 'NO')"

    preflight
    backup_path
    stop_old_service
    uninstall_pg13
    install_pg16
    init_pg16
    restore_data
    configure_pg16
    start_pg16
    verify_pg16

    log "全部步骤完成 ✓"
}

main "$@"
