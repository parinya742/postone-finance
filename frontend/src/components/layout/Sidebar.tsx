'use client'

import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, ShieldCheck, KeyRound,
  Settings, ChevronRight, X, PanelLeftClose, PanelLeftOpen,
  Tag, Activity, Package, FileArchive, FileText, Truck, GitMerge, Database, BarChart2, MapPin, PackageCheck, FileDown,
  Store, Receipt, FileSpreadsheet, ShoppingCart, LayoutGrid, ShoppingBag, Wallet, FolderOpen, Cookie,
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

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  permission: string | null
  exact: boolean
  sectionLabel?: never
}

type SectionDivider = {
  sectionLabel: string
  href?: never
  label?: never
  icon?: never
  permission?: never
  exact?: never
}

type PlatformItem = NavItem | SectionDivider

const ecommercePlatforms: Record<EcommercePlatform, { label: string; short: string; items: PlatformItem[] }> = {
  lazada: {
    label: 'Lazada',
    short: 'L',
    items: [
      { sectionLabel: 'การจัดการ' },
      { href: '/admin/lazada/shops', label: 'จัดการร้านค้า', icon: Store, permission: 'lazada-shops.view', exact: false },
      { href: '/admin/lazada/sessions', label: 'Cookie Sessions', icon: Cookie, permission: 'lazada-sessions.view', exact: false },

      { sectionLabel: 'รายการรายรับ' },
      { href: '/admin/lazada/transactions', label: 'รายการธุรกรรม', icon: Receipt, permission: 'lazada-shops.view', exact: false },
      { href: '/admin/lazada/files', label: 'ไฟล์ส่งออก', icon: FileSpreadsheet, permission: 'lazada-shops.view', exact: false },

      { sectionLabel: 'รายการใบแจ้งหนี้' },
      { href: '/admin/lazada/invoices', label: 'ใบแจ้งหนี้', icon: FileText, permission: 'lazada-invoices.view', exact: false },
    ],
  },
  tiktok: {
    label: 'TikTok',
    short: 'T',
    items: [
      { sectionLabel: 'การจัดการ' },
      { href: '/admin/tiktok/shops', label: 'จัดการร้านค้า', icon: Store, permission: 'tiktok-shops.view', exact: false },

      { sectionLabel: 'รายการรายรับ' },
      { href: '/admin/tiktok/transactions', label: 'รายการธุรกรรม', icon: Receipt, permission: 'tiktok-shops.view', exact: false },
      { href: '/admin/tiktok/files', label: 'ไฟล์ส่งออก', icon: FileSpreadsheet, permission: 'tiktok-shops.view', exact: false },
    ],
  },
  shopee: {
    label: 'Shopee',
    short: 'S',
    items: [
      { sectionLabel: 'การจัดการ' },
      { href: '/admin/shopee/shops', label: 'จัดการร้านค้า', icon: Store, permission: 'shopee-shops.view', exact: false },

      { sectionLabel: 'รายการรายรับ' },
      { href: '/admin/shopee/transactions', label: 'รายการธุรกรรม', icon: Receipt, permission: 'shopee-shops.view', exact: false },
      { href: '/admin/shopee/files', label: 'ไฟล์ส่งออก', icon: FileSpreadsheet, permission: 'shopee-shops.view', exact: false },

      { sectionLabel: 'รายการออเดอร์' },
      { href: '/admin/shopee/orders', label: 'รายการออเดอร์', icon: ShoppingBag, permission: 'shopee-shops.view', exact: false },
      { href: '/admin/shopee/order-files', label: 'ไฟล์ออเดอร์', icon: FileText, permission: 'shopee-shops.view', exact: false },

      { sectionLabel: 'Seller Wallet' },
      { href: '/admin/shopee/wallet-transactions', label: 'ธุรกรรม Wallet', icon: Wallet, permission: 'shopee-shops.view', exact: false },
      { href: '/admin/shopee/wallet-files', label: 'ไฟล์ Wallet', icon: FolderOpen, permission: 'shopee-shops.view', exact: false },

      { sectionLabel: 'Sync Logs' },
      { href: '/admin/shopee/sync-logs', label: 'ประวัติการซิงค์', icon: Activity, permission: 'shopee-shops.view', exact: false },
    ],
  },
}

