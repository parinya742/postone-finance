'use client'

import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, ShieldCheck, KeyRound,
  Settings, ChevronRight, X,
  Tag, Activity, Package, FileArchive, FileText, Truck, GitMerge, Database, BarChart2, MapPin, PackageCheck, FileDown,
  Store, Receipt, FileSpreadsheet, ShoppingCart, LayoutGrid, ShoppingBag,
} from 'lucide-react'
import clsx from 'clsx'
import { useState, useEffect } from 'react'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

type SidebarMode = 'main' | 'ecommerce'
type EcommercePlatform = 'lazada' | 'tiktok' | 'shopee'

const navGroups = [
  {
    label: 'หลัก',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, permission: null, exact: true },
    ],
  },
  {
    label: 'การจัดการ',
    items: [
      { href: '/admin/users', label: 'ผู้ใช้งาน', icon: Users, permission: 'users.view', exact: false },
      { href: '/admin/roles', label: 'Roles', icon: ShieldCheck, permission: 'roles.view', exact: false },
      { href: '/admin/permissions', label: 'Permissions', icon: KeyRound, permission: 'permissions.view', exact: false },
    ],
  },
  {
    label: 'ระบบ',
    items: [
      { href: '/admin/settings', label: 'ตั้งค่า', icon: Settings, permission: 'settings.view', exact: false },
    ],
  },
  {
    label: 'Postone Data',
    items: [
      { href: '/admin/account-types', label: 'จัดการแอคเคาท์ไปรษณีย์', icon: Tag, permission: 'account-types.view', exact: false },
      { href: '/admin/sessions', label: 'เซสชั่น', icon: Activity, permission: 'sessions.view', exact: false },
      { href: '/admin/export-files', label: 'รายการไฟล์ไปรษณีย์ (web)', icon: FileDown, permission: 'shipments.view', exact: false },
      { href: '/admin/shipments', label: 'รายการพัสดุไปรษณีย์ (web)', icon: Package, permission: 'shipments.view', exact: false },
      { href: '/admin/line-files', label: 'รายการไฟล์บริการ', icon: FileArchive, permission: 'line-files.view', exact: false },
      { href: '/admin/line-extracted', label: 'รายการคัดแยกไฟล์บริการ (zip)', icon: FileText, permission: 'line-files.view', exact: false },
      { href: '/admin/thaipost', label: 'รายการพัสดุไฟล์บริการ', icon: Truck, permission: 'thaipost.view', exact: false },
      { href: '/admin/shipment-acceptance', label: 'เปรียบเทียบข้อมูลไปรษณีย์', icon: GitMerge, permission: 'shipments.view', exact: false },
    ],
  },
  {
    label: 'ISCODE',
    items: [
      { href: '/admin/so-head', label: 'ข้อมูล SO', icon: Database, permission: 'iscode.view', exact: false },
      { href: '/admin/line-so', label: 'เปรียบเทียบข้อมูลไฟล์บริการ', icon: BarChart2, permission: 'line-so.view', exact: false },
    ],
  },
  {
    label: 'Master Data',
    items: [
      { href: '/admin/special-postal-zones', label: 'จัดการไปรษณีย์พื้นที่พิเศษ', icon: MapPin, permission: 'special-zones.view', exact: false },
      { href: '/admin/ems-rates', label: 'จัดการอัตราค่าบริการ EMS', icon: PackageCheck, permission: 'ems-rates.view', exact: false },
      { href: '/admin/domestic-letter-rates', label: 'จัดการอัตราค่าบริการไปรษณีย์', icon: PackageCheck, permission: 'domestic-letter-rates.view', exact: false },
    ],
  },
]

