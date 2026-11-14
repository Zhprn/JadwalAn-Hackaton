import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import DashboardLayout from '../components/layout/dashboard-layout'

// 1. Definisikan Route dengan nama file '_authenticated'
export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
})

// 2. Komponen Layout
function AuthenticatedLayout() {
  return (
    <DashboardLayout>
      {/* Outlet adalah tempat di mana komponen dari file index.tsx 
          yang ada di dalam folder _authenticated\dashboard akan di-render */}
      <Outlet />
    </DashboardLayout>
  )
}