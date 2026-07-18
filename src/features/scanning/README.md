# Orbix AI — Scanning Feature

## Overview
This folder is the **master module** for all scanning-related features inside Sutra ERP / Orbix AI.

## Folder Structure
```
src/features/scanning/
├── README.md                  ← You are here
├── index.ts                   ← Public API barrel export
├── types.ts                   ← Shared TypeScript types / interfaces
├── constants.ts               ← Feature-wide constants & config
├── hooks/                     ← Custom React hooks
│   ├── useScanner.ts          ← Core scanner state hook
│   └── useScanHistory.ts      ← Scan session history hook
├── components/                ← Pure UI components
│   ├── ScannerShell.tsx       ← Root shell / layout for scanning UI
│   ├── ScannerToolbar.tsx     ← Top toolbar (start/stop/settings)
│   ├── ScanResultCard.tsx     ← Individual result display card
│   └── ScanHistoryPanel.tsx   ← Slide-in history panel
├── services/                  ← Data & API services
│   └── scanService.ts         ← Scanning engine / API adapter
├── store/                     ← Zustand slice for scanning state
│   └── scanStore.ts
└── pages/                     ← Page-level components (routed)
    └── ScanningPage.tsx       ← Main scanning workspace page
```

## Phase Roadmap
| Phase | Description                         | Status  |
|-------|-------------------------------------|---------|
| 1     | Master scaffold & folder setup      | ✅ Done |
| 2     | (Next phase — per your prompt)      | ⏳ TBD  |

## Design Rules
- Follows Sutra ERP design system (see `AGENTS.md`)  
- Primary colour: `#1557b0`  
- No decorative gradients / glassmorphism  
- Table headers: 10px uppercase, body: 12px  
- All buttons: `h-8` md size unless specified otherwise
