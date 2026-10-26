'use client'

import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, ShieldCheck, KeyRound,
  Settings, ChevronRight, X, PanelLeftClose, PanelLeftOpen,
  Tag, Activity, Package, FileArchive, FileText, Truck, GitMerge, Database, BarChart2, MapPin, PackageCheck, FileDown, Image,
  Store, Receipt, FileSpreadsheet, ShoppingCart, LayoutGrid, ShoppingBag, Wallet, FolderOpen, Cookie, Megaphone, Warehouse,
  BadgePercent, Banknote, BarChart3, Mail, Ticket, Newspaper, Undo2, Boxes,
  History as HistoryIcon,
} from 'lucide-react'
import clsx from 'clsx'
import { useState, useEffect } from 'react'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

type SidebarMode = 'main' | 'ecommerce' | 'mt'
type EcommercePlatform = 'lazada' | 'tiktok' | 'shopee'
type MtChannel = 'crc' | 'hp-mh' | 'hp-mh-rtv' | 'hp-mh-stock' | 'dh'

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
      { href: '/admin/line-media', label: 'รายการสื่อ LINE (Media)', icon: Image, permission: 'line-media.view', exact: false },
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
      { href: '/admin/lazada/sessions', label: 'จัดการเซสชั่น', icon: Cookie, permission: 'lazada-sessions.view', exact: false },
      { href: '/admin/lazada/session-logs', label: 'Capture Logs', icon: HistoryIcon, permission: 'lazada-sessions.view', exact: false },

      { sectionLabel: 'รายการรายรับ (การเงิน)' },
      { href: '/admin/lazada/transactions', label: 'รายการธุรกรรม', icon: Receipt, permission: 'lazada-transactions.view', exact: false },
      { href: '/admin/lazada/transactions-work', label: 'จัดการธุรกรรม', icon: Receipt, permission: 'lazada-transactions-work.view', exact: true },
      { href: '/admin/lazada/transactions-work/history', label: 'ประวัติการจัดการธุรกรรม', icon: HistoryIcon, permission: 'lazada-transactions-work.view', exact: false },
      { href: '/admin/lazada/files', label: 'ไฟล์ส่งออก', icon: FileSpreadsheet, permission: 'lazada-files.view', exact: false },

      { sectionLabel: 'เครื่องมือโปรโมทสินค้า' },
      { href: '/admin/lazada/promotion', label: 'รายการโปรโมทสินค้า', icon: Megaphone, permission: 'lazada-promotion.view', exact: true },
      { href: '/admin/lazada/promotion-files', label: 'ไฟล์โปรโมทสินค้า', icon: FolderOpen, permission: 'lazada-promotion-files.view', exact: false },

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

      { sectionLabel: 'รายการรายรับ (การเงิน)' },
      { href: '/admin/tiktok/transactions', label: 'รายการธุรกรรม', icon: Receipt, permission: 'tiktok-transactions.view', exact: false },
      { href: '/admin/tiktok/files', label: 'ไฟล์ส่งออก', icon: FileSpreadsheet, permission: 'tiktok-files.view', exact: false },

      { sectionLabel: 'จัดการคำสั่งซื้อ' },
      { href: '/admin/tiktok/orders', label: 'รายการคำสั่งซื้อ', icon: ShoppingBag, permission: 'tiktok-orders.view', exact: false },
      { href: '/admin/tiktok/order-files', label: 'ไฟล์คำสั่งซื้อ', icon: FileText, permission: 'tiktok-order-files.view', exact: false },

      { sectionLabel: 'การเงิน / เอกสารทางภาษี' },
      { href: '/admin/tiktok/tax-invoices', label: 'เอกสารทางภาษี', icon: FileArchive, permission: 'tiktok-tax-invoices.view', exact: false },
    ],
  },
  shopee: {
    label: 'Shopee',
    short: 'S',
    items: [
      { sectionLabel: 'การจัดการ' },
      { href: '/admin/shopee/shops', label: 'จัดการร้านค้า', icon: Store, permission: 'shopee-shops.view', exact: false },
      { href: '/admin/shopee/sessions', label: 'จัดการเซสชั่น', icon: Cookie, permission: 'shopee-sessions.view', exact: false },
      { href: '/admin/shopee/session-logs', label: 'Capture Logs', icon: HistoryIcon, permission: 'shopee-sessions.view', exact: false },

      { sectionLabel: 'รายการรายรับ (การเงิน) Income Payout' },
      { href: '/admin/shopee/transactions', label: 'รายการธุรกรรม', icon: Receipt, permission: 'shopee-transactions.view', exact: false },
      { href: '/admin/shopee/files', label: 'ไฟล์ส่งออก', icon: FileSpreadsheet, permission: 'shopee-files.view', exact: false },

      { sectionLabel: 'รายการออเดอร์ คำสั่งซื้อ' },
      { href: '/admin/shopee/orders', label: 'รายการออเดอร์', icon: ShoppingBag, permission: 'shopee-orders.view', exact: false },
      { href: '/admin/shopee/order-files', label: 'ไฟล์ออเดอร์', icon: FileText, permission: 'shopee-order-files.view', exact: false },

      { sectionLabel: 'Seller Wallet Balance' },
      { href: '/admin/shopee/wallet-transactions', label: 'ธุรกรรม Wallet', icon: Wallet, permission: 'shopee-wallet-transactions.view', exact: false },
      { href: '/admin/shopee/wallet-files', label: 'ไฟล์ Wallet', icon: FolderOpen, permission: 'shopee-wallet-files.view', exact: false },

      { sectionLabel: 'ใบกำกับภาษี (e-Tax)' },
      { href: '/admin/shopee/etax', label: 'ใบกำกับภาษี', icon: FileArchive, permission: 'shopee-etax.view', exact: false },

      { sectionLabel: 'ค่าใช้จ่ายโฆษณา (Ads)' },
      { href: '/admin/shopee/ads', label: 'ค่าใช้จ่ายโฆษณา', icon: Megaphone, permission: 'shopee-ads.view', exact: false },

      { sectionLabel: 'Sync Logs' },
      { href: '/admin/shopee/sync-logs', label: 'ประวัติการซิงค์', icon: Activity, permission: 'shopee-sync-logs.view', exact: false },
    ],
  },
}

