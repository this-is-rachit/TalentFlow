
import React, { createContext, useContext, useMemo, useRef, useState } from 'react';

const ToastCtx = createContext(null);
export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(1);

  const api = useMemo(() => ({
    show(msg, type = 'info', ms = 2500) {
      const id = idRef.current++;
      setToasts(t => [...t, { id, msg, type }]);
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), ms);
    }
  }), []);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div style={{
        position:'fixed', right:16, bottom:16, display:'flex', flexDirection:'column', gap:8, zIndex:1000
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding:'8px 12px', borderRadius:8, background: t.type==='error' ? '#fde2e2' : '#e7f7ef',
            border: '1px solid rgba(0,0,0,0.1)', minWidth: 240, boxShadow:'0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <b style={{ marginRight:6 }}>{t.type === 'error' ? 'Error' : 'Done'}</b> {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
