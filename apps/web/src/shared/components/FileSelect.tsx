import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';

export type FileSelectProps = {
  name?: string;
  accept?: string;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  /** Visible button label (English UI). */
  buttonLabel?: string;
  /** Shown when nothing is selected. */
  emptyLabel?: string;
  className?: string;
  onChange?: (files: FileList | null) => void;
};

function describeFiles(files: FileList | null, emptyLabel: string): string {
  if (!files || files.length === 0) return emptyLabel;
  const first = files.item(0);
  if (files.length === 1 && first) return first.name;
  return `${files.length} files selected`;
}

export function FileSelect({
  name,
  accept,
  multiple,
  required,
  disabled,
  buttonLabel = 'Select',
  emptyLabel = 'No file chosen',
  className,
  onChange,
}: FileSelectProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [summary, setSummary] = useState(emptyLabel);

  const resolvedButtonLabel =
    buttonLabel ?? 'Select';

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    if (!form) return;
    function onReset() {
      setSummary(emptyLabel);
    }
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, [emptyLabel]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    setSummary(describeFiles(files, emptyLabel));
    onChange?.(files);
  }

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  return (
    <span className={className ? `file-select ${className}` : 'file-select'}>
      <input
        ref={inputRef}
        id={inputId}
        className="file-select__input"
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        required={required}
        disabled={disabled}
        onChange={handleChange}
        tabIndex={-1}
        aria-hidden
      />
      <button
        type="button"
        className="btn btn--ghost file-select__btn"
        onClick={openPicker}
        disabled={disabled}
        aria-controls={inputId}
      >
        {resolvedButtonLabel}
      </button>
      <span className="file-select__name" title={summary === emptyLabel ? undefined : summary}>
        {summary}
      </span>
    </span>
  );
}
