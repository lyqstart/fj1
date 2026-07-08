# Intake — WI-0010 (版本控制卫生：git commit 累积源码变更)

## 变更描述

WI-0001~0009 的全部源码修改已通过 SpecForge 流程审查、验证并部署到生产，但从未做过 git commit。`git status` 显示 78 个未提交变更（其中约 12 个源码文件 + 约 60 个构建产物 + 约 6 个治理文件）。

此外 `.gitignore` 未排除 `target/` 构建产物目录，导致 Maven 构建产物污染了 git 索引。

## 目标

1. 修改 `.gitignore` 添加 `target/` 排除规则
2. `git rm --cached` 移除已跟踪的构建产物（不删除物理文件）
3. `git add` 暂存所有源码变更
4. `git commit` 提交，commit message 涵盖 WI-0003~0009 全部变更

## 变更范围

仅修改 `.gitignore` 一个文件（添加 target/ 规则）。其余操作是 git 索引操作（rm --cached、add、commit），不修改工作区源码文件。

## 守卫检查（code_only_fast_path）

- 无需求变更 ✅
- 无设计变更 ✅
- 无架构变更 ✅
- 无验收标准变更 ✅
- 无数据语义变更 ✅
- 无接口契约变化 ✅
- unknowns=[] ✅
- 不新增用户可见功能 ✅

## 验收标准

- AC-1: .gitignore 包含 `target/` 排除规则
- AC-2: `git rm --cached` 移除构建产物后 `git status` 不再显示 target/ 下的文件
- AC-3: `git commit` 成功，`git log -1` 显示新提交
- AC-4: `git status` 显示 clean（或仅剩 .specforge 运行时文件）

## 不变行为

- 不修改任何源码文件的内容（.java/.sql/.yml）
- 不修改部署配置
- 不影响生产环境
- git commit 是本地操作，不 push（除非用户另有指示）
