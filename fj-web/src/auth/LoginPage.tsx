import { useState } from 'react'
import { Form, Input, Button, Card, message, Typography } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { apiClient } from '@/api/client'
import type { ApiResponse } from '@/api/client'
import { useAuthStore, type AuthUser } from '@/store/authStore'

interface LoginFormData {
  username: string
  password: string
}

interface LoginResult {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

interface FromState {
  from?: { pathname?: string }
}

/**
 * 登录页
 *
 * 表单提交逻辑：
 * 1. 用户填写账号密码
 * 2. 调用 POST /api/v1/auth/login（DD-4）
 * 3. 成功 → 写入 authStore（token 持久化到 localStorage），跳转来源页或首页
 * 4. 失败 → 展示后端 message（不区分用户名/密码错误，统一提示，符合安全基线）
 */
export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: LoginFormData): Promise<void> => {
    setLoading(true)
    try {
      const res = await apiClient.post<ApiResponse<LoginResult>>(
        '/auth/login',
        values,
      )
      const body = res.data

      if (body.code !== 0 || !body.data) {
        // 业务失败：统一提示，不暴露具体错误原因（REQ-1.2 安全基线）
        message.error(body.message || '账号或密码错误')
        return
      }

      const { accessToken, refreshToken, user } = body.data
      setAuth({ accessToken, refreshToken, user })

      message.success('登录成功')

      // 跳转到登录前的来源页，默认首页
      const fromPath =
        (location.state as FromState | null)?.from?.pathname ?? '/'
      navigate(fromPath, { replace: true })
    } catch {
      // 网络异常 / 服务不可达
      message.error('登录失败，请检查网络后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
      }}
    >
      <Card style={{ width: 400 }}>
        <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          飞检现场管理系统
        </Typography.Title>
        <Form<LoginFormData>
          name="login"
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ username: '', password: '' }}
          autoComplete="off"
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" autoComplete="username" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="请输入密码" autoComplete="current-password" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
