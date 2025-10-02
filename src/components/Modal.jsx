// src/components/Modal.jsx
import { useEffect } from 'react';

export default function Modal({ open, title, children, onClose, footer }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.(); }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.35)',
        display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
      }}
    >
      <div
        onClick={e=>e.stopPropagation()}
        style={{
          width:'min(680px, 94vw)', background:'#fff', borderRadius:12,
          boxShadow:'0 12px 32px rgba(0,0,0,0.2)', padding:16
        }}
      >
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <h3 style={{ margin:0 }}>{title}</h3>
          <button onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div>{children}</div>
        {footer && <div style={{ marginTop:16, display:'flex', justifyContent:'flex-end', gap:8 }}>{footer}</div>}
      </div>
    </div>
  );
}
