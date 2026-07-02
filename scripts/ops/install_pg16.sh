#!/bin/bash
#
# PostgreSQL 13 → 16 全新安装幂等脚本
# Work Item: WI-0002 / TASK-W02-001
#
# 说明:
#   - 全新安装 PG16（非原地升级，不保留 PG13 数据）
#   - 幂等：PG16 已装则跳过安装阶段；配置与服务步骤始终幂等执行，重复运行不报错
#   - 数据库密码从环境变量 FJ_DB_PASSWORD 读取，禁止硬编码
#   - 不创建业务数据库和用户（由 init_database.sh / TASK-W02-007 负责）
#
# 用法（需 root 权限，交互式终端执行）:
#   export FJ_DB_PASSWORD='<你的强密码>'
#   sudo -E bash install_pg16.sh
#
set -euo pipefail

# ---------- 可配置变量 ----------
PG16_VERSION="16"
PG16_SERVICE="postgresql-${PG16_VERSION}"
PG16_DATA="/var/lib/pgsql/${PG16_VERSION}/data"
PG16_HBA="${PG16_DATA}/pg_hba.conf"
PG16_CONF="${PG16_DATA}/postgresql.conf"
PG13_SERVICE="postgresql"
PG13_PACKAGES="postgresql-server"

# ---------- 工具函数 ----------
log()  { echo "[install_pg16] $*"; }
fail() { echo "[install_pg16][ERROR] $*" >&2; exit 1; }

# 设置 postgresql.conf 参数：先删除已有该参数的行（含注释行），再追加新值
# 该方式幂等：重复执行结果恒为期望值，不产生重复行
set_conf() {
    local file="$1" key="$2" value="$3"
    sed -i -E "/^[[:space:]]*#?[[:space:]]*${key}[[:space:]]*=/d" "${file}"
    printf '%s = %s\n' "${key}" "${value}" >> "${file}"
}

# ---------- 前置检查 ----------
preflight() {
    log "=== 前置检查 ==="

    # 安装与服务管理需要 root 权限
    if [ "$(id -u)" -ne 0 ]; then
        fail "本脚本需要 root 权限运行（请使用 sudo）"
    fi

    # 数据库密码从环境变量读取，禁止硬编码
    # 注意：本脚本不创建业务用户，此变量供后续 init_database.sh（TASK-W02-007）使用；
    # 这里仅做环境就绪校验，避免到后续步骤才发现缺失
    if [ -z "${FJ_DB_PASSWORD:-}" ]; then
        fail "环境变量 FJ_DB_PASSWORD 未设置。请先执行 export FJ_DB_PASSWORD='<密码>' 后重试。"
    fi

    log "前置检查通过"
}

# ---------- 交互确认 ----------
confirm() {
    log "操作摘要:"
    log "  - 将卸载 PG13（如存在，含停止旧服务）"
    log "  - 将安装 PostgreSQL ${PG16_VERSION}（postgresql${PG16_VERSION}-server）"
    log "  - 将初始化数据目录 ${PG16_DATA}"
    log "  - 将配置 pg_hba.conf（local=peer, 127.0.0.1=scram-sha-256）"
    log "  - 将配置 postgresql.conf（shared_buffers=512MB 等）"
    log "  - 将启用并启动 ${PG16_SERVICE}"
    log "  - 幂等：PG16 已装则跳过安装阶段，配置与服务重复执行不报错"
    log "  - 不创建数据库和用户（由 init_database.sh 负责）"
    echo

    # 等待用户显式确认；输入 yes 才继续，其他任意输入均取消
    read -r -p "确认执行以上操作？输入 yes 继续，其他任意输入取消: " confirm_input
    if [ "${confirm_input}" != "yes" ]; then
        fail "用户取消执行"
    fi
}

# ---------- 检查并卸载 PG13 ----------
# 如检测到 PG13 存在：停止旧服务 → 卸载 PG13 包（幂等，不存在则跳过）
uninstall_pg13_if_present() {
    log "=== 检查并卸载 PG13（如存在）==="

    # 通过 rpm 包或 psql 版本号判断 PG13 是否存在
    local pg13_present=0
    if rpm -q ${PG13_PACKAGES} >/dev/null 2>&1; then
        pg13_present=1
    elif command -v psql >/dev/null 2>&1 && psql --version 2>/dev/null | grep -qw 13; then
        pg13_present=1
    fi

    # PG13 不存在则跳过卸载
    if [ "${pg13_present}" -eq 0 ]; then
        log "未检测到 PG13，无需卸载"
        return
    fi

    # 停止并禁用旧的 PG13 服务（服务不存在时忽略错误）
    log "检测到 PG13，停止旧服务"
    systemctl stop "${PG13_SERVICE}" 2>/dev/null || true
    systemctl disable "${PG13_SERVICE}" 2>/dev/null || true

    # 卸载 PG13 包（无包时 dnf 不会报错，|| true 兜底）
    log "卸载 PG13 包: ${PG13_PACKAGES}"
    dnf remove -y ${PG13_PACKAGES} || true

    log "PG13 卸载完成"
}

