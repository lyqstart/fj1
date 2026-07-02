/**
 * PhotoCapture — 拍照组件（注入端口模式）
 *
 * 设计依据：WI-0001 §101.13 Photo / DD-2 / DD-10 / TASK-028
 *
 * 职责：
 *  - 提供拍照入口按钮
 *  - 通过注入端口 CameraProvider 调起相机（不直接依赖 react-native-image-picker /
 *    expo-camera，避免在骨架阶段引入新 npm 依赖）
 *  - 拍照瞬间同时通过 GpsProvider 读取 GPS 坐标（保证时间一致性，供水印 + 元数据使用）
 *  - 拍照成功后回调返回 CameraCaptureResult（临时文件路径 + 时间 + GPS）
 *
 * 端口注入方式（同 NetworkMonitor.NetInfoProvider / PhotoUploadQueue.PhotoChunkReader）：
 *  - 生产实现：安装原生包后在 App 根组件用 <CameraPortProvider provider={...}> 注入
 *  - 默认实现：DefaultCameraProvider / DefaultGpsProvider，标记为不可用，
 *    组件降级为"相机未配置"占位按钮（点击弹提示，不崩溃）
 *
 * GPS 缺失处理（DD-10）：
 *  - 拍照时无论 GPS 是否成功都返回结果，仅在 result.gps.status 中标记
 *  - UI 层（IssueEvidenceScreen）据此显示"GPS 缺失"红字提醒
 */
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';

// ============== GPS 端口 ==============
export interface GpsCoordinates {
  longitude: number;
  latitude: number;
  accuracy?: number;
}

/** GPS 获取状态（与 PhotoModel.GPS_STATUS 对齐：success|denied|unavailable） */
export type GpsAvailability = 'success' | 'denied' | 'unavailable';

export interface GpsReading {
  coords: GpsCoordinates | null;
  status: GpsAvailability;
}

export interface GpsProvider {
  /** 异步读取当前 GPS 位置；无定位权限时返回 { coords: null, status: 'denied'|'unavailable' } */
  getCurrent(): Promise<GpsReading>;
}

/**
 * 默认 GPS Provider（fallback）。
 * 未注入原生定位实现时使用；始终返回 unavailable。
 * 生产应在 link @react-native-community/geolocation 后注入真实实现。
 */
export class DefaultGpsProvider implements GpsProvider {
  async getCurrent(): Promise<GpsReading> {
    return { coords: null, status: 'unavailable' };
  }
}

// ============== 相机端口 ==============
/** 拍照结果（交给 PhotoCompressor 进一步压缩） */
export interface CameraCaptureResult {
  /** 临时文件路径（file:// uri 或绝对路径） */
  uri: string;
  /** 原图宽度（若原生层返回） */
  width?: number;
  /** 原图高度 */
  height?: number;
  /** 原图文件大小（字节） */
  size?: number;
  /** 拍摄时刻 */
  capturedAt: Date;
  /** 拍照瞬间读取的 GPS（用于水印 + 写入 PhotoModel.gps_status） */
  gps: GpsReading;
}

export interface CameraProvider {
  /** 相机是否可用（原生模块已 link 且权限已授予） */
  isAvailable(): boolean;
  /** 调起相机拍照，返回临时文件路径 + 拍照瞬间的 GPS 读数 */
  capture(): Promise<CameraCaptureResult>;
}

/**
 * 默认相机 Provider（fallback）。
 * 未注入原生相机实现时使用；isAvailable() 返回 false，capture() 抛出清晰错误。
 *
 * 生产实现示例（安装 react-native-image-picker 后）：
 * ```ts
 * import { launchCamera } from 'react-native-image-picker';
 * class RnCameraProvider implements CameraProvider {
 *   constructor(private gps: GpsProvider) {}
 *   isAvailable() { return true; }
 *   async capture() {
 *     const gps = await this.gps.getCurrent();
 *     const resp = await launchCamera({ mediaType: 'photo', cameraType: 'back' });
 *     const asset = resp.assets?.[0];
 *     if (!asset?.uri) throw new Error('用户取消或拍照失败');
 *     return { uri: asset.uri, width: asset.width, height: asset.height,
 *              size: asset.fileSize, capturedAt: new Date(), gps };
 *   }
 * }
 * ```
 */
export class DefaultCameraProvider implements CameraProvider {
  private readonly gps: GpsProvider;

  constructor(gps?: GpsProvider) {
    this.gps = gps ?? new DefaultGpsProvider();
  }

  isAvailable(): boolean {
    return false;
  }

