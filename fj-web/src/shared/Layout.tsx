import { useMemo } from 'react'
import {
  Layout as AntLayout,
  Menu,
  Dropdown,
  Avatar,
  Space,
  theme,
  type MenuProps,
} from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

const { Header, Sider, Content } = AntLayout

type MenuItem = Required<MenuProps>['items'][number]

/** 菜单项（支持分组子菜单） */
function defineMenu(): MenuItem[] {
  return [
    { key: '/', label: '首页' },
    {
      key: 'report-group',
      label: '报告管理',
      children: [
        { key: '/reports', label: '报告生产' },
        { key: '/report-approval', label: '报告审批' },
        { key: '/published-reports', label: '已发布报告' },
      ],
    },
    {
      key: 'system-group',
      label: '系统管理',
      children: [
        { key: '/system/users', label: '用户管理' },
        { key: '/system/organizations', label: '组织管理' },
        { key: '/system/roles', label: '角色权限' },
        { key: '/system/dictionaries', label: '数据字典' },
      ],
    },
  ]
}

const MENU_ITEMS = defineMenu()

/** 收集所有叶子路由 key（以 / 开头的实际可导航项） */
const LEAF_KEYS: string[] = MENU_ITEMS.flatMap((m) => {
  if (m && typeof m === 'object' && 'children' in m && m.children) {
    return m.children
      .filter((c): c is { key: string; label: string } => !!c && typeof c === 'object' && 'key' in c)
      .map((c) => c.key)
  }
  if (m && typeof m === 'object' && 'key' in m) {
    const k = (m as { key: string }).key
    return k.startsWith('/') ? [k] : []
  }
  return []
})

/**
 * 应用主布局：侧边栏 + 顶部导航 + 内容区（Outlet）
 *
 * - 侧边栏菜单可折叠，点击切换路由（支持分组子菜单）
 * - 顶部导航右侧展示当前用户及退出登录入口
 * - 内容区渲染子路由（<Outlet />）
 */
export function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clear)
  const { token: themeToken } = theme.useToken()

  const { selectedKeys, openKeys } = useMemo(() => {
    const path = location.pathname
    // 精确匹配叶子路由，否则按前缀匹配
    const exact = LEAF_KEYS.find((k) => path === k)
    const prefix = LEAF_KEYS.find((k) => path.startsWith(`${k}/`))
    const matched = exact ?? prefix ?? (path === '/' ? '/' : null)
    // 默认展开所有分组，使当前选中项可见
    const groups = MENU_ITEMS.filter(
      (m) => m && typeof m === 'object' && 'children' in m,
    ).map((m) => (m as { key: string }).key)
    return {
      selectedKeys: matched ? [matched] : [],
      openKeys: groups,
    }
  }, [location.pathname])

  const displayName = user?.realName || user?.username || '未登录'
  const avatarText = displayName.charAt(0).toUpperCase()

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      clearAuth()
      navigate('/login', { replace: true })
    }
  }

  const userMenuProps: MenuProps = {
    items: [{ key: 'logout', label: '退出登录' }],
    onClick: handleMenuClick,
  }

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsible>
        <div
          style={{
            height: 48,
            margin: 16,
            color: '#fff',
            textAlign: 'center',
            lineHeight: '48px',
            fontWeight: 600,
          }}
        >
          飞检系统
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={MENU_ITEMS}
          onClick={({ key }) => {
            if (key.startsWith('/')) navigate(key)
          }}
        />
      </Sider>
      <AntLayout>
        <Header
          style={{
            background: themeToken.colorBgContainer,
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          <Dropdown menu={userMenuProps} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar size="small" style={{ backgroundColor: themeToken.colorPrimary }}>
                {avatarText}
              </Avatar>
              <span>{displayName}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}