type MtSubTab = { key: string; label: string; items: PlatformItem[] }

const mtChannels: Record<MtChannel, { label: string; short: string; items: PlatformItem[]; subTabs?: MtSubTab[] }> = {
  crc: {
    label: 'CRC',
    short: 'CRC',
    items: [
      { sectionLabel: 'ข้อมูล CRC' },
      { href: '/admin/mt/crc/price-compensate', label: 'Price Compensate', icon: BadgePercent, permission: 'crc-price-compensate.view', exact: false },
      { href: '/admin/mt/crc/remittance', label: 'Remittance', icon: Banknote, permission: 'crc-remittance.view', exact: false },
      { href: '/admin/mt/crc/summary-report', label: 'Summary Report', icon: BarChart3, permission: 'crc-summary-report.view', exact: false },
      { sectionLabel: 'ระบบ' },
      { href: '/admin/mt/crc/audit-logs', label: 'ประวัติการทำงาน', icon: HistoryIcon, permission: 'crc-audit-logs.view', exact: false },
    ],
  },
  'hp-mh': {
    label: 'HP-MH',
    short: 'HP',
    items: [],
    subTabs: [
      {
        key: '3263',
        label: 'Vendor No: 3263',
        items: [
          { sectionLabel: 'Correspondence' },
          { href: '/admin/mt/hp-mh/correspondence', label: 'หนังสือ Correspondence', icon: Mail, permission: 'hpmh-correspondence.view', exact: false },
          { href: '/admin/mt/hp-mh/coupons', label: 'Vendor Coupon', icon: Ticket, permission: 'hpmh-coupons.view', exact: false },
          { href: '/admin/mt/hp-mh/leaflets', label: 'ชดเชย Leaflet', icon: Newspaper, permission: 'hpmh-leaflets.view', exact: false },
          { sectionLabel: 'บัญชีและการเงิน' },
          { href: '/admin/mt/hp-mh/compensate', label: 'ชดเชยราคา (Compensate)', icon: BadgePercent, permission: 'hpmh-compensate.view', exact: false },
          { sectionLabel: 'ยอดขาย' },
          { href: '/admin/mt/hp-mh/sales-export', label: 'Sales Export', icon: ShoppingCart, permission: 'hpmh-sales-export.view', exact: false },
          { sectionLabel: 'ระบบ' },
          { href: '/admin/mt/hp-mh/audit-logs/3263', label: 'ประวัติการทำงาน', icon: HistoryIcon, permission: 'hpmh-audit-logs.view', exact: false },
        ],
      },
      {
        key: '501447',
        label: 'Vendor No: 501447',
        items: [
          { sectionLabel: 'บัญชีและการเงิน' },
          { href: '/admin/mt/hp-mh/pas', label: 'ชำระเงินหลังการขาย (PAS)', icon: Wallet, permission: 'hpmh-pas.view', exact: false },
          { href: '/admin/mt/hp-mh/receipts', label: 'ใบเสร็จรับเงิน', icon: Receipt, permission: 'hpmh-receipts.view', exact: false },
          { sectionLabel: 'ระบบ' },
          { href: '/admin/mt/hp-mh/audit-logs/501447', label: 'ประวัติการทำงาน', icon: HistoryIcon, permission: 'hpmh-audit-logs.view', exact: false },
        ],
      },
    ],
  },
  'hp-mh-rtv': {
    label: 'HP-MH-RTV',
    short: 'RTV',
    items: [],
    subTabs: [
      {
        key: '501447',
        label: 'Vendor No: 501447',
        items: [
          { sectionLabel: 'คืนสินค้า' },
          { href: '/admin/mt/hp-mh-rtv/return-slips', label: 'ใบคืนสินค้า (Return Slip)', icon: Undo2, permission: 'hpmh-rtv-return-slips.view', exact: false },
        ],
      },
    ],
  },
  'hp-mh-stock': {
    label: 'HP-MH Stock',
    short: 'STK',
    items: [],
    subTabs: [
      {
        key: '501447',
        label: 'Vendor No: 501447',
        items: [
          { sectionLabel: 'สต็อกสินค้า' },
          { href: '/admin/mt/hp-mh-stock/inventory', label: 'สต็อกคงเหลือ (Inventory)', icon: Boxes, permission: 'hpmh-stock-inventory.view', exact: false },
        ],
      },
    ],
  },
  dh: {
    label: 'DH',
    short: 'DH',
    items: [
      { sectionLabel: 'ยอดขาย' },
      { href: '/admin/mt/dh/sales-report', label: 'รายงานยอดขาย (Sales Report)', icon: ShoppingCart, permission: 'dh-sales-report.view', exact: false },
    ],
  },
}

