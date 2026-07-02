/**
 * NetworkMonitor — 飞检安卓端网络状态检测
 *
 * 设计依据：WI-0001 / DD-6 网络状态切换触发同步 / §103.2 弱网策略 / NFR-11
 *
 * 职责：
 *  - 监听网络连接 / 断开事件，在状态切换时回调上层：
 *      onReconnect：网络恢复 → 触发 SyncEngine.fullSync() 补传离线期积压的变更
 *      onDisconnect：网络断开 → 通知 UI 切换到离线态展示
 *  - 提供同步的当前网络状态查询（getCurrentState），供 UI 即时判断。
 *
 * 注入端口模式（不直接依赖 @react-native-community/netinfo）：
 *  - 该包当前未安装；直接 import 会导致编译失败。
 *  - 通过 NetInfoProvider 接口解耦：生产可在 link 原生包后注入其实现，
 *    测试可注入内存实现。默认实现 {@link PollingNetInfoProvider} 基于
 *    navigator.onLine 轮询（fallback，仅作骨架阶段可用）。
 *
 * 不引入新 npm 依赖：仅使用 RN 全局 navigator / setTimeout。
 */
// 全局 navigator / setTimeout 由 react-native 运行时提供，无需 import。

/** 网络状态快照 */
export interface NetworkState {
  /** 当前是否联网（true 时可发起同步） */
  isConnected: boolean;
  /** 网络类型：'wifi' | 'cellular' | 'bluetooth' | 'ethernet' | 'unknown' | 'none' */
  type: string;
}

/**
 * 网络信息提供者端口（解耦 @react-native-community/netinfo）。
 *
 * 生产实现示例（安装该包后）：
 * ```ts
 * import NetInfo from '@react-native-community/netinfo';
 * class RnNetInfoProvider implements NetInfoProvider {
 *   fetch() {
 *     return NetInfo.fetch().then(s => ({ isConnected: Boolean(s.isConnected), type: s.type }));
 *   }
 *   addEventListener(handler) {
 *     const unsub = NetInfo.addEventListener(s =>
 *       handler({ isConnected: Boolean(s.isConnected), type: s.type }));
 *     return () => unsub();
 *   }
 * }
 * ```
 */
export interface NetInfoProvider {
  /** 立即获取一次当前网络状态 */
  fetch(): Promise<NetworkState>;
  /** 订阅网络状态变化；返回取消订阅函数 */
  addEventListener(handler: (state: NetworkState) => void): () => void;
}

/** 轮询默认间隔（毫秒） */
const DEFAULT_POLL_INTERVAL_MS = 5000;

/** 初始未知网络状态（保守视为已连接，避免误触 onDisconnect） */
const INITIAL_STATE: NetworkState = { isConnected: true, type: 'unknown' };

/**
 * 读取全局 navigator.onLine（RN 类型未声明 navigator，故通过 globalThis 安全访问）。
 * 不存在或非 boolean 时保守返回 true（视为在线，避免误判离线）。
 */
function readNavigatorOnLine(): boolean {
  const g = globalThis as { navigator?: { onLine?: boolean } | undefined };
  const onLine = g.navigator?.onLine;
  return typeof onLine === 'boolean' ? onLine : true;
}

/**
 * 基于 navigator.onLine 轮询的默认 NetInfoProvider（fallback）。
 *
 * 适用场景：未安装 @react-native-community/netinfo 的骨架阶段 / 单测。
 * 局限：navigator.onLine 仅能区分在线/离线，无法区分 wifi/cellular（type 固定 'unknown'）。
 * 生产建议注入原生 NetInfo 实现以获得精确的网络类型与即时事件。
 */
export class PollingNetInfoProvider implements NetInfoProvider {
  private readonly intervalMs: number;
  /** 缓存最近状态，供 fetch 同步返回与事件去重 */
  private lastState: NetworkState = INITIAL_STATE;
  private listeners = new Set<(state: NetworkState) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(intervalMs: number = DEFAULT_POLL_INTERVAL_MS) {
    this.intervalMs = intervalMs;
  }

  /** 读取 navigator.onLine（RN 全局存在时；不存在时保守返回 true） */
  private probe(): NetworkState {
    const online = readNavigatorOnLine();
    return { isConnected: online, type: online ? 'unknown' : 'none' };
  }