const ecommercePlatforms = {
  lazada: {
    label: 'Lazada',
    items: [
      { href: '/admin/lazada/shops', label: 'จัดการร้านค้า', icon: Store, permission: 'lazada-shops.view', exact: false },
      { href: '/admin/lazada/transactions', label: 'รายการธุรกรรม', icon: Receipt, permission: 'lazada-shops.view', exact: false },
      { href: '/admin/lazada/files', label: 'ไฟล์ส่งออก', icon: FileSpreadsheet, permission: 'lazada-shops.view', exact: false },
    ],
  },
  tiktok: {
    label: 'TikTok',
    items: [
      { href: '/admin/tiktok/shops', label: 'จัดการร้านค้า', icon: Store, permission: 'tiktok-shops.view', exact: false },
      { href: '/admin/tiktok/transactions', label: 'รายการธุรกรรม', icon: Receipt, permission: 'tiktok-shops.view', exact: false },
      { href: '/admin/tiktok/files', label: 'ไฟล์ส่งออก', icon: FileSpreadsheet, permission: 'tiktok-shops.view', exact: false },
    ],
  },
  shopee: {
    label: 'Shopee',
    items: [
      { href: '/admin/shopee/shops', label: 'จัดการร้านค้า', icon: Store, permission: 'shopee-shops.view', exact: false },
      { href: '/admin/shopee/transactions', label: 'รายการธุรกรรม', icon: Receipt, permission: 'shopee-shops.view', exact: false },
      { href: '/admin/shopee/files', label: 'ไฟล์ส่งออก', icon: FileSpreadsheet, permission: 'shopee-shops.view', exact: false },
      { href: '/admin/shopee/orders', label: 'รายการออเดอร์', icon: ShoppingBag, permission: 'shopee-shops.view', exact: false },
      { href: '/admin/shopee/order-files', label: 'ไฟล์ออเดอร์', icon: FileText, permission: 'shopee-shops.view', exact: false },
    ],
  },
}

