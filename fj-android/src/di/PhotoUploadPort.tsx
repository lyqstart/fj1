/**
 * PhotoUploadPort — PhotoUploadQueue 的 React 注入端口
 *
 * 设计依据：WI-0018 DD-1
 *
 * 职责：
 *  - 提供 PhotoUploadQueue 的 React Context 注入点
 *  - 屏幕组件通过 usePhotoUploadQueue() 获取实例（可能为 null）
 *  - null 表示照片上传服务尚未配置
 */
import React, { createContext, useContext } from 'react';
import type { PhotoUploadQueue } from '../api/PhotoUploadQueue';

export const PhotoUploadContext = createContext<PhotoUploadQueue | null>(null);

export interface PhotoUploadProviderProps {
  queue: PhotoUploadQueue | null;
  children: React.ReactNode;
}

export function PhotoUploadProvider({
  queue,
  children,
}: PhotoUploadProviderProps): React.ReactElement {
  return (
    <PhotoUploadContext.Provider value={queue}>
      {children}
    </PhotoUploadContext.Provider>
  );
}

export function usePhotoUploadQueue(): PhotoUploadQueue | null {
  return useContext(PhotoUploadContext);
}
