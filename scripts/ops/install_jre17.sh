#!/bin/bash
#
# JRE 17 (OpenJDK headless) 幂等安装脚本
# Work Item: WI-0002 / TASK-W02-002
#
# 说明:
#   - 仅安装 java-17-openjdk-headless（精简 JRE，不含完整 JDK / Maven / GUI 依赖）
#   - 幂等：若系统中已存在主版本号为 17.x 的 java，则跳过安装并退出 0
#   - 通过 /etc/profile.d/fj_java_home.sh 配置 JAVA_HOME 与 PATH
#
# 用法（需 root 权限）:
#   sudo bash install_jre17.sh
#
set -euo pipefail

# ---------- 工具函数 ----------
log()  { echo "[install_jre17] $*"; }
fail() { echo "[install_jre17][ERROR] $*" >&2; exit 1; }

# ---------- 前置检查 ----------
preflight() {
    log "=== 前置检查 ==="

    # 安装与写入 /etc/profile.d 均需要 root 权限
    if [ "$(id -u)" -ne 0 ]; then
        fail "本脚本需要 root 权限运行（请使用 sudo）"
    fi

    log "前置检查通过"
}

# ---------- 幂等检测 ----------
# 检查现有 java：若主版本号已是 17，则打印提示并退出 0（脚本整体跳过）
check_existing_java() {
    log "=== 检查现有 java ==="

    # 未安装 java 时进入安装流程
    if ! command -v java >/dev/null 2>&1; then
        log "未检测到 java，进入安装流程"
        return 0
    fi

    # java -version 输出走 stderr，合并后取首行
    local cur_line
    cur_line=$(java -version 2>&1 | head -1 || true)
    log "当前 java 版本: ${cur_line}"

    # 提取主版本号（兼容 "17" 与 "17.0.x"）；提取失败时默认为 0
    local major
    major=$(echo "${cur_line}" | grep -oE 'version "[0-9]+' | grep -oE '[0-9]+$' || echo "0")

    if [ "${major}" = "17" ]; then
        echo "JRE 17 already installed"
        exit 0
    fi

    log "检测到非 17 版本（major=${major}），继续安装 JRE 17"
}

# ---------- 安装 JRE17 ----------
install_jre17() {
    log "=== 安装 java-17-openjdk-headless ==="

    # 仅 headless JRE，避免引入完整 JDK / Maven / GUI 依赖
    dnf install -y java-17-openjdk-headless

    log "安装完成"
}

# ---------- 配置 JAVA_HOME ----------
configure_java_home() {
    log "=== 配置 JAVA_HOME ==="

    local profile_file="/etc/profile.d/fj_java_home.sh"

    # 写入 JAVA_HOME 与 PATH（登录 shell 自动 source）
    # 使用单引号 heredoc，确保 $(...) 字面写入文件，由运行时解析
    cat > "${profile_file}" <<'EOF'
export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))
export PATH=$JAVA_HOME/bin:$PATH
EOF

    chmod 644 "${profile_file}"

    log "已写入 ${profile_file}"
}

# ---------- 验证 ----------
verify() {
    log "=== 验证 ==="
    java -version 2>&1
    log "JRE 17 安装与配置完成"
}

# ---------- 主流程 ----------
main() {
    # 交互确认：执行前打印操作摘要，给操作者取消机会
    log "操作摘要:"
    log "  - 安装包: java-17-openjdk-headless（仅 headless JRE）"
    log "  - 配置文件: /etc/profile.d/fj_java_home.sh（JAVA_HOME + PATH）"
    log "  - 行为: 幂等，若已装 17.x 则跳过"
    echo
    log "如需取消请按 Ctrl+C，3 秒后开始..."
    sleep 3

    preflight
    check_existing_java
    install_jre17
    configure_java_home
    verify

    log "全部步骤完成"
}

main "$@"