const isDemo = process.env.NEXT_PUBLIC_APP_ENV === 'demo'

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { can } = useAuth()
  const pathname = usePathname()

  const isEcommercePath =
    pathname.startsWith('/admin/lazada') ||
    pathname.startsWith('/admin/tiktok') ||
    pathname.startsWith('/admin/shopee')

  const [mode, setMode] = useState<SidebarMode>(isEcommercePath ? 'ecommerce' : 'main')
  const [activePlatform, setActivePlatform] = useState<EcommercePlatform>(
    pathname.startsWith('/admin/tiktok') ? 'tiktok'
    : pathname.startsWith('/admin/shopee') ? 'shopee'
    : 'lazada'
  )

  useEffect(() => {
    if (pathname.startsWith('/admin/lazada')) {
      setMode('ecommerce')
      setActivePlatform('lazada')
    } else if (pathname.startsWith('/admin/tiktok')) {
      setMode('ecommerce')
      setActivePlatform('tiktok')
    } else if (pathname.startsWith('/admin/shopee')) {
      setMode('ecommerce')
      setActivePlatform('shopee')
    }
  }, [pathname])

  const platformItems = ecommercePlatforms[activePlatform].items.filter(
    (item) => !item.permission || can(item.permission)
  )

  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-30 w-72 bg-white border-r border-[#D9D9D9] flex flex-col transition-transform duration-300 ease-in-out flex-shrink-0',
        'lg:relative lg:translate-x-0 lg:z-auto',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-[#D9D9D9] flex-shrink-0 bg-[#FAFAFA]">
        <div className="flex items-center gap-3">
          <img src="/pumpkin.png" alt="POSTONE Logo" className="w-8 h-8 object-contain" />
          <div>
            <p className="font-bold text-sm tracking-wide text-[#32363A]">POSTONE {isDemo ? '(Demo)' : ''}</p>
            <p className="text-[#6A6D70] text-[10px] uppercase tracking-widest">Finance</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded text-[#6A6D70] hover:text-[#32363A] hover:bg-[#EBEBEB] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode switcher */}
      <div className="flex border-b border-[#D9D9D9] bg-[#FAFAFA] flex-shrink-0">
        <button
          onClick={() => setMode('main')}
          className={clsx(
            'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors duration-150 border-b-2',
            mode === 'main'
              ? 'text-[#0070F2] border-[#0070F2] bg-white'
              : 'text-[#6A6D70] border-transparent hover:text-[#32363A] hover:bg-[#EBEBEB]'
          )}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>หลัก</span>
        </button>
        <button
          onClick={() => setMode('ecommerce')}
          className={clsx(
            'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors duration-150 border-b-2',
            mode === 'ecommerce'
              ? 'text-[#0070F2] border-[#0070F2] bg-white'
              : 'text-[#6A6D70] border-transparent hover:text-[#32363A] hover:bg-[#EBEBEB]'
          )}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>E-Commerce</span>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">

        {/* ── Main mode ── */}
        {mode === 'main' && navGroups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.permission || can(item.permission)
          )
          if (visibleItems.length === 0) return null

          return (
            <div key={group.label} className="mb-4">
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#6A6D70]">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map(({ href, label, icon: Icon, exact }) => {
                  const active = exact
                    ? pathname === href
                    : pathname === href || pathname.startsWith(href + '/')
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      className={clsx(
                        'group flex items-center justify-between px-3 py-2 rounded text-sm transition-all duration-150 border-l-2',
                        active
                          ? 'bg-[#EBF5FE] text-[#0070F2] font-medium border-[#0070F2]'
                          : 'text-[#32363A] hover:bg-[#F5F5F5] hover:text-[#0070F2] border-transparent'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={clsx('w-4 h-4 flex-shrink-0', active ? 'text-[#0070F2]' : 'text-[#6A6D70] group-hover:text-[#0070F2]')} />
                        <span>{label}</span>
                      </div>
                      {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* ── Ecommerce mode ── */}
        {mode === 'ecommerce' && (
          <div>
            {/* Section label */}
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#6A6D70]">
              Report Ecommerce
            </p>

            {/* Platform tabs */}
            <div className="flex mb-3 rounded-lg overflow-hidden border border-[#E8E8E8] mx-1">
              {(Object.keys(ecommercePlatforms) as EcommercePlatform[]).map((platform) => (
                <button
                  key={platform}
                  onClick={() => setActivePlatform(platform)}
                  className={clsx(
                    'flex-1 py-2 text-xs font-semibold transition-colors duration-150',
                    activePlatform === platform
                      ? 'bg-[#0070F2] text-white'
                      : 'bg-white text-[#6A6D70] hover:bg-[#F5F5F5] hover:text-[#32363A]'
                  )}
                >
                  {ecommercePlatforms[platform].label}
                </button>
              ))}
            </div>

            {/* Sub-items */}
            <div className="space-y-0.5">
              {platformItems.length === 0 ? (
                <p className="px-3 py-2 text-xs text-[#6A6D70]">ไม่มีสิทธิ์เข้าถึง</p>
              ) : (
                platformItems.map(({ href, label, icon: Icon, exact }) => {
                  const active = exact
                    ? pathname === href
                    : pathname === href || pathname.startsWith(href + '/')
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      className={clsx(
                        'group flex items-center justify-between px-3 py-2 rounded text-sm transition-all duration-150 border-l-2',
                        active
                          ? 'bg-[#EBF5FE] text-[#0070F2] font-medium border-[#0070F2]'
                          : 'text-[#32363A] hover:bg-[#F5F5F5] hover:text-[#0070F2] border-transparent'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={clsx('w-4 h-4 flex-shrink-0', active ? 'text-[#0070F2]' : 'text-[#6A6D70] group-hover:text-[#0070F2]')} />
                        <span>{label}</span>
                      </div>
                      {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                    </Link>
                  )
                })
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[#D9D9D9] bg-[#FAFAFA] flex-shrink-0">
        <div className="px-3 py-2">
          <p className="text-[10px] text-[#6A6D70] uppercase tracking-widest">Version</p>
          <p className="text-xs text-[#6A6D70] mt-0.5">v1.0.0 — Development</p>
        </div>
      </div>
    </aside>
  )
}
