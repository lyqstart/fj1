/**
 * PhotoCompressor — 照片压缩组件（注入端口模式）
 *
 * 设计依据：WI-0001 DD-2 照片压缩 / §103.2 弱网策略 / TASK-028
 *
 * 压缩参数（DD-2）：
 *  - 长边 1920px（PHOTO_MAX_LONG_EDGE）
 *  - 质量 80（PHOTO_QUALITY，JPEG 0-100）
 *  - 目标 ≤1MB（PHOTO_TARGET_MAX_BYTES，仅作质量校验提示，实际由压缩算法保证）
 *
 * 端口注入：通过 ImageResizerProvider 解耦 react-native-image-resizer。
 *  - 生产实现：安装 react-native-image-resizer 后注入其封装
 *  - 默认实现：DefaultImageResizerProvider 标记不可用，组件降级提示
 *
 * 使用方式（两种）：
 *  1. 声明式组件 <PhotoCompressor sourceUri={uri} onCompressed={...} />：
 *     sourceUri 变化时自动压缩，适合放在 IssueEvidenceScreen 的渲染树中
 *  2. 命令式 hook const resizer = useImageResizer(); await resizer.compress({...})：
 *     适合需要在事件处理中精确控制时机的场景
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';

// ============== 压缩参数（DD-2）==============
/** 长边像素上限（超过则等比缩放） */
export const PHOTO_MAX_LONG_EDGE = 1920;
/** JPEG 质量（0-100） */
export const PHOTO_QUALITY = 80;
/** 目标文件大小上限（1MB），超过则提示（DD-2 质量规则） */
export const PHOTO_TARGET_MAX_BYTES = 1024 * 1024;

// ============== 端口接口 ==============
export interface CompressResult {
  /** 压缩后文件路径 */
  uri: string;
  /** 压缩后文件大小（字节） */
  size: number;
  /** 压缩后宽度（若原生层返回） */
  width?: number;
  /** 压缩后高度 */
  height?: number;
}

export interface CompressParams {
  /** 原图 URI（file:// 或绝对路径） */
  uri: string;
  /** 长边像素上限 */
  maxLongEdge: number;
  /** JPEG 质量 0-100 */
  quality: number;
}

export interface ImageResizerProvider {
  /** 压缩实现是否可用（原生模块已 link） */
  isAvailable(): boolean;
  /** 执行压缩；返回压缩后文件路径 + 大小 */
  compress(params: CompressParams): Promise<CompressResult>;
}

/**
 * 默认压缩 Provider（fallback）：不可用。
 *
 * 生产实现示例（安装 react-native-image-resizer 后）：
 * ```ts
 * import ImageResizer from 'react-native-image-resizer';
 * class RnImageResizerProvider implements ImageResizerProvider {
 *   isAvailable() { return true; }
 *   async compress({ uri, maxLongEdge, quality }) {
 *     const r = await ImageResizer.createResizedImage(uri, maxLongEdge, maxLongEdge, 'JPEG', quality);
 *     return { uri: r.uri, size: r.size, width: r.width, height: r.height };
 *   }
 * }
 * ```
 */
export class DefaultImageResizerProvider implements ImageResizerProvider {
  isAvailable(): boolean {
    return false;
  }
  async compress(): Promise<CompressResult> {
    throw new Error(
      'ImageResizerProvider 未注入：请在 native 集成 react-native-image-resizer 后通过 ImageResizerPortProvider 注入实现',
    );
  }
}

// ============== React Context 注入 ==============
const ImageResizerContext = createContext<ImageResizerProvider>(
  new DefaultImageResizerProvider(),
);

export interface ImageResizerPortProviderProps {
  provider?: ImageResizerProvider;
  children: React.ReactNode;
}

export function ImageResizerPortProvider({
  provider,
  children,
}: ImageResizerPortProviderProps): React.ReactElement {
  const value = useMemo(
    () => provider ?? new DefaultImageResizerProvider(),
    [provider],
  );
  return (
    <ImageResizerContext.Provider value={value}>
      {children}
    </ImageResizerContext.Provider>
  );
}

/** 获取已注入的图片压缩端口（命令式调用） */
export function useImageResizer(): ImageResizerProvider {
  return useContext(ImageResizerContext);
}

// ============== 声明式压缩组件 ==============
export interface PhotoCompressorProps {
  /** 待压缩的原图 URI；为 null 时不触发；变化时自动重新压缩 */
  sourceUri: string | null;
  /** 压缩完成回调（返回压缩后路径 + 大小） */
  onCompressed: (result: CompressResult) => void;
  /** 压缩失败回调（可选；缺省弹 Alert） */
  onError?: (error: Error) => void;
}

/**
 * 声明式压缩组件。
 *
 * 行为：
 *  - sourceUri 非 null 且端口可用 → 自动压缩，成功回调 onCompressed
 *  - 端口不可用 → 调用 onError 或弹 Alert
 *  - 压缩中 → 显示半透明浮层 + loading（非 null 渲染）
 *  - sourceUri 为 null → 不渲染
 *
 * 放置方式：在 IssueEvidenceScreen 渲染树中常驻，sourceUri 由拍照回调驱动。
 *
 * 注意：sourceUri 变化触发新压缩时，上一次的回调会被 cancel（cleanup），
 *       避免竞态导致旧压缩结果覆盖新值。
 */
export function PhotoCompressor({
  sourceUri,
  onCompressed,
  onError,
}: PhotoCompressorProps): React.ReactElement | null {
  const resizer = useImageResizer();
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    if (!sourceUri) {
      return;
    }
    if (!resizer.isAvailable()) {
      const err = new Error(
        'ImageResizerProvider 未注入：请在 native 集成 react-native-image-resizer 后通过 ImageResizerPortProvider 注入实现',
      );
      if (onError) {
        onError(err);
      } else {
        Alert.alert('压缩不可用', err.message);
      }
      return;
    }

    let cancelled = false;
    setBusy(true);

    resizer
      .compress({
        uri: sourceUri,
        maxLongEdge: PHOTO_MAX_LONG_EDGE,
        quality: PHOTO_QUALITY,
      })
      .then((result) => {
        if (!cancelled) {
          onCompressed(result);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const err = error instanceof Error ? error : new Error(String(error));
        if (onError) {
          onError(err);
        } else {
          Alert.alert('照片压缩失败', err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sourceUri, resizer, onCompressed, onError]);

  if (!sourceUri || !busy) {
    return null;
  }
  return (
    <View style={styles.overlay}>
      <ActivityIndicator />
      <Text style={styles.text}>照片压缩中…</Text>
    </View>
  );
}

// ============== 样式 ==============
const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#ffffff',
    fontSize: 14,
    marginTop: 8,
  },
});
