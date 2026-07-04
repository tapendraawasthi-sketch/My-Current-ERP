# Mobile Khata Launch Checklist

- [x] NLU test suite passes (15/15 sentences) — run `python3 erp_bot/scripts/test_falcon_trader_nlu.py`
- [x] Ledger double-entry mapping tests pass (6/6 voucher types) — `cd khata-app && npm test`
- [ ] Offline sync test passes on Chrome DevTools + real Android device
- [ ] PWA Lighthouse score ≥ 90 (Performance, PWA, Accessibility)
- [ ] Trust message copy explicitly approved (see Module H)
- [x] No PAN/VAT fields in any Khata-facing UI (compliance-pipe check)
- [x] `.env.example` has ESEWA_MERCHANT_ID, KHALTI_PUBLIC_KEY, PAYMENT_WEBHOOK_SECRET
- [ ] eSewa/Khalti deep links tested on real Android device
- [ ] Manual UAT completed with at least 2 real traders (pilot)
- [ ] FREE_TIER_MONTHLY_LIMIT constant reviewed and confirmed

## Automated verification

```bash
python3 erp_bot/scripts/test_falcon_trader_nlu.py   # expect 15/15
cd khata-app && npm test && npm run build
cd packages/backend && npm run build
python3 erp_bot/scripts/parse_khata_cli.py "Ram lai 500 udhaar diye"
```

## Manual UAT Script

1. Onboarding: clear localStorage, enter phone, accept trust message, land on chat.
2. Credit sale: type `Ram lai 500 udhaar diye`, confirm card, verify success toast.
3. Payment in: type `Shyam le 200 tiryo`, confirm, verify udhaar-in chip updates.
4. Ambiguous entry: type `500 diye`, verify clarifying question appears.
5. Offline: DevTools offline, confirm a cash sale, verify offline toast; go online, verify sync.
6. Privacy: open Settings Privacy link, verify Nepali + English trust copy exactly.
7. Premium gate: tap party summary while free tier, verify bottom sheet with dismiss.
8. Voice: tap mic on Chrome Android, speak Nepali entry, edit transcript, send.
9. OCR: photograph bill with amount, verify editable text in input bar.
10. Insights: after entries, verify daily total insight and dismiss behavior.
11. Growth ladder: if insight shown, tap **Pardaina** and confirm it hides for 30 days.