const mtChannelKeys = Object.keys(mtChannels) as MtChannel[]

const getMtChannelFromPath = (pathname: string): MtChannel | null => {
  if (!pathname.startsWith('/admin/mt/')) return null
  const segment = pathname.split('/')[3] as MtChannel
  return mtChannelKeys.includes(segment) ? segment : null
}

// Sub-tab whose menu contains the current path (falls back to the first sub-tab)
const getMtSubTabFromPath = (channel: MtChannel, pathname: string): string | null => {
  const subTabs = mtChannels[channel].subTabs
  if (!subTabs) return null
  const match = subTabs.find(tab =>
    tab.items.some(item => item.href && (pathname === item.href || pathname.startsWith(item.href + '/')))
  )
  return (match ?? subTabs[0]).key
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

  const isMtPath = pathname.startsWith('/admin/mt')

  const [mode, setMode] = useState<SidebarMode>(isEcommercePath ? 'ecommerce' : isMtPath ? 'mt' : 'main')
  const [activePlatform, setActivePlatform] = useState<EcommercePlatform>(
    pathname.startsWith('/admin/tiktok') ? 'tiktok'
      : pathname.startsWith('/admin/shopee') ? 'shopee'
        : 'lazada'
  )
  const [activeMtChannel, setActiveMtChannel] = useState<MtChannel>(getMtChannelFromPath(pathname) ?? 'crc')
  const [activeMtSubTab, setActiveMtSubTab] = useState<Partial<Record<MtChannel, string>>>(() => {
    const channel = getMtChannelFromPath(pathname)
    const subTab = channel ? getMtSubTabFromPath(channel, pathname) : null
    return channel && subTab ? { [channel]: subTab } : {}
  })

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
    } else if (pathname.startsWith('/admin/mt')) {
      setMode('mt')
      const channel = getMtChannelFromPath(pathname)
      if (channel) {
        setActiveMtChannel(channel)
        const subTab = getMtSubTabFromPath(channel, pathname)
        if (subTab) setActiveMtSubTab(prev => ({ ...prev, [channel]: subTab }))
      }
    }
  }, [pathname])

  const mtSubTabs = mtChannels[activeMtChannel].subTabs
  const currentMtSubTab = mtSubTabs?.find(tab => tab.key === activeMtSubTab[activeMtChannel]) ?? mtSubTabs?.[0]
  const subItems = mode === 'mt'
    ? (currentMtSubTab?.items ?? mtChannels[activeMtChannel].items)
    : ecommercePlatforms[activePlatform].items
  const platformItems = subItems.filter(
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
          <button
            onClick={() => setMode('mt')}
            className={clsx(
              'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors duration-150 border-b-2',
              mode === 'mt'
                ? 'text-[#0070F2] border-[#0070F2] bg-white'
                : 'text-[#6A6D70] border-transparent hover:text-[#32363A] hover:bg-[#EBEBEB]'
            )}
          >
            <Warehouse className="w-4 h-4" />
            <span>MT</span>
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
          <button
            onClick={() => setMode('mt')}
            title="MT"
            className={clsx(
              'flex justify-center py-2.5 transition-colors duration-150 border-l-2',
              mode === 'mt'
                ? 'text-[#0070F2] border-[#0070F2]'
                : 'text-[#6A6D70] border-transparent hover:text-[#0070F2] hover:bg-[#F5F5F5]'
            )}
          >
            <Warehouse className="w-4 h-4" />
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
          </div>
        )}

        {/* ── MT mode ── */}
        {mode === 'mt' && (
          <div>
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#6A6D70]">
                Report MT
              </p>
            )}

            {/* Channel tabs */}
            {!collapsed ? (
              <div className="grid grid-cols-3 gap-1 mb-3 mx-1">
                {mtChannelKeys.map((channel) => (
                  <button
                    key={channel}
                    onClick={() => setActiveMtChannel(channel)}
                    className={clsx(
                      'py-2 px-1 text-xs font-semibold rounded border transition-colors duration-150 whitespace-nowrap',
                      activeMtChannel === channel
                        ? 'bg-[#0070F2] text-white border-[#0070F2]'
                        : 'bg-white text-[#6A6D70] border-[#E8E8E8] hover:bg-[#F5F5F5] hover:text-[#32363A]'
                    )}
                  >
                    {mtChannels[channel].label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-0.5 mb-2">
                {mtChannelKeys.map((channel) => (
                  <button
                    key={channel}
                    onClick={() => setActiveMtChannel(channel)}
                    title={mtChannels[channel].label}
                    className={clsx(
                      'w-full flex justify-center py-2 text-[10px] font-bold rounded transition-colors duration-150 border-l-2',
                      activeMtChannel === channel
                        ? 'bg-[#EBF5FE] text-[#0070F2] border-[#0070F2]'
                        : 'text-[#6A6D70] border-transparent hover:bg-[#F5F5F5] hover:text-[#32363A]'
                    )}
                  >
                    {mtChannels[channel].short}
                  </button>
                ))}
              </div>
            )}

            {/* Vendor sub-tabs (channels that define subTabs) */}
            {mtSubTabs && !collapsed && (
              <div className="flex gap-1 mb-3 mx-1 border-b border-[#E8E8E8]">
                {mtSubTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveMtSubTab(prev => ({ ...prev, [activeMtChannel]: tab.key }))}
                    className={clsx(
                      'flex-1 py-1.5 px-1 text-[11px] font-semibold border-b-2 -mb-px transition-colors duration-150 whitespace-nowrap',
                      currentMtSubTab?.key === tab.key
                        ? 'text-[#0070F2] border-[#0070F2]'
                        : 'text-[#6A6D70] border-transparent hover:text-[#32363A]'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Sub-items (E-Commerce / MT) ── */}
        {mode !== 'main' && (
          <div>
            <div className="space-y-0.5">
              {platformItems.filter(item => !item.sectionLabel).length === 0 ? (
                !collapsed && (
                  <p className="px-3 py-2 text-xs text-[#6A6D70]">
                    {subItems.length === 0 ? 'ยังไม่มีเมนู' : 'ไม่มีสิทธิ์เข้าถึง'}
                  </p>
                )
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
