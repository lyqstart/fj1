import dayjs from 'dayjs'

/**
 * 后端 Jackson 配置 date-format=yyyy-MM-dd HH:mm:ss（无时区后缀），
 * 此处补 'T' 使其成为 ISO 兼容串以被 Date 解析为本地时间。
 */
export function toJsDate(s?: string | null): Date | null {
  if (!s) return null
  const normalized = s.includes('T') ? s : s.replace(' ', 'T')
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 格式化日期时间 YYYY-MM-DD HH:mm */
export function formatDateTime(s?: string | null): string {
  const d = toJsDate(s)
  if (!d) return '-'
  return dayjs(d).format('YYYY-MM-DD HH:mm')
}

/** 格式化日期 YYYY-MM-DD */
export function formatDate(s?: string | null): string {
  const d = toJsDate(s)
  if (!d) return '-'
  return dayjs(d).format('YYYY-MM-DD')
}

/** 距截止时间剩余天数（向上取整；负数表示已超期天数）；无法解析返回 null */
export function daysToDeadline(
  deadline?: string | null,
  now: Date = new Date(),
): number | null {
  const d = toJsDate(deadline)
  if (!d) return null
  const diff = d.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/** 是否超期 */
export function isOverdue(deadline?: string | null, now: Date = new Date()): boolean {
  const days = daysToDeadline(deadline, now)
  return days !== null && days < 0
}

/** 倒计时展示文本：剩 N 天 / 已超期 N 天 / 今日截止 */
export function deadlineCountdownText(
  deadline?: string | null,
  now: Date = new Date(),
): string {
  const days = daysToDeadline(deadline, now)
  if (days === null) return '-'
  if (days === 0) return '今日截止'
  if (days > 0) return `剩 ${days} 天`
  return `已超期 ${-days} 天`
}
