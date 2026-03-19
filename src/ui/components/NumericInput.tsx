import { useState, useRef, useCallback, useEffect } from 'react';

interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  label: string;
  className?: string;
}

/**
 * Numeric input with draft/commit model:
 * - User types freely (no live updates)
 * - Commit on Enter or blur
 * - Escape reverts to last committed value
 * - Supports negative numbers and intermediate states (e.g. "-", "")
 */
export function NumericInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  precision = 0,
  label,
  className,
}: NumericInputProps) {
  const displayValue = precision > 0
    ? (Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision)).toString()
    : Math.round(value).toString();

  const [draft, setDraft] = useState(displayValue);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(value);

  // Sync draft with external value when NOT editing
  useEffect(() => {
    if (!isEditing) {
      setDraft(displayValue);
      committedRef.current = value;
    }
  }, [value, displayValue, isEditing]);

  const commitValue = useCallback(
    (text: string) => {
      const num = parseFloat(text);
      if (isNaN(num)) {
        // Invalid — revert to last committed
        setDraft(
          precision > 0
            ? (Math.round(committedRef.current * Math.pow(10, precision)) / Math.pow(10, precision)).toString()
            : Math.round(committedRef.current).toString(),
        );
        setIsEditing(false);
        return;
      }

      let clamped = num;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);

      committedRef.current = clamped;
      onChange(clamped);
      setIsEditing(false);
    },
    [onChange, min, max, precision],
  );

  const handleFocus = useCallback(() => {
    setIsEditing(true);
    // Select all text on focus for easy replacement
    setTimeout(() => inputRef.current?.select(), 0);
  }, []);

  const handleBlur = useCallback(() => {
    commitValue(draft);
  }, [draft, commitValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitValue(draft);
        inputRef.current?.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        // Revert to committed value
        const revert = precision > 0
          ? (Math.round(committedRef.current * Math.pow(10, precision)) / Math.pow(10, precision)).toString()
          : Math.round(committedRef.current).toString();
        setDraft(revert);
        setIsEditing(false);
        inputRef.current?.blur();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const num = parseFloat(draft);
        if (!isNaN(num)) {
          const delta = e.shiftKey ? step * 10 : step;
          const newVal = num + delta;
          const clamped = max !== undefined ? Math.min(max, newVal) : newVal;
          setDraft(clamped.toString());
          commitValue(clamped.toString());
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const num = parseFloat(draft);
        if (!isNaN(num)) {
          const delta = e.shiftKey ? step * 10 : step;
          const newVal = num - delta;
          const clamped = min !== undefined ? Math.max(min, newVal) : newVal;
          setDraft(clamped.toString());
          commitValue(clamped.toString());
        }
      }
    },
    [draft, commitValue, step, min, max, precision],
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow free typing — no validation here
    setDraft(e.target.value);
  }, []);

  return (
    <input
      ref={inputRef}
      className={className}
      type="text"
      inputMode="numeric"
      value={draft}
      aria-label={label}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}
