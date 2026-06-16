'use client'

import { useAuth } from '@/context/AuthContext'
import { LogOut, Menu, Bell, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { usePathname } from 'next/navigation'

interface HeaderProps {
  onMenuToggle: () => void
}

const pageTitles: Record<string, string> = {
  '/admin': 'Dashboard',

  '/admin/users': 'จัดการผู้ใช้งาน',
  '/admin/roles': 'จัดการ Roles',
  '/admin/permissions': 'จัดการ Permissions',

  '/admin/settings': 'ตั้งค่าระบบ',

  '/admin/account-types': 'จัดการแอคเคาท์ไปรษณีย์ (Account Types)',
  '/admin/sessions': 'เซสชั่น (Postone Sessions)',
  '/admin/export-files': 'รายการไฟล์ไปรษณีย์ (Header Export Files Shipments)',
  '/admin/shipments': 'รายการพัสดุไปรษณีย์ (Postone Shipments Sync)',
  '/admin/line-files': 'รายการไฟล์บริการ (Header Files Services Fee)',
  '/admin/line-extracted': 'รายการคัดแยกไฟล์บริการ (zip) (Header Files Extracted)',
  '/admin/thaipost': 'รายการพัสดุไฟล์บริการ (Files Data Server Fee)',
  '/admin/shipment-acceptance': 'เปรียบเทียบข้อมูลไปรษณีย์ (Data Reconciliation)',

  '/admin/so-head': 'SO Head Data',
  '/admin/line-so': 'ตรวจสอบข้อมูลไปรษณีย์ (Report)',

  '/admin/special-postal-zones': 'พื้นที่พิเศษ',
  '/admin/ems-rates': 'อัตราค่าขนส่ง EMS',
  '/admin/domestic-letter-rates': 'อัตราค่าขนส่งจดหมายในประเทศ - ซอง',

  '/admin/lazada/shops': 'ร้านค้า lazada',
  '/admin/lazada/transactions': 'ธุรกรรม lazada',
  '/admin/lazada/files': 'ไฟล์ lazada',

  '/admin/shopee/sync-logs': 'Shopee Sync Logs'
}

const isDemo = process.env.NEXT_PUBLIC_APP_ENV === 'demo'

export default function Header({ onMenuToggle }: HeaderProps) {
  const { user, roles, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const title = pageTitles[pathname] ?? 'Admin'

  return (
    <header className={`h-16 border-b flex items-center justify-between px-4 lg:px-6 flex-shrink-0 z-10 bg-[#354A5E] ${isDemo ? 'border-amber-400' : 'border-[#2D3F51]'}`}>
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded text-white/70 hover:bg-[#2D3F51] hover:text-white transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <img src="/pumpkin.png" alt="Logo" className="w-7 h-7 object-contain lg:hidden" />
        <div>
          <h1 className="text-base font-semibold text-white leading-tight">{title}</h1>
          <p className="text-xs text-[#ACC7D9] hidden sm:block">Postone Finance</p>
        </div>
        {isDemo && (
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-amber-400 text-amber-900 tracking-wide">
            DEMO
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button className="relative p-2 rounded text-white/70 hover:bg-[#2D3F51] hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#BB0000] rounded-full" />
        </button>

        <div className="relative ml-1">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded text-sm hover:bg-[#2D3F51] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#0070F2] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="text-left hidden sm:block">
              <p className="font-semibold leading-tight text-white text-sm">{user?.name}</p>
              <p className="text-xs text-[#ACC7D9] leading-tight">{roles[0]?.name ?? '—'}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-[#ACC7D9] hidden sm:block" />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 mt-2 w-56 bg-white border border-[#EBEBEB] rounded shadow-xl py-1 z-20">
                <div className="px-4 py-3 border-b border-[#EBEBEB]">
                  <p className="text-sm font-semibold text-[#32363A]">{user?.name}</p>
                  <p className="text-xs text-[#6A6D70] mt-0.5">{user?.email}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {roles.map((role) => (
                      <span
                        key={role.id}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold text-white"
                        style={{ backgroundColor: role.color }}
                      >
                        {role.name}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => { logout(); setOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#BB0000] hover:bg-[#FFF5F5] transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  ออกจากระบบ
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
