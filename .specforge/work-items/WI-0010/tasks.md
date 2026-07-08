# Tasks — WI-0010 (版本控制卫生)

> Work Item: WI-0010
> Workflow Type: quick_change
> Workflow Path: code_only_fast_path

### TASK-1 git commit 版本控制卫生

**context_block**:
- **What**: 修改 .gitignore 添加 target/ 排除，git rm --cached 移除构建产物索引，git add 暂存源码变更，git commit 提交
- **Why**: WI-0003~0009 的源码变更已部署到生产但从未 git commit
- **Where**:
  - read_files: [git status 输出]
  - allowed_write_files: [.gitignore]
  - forbidden_files: [所有源码文件（不修改内容）、.specforge/**]
- **Constraints**:
  - 不修改任何源码文件内容
  - git rm --cached 只移除索引不删除物理文件
  - commit message 涵盖 WI-0003~0009 变更
  - 不 git push（本地操作）
- **Done When**:
  - .gitignore 含 target/ 排除规则
  - git commit 成功
  - git status 显示 clean（或仅 .specforge 运行时）

**task_id**: TASK-1
**refs**: [intake.AC-1, AC-2, AC-3, AC-4]
**depends_on**: []
**parallel**: false
**requires_user_confirmation**: false
**destructive**: false

**operation_commands**:
1. 修改 .gitignore：在末尾添加 `target/`
2. `git rm -r --cached fj-backend/**/target/`（移除构建产物索引，保留物理文件）
3. `git add .gitignore` + `git add` 所有源码变更（.java/.sql/.yml/scripts/deploy）
4. `git commit -m "..."`（涵盖 WI-0003~0009 变更）

**verification_commands**:
- `git log -1 --oneline`（确认新提交）
- `git status --short | wc -l`（确认 clean 或仅剩少量运行时文件）

**files_to_modify**: [".gitignore"]

**out_of_scope**:
- 不 push 到远程
- 不修改源码内容
- 不修改 .specforge/ 治理产物
