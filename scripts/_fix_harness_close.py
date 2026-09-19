from pathlib import Path
p = Path("src/e2e/bootstrapUiQaHarness.ts")
t = p.read_text(encoding="utf-8")
start = t.find("    async pullRemoteEvents() {")
end = t.find("\n    async getSettlementSnapshot()", start)
if start < 0:
    raise SystemExit("pullRemoteEvents missing")
# if getSettlement is before pullRemote, find next async after start
if end < 0:
    # find closing of function roughly
    end = t.find("\n    async ", start + 10)
new = '''    async pullRemoteEvents() {
      const companyId = E2E_COMPANY_ID;
      return (await getEventSyncClient().pullRemote(companyId)) as Record<string, unknown>;
    },
'''
# Keep everything from end onward
# Actually replace from start to end
if end > start:
    t = t[:start] + new + t[end+1:]  # end points at newline before getSettlement - keep getSettlement
    # fix: end includes leading newline of getSettlement marker - we used find of "\n    async getSettlement"
    # so t[end+1:] would skip one char. Better:
    
p = Path("src/e2e/bootstrapUiQaHarness.ts")
t = p.read_text(encoding="utf-8")
start = t.find("    async pullRemoteEvents() {")
marker = "    async getSettlementSnapshot()"
end = t.find(marker, start)
if start < 0 or end < 0:
    print("markers", start, end)
else:
    t = t[:start] + new + t[end:]
    p.write_text(t, encoding="utf-8", newline="\n")
    print("pullRemoteEvents fixed")

# Add Close Session toolbar action in BankReconciliation
rec = Path("src/pages/BankReconciliation.tsx")
rt = rec.read_text(encoding="utf-8")
if "handleCloseReconciliation" in rt and "Close Session" not in rt:
    rt = rt.replace(
        '''          {
            label: "Print Report",
            onClick: printReport,
            icon: <Printer className="h-3.5 w-3.5" />,
          },''',
        '''          {
            label: "Close Session",
            onClick: handleCloseReconciliation,
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
          },
          {
            label: "Print Report",
            onClick: printReport,
            icon: <Printer className="h-3.5 w-3.5" />,
          },''',
    )
    rec.write_text(rt, encoding="utf-8", newline="\n")
    print("Close Session button added")
else:
    print("Close Session skip", "Close Session" in rt)