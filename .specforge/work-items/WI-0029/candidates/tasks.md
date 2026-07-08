# WI-0029 Tasks

## TASK-1: 后端 AppLogController + Service + DTO
- 创建: fj-common/.../applog/AppLogController.java
- 创建: fj-common/.../applog/AppLogService.java
- 创建: fj-common/.../applog/dto/LogBatchRequest.java
- 修改: SecurityConfig.java permitAll
- 验证: mvn compile

## TASK-2: 前端 Logger.flush() 接通
- 修改: src/utils/Logger.ts
- 验证: tsc --noEmit

## TASK-3: 后端编译验证
- mvn clean compile -q

## TASK-4: 前端构建 Release APK
- Docker assembleRelease