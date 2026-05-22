import React from 'react';
import './index.css';

const App = () => {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh' }}>
      <div className="glow-bg" />

      {/* Navigation */}
      <nav style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '2rem 4rem',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 500, fontSize: '1.1rem' }}>
          <div style={{
            width: '24px', height: '24px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            borderRadius: '6px'
          }} />
          killit
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', fontSize: '0.95rem', color: '#a3a3a3' }}>
          <a href="#docs" style={{ transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#fff'} onMouseOut={e => e.currentTarget.style.color = '#a3a3a3'}>Docs</a>
          <a href="#github" style={{ transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#fff'} onMouseOut={e => e.currentTarget.style.color = '#a3a3a3'}>GitHub</a>
          
          <button style={{
            background: 'linear-gradient(to right, #2563eb, #3b82f6)',
            color: 'white',
            border: 'none',
            padding: '0.6rem 1.25rem',
            borderRadius: '999px',
            fontSize: '0.9rem',
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.39)',
          }}>
            npm install -g killit
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '6rem',
        textAlign: 'center'
      }}>
        
        {/* Big App Icon */}
        <div style={{
          width: '120px',
          height: '120px',
          background: 'linear-gradient(180deg, rgba(30,58,138,1) 0%, rgba(14,165,233,1) 100%)',
          borderRadius: '28px',
          boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '2rem'
        }}>
          {/* Faux terminal graphic */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />
          </div>
          <div style={{
            width: '60px', height: '16px', borderRadius: '8px', background: 'white',
            display: 'flex', alignItems: 'center', padding: '0 4px'
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0e7490' }} />
          </div>
        </div>

        <h1 style={{
          fontSize: '4rem',
          fontWeight: 300,
          letterSpacing: '-0.02em',
          marginBottom: '1.5rem'
        }}>
          killit
        </h1>

        <button style={{
          background: 'linear-gradient(to right, #2563eb, #3b82f6)',
          color: 'white',
          border: 'none',
          padding: '0.75rem 2rem',
          borderRadius: '999px',
          fontSize: '1rem',
          fontWeight: 500,
          cursor: 'pointer',
          boxShadow: '0 4px 20px 0 rgba(37, 99, 235, 0.4)',
          marginBottom: '1rem'
        }}>
          npx killit list
        </button>

        <p style={{ color: '#888', fontSize: '0.95rem' }}>
          Trusted by <span style={{ color: '#fff', fontWeight: 500 }}>developers</span><br/>
          <em style={{ fontStyle: 'italic' }}>for safely managing local ports.</em>
        </p>

        {/* Feature section */}
        <div style={{ marginTop: '8rem', maxWidth: '600px' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 300, marginBottom: '1rem' }}>
            Smart Port Killer
          </h2>
          <p style={{ color: '#888', fontSize: '1rem', lineHeight: '1.6' }}>
            The most powerful <em style={{ color: '#aaa' }}>cross-platform toolkit</em> for Node.js.<br />
            Detects Docker containers, Windows System processes, and <br/> protects your machine from accidental destruction.
          </p>
        </div>

      </main>
    </div>
  );
};

export default App;
