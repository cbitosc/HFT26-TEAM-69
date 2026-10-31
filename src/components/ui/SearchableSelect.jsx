import { useEffect, useMemo, useRef, useState } from 'react'
import './SearchableSelect.css'

/**
 * @param {Object} props
 * @param {string} props.label
 * @param {string} props.value
 * @param {{ value: string, label: string, searchText?: string }[]} props.options
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.placeholder]
 * @param {string} [props.className]
 */
export default function SearchableSelect({ label, value, options, onChange, placeholder = 'Search…', className = '' }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const selected = options.find((option) => option.value === value) ?? null
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return options
    return options.filter((option) => (option.searchText ?? option.label).toLocaleLowerCase().includes(normalizedQuery))
  }, [options, query])

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  function selectOption(option) {
    onChange(option.value)
    setQuery('')
    setOpen(false)
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      setQuery('')
      setOpen(false)
      inputRef.current?.blur()
    }
    if (event.key === 'Enter' && filteredOptions[0]) {
      event.preventDefault()
      selectOption(filteredOptions[0])
    }
  }

  return (
    <div ref={rootRef} className={`searchable-select ${className}`}>
      <label className="searchable-select__label">
        <span>{label}</span>
        <input
          ref={inputRef}
          type="search"
          value={open ? query : selected?.label ?? ''}
          placeholder={placeholder}
          aria-label={label}
          aria-expanded={open}
          aria-controls={`${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-options`}
          role="combobox"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onKeyDown={handleKeyDown}
        />
      </label>
      {open && (
        <div
          id={`${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-options`}
          className="searchable-select__menu"
          role="listbox"
          aria-label={`${label} options`}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={option.value === value ? 'is-selected' : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
              >
                {option.label}
              </button>
            ))
          ) : (
            <p className="searchable-select__empty">No matching planets or systems.</p>
          )}
        </div>
      )}
    </div>
  )
}