const isDemo = process.env.NEXT_PUBLIC_APP_ENV === 'demo'

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { can } = useAuth()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('sidebar_collapsed') === 'true'
  })

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
        'fixed inset-y-0 left-0 z-30 bg-white border-r border-[#D9D9D9] flex flex-col transition-all duration-300 ease-in-out flex-shrink-0',
        'lg:relative lg:translate-x-0 lg:z-auto',
        collapsed ? 'w-16' : 'w-72',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-3 border-b border-[#2D3F51] flex-shrink-0 bg-[#354A5E]">
        <div className={clsx('flex items-center gap-3 overflow-hidden', collapsed && 'justify-center w-full')}>
          <img src="/pumpkin.png" alt="POSTONE Logo" className="w-8 h-8 object-contain flex-shrink-0" />
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="font-bold text-sm tracking-wide text-white whitespace-nowrap">Report {isDemo ? '(Demo)' : ''}</p>
              <p className="text-[#ACC7D9] text-[10px] uppercase tracking-widest">Finance</p>
            </div>
          )}
        </div>
        {/* Mobile close */}
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded text-white/70 hover:text-white hover:bg-[#2D3F51] transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
        {/* Desktop collapse toggle */}
        {!collapsed && (
          <button
            onClick={() => { setCollapsed(true); localStorage.setItem('sidebar_collapsed', 'true') }}
            className="hidden lg:flex p-1.5 rounded text-white/70 hover:text-white hover:bg-[#2D3F51] transition-colors flex-shrink-0"
            title="ย่อ Sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div className="hidden lg:flex justify-center py-2 border-b border-[#D9D9D9] flex-shrink-0">
          <button
            onClick={() => { setCollapsed(false); localStorage.setItem('sidebar_collapsed', 'false') }}
            className="p-1.5 rounded text-[#6A6D70] hover:text-[#0070F2] hover:bg-[#EBF5FE] transition-colors"
            title="ขยาย Sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mode switcher */}
      {!collapsed && (
        <div className="flex border-b border-[#D9D9D9] bg-white flex-shrink-0">
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
      )}

      {/* Collapsed mode switcher — icon only */}
      {collapsed && (
        <div className="hidden lg:flex flex-col border-b border-[#D9D9D9] bg-white flex-shrink-0">
          <button
            onClick={() => setMode('main')}
            title="หลัก"
            className={clsx(
              'flex justify-center py-2.5 transition-colors duration-150 border-l-2',
              mode === 'main'
                ? 'text-[#0070F2] border-[#0070F2]'
                : 'text-[#6A6D70] border-transparent hover:text-[#0070F2] hover:bg-[#F5F5F5]'
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMode('ecommerce')}
            title="E-Commerce"
            className={clsx(
              'flex justify-center py-2.5 transition-colors duration-150 border-l-2',
              mode === 'ecommerce'
                ? 'text-[#0070F2] border-[#0070F2]'
                : 'text-[#6A6D70] border-transparent hover:text-[#0070F2] hover:bg-[#F5F5F5]'
            )}
          >
            <ShoppingCart className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className={clsx('flex-1 overflow-y-auto py-3', collapsed ? 'px-1' : 'px-2')}>

        {/* ── Main mode ── */}
        {mode === 'main' && navGroups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.permission || can(item.permission)
          )
          if (visibleItems.length === 0) return null

          return (
            <div key={group.label} className={clsx('mb-4', collapsed && 'mb-2')}>
              {!collapsed && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#6A6D70]">
                  {group.label}
                </p>
              )}
              {collapsed && <div className="mx-1 mb-1 border-t border-[#E8E8E8]" />}
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
                      title={collapsed ? label : undefined}
                      className={clsx(
                        'group flex items-center rounded text-sm transition-all duration-150 border-l-2',
                        collapsed
                          ? 'justify-center px-0 py-2.5'
                          : 'justify-between px-3 py-2',
                        active
                          ? 'bg-[#EBF5FE] text-[#0070F2] font-medium border-[#0070F2]'
                          : 'text-[#32363A] hover:bg-[#F5F5F5] hover:text-[#0070F2] border-transparent'
                      )}
                    >
                      <div className={clsx('flex items-center', !collapsed && 'gap-3')}>
                        <Icon className={clsx('w-4 h-4 flex-shrink-0', active ? 'text-[#0070F2]' : 'text-[#6A6D70] group-hover:text-[#0070F2]')} />
                        {!collapsed && <span>{label}</span>}
                      </div>
                      {!collapsed && active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
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
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#6A6D70]">
                Report Ecommerce
              </p>
            )}

            {/* Platform tabs */}
            {!collapsed ? (
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
            ) : (
              <div className="flex flex-col gap-0.5 mb-2">
                {(Object.keys(ecommercePlatforms) as EcommercePlatform[]).map((platform) => (
                  <button
                    key={platform}
                    onClick={() => setActivePlatform(platform)}
                    title={ecommercePlatforms[platform].label}
                    className={clsx(
                      'w-full flex justify-center py-2 text-xs font-bold rounded transition-colors duration-150 border-l-2',
                      activePlatform === platform
                        ? 'bg-[#EBF5FE] text-[#0070F2] border-[#0070F2]'
                        : 'text-[#6A6D70] border-transparent hover:bg-[#F5F5F5] hover:text-[#32363A]'
                    )}
                  >
                    {ecommercePlatforms[platform].short}
                  </button>
                ))}
              </div>
            )}

            {/* Sub-items */}
            <div className="space-y-0.5">
              {platformItems.filter(item => !item.sectionLabel).length === 0 ? (
                !collapsed && <p className="px-3 py-2 text-xs text-[#6A6D70]">ไม่มีสิทธิ์เข้าถึง</p>
              ) : (
                platformItems.map((item, idx) => {
                  if (item.sectionLabel) {
                    if (collapsed) return null
                    return (
                      <p key={`section-${idx}`} className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[#6A6D70]">
                        {item.sectionLabel}
                      </p>
                    )
                  }
                  const { href, label, icon: Icon, exact } = item as NavItem
                  const active = exact
                    ? pathname === href
                    : pathname === href || pathname.startsWith(href + '/')
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      title={collapsed ? label : undefined}
                      className={clsx(
                        'group flex items-center rounded text-sm transition-all duration-150 border-l-2',
                        collapsed
                          ? 'justify-center px-0 py-2.5'
                          : 'justify-between px-3 py-2',
                        active
                          ? 'bg-[#EBF5FE] text-[#0070F2] font-medium border-[#0070F2]'
                          : 'text-[#32363A] hover:bg-[#F5F5F5] hover:text-[#0070F2] border-transparent'
                      )}
                    >
                      <div className={clsx('flex items-center', !collapsed && 'gap-3')}>
                        <Icon className={clsx('w-4 h-4 flex-shrink-0', active ? 'text-[#0070F2]' : 'text-[#6A6D70] group-hover:text-[#0070F2]')} />
                        {!collapsed && <span>{label}</span>}
                      </div>
                      {!collapsed && active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                    </Link>
                  )
                })
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-3 border-t border-[#D9D9D9] bg-white flex-shrink-0">
          <div className="px-3 py-2">
            <p className="text-[10px] text-[#6A6D70] uppercase tracking-widest">Version</p>
            <p className="text-xs text-[#6A6D70] mt-0.5">v1.0.0 — Development</p>
          </div>
        </div>
      )}
    </aside>
  )
}
