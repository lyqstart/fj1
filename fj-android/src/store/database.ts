/**
 * Database 初始化（不加密普通 SQLite）
 *
 * 设计依据：WI-0001 §7.5 / DD-1 / §6.1 / WI-0015 DD-2 / TD-ANDROID-001
 *
 * ⚠️ TD-ANDROID-001：本地数据库未加密（MVP 降级为普通 SQLite）。
 *    此前的 SQLCipher + Keystore 加密路径已于 WI-0015 移除；风险与升级路径
 *    详见 src/store/schema.ts 顶部 TD-ANDROID-001 说明。
 *
 * 集成：App 启动调用 initDatabase() 一次性初始化；业务层用 getDatabase() 同步获取；
 *      React 组件树通过 @nozbe/watermelondb/react 的 DatabaseProvider/useDatabase 注入。
 */
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema } from './schema';
import { migrations } from './migrations';
import DailyReportModel from './models/DailyReportModel';
import DailyReportIssueModel from './models/DailyReportIssueModel';
import PhotoModel from './models/PhotoModel';
import InspectionTaskModel from './models/InspectionTaskModel';

// ============== 常量 ==============
/** 本地数据库文件名（不含扩展名，SQLiteAdapter 会自动加 .db） */
export const DB_NAME = 'fj';
/**
 * （历史）keychain 中的 service 标识。
 * @deprecated TD-ANDROID-001（WI-0015）：数据库降级为不加密后，本常量不再使用，
 *             仅保留以防外部引用断裂。后续 WI 启用 SQLCipher 时可恢复使用。
 */
export const DB_KEYCHAIN_SERVICE = 'com.fj.android.dbkey';

// ============== 模型注册表 ==============
/**
 * 所有需要注册到 Database 的 Model 类。
 * 顺序无关，但新增 Model 时必须在此追加，否则 withObservables 不会触发该表的查询。
 */
export const MODEL_CLASSES = [
  DailyReportModel,
  DailyReportIssueModel,
  PhotoModel,
  InspectionTaskModel,
];

// ============== Database 初始化（单例）==============
let databaseInstance: Database | null = null;
let initializationPromise: Promise<Database> | null = null;

/**
 * 创建 SQLiteAdapter（不加密普通 SQLite，jsi: true 启用 C++ 同步桥接）。
 *
 * jsi:true 要求 watermelondb 原生模块已 link 进 APK（WI-0015 TASK-1 解除屏蔽）。
 * 如 Docker 编译失败（TASK-7），可降级为 jsi: false（性能损失但可运行）。
 */
function createAdapter(): SQLiteAdapter {
  return new SQLiteAdapter({
    schema,
    migrations,
    jsi: true,
    dbName: DB_NAME,
  });
}

/**
 * 初始化数据库实例（单例，多次调用返回同一 Database）。
 *
 * 此函数必须在 App 入口（AppRoot.tsx）中 await 后再渲染业务 UI。
 *
 * Errors:
 *  - SQLite 打开失败 / schema migration 失败时 reject。
 */
export async function initDatabase(): Promise<Database> {
  if (databaseInstance) {
    return databaseInstance;
  }
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    const adapter = createAdapter();
    databaseInstance = new Database({
      adapter,
      modelClasses: MODEL_CLASSES,
    });
    return databaseInstance;
  })();

  return initializationPromise;
}

/**
 * 同步获取已初始化的 Database 实例。
 *
 * 仅在 initDatabase() resolve 后调用；否则抛出异常。
 * 用于业务层在 React 组件外（如 sync engine、定时任务）访问数据库。
 */
export function getDatabase(): Database {
  if (!databaseInstance) {
    throw new Error(
      'Database 尚未初始化。请在 App 启动时先 await initDatabase()。',
    );
  }
  return databaseInstance;
}

/**
 * 重置数据库实例（仅用于测试或用户切换登出）。
 *
 * 注意：此函数不删除数据库文件，仅清空内存中的单例引用。
 */
export function resetDatabaseInstance(): void {
  databaseInstance = null;
  initializationPromise = null;
}
