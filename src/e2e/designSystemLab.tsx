/**
 * Design-system component laboratory — not exposed as a production app route.
 * Guarded like the auth fixture.
 */
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  Button,
  IconButton,
  Input,
  Textarea,
  FormField,
  Checkbox,
  Radio,
  RadioGroup,
  Switch,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Tooltip,
  TooltipProvider,
  Divider,
  Badge,
  StatusChip,
  Spinner,
  Skeleton,
  Surface,
  Stack,
  Inline,
  Container,
  applyDensity,
  applyDsTheme,
  OrbixIcon,
  NprIcon,
  DualDateIcon,
  LedgerIcon,
  ReconciliationIcon,
  SyncConflictIcon,
  type Density,
} from "@/design-system";
import { Search } from "lucide-react";
import { Ui2LabSections } from "./designSystemLabUi2";
import "@/design-system/foundations/index.css";
import "../styles.css";

function allowed() {
  if (import.meta.env.DEV) return true;
  return import.meta.env.VITE_ALLOW_AUTH_FIXTURE === "true";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Surface tone="surface" elevation={1} className="p-[var(--ds-card-padding)]">
      <h2 className="ds-text-section-title mb-4">{title}</h2>
      {children}
    </Surface>
  );
}

function Lab() {
  const [density, setDensity] = useState<Density>("productive");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [lang, setLang] = useState<"en" | "ne">("en");
  const [sw, setSw] = useState(false);

  useEffect(() => {
    applyDensity(density);
    applyDsTheme(theme);
  }, [density, theme]);

  if (!allowed()) {
    return <div data-testid="ds-lab-blocked">Design system lab unavailable in this build.</div>;
  }

  const t = (en: string, ne: string) => (lang === "ne" ? ne : en);

  return (
    <TooltipProvider>
      <div data-testid="ds-lab-ready" className="ds-root min-h-screen">
        <Container className="py-6">
          <Stack gap={6}>
            <header>
              <h1 className="ds-text-page-title">Himalayan Precision — Component Lab</h1>
              <p className="ds-text-metadata mt-1">
                {t("Isolated design-system gallery", "डिजाइन प्रणाली ग्यालेरी")}
              </p>
              <Inline gap={3} className="mt-4">
                <Button
                  size="small"
                  variant={theme === "light" ? "primary" : "secondary"}
                  onClick={() => setTheme("light")}
                >
                  Light
                </Button>
                <Button
                  size="small"
                  variant={theme === "dark" ? "primary" : "secondary"}
                  onClick={() => setTheme("dark")}
                >
                  Dark
                </Button>
                {(["comfortable", "productive", "compact"] as Density[]).map((d) => (
                  <Button
                    key={d}
                    size="small"
                    variant={density === d ? "primary" : "secondary"}
                    onClick={() => setDensity(d)}
                  >
                    {d}
                  </Button>
                ))}
                <Button
                  size="small"
                  variant={lang === "en" ? "primary" : "quiet"}
                  onClick={() => setLang("en")}
                >
                  EN
                </Button>
                <Button
                  size="small"
                  variant={lang === "ne" ? "primary" : "quiet"}
                  onClick={() => setLang("ne")}
                >
                  नेपाली
                </Button>
              </Inline>
            </header>

            <Section title={t("Buttons", "बटनहरू")}>
              <Inline gap={3}>
                <Button variant="primary">{t("Save", "बचत गर्नुहोस्")}</Button>
                <Button variant="secondary">Cancel</Button>
                <Button variant="quiet">Quiet</Button>
                <Button variant="destructive">Delete</Button>
                <Button variant="link">Link</Button>
                <Button loading>Loading</Button>
                <Button disabled>Disabled</Button>
                <IconButton aria-label="Search" icon={<Search />} />
              </Inline>
            </Section>

            <Section title={t("Fields", "फिल्डहरू")}>
              <Stack gap={4} className="max-w-md">
                <FormField id="name" label={t("Account name", "खाताको नाम")} required>
                  <Input placeholder={t("Cash in hand", "नगद मौज्दात")} />
                </FormField>
                <FormField id="amt" label={t("Amount", "रकम")} description="NPR">
                  <Input amount startAddon="रू" defaultValue="1,25,000.00" />
                </FormField>
                <FormField id="err" label="Invalid" error="This field is required">
                  <Input invalid />
                </FormField>
                <FormField id="notes" label={t("Narration", "विवरण")}>
                  <Textarea />
                </FormField>
                <div>
                  <label className="ds-text-label mb-1 block">Voucher type</label>
                  <Select defaultValue="journal">
                    <SelectTrigger aria-label="Voucher type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="journal">{t("Journal", "जर्नल")}</SelectItem>
                      <SelectItem value="payment">{t("Payment", "भुक्तानी")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Stack>
            </Section>

            <Section title="Selection">
              <Stack gap={3}>
                <Checkbox label="Include opening balance" />
                <Checkbox checked="indeterminate" label="Indeterminate" />
                <RadioGroup label="Posting mode" defaultValue="draft">
                  <Radio value="draft" label="Draft" />
                  <Radio value="final" label="Final" />
                </RadioGroup>
                <Switch
                  label="Show zero balances"
                  checked={sw}
                  onCheckedChange={setSw}
                  onLabel="On"
                  offLabel="Off"
                />
              </Stack>
            </Section>

            <Section title="Feedback">
              <Inline gap={3}>
                <Badge>FY 2081/82</Badge>
                <StatusChip tone="success">Balanced</StatusChip>
                <StatusChip tone="warning">Partial</StatusChip>
                <StatusChip tone="danger">Conflict</StatusChip>
                <StatusChip tone="info">Synced</StatusChip>
                <Spinner />
                <Skeleton className="h-8 w-40" />
                <Tooltip content="Accessible tooltip">
                  <Button variant="secondary" size="small">
                    Hover tip
                  </Button>
                </Tooltip>
              </Inline>
              <Divider className="my-4" />
              <Inline gap={4} className="text-[var(--ds-text-default)]">
                <OrbixIcon className="h-5 w-5" />
                <NprIcon className="h-5 w-5" />
                <DualDateIcon className="h-5 w-5" />
                <LedgerIcon className="h-5 w-5" />
                <ReconciliationIcon className="h-5 w-5" />
                <SyncConflictIcon className="h-5 w-5" />
              </Inline>
            </Section>

            <Section title={t("Financial numbers", "वित्तीय अंक")}>
              <table className="w-full max-w-sm">
                <thead>
                  <tr className="ds-text-label text-left">
                    <th className="py-2">Ledger</th>
                    <th className="py-2 text-right">Debit</th>
                    <th className="py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="ds-text-table">
                  <tr>
                    <td>Cash</td>
                    <td className="ds-financial-value ds-financial-debit">12,500.00 Dr</td>
                    <td className="ds-financial-value">—</td>
                  </tr>
                  <tr>
                    <td>Sales</td>
                    <td className="ds-financial-value">—</td>
                    <td className="ds-financial-value ds-financial-credit">12,500.00 Cr</td>
                  </tr>
                  <tr>
                    <td className="ds-text-body-strong">Total</td>
                    <td className="ds-financial-total">12,500.00</td>
                    <td className="ds-financial-total">12,500.00</td>
                  </tr>
                </tbody>
              </table>
              <p className="ds-text-metadata mt-3">
                Mixed date: 2082-03-15 BS / 2026-06-29 AD · NPR १२५००
              </p>
            </Section>

            <div data-testid="ds-lab-ui2">
              <Ui2LabSections lang={lang} />
            </div>
          </Stack>
        </Container>
      </div>
    </TooltipProvider>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("ds-lab root missing");
ReactDOM.createRoot(root).render(<Lab />);
