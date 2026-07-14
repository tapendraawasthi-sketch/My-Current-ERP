# UI-3 Product Identity Policy

**Phase:** UI-3.3

## User-facing hierarchy

| Layer | Name | Notes |
|-------|------|-------|
| Primary product | **Orbix ERP** | Shell mark + title |
| Descriptor | Intelligent ERP | Optional subtitle, not competing brand |
| Assistant | **Orbix** | Single user-facing AI entry |
| Active company | Company legal/trade name from `companySettings` | Never confused with product |
| Environment | Production / Test / Training / Development | Subtle marker; not colour-only |

## Internal providers (retained, not competing in chrome)

Falcon, NIOS, eKhata, Sutra AI may continue to operate under feature flags.  
The shell command bar, nav, and palette expose **Orbix** only — not Falcon/NIOS/Sutra AI as peer brands.

## Forbidden in ordinary UI

- Multiple assistant logos as peer nav items  
- Exposing provider/architecture names to ordinary users  
- E2E fixtures in production builds  

## Legal / domain

Do not rename legal company entities or alter domain architecture.
