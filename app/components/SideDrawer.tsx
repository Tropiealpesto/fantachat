'use client';

// components/SideDrawer.tsx
// Menu laterale a scomparsa (da sinistra)
// Contiene: Rosa, Statistiche, Storico + sezioni Admin

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  teamName?: string;
  leagueName?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

// ─── ICONE ───────────────────────────────────────────────────────────────
const RosaIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const StatIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const StoricoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const AdminIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" />
  </svg>
);

const GiornataIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <path d="M8 14h.01M12 14h.01M16 14h.01" />
  </svg>
);

const RegoleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14,2 14,8 20,8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10,9 9,9 8,9" />
  </svg>
);

const PodcastIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="11" r="4" />
    <path d="M12 15v6M8 19h8M6 6.9a7 7 0 0112 0" />
  </svg>
);

const PartiteIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    <line x1="2" y1="12" x2="22" y2="12" />
  </svg>
);

const Top6Icon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ─── MENU ITEM ────────────────────────────────────────────────────────────
function MenuItem({
  href,
  icon,
  label,
  subtitle,
  accent,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  accent?: string;
  onClick: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <Link href={href} onClick={onClick} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '12px 16px',
        borderRadius: '12px',
        background: active ? `${accent || '#16A34A'}15` : 'transparent',
        marginBottom: '4px',
        transition: 'background 0.15s',
        cursor: 'pointer',
      }}
        onMouseEnter={(e) => !active && (e.currentTarget.style.background = '#F9FAFB')}
        onMouseLeave={(e) => !active && (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: active ? `${accent || '#16A34A'}20` : '#F3F4F6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: active ? (accent || '#16A34A') : '#6B7280',
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '15px',
            fontWeight: active ? 700 : 500,
            color: active ? (accent || '#16A34A') : '#111827',
          }}>
            {label}
          </div>
          {subtitle && (
            <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '1px' }}>
              {subtitle}
            </div>
          )}
        </div>
        {active && (
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: accent || '#16A34A',
          }} />
        )}
      </div>
    </Link>
  );
}

// Admin sub-button (più piccolo)
function AdminButton({
  href,
  icon,
  label,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link href={href} onClick={onClick} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: '10px',
        background: 'white',
        border: '1px solid #E5E7EB',
        marginBottom: '6px',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#F0FDF4';
          e.currentTarget.style.borderColor = '#16A34A';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'white';
          e.currentTarget.style.borderColor = '#E5E7EB';
        }}
      >
        <span style={{ color: '#6B7280' }}>{icon}</span>
        <span style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>
          {label}
        </span>
      </div>
    </Link>
  );
}

// ─── COMPONENTE PRINCIPALE ────────────────────────────────────────────────
export default function SideDrawer({
  isOpen,
  onClose,
  teamName,
  leagueName,
  isAdmin = false,
  isSuperAdmin = false,
}: SideDrawerProps) {

  // Blocca scroll body quando drawer è aperto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 200,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'all' : 'none',
          transition: 'opacity 0.25s ease',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: '300px',
        maxWidth: '85vw',
        background: 'white',
        zIndex: 201,
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
      }}>
        {/* Header drawer */}
        <div style={{
          background: 'linear-gradient(135deg, #1a5c2e 0%, #2d7a45 100%)',
          padding: '48px 20px 20px',
          flexShrink: 0,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}>
            <div>
              {/* Logo */}
              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '22px', fontWeight: 900, color: '#4ADE80' }}>
                  Fanta
                </span>
                <span style={{ fontSize: '22px', fontWeight: 900, color: '#F97316' }}>
                  Chat
                </span>
              </div>
              {leagueName && (
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
                  {leagueName}
                </div>
              )}
              {teamName && (
                <div style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <span>👋</span> {teamName}
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: '8px',
                padding: '6px',
                cursor: 'pointer',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Nav items */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 12px',
        }}>
          {/* Sezione principale */}
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#9CA3AF',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '0 4px',
            marginBottom: '8px',
          }}>
            Navigazione
          </div>

          <MenuItem
            href="/rosa"
            icon={<RosaIcon />}
            label="Rosa"
            subtitle="Scegli i 4 giocatori"
            onClick={onClose}
          />
          <MenuItem
            href="/statistiche"
            icon={<StatIcon />}
            label="Statistiche"
            subtitle="Giocatori e classifiche"
            onClick={onClose}
          />
          <MenuItem
            href="/storico"
            icon={<StoricoIcon />}
            label="Storico"
            subtitle="Rivedi le giornate passate"
            onClick={onClose}
          />

          {/* Sezione Admin */}
          {(isAdmin || isSuperAdmin) && (
            <>
              <div style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#9CA3AF',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '0 4px',
                margin: '20px 0 8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <AdminIcon />
                Admin Lega
              </div>

              <div style={{
                background: '#FFF7ED',
                borderRadius: '12px',
                padding: '10px',
                border: '1px solid #FED7AA',
              }}>
                <AdminButton href="/admin/giornata" icon={<GiornataIcon />} label="Giornata" onClick={onClose} />
                <AdminButton href="/admin/regole" icon={<RegoleIcon />} label="Regole Lega" onClick={onClose} />
                <AdminButton href="/admin/podcast" icon={<PodcastIcon />} label="Podcast" onClick={onClose} />
              </div>

              {isSuperAdmin && (
                <>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#9CA3AF',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    padding: '0 4px',
                    margin: '16px 0 8px',
                  }}>
                    Super Admin
                  </div>

                  <div style={{
                    background: '#FEF2F2',
                    borderRadius: '12px',
                    padding: '10px',
                    border: '1px solid #FECACA',
                  }}>
                    <AdminButton href="/admin/partite" icon={<PartiteIcon />} label="Partite" onClick={onClose} />
                    <AdminButton href="/admin/top6" icon={<Top6Icon />} label="Top 6" onClick={onClose} />
                    <AdminButton href="/admin/statistiche" icon={<StatIcon />} label="Statistiche" onClick={onClose} />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer drawer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #F3F4F6',
          background: '#FAFAFA',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: '11px', color: '#D1D5DB', textAlign: 'center' }}>
            FantaChat © 2025
          </div>
        </div>
      </div>
    </>
  );
}