  async capture(): Promise<CameraCaptureResult> {
    // 即使最终抛错，也先读 GPS，便于上层在 catch 分支诊断 GPS 可用性
    const gps = await this.gps.getCurrent();
    void gps; // 标记已使用（降级实现不返回 GPS，仅抛错）
    throw new Error(
      'CameraProvider 未注入：请在 native 集成 react-native-image-picker 或 expo-camera 后，通过 CameraPortProvider 注入实现',
    );
  }
}

// ============== React Context 注入 ==============
interface CameraPorts {
  camera: CameraProvider;
  gps: GpsProvider;
}

const DEFAULT_PORTS: CameraPorts = {
  camera: new DefaultCameraProvider(),
  gps: new DefaultGpsProvider(),
};

const CameraPortContext = createContext<CameraPorts>(DEFAULT_PORTS);

export interface CameraPortProviderProps {
  /** 相机实现（可选，缺省用 DefaultCameraProvider） */
  camera?: CameraProvider;
  /** GPS 实现（可选，缺省用 DefaultGpsProvider） */
  gps?: GpsProvider;
  children: React.ReactNode;
}

/**
 * 相机 + GPS 端口 Provider。
 * 在 App 根组件包裹一次，所有子屏幕通过 useCameraPorts() 获取实例。
 *
 * @example
 * <CameraPortProvider camera={new RnCameraProvider(gps)} gps={gps}>
 *   <AppNavigator />
 * </CameraPortProvider>
 */
export function CameraPortProvider({
  camera,
  gps,
  children,
}: CameraPortProviderProps): React.ReactElement {
  const value = useMemo<CameraPorts>(() => {
    const g = gps ?? DEFAULT_PORTS.gps;
    return {
      camera: camera ?? new DefaultCameraProvider(g),
      gps: g,
    };
  }, [camera, gps]);

  return (
    <CameraPortContext.Provider value={value}>
      {children}
    </CameraPortContext.Provider>
  );
}

/** 获取已注入的相机 + GPS 端口 */
export function useCameraPorts(): CameraPorts {
  return useContext(CameraPortContext);
}

// ============== PhotoCapture 组件 ==============
export interface PhotoCaptureProps {
  /** 拍照成功回调 */
  onCaptured: (result: CameraCaptureResult) => void;
  /** 按钮文案（默认"拍照取证"） */
  label?: string;
  /** 是否禁用（如已达照片上限） */
  disabled?: boolean;
}

/**
 * 拍照按钮组件。
 *
 * 行为：
 *  - 相机不可用（DefaultCameraProvider）→ 按钮显示"（相机未配置）"，点击弹 Alert 说明
 *  - 相机可用 → 点击调起相机，成功后回调 onCaptured
 *  - 拍照中 → 按钮转为 loading 态，防重复点击
 */
export default function PhotoCapture({
  onCaptured,
  label = '拍照取证',
  disabled = false,
}: PhotoCaptureProps): React.ReactElement {
  const { camera } = useCameraPorts();
  const [busy, setBusy] = useState<boolean>(false);
  const available = camera.isAvailable();

  const handlePress = useCallback(async () => {
    if (busy || disabled) {
      return;
    }
    if (!available) {
      Alert.alert(
        '相机未配置',
        '当前未注入原生相机模块。请在 native 集成 react-native-image-picker 或 expo-camera 后，通过 CameraPortProvider 注入实现。',
      );
      return;
    }
    setBusy(true);
    try {
      const result = await camera.capture();
      onCaptured(result);
    } catch (error) {
      Alert.alert(
        '拍照失败',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setBusy(false);
    }
  }, [busy, disabled, available, camera, onCaptured]);

  const buttonLabel = available ? label : `${label}（相机未配置）`;

  return (
    <TouchableOpacity
      testID="photo-capture-btn"
      onPress={handlePress}
      disabled={busy || disabled}
      activeOpacity={0.7}
      style={[
        styles.button,
        !available && styles.buttonUnavailable,
        disabled && styles.buttonDisabled,
      ]}
    >
      {busy ? (
        <View style={styles.inner}>
          <ActivityIndicator color="#ffffff" />
          <Text style={styles.label}>拍摄中…</Text>
        </View>
      ) : (
        <View style={styles.inner}>
          <Text style={styles.label}>{buttonLabel}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ============== 样式 ==============
const styles = StyleSheet.create({
  button: {
    height: 44,
    borderRadius: 8,
    backgroundColor: '#1677ff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonUnavailable: {
    backgroundColor: '#d9d9d9',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 6,
  },
});
