/**
 * 画布背景主题配置。
 *
 * 单独成模块：与组件同文件导出常量会破坏 React Fast Refresh
 * （react-refresh/only-export-components），改动背景组件时整页刷新。
 */
import type { CanvasBackground as CanvasBg } from '../../types';

export const BACKGROUND_OPTIONS: { value: CanvasBg; label: string; preview: string; theme: 'dark' | 'light' }[] = [
  { value: 'default', label: '默认暗色', preview: 'canvas-bg', theme: 'dark' },
  { value: 'off-white', label: '米白浅色', preview: 'off-white', theme: 'light' },
  { value: 'custom', label: '自定义图片', preview: 'custom', theme: 'dark' },
];