# ---------- 幂等检测：PG16 是否已安装 ----------
# 通过 rpm 包查询 postgresql16-server 是否已安装，决定是否进入安装阶段
check_pg16_installed() {
    log "=== 检查 PostgreSQL ${PG16_VERSION} 安装状态 ==="

    if rpm -q postgresql${PG16_VERSION}-server >/dev/null 2>&1; then
        log "PostgreSQL ${PG16_VERSION} 已安装，跳过安装阶段"
        return 0
    fi

    log "PostgreSQL ${PG16_VERSION} 未安装"
    return 1
}

# ---------- 安装 PG16 ----------
install_pg16() {
    log "=== 安装 PostgreSQL ${PG16_VERSION} ==="

    dnf install -y postgresql${PG16_VERSION}-server

    log "PostgreSQL ${PG16_VERSION} 安装完成"
}

# ---------- 初始化 PG16 数据目录 ----------
# 使用官方 setup 脚本初始化；若数据目录已存在（PG_VERSION 存在）则跳过
init_pg16() {
    log "=== 初始化 PostgreSQL ${PG16_VERSION} 数据目录 ==="

    # 数据目录已存在则视为已初始化，跳过 initdb
    if [ -f "${PG16_DATA}/PG_VERSION" ]; then
        log "数据目录已存在（${PG16_DATA}/PG_VERSION），跳过 initdb"
        return
    fi

    postgresql-16-setup --initdb

    log "数据目录初始化完成: ${PG16_DATA}"
}

# ---------- 配置 pg_hba.conf ----------
# local 连接使用 peer；127.0.0.1 TCP 连接使用 scram-sha-256
configure_hba() {
    log "=== 配置 pg_hba.conf ==="

    # 备份原文件（每次执行生成带时间戳的备份，便于回滚）
    cp -p "${PG16_HBA}" "${PG16_HBA}.bak.$(date +%s)" 2>/dev/null || true

    # 重写为最小认证规则（幂等：每次覆盖为期望状态，结果恒定）
    cat > "${PG16_HBA}" <<'EOF'
# TYPE  DATABASE        USER            ADDRESS                 METHOD
# 本地 Unix socket 连接使用 peer（操作系统用户映射）
local   all             all                                     peer
# IPv4 本地回环 TCP 连接使用 scram-sha-256
host    all             all             127.0.0.1/32            scram-sha-256
# IPv6 本地回环 TCP 连接使用 scram-sha-256
host    all             all             ::1/128                 scram-sha-256
EOF

    chmod 600 "${PG16_HBA}"

    log "pg_hba.conf 已配置（local=peer, 127.0.0.1=scram-sha-256）"
}

# ---------- 配置 postgresql.conf ----------
configure_conf() {
    log "=== 配置 postgresql.conf ==="

    # 备份原文件
    cp -p "${PG16_CONF}" "${PG16_CONF}.bak.$(date +%s)" 2>/dev/null || true

    # 依次设置关键运行参数（set_conf 幂等：先删旧行再追加新值）
    set_conf "${PG16_CONF}" shared_buffers       "512MB"
    set_conf "${PG16_CONF}" effective_cache_size "1GB"
    set_conf "${PG16_CONF}" max_connections      "50"
    set_conf "${PG16_CONF}" work_mem             "4MB"
    set_conf "${PG16_CONF}" timezone             "Asia/Shanghai"
    set_conf "${PG16_CONF}" listen_addresses     "'127.0.0.1'"

    log "postgresql.conf 已配置（shared_buffers=512MB, effective_cache_size=1GB, max_connections=50, work_mem=4MB, timezone=Asia/Shanghai, listen_addresses=127.0.0.1）"
}

# ---------- 启动并启用服务 ----------
start_service() {
    log "=== 启用并启动 ${PG16_SERVICE} ==="

    # 开机自启
    systemctl enable "${PG16_SERVICE}"

    # restart 等价于 stop+start：确保配置变更生效；服务未运行时自动启动
    systemctl restart "${PG16_SERVICE}"

    log "${PG16_SERVICE} 已启用并运行"
}

# ---------- 验证 ----------
verify() {
    log "=== 验证 ==="

    systemctl is-active "${PG16_SERVICE}"
    psql --version

    log "PostgreSQL ${PG16_VERSION} 安装与配置完成"
}

# ---------- 主流程 ----------
main() {
    log "PostgreSQL ${PG16_VERSION} 全新安装（幂等）"

    # 前置检查（root 权限 + 环境变量）
    preflight

    # 交互确认：打印操作摘要，等待用户显式确认后再执行破坏性操作
    confirm

    # 各阶段幂等：内部均自带存在性检查，重复执行不报错
    uninstall_pg13_if_present

    # PG16 已装则跳过安装，否则安装
    if check_pg16_installed; then
        log "跳过安装 PostgreSQL ${PG16_VERSION}（已就位）"
    else
        install_pg16
    fi

    # 数据目录已初始化则跳过 initdb
    init_pg16

    # 配置阶段：始终幂等执行（重写为期望状态）
    configure_hba
    configure_conf

    # 服务阶段：始终幂等执行
    start_service

    verify

    log "全部步骤完成 ✓"
}

main "$@"
