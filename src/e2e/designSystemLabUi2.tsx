/**
 * Phase UI-2 laboratory sections — deterministic demo data only.
 */
import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
  ConfirmDialogFoundation,
  Drawer,
  DrawerTrigger,
  DrawerContent,
  Popover,
  PopoverTrigger,
  PopoverContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  MenuButton,
  Alert,
  Banner,
  ToastProvider,
  useToast,
  ErrorSummary,
  EmptyState,
  LoadingState,
  Progress,
  StepProgress,
  RecoveryPanel,
  SyncStatusChip,
  PageHeader,
  Breadcrumbs,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Toolbar,
  StickyActionBar,
  Section,
  SectionHeader,
  ContentWell,
  SearchField,
  FilterBar,
  FilterChip,
  DateRangeFilter,
  Pagination,
  SelectionSummary,
  EnterpriseDataTable,
  DebitCreditCell,
  StatusChip,
  Stack,
  Inline,
  Surface,
} from "@/design-system";

type InvoiceRow = {
  id: string;
  docNo: string;
  party: string;
  date: string;
  amount: number;
  status: string;
  sync: "synced" | "pending" | "conflict";
};

const INVOICES: InvoiceRow[] = [
  {
    id: "inv-1",
    docNo: "SI-2081-00041",
    party: "राम ट्रेडर्स प्रा.लि.",
    date: "2082-03-15 / 2026-06-29",
    amount: 125000.5,
    status: "Unpaid",
    sync: "synced",
  },
  {
    id: "inv-2",
    docNo: "SI-2081-00042",
    party: "Himalayan Supplies Pvt Ltd — Kathmandu Branch",
    date: "2082-03-16 / 2026-06-30",
    amount: -2500,
    status: "Credit note",
    sync: "pending",
  },
  {
    id: "inv-3",
    docNo: "SI-2081-00043",
    party: "Everest Wholesale",
    date: "2082-03-17 / 2026-07-01",
    amount: 0,
    status: "Draft",
    sync: "conflict",
  },
];

function ToastDemo() {
  const { push } = useToast();
  return (
    <Button
      size="small"
      variant="secondary"
      onClick={() => push({ title: "Draft saved", description: "Non-critical success", tone: "success" })}
    >
      Show toast
    </Button>
  );
}

