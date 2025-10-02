import { resetAndReseed } from '../lib/dev';

export default function DevBar() {
  async function onReset() {
    const ok = confirm('Reset IndexedDB and reseed demo data?');
    if (!ok) return;
    try {
      await resetAndReseed();
      location.reload();
    } catch (e) {
      alert('Reset failed: ' + (e?.message || e));
    }
  }

  return (
    <div style={{
      position:'fixed', left:16, bottom:16, zIndex:1000,
      background:'#101828', color:'#fff', borderRadius:10, padding:'8px 10px',
      boxShadow:'0 6px 20px rgba(0,0,0,0.25)', display:'flex', gap:8, alignItems:'center'
    }}>
      <span style={{ fontSize:12, opacity:0.85 }}>Dev</span>
      <button onClick={onReset} style={{
        background:'#fff', color:'#101828', border:'none', borderRadius:8, padding:'6px 10px', cursor:'pointer'
      }}>
        Reset DB & Reseed
      </button>
    </div>
  );
}
