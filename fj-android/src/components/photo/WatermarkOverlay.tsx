/**
 * WatermarkOverlay — 照片水印叠加组件
 *
 * 设计依据：WI-0001 §101.13 Photo / DD-2 照片压缩与存储 / TASK-028
 *
 * 职责：
 *  - 在照片底部叠加半透明水印条
 *  - 显示：拍摄时间（yyyy-MM-dd HH:mm:ss）、GPS 坐标、检查员姓名
 *  - 使用 RN Image + 绝对定位实现（不引入 skia / react-native-view-shot 等原生绘图依赖）
 *
 * 使用场景：问题取证页 IssueEvidenceScreen 在拍摄后预览时使用。
 *           真正的水印烧录（写入像素）应在 native 拍照回调中完成（DD-2），
 *           本组件仅做视觉预览叠加，保证骨架阶段可运行且零额外依赖。
 */
import React from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  type ImageSourcePropType,
  type ViewStyle,
} from 'react-native';

/** 水印所需的可观测数据 */
export interface WatermarkData {
  /** 拍摄时间 */
  capturedAt: Date;
  /** GPS 经度（null 时显示"GPS 缺失"） */
  longitude: number | null;
  /** GPS 纬度（null 时显示"GPS 缺失"） */
  latitude: number | null;
  /** 检查员姓名 */
  inspectorName: string;
}

export interface WatermarkOverlayProps {
  /** 照片源（{ uri } 或 require） */
  source: ImageSourcePropType;
  /** 水印数据 */
  data: WatermarkData;
  /** 容器额外样式（如 { height: 200 } 控制预览高度） */
  style?: ViewStyle;
}

/**
 * 格式化时间为水印要求的 yyyy-MM-dd HH:mm:ss（本地时区）。
 * 导出供 IssueEvidenceScreen 在构造照片元数据时复用。
 */
export function formatWatermarkTime(d: Date): string {
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`;
}

/**
 * 格式化 GPS 坐标（保留 6 位小数）。
 * 任一坐标缺失时返回"GPS 缺失"，触发 UI 红字提示（DD-10）。
 */
export function formatGps(
  longitude: number | null,
  latitude: number | null,
): string {
  if (longitude == null || latitude == null) {
    return 'GPS 缺失';
  }
  return `经 ${longitude.toFixed(6)} / 纬 ${latitude.toFixed(6)}`;
}

/**
 * 水印叠加组件。
 * 照片铺满容器，底部半透明黑条显示三行水印文字。
 */
export default function WatermarkOverlay({
  source,
  data,
  style,
}: WatermarkOverlayProps): React.ReactElement {
  const timeStr = formatWatermarkTime(data.capturedAt);
  const gpsStr = formatGps(data.longitude, data.latitude);
  const gpsMissing = data.longitude == null || data.latitude == null;
  const inspectorLabel = data.inspectorName || '（检查员未配置）';

  return (
    <View style={[styles.container, style]}>
      <Image source={source} style={styles.image} resizeMode="cover" />
      <View style={styles.watermarkBar}>
        <Text style={styles.watermarkLine} numberOfLines={1}>
          {timeStr}
        </Text>
        <Text
          style={[styles.watermarkLine, gpsMissing && styles.gpsMissing]}
          numberOfLines={1}
        >
          {gpsStr}
        </Text>
        <Text style={styles.watermarkLine} numberOfLines={1}>
          检查员：{inspectorLabel}
        </Text>
      </View>
    </View>
  );
}

// ============== 样式 ==============
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 6,
    overflow: 'hidden',
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  watermarkBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  watermarkLine: {
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 16,
  },
  gpsMissing: {
    color: '#ff7875',
  },
});
