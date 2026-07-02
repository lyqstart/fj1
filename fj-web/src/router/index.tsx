import { Routes, Route } from 'react-router-dom'
import { AuthGuard } from './AuthGuard'
import { LoginPage } from '@/auth/LoginPage'
import { Layout } from '@/shared/Layout'
import { DailyReportConfirmPage } from '@/report-confirm/DailyReportConfirmPage'
import { IssuePoolPage } from '@/issue-pool/IssuePoolPage'
import { MyIssuesPage } from '@/issue-pool/MyIssuesPage'
import { ReportWorkspacePage } from '@/report/ReportWorkspacePage'
import { ReportSnapshotEditorPage } from '@/report/ReportSnapshotEditorPage'
import { ReportApprovalPage } from '@/approval/ReportApprovalPage'
import { PublishedReportPage } from '@/approval/PublishedReportPage'
import { UserManagementPage } from '@/system/UserManagementPage'
import { OrganizationManagementPage } from '@/system/OrganizationManagementPage'
import { RolePermissionPage } from '@/system/RolePermissionPage'
import { DictionaryManagementPage } from '@/system/DictionaryManagementPage'

function Dashboard() {
  return <div style={{ fontSize: 16 }}>首页（占位）</div>
}

function NotFound() {
  return <div style={{ fontSize: 16 }}>404 - 页面不存在</div>
}

/**
 * 应用路由表
 * - /login 公开路由
 * - / 下受 AuthGuard 保护，Layout 作为带 Outlet 的布局容器
 */
export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <AuthGuard>
            <Layout />
          </AuthGuard>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="report-confirm" element={<DailyReportConfirmPage />} />
        <Route path="issue-pool" element={<IssuePoolPage />} />
        <Route path="my-issues" element={<MyIssuesPage />} />
        <Route path="reports" element={<ReportWorkspacePage />} />
        <Route path="reports/:id/snapshots" element={<ReportSnapshotEditorPage />} />
        <Route path="report-approval" element={<ReportApprovalPage />} />
        <Route path="published-reports" element={<PublishedReportPage />} />
        <Route path="system/users" element={<UserManagementPage />} />
        <Route path="system/organizations" element={<OrganizationManagementPage />} />
        <Route path="system/roles" element={<RolePermissionPage />} />
        <Route path="system/dictionaries" element={<DictionaryManagementPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
