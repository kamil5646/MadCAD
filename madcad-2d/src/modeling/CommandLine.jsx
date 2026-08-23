import React, { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, History, SquareTerminal } from 'lucide-react';
import { commandSuggestions, describeActiveCommand } from './command-controller.js';

export function CommandLine({ command, history = [], notice, onCancel, onSubmit }) {
  const [value, setValue] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef(null);
  const suggestions = useMemo(() => commandSuggestions(value), [value]);
  const activePrompt = describeActiveCommand(command);

  const submit = () => {
    const submitted = value;
    if (onSubmit(submitted) !== false) {
      setValue('');
      setHistoryIndex(-1);
    }
  };

  const navigateHistory = (direction) => {
    if (!history.length) return;
    const next = Math.max(0, Math.min(history.length - 1, historyIndex + direction));
    setHistoryIndex(next);
    setValue(history[next]?.input || '');
  };

  return (
    <div className="command-line" role="region" aria-label="Linia poleceń CAD">
      <button
        className="command-history-toggle"
        type="button"
        aria-label={historyOpen ? 'Ukryj historię poleceń' : 'Pokaż historię poleceń'}
        aria-expanded={historyOpen}
        onClick={() => setHistoryOpen((open) => !open)}
      >
        <History size={15} />
        {historyOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
      </button>
      <SquareTerminal className="command-line-icon" size={16} aria-hidden="true" />
      <label htmlFor="madcad-command-line">Polecenie:</label>
      <input
        ref={inputRef}
        id="madcad-command-line"
        data-testid="command-line-input"
        value={value}
        autoComplete="off"
        spellCheck="false"
        placeholder={command?.lastPoint ? 'Wpisz długość i naciśnij Enter' : 'Wpisz polecenie lub skrót'}
        onChange={(event) => { setValue(event.target.value); setHistoryIndex(-1); }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            submit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (value) setValue('');
            else onCancel();
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            navigateHistory(1);
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            event.stopPropagation();
            navigateHistory(-1);
          }
        }}
      />
      <span className="command-line-prompt" title={notice}>{activePrompt}</span>
      <span className="command-line-keys"><kbd>Enter</kbd><kbd>Esc</kbd></span>
      {suggestions.length > 0 && value && (
        <div className="command-suggestions" role="listbox" aria-label="Podpowiedzi poleceń">
          {suggestions.map((suggestion) => (
            <button key={suggestion.shortcut} type="button" role="option" onClick={() => { setValue(suggestion.command); inputRef.current?.focus(); }}>
              <strong>{suggestion.command}</strong><span>{suggestion.label}</span><kbd>{suggestion.shortcut}</kbd>
            </button>
          ))}
        </div>
      )}
      {historyOpen && (
        <div className="command-history" aria-label="Historia poleceń">
          <header><strong>Historia poleceń</strong><span>{history.length ? `${history.length} ostatnich` : 'Brak poleceń'}</span></header>
          <div>
            {history.length ? history.slice(0, 12).map((entry) => (
              <button key={entry.id} type="button" onClick={() => { setValue(entry.input); setHistoryOpen(false); inputRef.current?.focus(); }}>
                <code>{entry.input || 'Enter'}</code><span>{entry.message}</span>
              </button>
            )) : <p>Polecenia wpisane w dolnym polu pojawią się tutaj.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
