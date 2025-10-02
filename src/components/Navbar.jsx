import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useMatch } from 'react-router-dom';

function Brand() {
  return (
    <Link to="/" className="nav__brand" aria-label="TalentFlow home">
      <div className="brand-badge" style={{ fontSize: 14, letterSpacing: -0.5 }}>TF</div>
      <strong>TalentFlow</strong>
    </Link>
  );
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const makeClass = (active) => `nav__link${active ? ' active' : ''}`;
  const linkClass = ({ isActive }) => makeClass(isActive);

  const matchCandRoot = useMatch({ path: '/candidates', end: true });      
  const matchCandId   = useMatch('/candidates/:id');                        
  const matchBoard    = useMatch({ path: '/candidates/board', end: true }); 

  const candidatesActive = !!matchCandRoot || (!!matchCandId && !matchBoard);
  const kanbanActive = !!matchBoard;

  return (
    <div className="page nav-wrap">
      <div className="glass nav">
        <Brand />

        <nav className="nav__links" aria-label="Primary">
          <NavLink to="/jobs" end className={linkClass}>
            Jobs
          </NavLink>

      
          <Link to="/candidates" className={makeClass(candidatesActive)}>
            Candidates
          </Link>

       
          <NavLink to="/candidates/board" end className={() => makeClass(kanbanActive)}>
            Kanban
          </NavLink>

          <NavLink to="/assessments/1" end className={linkClass}>
            Assessments
          </NavLink>
        </nav>

        <div className="row">

          <div className="menu" ref={menuRef}>
            <button
              className="avatar-wrap"
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Open profile menu"
            >
              <div className="avatar-ring">
                <div
                  className="avatar"
                  style={{
                    backgroundImage:
                      "url('https://www.thejobcompany.in/adminware/uploads/logos/1747235765.jpeg')"
                  }}
                />
              </div>
            </button>

            {menuOpen && (
              <div className="glass menu-panel">
                <div style={{ padding: '8px 12px' }}>
                  <div style={{ fontWeight: 700 }}>ENTNT Executive</div>
                  <div className="profile-email">entnt@example.com</div>
                </div>
                <div style={{ height:1, background:'rgba(255,255,255,.1)', margin:'4px 0' }} />
                <button className="menu-item">Profile</button>
                <button className="menu-item">Settings</button>
                <div style={{ height:1, background:'rgba(255,255,255,.1)', margin:'4px 0' }} />
                <button className="menu-item">Log out</button>
              </div>
            )}
          </div>

       
          <button
            className="btn btn-ghost hamburger"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Menu"
          >
            ☰
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="glass mobile-sheet">
          <nav className="mobile-links" aria-label="Mobile">
            <NavLink onClick={()=>setMobileOpen(false)} to="/jobs" end className={linkClass}>
              Jobs
            </NavLink>

            <Link onClick={()=>setMobileOpen(false)} to="/candidates" className={makeClass(candidatesActive)}>
              Candidates
            </Link>

            <NavLink
              onClick={()=>setMobileOpen(false)}
              to="/candidates/board"
              end
              className={() => makeClass(kanbanActive)}
            >
              Kanban
            </NavLink>

            <NavLink
              onClick={()=>setMobileOpen(false)}
              to="/assessments/1"
              end
              className={linkClass}
            >
              Assessments
            </NavLink>
          </nav>
        </div>
      )}
    </div>
  );
}