export function Ui2LabSections({ lang }: { lang: "en" | "ne" }) {
  const t = (en: string, ne: string) => (lang === "ne" ? ne : en);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ id: string; desc: boolean } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [range, setRange] = useState<{ start?: string; end?: string }>({});
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <ToastProvider>
      <Stack gap={6}>
        <Section>
          <SectionHeader title={t("Overlays", "ओभरले")} />
          <ContentWell>
            <Inline gap={3}>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="small">{t("Open dialog", "संवाद खोल्नुहोस्")}</Button>
                </DialogTrigger>
                <DialogContent size="medium" aria-describedby={undefined}>
                  <DialogHeader>
                    <DialogTitle>{t("Edit narration", "विवरण सम्पादन")}</DialogTitle>
                    <DialogDescription>Long content scrolls; footer stays sticky.</DialogDescription>
                  </DialogHeader>
                  <DialogBody>
                    <p className="ds-text-body">
                      Deterministic dialog body with enough text to exercise overflow. Select nested below.
                    </p>
                    <div className="mt-4 h-40 overflow-auto rounded border border-[var(--ds-border-subtle)] p-2 text-[13px]">
                      {Array.from({ length: 20 }).map((_, i) => (
                        <div key={i}>Line {i + 1} — accounting note sample</div>
                      ))}
                    </div>
                  </DialogBody>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="secondary">Cancel</Button>
                    </DialogClose>
                    <Button>Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button size="small" variant="destructive" onClick={() => setConfirmOpen(true)}>
                Delete draft
              </Button>
              <ConfirmDialogFoundation
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Delete draft"
                consequence="This permanently removes the draft voucher. Posted documents are unaffected."
                documentLabel="DRAFT-SI-009"
                amount="NPR 12,500.00"
                company="Orbix E2E Auth Fixture Co"
                fiscalPeriod="2081/82"
                warning="This action cannot be undone."
                confirmLabel="Delete draft"
                destructive
                requireTypedPhrase="DELETE"
                typedValue={typed}
                onTypedValueChange={setTyped}
                onConfirm={() => setConfirmOpen(false)}
              />

              <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                <DrawerTrigger asChild>
                  <Button size="small" variant="secondary">
                    Open drawer
                  </Button>
                </DrawerTrigger>
                <DrawerContent title="Row details" description="Supplemental context" footer={<Button size="small">Close</Button>}>
                  <p className="ds-text-body">Audit trail and document context belong here.</p>
                </DrawerContent>
              </Drawer>

              <Popover>
                <PopoverTrigger asChild>
                  <Button size="small" variant="quiet">
                    Popover
                  </Button>
                </PopoverTrigger>
                <PopoverContent>Compact column / filter options only.</PopoverContent>
              </Popover>

              <MenuButton label="Actions">
                <DropdownMenuItem>Export CSV</DropdownMenuItem>
                <DropdownMenuItem>Print</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive>Delete draft</DropdownMenuItem>
              </MenuButton>
            </Inline>
          </ContentWell>
        </Section>

        <Section>
          <SectionHeader title={t("Feedback", "प्रतिक्रिया")} />
          <Stack gap={3}>
            <Banner tone="warning" title="Offline" description="Changes remain local until connection returns." action={<Button size="small">Retry sync</Button>} />
            <Alert tone="info" title="Permission limited" onDismiss={() => undefined}>
              You can view but not post in this period.
            </Alert>
            <ErrorSummary
              errors={[
                { id: "party", message: "Party is required", href: "#party" },
                { id: "amount", message: "Amount must be greater than zero", href: "#amount" },
              ]}
            />
            <Inline gap={3}>
              <ToastDemo />
              <EmptyState title="No invoices yet" description="Create your first sales invoice." primaryAction={<Button size="small">New invoice</Button>} />
            </Inline>
            <LoadingState rows={3} />
            <Progress label="Import" value={65} />
            <StepProgress steps={["Upload", "Map", "Validate", "Post"]} current={1} />
            <RecoveryPanel title="Sync failed" whatFailed="Could not push events." whatRemains="Local drafts are still saved." onRetry={() => undefined} reference="ref-e2e-001" />
            <Inline gap={2}>
              <SyncStatusChip state="synced" />
              <SyncStatusChip state="pending" />
              <SyncStatusChip state="conflict" />
              <SyncStatusChip state="action_required" />
            </Inline>
          </Stack>
        </Section>

        <Section>
          <PageHeader
            title={t("Sales invoices", "बिक्री बीजक")}
            description="Register laboratory — deterministic data"
            breadcrumbs={<Breadcrumbs items={[{ label: "Home", href: "#" }, { label: "Sell", href: "#" }, { label: "Invoices" }]} />}
            status={<StatusChip tone="info">Lab</StatusChip>}
            primaryAction={<Button size="small">New invoice</Button>}
            secondaryActions={[<Button key="export" size="small" variant="secondary">Export</Button>]}
            overflowActions={[{ label: "Archive", onSelect: () => undefined }]}
            tabs={
              <Tabs defaultValue="all">
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
                </TabsList>
                <TabsContent value="all" />
                <TabsContent value="unpaid" />
              </Tabs>
            }
          />
          <Toolbar>
            <FilterBar
              search={
                <SearchField id="inv-search" label="Search invoices" value={search} onChange={setSearch} placeholder="Doc no or party" />
              }
              filters={<DateRangeFilter id="inv-range" label="Date range" value={range} onChange={setRange} />}
              chips={
                search ? <FilterChip label="Search" value={search} onRemove={() => setSearch("")} /> : null
              }
              onClearAll={() => {
                setSearch("");
                setRange({});
              }}
              savedViews={[
                { id: "unpaid", name: "Unpaid", owner: "system", filters: {}, sort: null, columns: null },
                { id: "month", name: "This fiscal month", owner: "user", filters: {}, sort: null, columns: null },
              ]}
              activeViewId="unpaid"
              onSelectView={() => undefined}
            />
          </Toolbar>
        </Section>

        <Section>
          <SectionHeader title="Enterprise DataTable" />
          <SelectionSummary
            selectedCount={selected.size}
            pageCount={INVOICES.length}
            scope="page"
            onClear={() => setSelected(new Set())}
            onSelectPage={() => setSelected(new Set(INVOICES.map((r) => r.id)))}
            bulkActions={<Button size="small" variant="secondary">Mark reviewed</Button>}
          />
          <EnterpriseDataTable
            caption="Sales invoice register"
            density="productive"
            rows={INVOICES.filter((r) => !search || r.party.includes(search) || r.docNo.includes(search))}
            getRowId={(r) => r.id}
            sort={sort}
            onSortChange={setSort}
            enableSelection
            selectedIds={selected}
            onSelectionChange={setSelected}
            expandedIds={expanded}
            onExpandedChange={setExpanded}
            renderExpanded={(r) => <div className="ds-text-metadata">Detail for {r.docNo}</div>}
            rowActions={(r) => [
              { label: "Open", onSelect: () => undefined },
              { label: "Delete draft", onSelect: () => undefined, destructive: true, hidden: r.status !== "Draft" },
            ]}
            columns={[
              { id: "docNo", header: "Voucher", accessor: "docNo", sortable: true, priority: "high" },
              { id: "party", header: "Party", accessor: "party", priority: "high" },
              { id: "date", header: "Date", accessor: "date", priority: "medium" },
              {
                id: "amount",
                header: "Amount (NPR)",
                accessor: "amount",
                align: "right",
                financial: true,
                sortable: true,
                priority: "high",
              },
              {
                id: "dc",
                header: "Dr/Cr",
                align: "right",
                cell: (r) => <DebitCreditCell debit={r.amount > 0 ? r.amount : null} credit={r.amount < 0 ? Math.abs(r.amount) : null} />,
              },
              {
                id: "status",
                header: "Status",
                cell: (r) => <StatusChip tone={r.status === "Draft" ? "neutral" : "warning"}>{r.status}</StatusChip>,
              },
              {
                id: "sync",
                header: "Sync",
                cell: (r) => <SyncStatusChip state={r.sync === "synced" ? "synced" : r.sync === "pending" ? "pending" : "conflict"} />,
                priority: "low",
              },
            ]}
          />
          <Pagination page={page} pageSize={25} total={120} onPageChange={setPage} onPageSizeChange={() => undefined} />
          <StickyActionBar unsaved primary={<Button size="small">Save view</Button>} secondary={<Button size="small" variant="secondary">Discard</Button>} />
        </Section>

        <Section>
          <SectionHeader title="Table states" />
          <Stack gap={4}>
            <EnterpriseDataTable columns={[{ id: "a", header: "Col", accessor: "a" }]} rows={[]} getRowId={(r) => r.a} emptyTitle="No filtered results" emptyDescription="Clear filters to see invoices." />
            <EnterpriseDataTable columns={[{ id: "a", header: "Col", accessor: "a" }]} rows={[]} getRowId={(r) => r.a} loading />
            <EnterpriseDataTable
              columns={[{ id: "a", header: "Col", accessor: "a" }]}
              rows={[]}
              getRowId={(r) => r.a}
              error="Network unavailable"
              onRetry={() => undefined}
            />
          </Stack>
        </Section>
      </Stack>
    </ToastProvider>
  );
}
