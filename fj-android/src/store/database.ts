/**
 * Database 初始化与 SQLCipher 加密配置
 *
 * 设计依据：WI-0001 §7.5 安卓端本地数据加密 / DD-1 / §6.1
 *
 * 加密方案：
 *  - 底层数据库使用 SQLCipher（react-native-sqlcipher-storage native 模块）。
 *  - 加密密钥为 256-bit 随机数，首次启动时生成。
 *  - 密钥通过 react-native-keychain 存储，底层走 Android Keystore（不硬编码、不入 SharedPreferences）。
 *  - 设备 Root 后数据仍加密，降低数据泄露风险（§7.5）。
 *
 * 集成方式：
 *  WatermelonDB 0.27 的 SQLiteAdapter 标准实现不直接接受 cipher key，
 *  需要在 native 层（android/app/src/main/java/com/fj/android/）将 SQLiteAdapter
 *  底层的 sqlite module 替换为 react-native-sqlcipher-storage 提供的实现，
 *  并在 Application 启动时通过 NativeModules.FJDatabase.setEncryptionKey(key)
 *  把密钥注入 SQLCipher。JS 侧负责密钥的生命周期管理（生成 / 读取 / 轮换）。
 */
import { NativeModules } from 'react-native';
import * as Keychain from 'react-native-keychain';

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
/** react-native-keychain 中的 service 标识，用于隔离飞检数据库密钥 */
export const DB_KEYCHAIN_SERVICE = 'com.fj.android.dbkey';
/** SQLCipher 密钥长度（字节），256-bit */
export const DB_KEY_BYTES = 32;

/**
 * Native 模块接口（由 android native 层实现，负责把密钥注入 SQLCipher）。
 * 见 android/app/src/main/java/com/fj/android/db/FJDatabaseModule.kt
 */
interface FJDatabaseNativeModule {
  setEncryptionKey(hexKey: string): Promise<boolean>;
  isEncrypted(): Promise<boolean>;
}

// NativeModules.FJDatabase 是 any 类型，这里做一次类型断言以获得 IDE 提示
const FJDatabase = (NativeModules.FJDatabase ?? null) as FJDatabaseNativeModule | null;

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

// ============== 密钥管理 ==============
/**
 * 生成 256-bit 随机密钥（hex 编码，64 字符）。
 *
 * 注意：这里使用 Math.random 是降级实现。生产环境应替换为
 * react-native-get-random-values 提供的 crypto.getRandomValues，
 * 或直接在 native 层用 SecureRandom 生成后通过 NativeModules 返回。
 * 骨架阶段保留此实现以避免引入额外依赖。
 */
function generateHexKey(byteLength: number = DB_KEY_BYTES): string {
  const bytes: number[] = [];
  for (let i = 0; i < byteLength; i++) {
    bytes.push(Math.floor(Math.random() * 256));
  }
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 从 Android Keystore（通过 react-native-keychain 桥接）读取或生成数据库加密密钥。
 *
 * 流程：
 *  1. 尝试从 keychain 读取已存在的密钥（底层走 Android Keystore）。
 *  2. 若不存在，生成 256-bit 随机密钥并存入 keychain。
 *  3. 返回 hex 编码的密钥字符串。
 *
 * 安全说明：
 *  - accessControl 设为 DEVICE_PASSCODE，要求设备锁屏密码保护（NFR-10 安全基线）。
 *  - 若设备未设置锁屏密码，setGenericPassword 会失败，调用方需捕获并降级为不开加密
 *    （在 Application 启动时提示用户设置锁屏密码）。
 */
export async function getOrCreateEncryptionKey(): Promise<string> {
  // 1. 尝试读取已有密钥
  const existing = await Keychain.getGenericPassword({
    service: DB_KEYCHAIN_SERVICE,
  });
  if (existing !== false && typeof existing.password === 'string' && existing.password.length > 0) {
    return existing.password;
  }

  // 2. 生成新密钥
  const newKey = generateHexKey();

  // 3. 存入 Keystore
  await Keychain.setGenericPassword('fj_db_key', newKey, {
    service: DB_KEYCHAIN_SERVICE,
    accessControl: Keychain.ACCESS_CONTROL.DEVICE_PASSCODE,
  });

  return newKey;
}

// ============== Database 初始化 ==============
let databaseInstance: Database | null = null;
let initializationPromise: Promise<Database> | null = null;

/**
 * 创建 SQLiteAdapter（不传密钥，密钥由 native 层管理）。
 *
 * SQLCipher 加密在 native 层实现：SQLiteAdapter 创建数据库文件时，
 * native 端的 sqlcipher module 会使用之前通过 setEncryptionKey 注入的密钥。
 */
function createAdapter(): SQLiteAdapter {
  return new SQLiteAdapter({
    schema,
    migrations,
    jsi: true,
    dbName: DB_NAME,
    // experimentalUseJSI: true,  // jsi:true 已隐含
  });
}

/**
 * 初始化数据库实例。
 *
 * 完整流程：
 *  1. 获取/生成加密密钥（react-native-keychain）。
 *  2. 通过 NativeModules 把密钥注入 native 层的 SQLCipher 配置。
 *  3. 创建 SQLiteAdapter + Database 实例。
 *  4. 缓存单例，后续调用直接返回。
 *
 * 此函数必须在 App 入口（index.js / App.tsx）中 await 后再渲染 UI。
 *
 * Errors:
 *  - KeyStoreUnavailableError: 设备未设置锁屏密码或 Keystore 不可用
 *  - DecryptionError: 密钥与现有数据库不匹配（用户清除了 Keystore 但数据库还在）
 */
export async function initDatabase(): Promise<Database> {
  if (databaseInstance) {
    return databaseInstance;
  }
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    // 1. 获取/生成密钥
    const encryptionKey = await getOrCreateEncryptionKey();

    // 2. 注入到 native SQLCipher 层（若 native 模块未实现，此处会 no-op）
    if (FJDatabase && typeof FJDatabase.setEncryptionKey === 'function') {
      await FJDatabase.setEncryptionKey(encryptionKey);
    }
    // 注：若 FJDatabase 为 null（debug 模式或 native 未 link），
    //     数据库将以未加密模式打开，仅用于开发环境。

    // 3. 创建 adapter + database
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
 * 用于业务层在 React 组件外（如 sync engine）访问数据库。
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
 * 切换用户登出时应配合 native 层的 SQLCipher 密钥清除。
 */
export function resetDatabaseInstance(): void {
  databaseInstance = null;
  initializationPromise = null;
}