  async fetch(): Promise<NetworkState> {
    this.lastState = this.probe();
    return this.lastState;
  }

  addEventListener(handler: (state: NetworkState) => void): () => void {
    this.listeners.add(handler);
    // 第一个订阅者加入时启动轮询
    if (this.timer === null) {
      this.timer = setInterval(() => {
        const next = this.probe();
        // 仅当状态变化时通知（去重，避免每 5s 无谓回调）
        if (
          next.isConnected !== this.lastState.isConnected ||
          next.type !== this.lastState.type
        ) {
          this.lastState = next;
          for (const l of this.listeners) {
            l(next);
          }
        }
      }, this.intervalMs);
    }
    return () => {
      this.listeners.delete(handler);
      // 最后一个订阅者退出时停止轮询，节省电量
      if (this.listeners.size === 0 && this.timer !== null) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  }
}

/**
 * 飞检网络状态监控器。
 *
 * 状态切换语义：
 *  - 断开 → 已连接：触发 onReconnect（上层据此调用 SyncEngine.fullSync）
 *  - 已连接 → 断开：触发 onDisconnect（上层据此切换 UI 离线态）
 *  - 已连接 → 已连接（类型变化如 wifi→cellular）：不触发任一回调（避免误同步）
 *
 * @example
 * const monitor = new NetworkMonitor(
 *   () => syncEngine.fullSync(),   // onReconnect
 *   () => uiStore.setOffline(true) // onDisconnect
 * );
 * monitor.subscribe();
 * // App 卸载时
 * monitor.unsubscribe();
 */
export class NetworkMonitor {
  private readonly onReconnect: () => void;
  private readonly onDisconnect: () => void;
  private readonly provider: NetInfoProvider;

  /** 最近已知状态（订阅事件更新；getCurrentState 同步返回此值） */
  private lastState: NetworkState = INITIAL_STATE;
  /** 取消订阅函数（subscribe 后赋值；已取消时为 undefined） */
  private unsubscribeFn?: () => void;
  /** 是否已订阅（防止重复订阅导致多次回调） */
  private subscribed = false;

  constructor(
    onReconnect: () => void,
    onDisconnect: () => void,
    provider?: NetInfoProvider,
  ) {
    this.onReconnect = onReconnect;
    this.onDisconnect = onDisconnect;
    this.provider = provider ?? new PollingNetInfoProvider();
  }

  /**
   * 开始订阅网络状态变化。
   * 幂等：重复调用不会注册多个监听器。
   */
  subscribe(): void {
    if (this.subscribed) {
      return;
    }
    this.subscribed = true;
    // 订阅前先 fetch 一次，校准 lastState（避免把初始 unknown 误判为状态切换）
    this.provider
      .fetch()
      .then((state) => {
        this.lastState = state;
      })
      .catch(() => {
        // fetch 失败保守保持初始状态
      });
    this.unsubscribeFn = this.provider.addEventListener((state) => this.handleStateChange(state));
  }

  /**
   * 停止订阅（App 卸载 / 退出同步场景时调用，释放轮询定时器）。
   * 幂等：未订阅或重复调用安全。
   */
  unsubscribe(): void {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = undefined;
    }
    this.subscribed = false;
  }

  /**
   * 获取当前网络状态（同步，基于最近一次事件 / 初始校准）。
   * 若尚未 subscribe，返回初始值 { isConnected: true, type: 'unknown' }。
   */
  getCurrentState(): NetworkState {
    return this.lastState;
  }

  /** 内部：处理 provider 推送的状态变化，按切换语义触发回调 */
  private handleStateChange(state: NetworkState): void {
    const wasConnected = this.lastState.isConnected;
    const nowConnected = state.isConnected;
    this.lastState = state;

    // 断开 → 已连接：网络恢复
    if (!wasConnected && nowConnected) {
      this.onReconnect();
      return;
    }
    // 已连接 → 断开：网络丢失
    if (wasConnected && !nowConnected) {
      this.onDisconnect();
    }
    // 已连接 → 已连接（类型变化）或 断开 → 断开：不触发回调
  }
}
