/**
 * typography — 文字样式（WI-0021 TASK-4）
 *
 * 按层级定义字号与字重，fontWeight 使用 `as const` 以匹配 React Native 的字面量联合类型。
 */
export const typography = {
  caption: { fontSize: 12, fontWeight: '400' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  subtitle: { fontSize: 15, fontWeight: '400' as const },
  title: { fontSize: 16, fontWeight: '600' as const },
  heading: { fontSize: 18, fontWeight: '600' as const },
  display: { fontSize: 24, fontWeight: '700' as const },
};
