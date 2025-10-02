
import { useEffect, useMemo, useRef, useState } from 'react';

const TAG_MAX_LEN = 20;
const TAGS_MAX_COUNT = 5;

export default function TagsInput({ value = [], onChange, placeholder = 'add tag…' }) {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  const normSet = useMemo(() => new Set(value.map(v => v.trim().toLowerCase())), [value]);

  useEffect(() => {
   
    if (value.length >= TAGS_MAX_COUNT) setInput('');
  }, [value.length]);

  function addTag(raw) {
    const t = (raw || '').trim();
    if (!t) return;
    if (t.length > TAG_MAX_LEN) return; 
    const key = t.toLowerCase();
    if (normSet.has(key)) return; 
    if (value.length >= TAGS_MAX_COUNT) return;
    onChange?.([...value, t]);
    setInput('');
  }

  function removeTag(idx) {
    const copy = value.slice();
    copy.splice(idx, 1);
    onChange?.(copy);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',' ) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
   
      removeTag(value.length - 1);
    }
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    const parts = text.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      e.preventDefault();
      for (const p of parts) addTag(p);
    }
  }

  return (
    <div style={{
      display:'flex', flexWrap:'wrap', gap:6, padding:6, border:'1px solid #ddd',
      borderRadius:8, minHeight:40, alignItems:'center'
    }}>
      {value.map((t, idx) => (
        <span key={`${t}-${idx}`} style={{
          display:'inline-flex', alignItems:'center', gap:6, padding:'4px 8px',
          borderRadius:999, background:'#f3f5f7', border:'1px solid #e5e7eb'
        }}>
          {t}
          <button
            type="button"
            onClick={() => removeTag(idx)}
            style={{ border:'none', background:'transparent', cursor:'pointer' }}
            aria-label={`Remove ${t}`}
          >✕</button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={value.length >= TAGS_MAX_COUNT ? 'tag limit reached' : placeholder}
        disabled={value.length >= TAGS_MAX_COUNT}
        style={{ flex:1, minWidth:160, border:'none', outline:'none' }}
      />
      <div style={{ fontSize:12, opacity:0.6, marginLeft:'auto' }}>
        {value.length}/{TAGS_MAX_COUNT}
      </div>
    </div>
  );
}
