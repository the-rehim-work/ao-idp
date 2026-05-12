import React, { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'

type TableInfo = { table_name: string; column_count: number; size_bytes: number }
type ColumnInfo = { column_name: string; data_type: string; is_nullable: string; column_default: string | null }
type TableRowsResult = { rows: Record<string, unknown>[]; total: number; page: number; size: number; totalPages: number }
type QueryResult = { columns: string[]; rows: Record<string, unknown>[]; count: number; error?: string }

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN',
  'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'AND', 'OR', 'NOT', 'IN', 'NOT IN',
  'LIKE', 'ILIKE', 'IS NULL', 'IS NOT NULL', 'AS', 'ON', 'DISTINCT', 'UNION', 'UNION ALL',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF', 'CAST', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'WITH', 'EXPLAIN', 'BETWEEN', 'EXISTS', 'ASC', 'DESC', 'RETURNING',
]

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function cellStr(val: unknown): string {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

// ─── Row Detail / Edit Modal ─────────────────────────────────────────────────
function RowModal({
  mode, table, columns, row, onClose, onSave,
}: {
  mode: 'view' | 'edit' | 'add'
  table: string
  columns: ColumnInfo[]
  row: Record<string, unknown>
  onClose: () => void
  onSave: () => void
}) {
  const qc = useQueryClient()
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    columns.forEach(c => {
      const v = row[c.column_name]
      init[c.column_name] = v === null || v === undefined ? '' : String(v)
    })
    return init
  })
  const [isEdit, setIsEdit] = useState(mode === 'edit' || mode === 'add')

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | null> = {}
      columns.forEach(c => {
        const v = values[c.column_name]
        if (mode === 'add') {
          if (v !== '') payload[c.column_name] = v
        } else {
          if (c.column_name !== 'id') payload[c.column_name] = v === '' ? null : v
        }
      })
      if (mode === 'add') {
        await apiClient.post(`/db/tables/${table}/rows`, payload)
      } else {
        const id = row['id']
        await apiClient.put(`/db/tables/${table}/rows/${id}`, payload)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['db-rows', table] })
      onSave()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.delete(`/db/tables/${table}/rows/${row['id']}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['db-rows', table] })
      onSave()
    },
  })

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyRow = () => {
    const data: Record<string, unknown> = {}
    columns.forEach(c => { data[c.column_name] = row[c.column_name] })
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const AUTO_COLS = new Set(['created_at', 'updated_at', 'last_login_at'])
  const isAutoCol = (name: string) => AUTO_COLS.has(name)
  const isRequired = (col: ColumnInfo) =>
    col.is_nullable === 'NO' && !col.column_default && col.column_name !== 'id'

  const inputStyle = (disabled: boolean): React.CSSProperties => ({
    width: '100%', padding: '0.4rem 0.6rem',
    background: disabled ? 'rgba(94,234,212,0.03)' : '#0f141b',
    border: `1px solid ${disabled ? 'rgba(94,234,212,0.08)' : 'rgba(94,234,212,0.25)'}`,
    color: disabled ? '#64748b' : '#2dd4bf',
    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem',
    outline: 'none', borderRadius: 2,
  })

  const isBoolean = (col: ColumnInfo) => col.data_type === 'boolean'
  const isNumeric = (col: ColumnInfo) => ['integer', 'bigint', 'smallint', 'numeric', 'decimal', 'real', 'double precision'].includes(col.data_type)
  const isJson = (col: ColumnInfo) => col.data_type === 'json' || col.data_type === 'jsonb'
  const isTimestamp = (col: ColumnInfo) => col.data_type.startsWith('timestamp')
  const isDate = (col: ColumnInfo) => col.data_type === 'date'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#181c25', border: '1px solid rgba(94,234,212,0.2)',
        width: '90%', maxWidth: 680, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.85rem 1.25rem', borderBottom: '1px solid rgba(94,234,212,0.1)',
        }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              {mode === 'add' ? 'insert row' : isEdit ? 'edit row' : 'row detail'}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace" }}>{table}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {mode !== 'add' && (
              <button onClick={copyRow} style={btnStyle(copied ? '#86efac' : '#94a3b8')}>
                {copied ? 'copied!' : 'copy json'}
              </button>
            )}
            {mode === 'view' && !isEdit && (
              <button onClick={() => setIsEdit(true)} style={btnStyle('#5eead4')}>edit</button>
            )}
            {mode !== 'add' && !isEdit && !confirmDelete && (
              <button onClick={() => setConfirmDelete(true)} style={btnStyle('#ff4444', 'rgba(255,68,68,0.15)')}>delete</button>
            )}
            {confirmDelete && (
              <>
                <span style={{ fontSize: '0.72rem', color: '#ff4444' }}>confirm?</span>
                <button onClick={() => deleteMutation.mutate()} style={btnStyle('#ff4444', 'rgba(255,68,68,0.2)')}>yes, delete</button>
                <button onClick={() => setConfirmDelete(false)} style={btnStyle('#64748b')}>cancel</button>
              </>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.1rem', cursor: 'pointer', padding: '0 0.25rem' }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '1rem 1.25rem', flex: 1 }}>
          {saveMutation.isError && (
            <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.3)', color: '#ff4444', fontSize: '0.78rem', marginBottom: '1rem', fontFamily: "'JetBrains Mono', monospace" }}>
              {(saveMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed'}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem 1rem', alignItems: 'start' }}>
            {columns.map(col => {
              const isId = col.column_name === 'id'
              const isAuto = isAutoCol(col.column_name)
              const required = isRequired(col)
              const disabled = !isEdit || isId || (isAuto && mode !== 'add')
              const isLong = (values[col.column_name] ?? '').length > 60
              return (
                <React.Fragment key={col.column_name}>
                  <div style={{ padding: '0.45rem 0', fontSize: '0.72rem' }}>
                    <div style={{ color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace", display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      {col.column_name}
                      {required && <span style={{ color: '#ff6644', fontSize: '0.65rem' }}>*</span>}
                      {isAuto && <span style={{ color: '#64748b', fontSize: '0.6rem', letterSpacing: '0.05em' }}>auto</span>}
                      {isId && <span style={{ color: '#64748b', fontSize: '0.6rem', letterSpacing: '0.05em' }}>pk</span>}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.63rem', marginTop: '0.1rem' }}>{col.data_type} · {col.is_nullable === 'YES' ? 'nullable' : 'not null'}</div>
                  </div>
                  <div>
                    {isBoolean(col) && isEdit && !disabled ? (
                      <select
                        value={values[col.column_name] ?? ''}
                        onChange={e => setValues(v => ({ ...v, [col.column_name]: e.target.value }))}
                        style={{ ...inputStyle(false), cursor: 'pointer' }}
                      >
                        {col.is_nullable === 'YES' && <option value="">NULL</option>}
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : isJson(col) && isEdit && !disabled ? (
                      <textarea
                        value={values[col.column_name] ?? ''}
                        onChange={e => setValues(v => ({ ...v, [col.column_name]: e.target.value }))}
                        rows={4}
                        style={{ ...inputStyle(false), resize: 'vertical' }}
                      />
                    ) : isLong && isEdit && !disabled ? (
                      <textarea
                        value={values[col.column_name] ?? ''}
                        onChange={e => setValues(v => ({ ...v, [col.column_name]: e.target.value }))}
                        rows={3}
                        style={{ ...inputStyle(false), resize: 'vertical' }}
                      />
                    ) : !disabled && isTimestamp(col) ? (
                      <input
                        type="datetime-local"
                        value={values[col.column_name] ?? ''}
                        onChange={e => setValues(v => ({ ...v, [col.column_name]: e.target.value }))}
                        style={{ ...inputStyle(false), colorScheme: 'dark' }}
                      />
                    ) : !disabled && isDate(col) ? (
                      <input
                        type="date"
                        value={values[col.column_name] ?? ''}
                        onChange={e => setValues(v => ({ ...v, [col.column_name]: e.target.value }))}
                        style={{ ...inputStyle(false), colorScheme: 'dark' }}
                      />
                    ) : (
                      <input
                        type={!disabled && isNumeric(col) ? 'number' : 'text'}
                        value={values[col.column_name] ?? ''}
                        disabled={disabled}
                        onChange={e => setValues(v => ({ ...v, [col.column_name]: e.target.value }))}
                        style={inputStyle(disabled)}
                      />
                    )}
                  </div>
                </React.Fragment>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        {isEdit && (
          <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid rgba(94,234,212,0.1)', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={btnStyle('#64748b')}>cancel</button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              style={btnStyle('#5eead4')}
            >
              {saveMutation.isPending ? 'saving…' : mode === 'add' ? 'insert row' : 'save changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function btnStyle(color: string, bg = 'transparent'): React.CSSProperties {
  return {
    padding: '0.35rem 0.85rem', background: bg,
    border: `1px solid ${color}`, color,
    fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 600,
    letterSpacing: '0.05em', cursor: 'pointer', borderRadius: 2,
  }
}

// ─── Table Browser ────────────────────────────────────────────────────────────
function TableBrowser({ table, columns }: { table: string; columns: ColumnInfo[] }) {
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [orderBy, setOrderBy] = useState('')
  const [direction, setDirection] = useState<'ASC' | 'DESC'>('DESC')
  const [modal, setModal] = useState<{ mode: 'view' | 'edit' | 'add'; row: Record<string, unknown> } | null>(null)

  const params = new URLSearchParams({ page: String(page), size: '50' })
  if (orderBy) { params.set('orderBy', orderBy); params.set('direction', direction) }

  const { data, isFetching } = useQuery({
    queryKey: ['db-rows', table, page, orderBy, direction],
    queryFn: () => apiClient.get<TableRowsResult>(`/db/tables/${table}/rows?${params}`).then(r => r.data),
  })

  const cols = columns.map(c => c.column_name)
  const hasId = cols.includes('id')

  const handleSort = (col: string) => {
    if (orderBy === col) setDirection(d => d === 'ASC' ? 'DESC' : 'ASC')
    else { setOrderBy(col); setDirection('DESC') }
    setPage(0)
  }

  const emptyRow = Object.fromEntries(cols.map(c => [c, '']))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%' }}>
      {modal && (
        <RowModal
          mode={modal.mode}
          table={table}
          columns={columns}
          row={modal.row}
          onClose={() => setModal(null)}
          onSave={() => {
            setModal(null)
            qc.invalidateQueries({ queryKey: ['db-rows', table] })
          }}
        />
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{table}</span>
        {data && <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{data.total.toLocaleString()} rows</span>}
        {isFetching && <span style={{ fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.08em' }}>loading…</span>}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setModal({ mode: 'add', row: emptyRow })}
          style={btnStyle('#86efac')}
        >
          + add row
        </button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead style={{ position: 'sticky', top: 0, background: '#11171f', zIndex: 1 }}>
            <tr style={{ borderBottom: '1px solid rgba(94,234,212,0.2)' }}>
              {cols.map(col => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  style={{
                    padding: '0.45rem 0.75rem', textAlign: 'left',
                    color: orderBy === col ? '#5eead4' : '#64748b',
                    fontWeight: 600, fontSize: '0.65rem', letterSpacing: '0.1em',
                    textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap',
                    userSelect: 'none', fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {col} {orderBy === col ? (direction === 'ASC' ? '↑' : '↓') : ''}
                </th>
              ))}
              <th style={{ width: 60, padding: '0.45rem 0.75rem' }} />
            </tr>
          </thead>
          <tbody>
            {(data?.rows ?? []).map((row, i) => (
              <tr
                key={i}
                style={{ borderBottom: '1px solid rgba(94,234,212,0.05)', cursor: 'pointer' }}
                onClick={() => setModal({ mode: 'view', row })}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(94,234,212,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                {cols.map(col => {
                  const val = row[col]
                  const str = cellStr(val)
                  const isNull = val === null || val === undefined
                  const isBool = typeof val === 'boolean'
                  return (
                    <td
                      key={col}
                      title={str}
                      style={{
                        padding: '0.35rem 0.75rem',
                        color: isNull ? '#333' : isBool ? (val ? '#86efac' : '#ff6644') : '#5eead4',
                        maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.76rem',
                      }}
                    >
                      {isNull ? <span style={{ opacity: 0.35 }}>NULL</span> : str.length > 60 ? str.slice(0, 57) + '…' : str}
                    </td>
                  )
                })}
                <td style={{ padding: '0.35rem 0.75rem' }}>
                  {hasId && (
                    <button
                      onClick={e => { e.stopPropagation(); setModal({ mode: 'edit', row }) }}
                      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.7rem', padding: '0.1rem 0.3rem' }}
                      title="Edit row"
                    >
                      ✎
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!data?.rows.length && (
              <tr><td colSpan={cols.length + 1} style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>no rows</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
          <button disabled={page === 0} onClick={() => setPage(0)} style={pageBtn(page === 0)}>«</button>
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={pageBtn(page === 0)}>‹ prev</button>
          <span style={{ fontSize: '0.72rem', color: '#64748b', padding: '0 0.5rem' }}>
            page {page + 1} of {data.totalPages} · {data.total.toLocaleString()} rows
          </span>
          <button disabled={page >= data.totalPages - 1} onClick={() => setPage(p => p + 1)} style={pageBtn(page >= data.totalPages - 1)}>next ›</button>
          <button disabled={page >= data.totalPages - 1} onClick={() => setPage(data.totalPages - 1)} style={pageBtn(page >= data.totalPages - 1)}>»</button>
        </div>
      )}
    </div>
  )
}

function pageBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.3rem 0.65rem', background: 'transparent',
    border: '1px solid rgba(94,234,212,0.15)',
    color: disabled ? '#333' : '#94a3b8',
    fontFamily: 'inherit', fontSize: '0.72rem', cursor: disabled ? 'default' : 'pointer',
    borderRadius: 2,
  }
}

// ─── SQL Autocomplete Textarea ────────────────────────────────────────────────
function SqlEditor({
  value, onChange, onRun, tables,
}: {
  value: string
  onChange: (v: string) => void
  onRun: () => void
  tables: string[]
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [wordStart, setWordStart] = useState(0)
  const [activeSug, setActiveSug] = useState(0)

  const ALL_COMPLETIONS = [...SQL_KEYWORDS, ...tables]

  const getCurrentWord = (text: string, pos: number) => {
    let start = pos - 1
    while (start >= 0 && /[a-zA-Z0-9_]/.test(text[start])) start--
    start++
    return { word: text.slice(start, pos), start }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    onChange(val)
    const pos = e.target.selectionStart ?? val.length
    const { word, start } = getCurrentWord(val, pos)
    setWordStart(start)
    if (word.length >= 2) {
      const up = word.toUpperCase()
      const matches = ALL_COMPLETIONS.filter(s => s.toUpperCase().startsWith(up) && s.toUpperCase() !== up)
      setSuggestions(matches.slice(0, 10))
      setActiveSug(0)
    } else {
      setSuggestions([])
    }
  }

  const applySuggestion = useCallback((sug: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const pos = ta.selectionStart ?? value.length
    const before = value.slice(0, wordStart)
    const after = value.slice(pos)
    const newVal = before + sug + ' ' + after
    onChange(newVal)
    setSuggestions([])
    ta.focus()
    const newPos = wordStart + sug.length + 1
    requestAnimationFrame(() => ta.setSelectionRange(newPos, newPos))
  }, [value, wordStart, onChange])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSug(a => Math.min(a + 1, suggestions.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSug(a => Math.max(a - 1, 0)) }
      else if (e.key === 'Tab' || e.key === 'Enter') {
        if (suggestions[activeSug]) { e.preventDefault(); applySuggestion(suggestions[activeSug]) }
        else if (e.ctrlKey && e.key === 'Enter') { setSuggestions([]); onRun() }
      } else if (e.key === 'Escape') { setSuggestions([]) }
      return
    }
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); onRun() }
  }

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={7}
        spellCheck={false}
        style={{
          width: '100%', padding: '0.75rem',
          background: '#11171f', border: '1px solid rgba(94,234,212,0.18)',
          color: '#2dd4bf', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82rem',
          resize: 'vertical', outline: 'none', lineHeight: 1.6,
        }}
        placeholder="SELECT * FROM users LIMIT 20"
      />
      {suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 200,
          background: '#181c25', border: '1px solid rgba(94,234,212,0.25)',
          minWidth: 200, maxHeight: 260, overflowY: 'auto',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        }}>
          {suggestions.map((s, i) => (
            <div
              key={s}
              onMouseDown={e => { e.preventDefault(); applySuggestion(s) }}
              style={{
                padding: '0.35rem 0.85rem',
                background: i === activeSug ? 'rgba(94,234,212,0.1)' : 'transparent',
                color: SQL_KEYWORDS.includes(s) ? '#5eead4' : '#86efac',
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem',
                cursor: 'pointer', borderBottom: '1px solid rgba(94,234,212,0.04)',
              }}
              onMouseEnter={() => setActiveSug(i)}
            >
              {s}
              {!SQL_KEYWORDS.includes(s) && (
                <span style={{ marginLeft: '0.5rem', fontSize: '0.65rem', color: '#64748b' }}>table</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Query Executor ──────────────────────────────────────────────────────────
function QueryExecutor({ tables }: { tables: string[] }) {
  const [sql, setSql] = useState('SELECT * FROM users')
  const [result, setResult] = useState<QueryResult | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: (query: string) => apiClient.post<QueryResult>('/db/query', { sql: query }).then(r => r.data),
    onSuccess: data => setResult(data),
    onError: (e: { response?: { data?: QueryResult } }) =>
      setResult(e.response?.data ?? { columns: [], rows: [], count: 0, error: 'Request failed' }),
  })

  const handleRun = () => { if (sql.trim()) mutate(sql) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', height: '100%' }}>
      <div style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b' }}>
        SELECT only · <span style={{ color: '#94a3b8' }}>Tab / Enter</span> to complete · <span style={{ color: '#94a3b8' }}>Ctrl+Enter</span> to run
      </div>

      <SqlEditor value={sql} onChange={setSql} onRun={handleRun} tables={tables} />

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button
          onClick={handleRun}
          disabled={isPending}
          style={{
            padding: '0.5rem 1.25rem', background: isPending ? 'rgba(94,234,212,0.05)' : 'transparent',
            border: '1px solid #5eead4', color: '#5eead4',
            fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em',
            cursor: isPending ? 'wait' : 'pointer', borderRadius: 2,
          }}
        >
          {isPending ? 'running…' : '▶ run'}
        </button>
        {result && !result.error && (
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            {result.count} row{result.count !== 1 ? 's' : ''}
          </span>
        )}
        {result && (
          <button onClick={() => setResult(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.72rem' }}>
            clear
          </button>
        )}
      </div>

      {result?.error && (
        <div style={{
          padding: '0.75rem', background: 'rgba(255,51,51,0.06)',
          border: '1px solid rgba(255,51,51,0.25)', color: '#ff5555',
          fontSize: '0.78rem', fontFamily: "'JetBrains Mono', monospace",
        }}>
          {result.error}
        </div>
      )}

      {result && !result.error && result.columns.length > 0 && (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#11171f', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid rgba(94,234,212,0.2)' }}>
                {result.columns.map(col => (
                  <th key={col} style={{
                    padding: '0.4rem 0.75rem', textAlign: 'left', color: '#64748b',
                    fontWeight: 600, fontSize: '0.65rem', letterSpacing: '0.1em',
                    textTransform: 'uppercase', whiteSpace: 'nowrap',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(94,234,212,0.05)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(94,234,212,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  {result.columns.map(col => {
                    const val = row[col]
                    const str = cellStr(val)
                    return (
                      <td key={col} title={str} style={{
                        padding: '0.35rem 0.75rem',
                        color: val === null ? '#333' : '#5eead4',
                        maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.76rem',
                      }}>
                        {val === null ? <span style={{ opacity: 0.35 }}>NULL</span> : str.length > 80 ? str.slice(0, 77) + '…' : str}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DatabasePage() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [tab, setTab] = useState<'browse' | 'query'>('browse')

  const { data: tables } = useQuery({
    queryKey: ['db-tables'],
    queryFn: () => apiClient.get<TableInfo[]>('/db/tables').then(r => r.data),
  })

  const { data: columns } = useQuery({
    queryKey: ['db-columns', selectedTable],
    queryFn: () => apiClient.get<ColumnInfo[]>(`/db/tables/${selectedTable}/columns`).then(r => r.data),
    enabled: !!selectedTable,
  })

  const tableNames = (tables ?? []).map(t => t.table_name)

  return (
    <div style={{ display: 'flex', gap: '1.5rem', height: 'calc(100vh - 4rem)' }}>
      {/* Left: table list */}
      <div style={{ width: 188, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.15rem', overflowY: 'auto' }}>
        <div style={{ fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.5rem', padding: '0.1rem 0.25rem' }}>
          tables
        </div>
        {(tables ?? []).map(t => (
          <button
            key={t.table_name}
            onClick={() => { setSelectedTable(t.table_name); setTab('browse') }}
            style={{
              padding: '0.5rem 0.65rem',
              background: selectedTable === t.table_name ? 'rgba(94,234,212,0.08)' : 'transparent',
              border: `1px solid ${selectedTable === t.table_name ? 'rgba(94,234,212,0.28)' : 'transparent'}`,
              color: selectedTable === t.table_name ? '#5eead4' : '#94a3b8',
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.76rem',
              textAlign: 'left', cursor: 'pointer', borderRadius: 2,
              display: 'flex', justifyContent: 'space-between', gap: '0.4rem', alignItems: 'center',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.table_name}</span>
            <span style={{ fontSize: '0.62rem', color: '#64748b', flexShrink: 0 }}>{formatBytes(Number(t.size_bytes))}</span>
          </button>
        ))}
      </div>

      {/* Right: content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <div>
          <div style={{ fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.2rem' }}>database</div>
          <h1 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#5eead4', letterSpacing: '0.08em', margin: 0 }}>DATABASE</h1>
        </div>

        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(94,234,212,0.12)', flexShrink: 0 }}>
          {(['browse', 'query'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '0.45rem 1.1rem', background: 'transparent', border: 'none',
                color: tab === t ? '#5eead4' : '#64748b',
                fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 600,
                letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
                borderBottom: tab === t ? '2px solid #5eead4' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {t === 'browse' ? 'table browser' : 'query executor'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          {tab === 'query' ? (
            <QueryExecutor tables={tableNames} />
          ) : selectedTable && columns ? (
            <TableBrowser table={selectedTable} columns={columns} key={selectedTable} />
          ) : selectedTable ? (
            <div style={{ color: '#64748b', padding: '2rem', textAlign: 'center', fontSize: '0.8rem' }}>loading columns…</div>
          ) : (
            <div style={{ color: '#64748b', padding: '3rem', textAlign: 'center', fontSize: '0.8rem' }}>
              select a table from the left panel
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
