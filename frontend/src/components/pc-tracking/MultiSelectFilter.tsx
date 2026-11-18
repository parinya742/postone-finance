'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

type Option = { value: string; label: string; disabled?: boolean }

type Props = {
  placeholder: string            // shown when nothing is selected, e.g. "ทุกกลุ่ม"
  options: Option[]
  value: string[]
  onChange: (value: string[]) => void
  className?: string
}

/** Dropdown with a search box and a checkbox per option. Empty selection = no filter. */
export default function MultiSelectFilter({ placeholder, options, value, onChange, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const selected = useMemo(() => new Set(value), [value])
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    return term ? options.filter((o) => o.label.toLowerCase().includes(term) || o.value.toLowerCase().includes(term)) : options
  }, [options, q])

  const toggle = (v: string) => onChange(selected.has(v) ? value.filter((x) => x !== v) : [...value, v])
  const selectShown = () => onChange([...new Set([...value, ...shown.filter((o) => !o.disabled).map((o) => o.value)])])

  const summary =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? options.find((o) => o.value === value[0])?.label ?? value[0]
        : `เลือก ${value.length} รายการ`

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full min-w-[160px] max-w-[260px] flex items-center gap-2 border rounded px-3 py-2 text-sm bg-white text-left focus:outline-none focus:border-[#0070F2] focus:ring-1 focus:ring-[#0070F2] ${
          value.length ? 'border-[#0070F2] text-[#0070F2]' : 'border-[#89919A] text-[#32363A]'
        }`}
      >
        <span className="flex-1 truncate">{summary}</span>
        {value.length > 0 && (
          <span
            role="button"
            aria-label="ล้างตัวกรอง"
            onClick={(e) => { e.stopPropagation(); onChange([]) }}
            className="text-[#6A6D70] hover:text-[#AA0808]"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-[#6A6D70] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-72 bg-white border border-[#D9D9D9] rounded shadow-lg">
          <div className="p-2 border-b border-[#EBEBEB]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6A6D70]" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหา..."
                className="w-full pl-8 pr-2 py-1.5 border border-[#D9D9D9] rounded text-sm focus:outline-none focus:border-[#0070F2]"
              />
            </div>
            <div className="flex justify-between mt-2 text-xs">
              <button type="button" onClick={selectShown} className="text-[#0070F2] hover:underline">
                เลือกทั้งหมด{q ? 'ที่ค้นเจอ' : ''}
              </button>
              <button type="button" onClick={() => onChange([])} className="text-[#6A6D70] hover:underline" disabled={!value.length}>
                ล้าง ({value.length})
              </button>
            </div>
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {shown.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-[#6A6D70]">ไม่พบรายการ</li>
            ) : (
              shown.map((o) => (
                <li key={o.value}>
                  <label
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm ${
                      o.disabled ? 'text-[#A9AEB4] cursor-not-allowed' : 'text-[#32363A] hover:bg-[#F5F5F5] cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(o.value)}
                      disabled={o.disabled}
                      onChange={() => toggle(o.value)}
                      className="accent-[#0070F2] w-4 h-4 shrink-0 disabled:opacity-50"
                    />
                    <span className="truncate" title={o.label}>{o.label}</span>
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
