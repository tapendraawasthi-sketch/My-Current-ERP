/**
 * Public design-system API — single entry for future feature migration.
 * import { Button, Dialog, EnterpriseDataTable, ... } from "@/design-system";
 */
import "./foundations/index.css";

export type { Density, DsTheme, SpaceToken, SurfaceTone, StatusTone } from "./foundations/types";
export { SPACE_CSS, SURFACE_CSS, applyDensity, applyDsTheme } from "./foundations/types";

export { Button } from "./primitives/Button/Button";
export type { ButtonProps } from "./primitives/Button/Button";
export { IconButton } from "./primitives/IconButton/IconButton";
export type { IconButtonProps } from "./primitives/IconButton/IconButton";
export { Input } from "./primitives/Input/Input";
export type { InputProps } from "./primitives/Input/Input";
export { Textarea } from "./primitives/Textarea/Textarea";
export type { TextareaProps } from "./primitives/Textarea/Textarea";
export { Label, FormField, FieldDescription, FieldError } from "./primitives/FormField/FormField";
export { Checkbox } from "./primitives/Checkbox/Checkbox";
export { Radio, RadioGroup } from "./primitives/Radio/Radio";
export { Switch } from "./primitives/Switch/Switch";
export {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "./primitives/Select/Select";
export { Tooltip, TooltipProvider } from "./primitives/Tooltip/Tooltip";
export {
  Divider,
  Badge,
  StatusChip,
  Spinner,
  Skeleton,
  VisuallyHidden,
} from "./primitives/Feedback/Feedback";
export { Surface, Stack, Inline, Container } from "./primitives/Layout/Layout";

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "./primitives/Dialog/Dialog";
export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  ConfirmDialogFoundation,
} from "./primitives/Dialog/AlertDialog";
export { Drawer, DrawerTrigger, DrawerContent, DrawerClose } from "./primitives/Drawer/Drawer";
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from "./primitives/Popover/Popover";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  MenuButton,
} from "./primitives/Menu/DropdownMenu";

export {
  Alert,
  Banner,
  ToastProvider,
  useToast,
  ErrorSummary,
  EmptyState,
  LoadingState,
  InlineLoading,
  Progress,
  StepProgress,
  RecoveryPanel,
  SyncStatusChip,
  NotificationItem,
} from "./primitives/Feedback/Patterns";
export type { SyncVisualState } from "./primitives/Feedback/Patterns";

export {
  PageHeader,
  PageTitle,
  PageDescription,
  PageActions,
  PageMeta,
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
  DetailsPanel,
} from "./primitives/Page/Page";

export {
  SearchField,
  FilterBar,
  FilterChip,
  DateRangeFilter,
  Pagination,
  SelectionSummary,
} from "./primitives/Filters/Filters";
export type { SavedView, SavedViewOwner, DateRangeValue } from "./primitives/Filters/Filters";

export {
  EnterpriseDataTable,
  formatAmountCell,
  DebitCreditCell,
  DATA_TABLE_VIRTUALIZATION_THRESHOLD,
} from "./primitives/DataTable/EnterpriseDataTable";
export type {
  EnterpriseColumnDef,
  EnterpriseDataTableProps,
  SortDirection,
} from "./primitives/DataTable/EnterpriseDataTable";

export {
  OrbixIcon,
  NprIcon,
  DualDateIcon,
  LedgerIcon,
  ReconciliationIcon,
  SyncConflictIcon,
} from "./icons";

export {
  Combobox,
  AmountField,
  BalanceStrip,
  Dropzone,
  HubCardGrid,
  HubCard,
  StatementTable,
  LineItemGrid,
  DualDateField,
  DualDateDisplay,
  DateRangeField,
} from "./composites";
export type {
  ComboboxProps,
  ComboboxOption,
  StatementRow,
  StatementRowType,
  StatementTableProps,
  LineItemGridProps,
  LineItemRow,
  DateRangePreset,
} from "./composites";

export type { LucideIcon } from "lucide-react";
