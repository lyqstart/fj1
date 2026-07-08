/**
 * BiometricAuth — 生物识别认证工具（WI-0024）
 *
 * 使用 react-native-keychain 的 accessControl BIOMETRY 实现。
 * 无需额外原生依赖。
 *
 * 职责：
 *  - 检测设备是否支持生物识别（指纹/FaceID 等）
 *  - 存储/读取/清除受生物识别保护的凭证
 *  - 存储时设置 ACCESS_CONTROL.BIOMETRY_CURRENT_SET，
 *    读取(getBiometricCredentials)将触发系统生物识别对话框
 *
 * 实现说明：
 *  - 使用 InternetCredentials（以 server 为命名空间），与 KeychainStorage 的
 *    GenericPassword 分离，避免与 token 存储互相干扰。
 *  - getSupportedBiometryType 是 keychain 8.x 的官方 API（注意为单数 Biometry）。
 */
import * as Keychain from 'react-native-keychain';

/** 生物识别凭证的命名空间（server key） */
const BIOMETRIC_SERVER = 'fj-android-biometric';

/**
 * 检查设备是否支持生物识别。
 * @returns 设备支持任意生物识别类型时返回 true
 */
export async function isBiometricsAvailable(): Promise<boolean> {
  try {
    const result = await Keychain.getSupportedBiometryType();
    return result !== null && result !== undefined;
  } catch {
    return false;
  }
}

/**
 * 检查是否已存储生物识别凭证。
 * @returns 凭证存在时返回 true
 */
export async function hasBiometricCredentials(): Promise<boolean> {
  try {
    const creds = await Keychain.getInternetCredentials(BIOMETRIC_SERVER);
    return creds !== false && creds.username != null;
  } catch {
    return false;
  }
}

/**
 * 存储凭证（启用指纹登录）。
 * 存储后读取需通过生物识别验证（BIOMETRY_CURRENT_SET 表示指纹集合变化后失效）。
 * @returns 存储成功返回 true
 */
export async function setBiometricCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  try {
    await Keychain.setInternetCredentials(BIOMETRIC_SERVER, username, password, {
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return true;
  } catch (error) {
    console.warn('[BiometricAuth] setCredentials failed:', error);
    return false;
  }
}

/**
 * 读取凭证（触发系统生物识别对话框）。
 * @returns 验证通过返回 {username, password}，失败/取消返回 null
 */
export async function getBiometricCredentials(): Promise<{
  username: string;
  password: string;
} | null> {
  try {
    const creds = await Keychain.getInternetCredentials(BIOMETRIC_SERVER);
    if (creds === false || !creds.username) {
      return null;
    }
    return { username: creds.username, password: creds.password };
  } catch {
    return null;
  }
}

/**
 * 清除生物识别凭证（关闭指纹登录）。
 * @returns 清除成功返回 true
 */
export async function clearBiometricCredentials(): Promise<boolean> {
  try {
    await Keychain.resetInternetCredentials(BIOMETRIC_SERVER);
    return true;
  } catch {
    return false;
  }
}
