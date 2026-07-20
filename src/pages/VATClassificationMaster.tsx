import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store";
import { Plus, X, Save, Search } from "lucide-react";
import toast from "@/lib/appToast";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";
import { useAppRoute, useNavigateApp } from "../routing/useAppRoute";
import {
  Button,
  PageHeader,
  PageMeta,
  EnterpriseDataTable,
  type EnterpriseColumnDef,
} from "@/design-system";

const btnPrimary =
  "h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-200 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

const emptyForm = () => ({
  name: "",
  taxability: "",
  vatRate: 0,
  inputOutput: "both",
  effectiveDate: "",
  isActive: true,
});

const getTaxabilityLabel = (taxability: string) => {
  switch (taxability) {
    case "taxable":
      return "Taxable";
    case "exempt":
      return "Exempt";
    case "zero_rated":
      return "Zero Rated";
    case "non_vat":
      return "Non-VAT";
    default:
      return taxability;
  }
};

const getInputOutputLabel = (io: string) => {
  switch (io) {
    case "input":
      return "Input";
    case "output":
      return "Output";
    case "both":
      return "Both";
    default:
      return io;
  }
};

const VATClassificationMaster: React.FC = () => {
  const {
    vatClassifications,
    addVATClassification,
    updateVATClassification,
    deleteVATClassification,
    initLifecycle,
  } = useStore();
  const { branchFilter, matchBranch } = useBranchFilter();
  const route = useAppRoute();
  const { openEntity, clearEntity } = useNavigateApp();
  const pageId = "vat-classifications";

  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [seedDone, setSeedDone] = useState(false);
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if ((vatClassifications || []).length === 0 && !seedDone) {
      setSeedDone(true);
      const seedData = [
        {
          name: "Taxable (13%)",
          vatRate: 13,
          taxability: "taxable",
          inputOutput: "both",
          isActive: true,
        },
        {
          name: "VAT Exempt",
          vatRate: 0,
          taxability: "exempt",
          inputOutput: "both",
          isActive: true,
        },
        {
          name: "Zero Rated",
          vatRate: 0,
          taxability: "zero_rated",
          inputOutput: "both",
          isActive: true,
        },
        {
          name: "Non-VAT",
          vatRate: 0,
          taxability: "non_vat",
          inputOutput: "both",
          isActive: true,
        },
      ];

      seedData.forEach(async (item) => {
        await addVATClassification(item);
      });
    }
  }, [vatClassifications, seedDone, addVATClassification]);

  const filteredClassifications = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = vatClassifications || [];
    return list.filter((cls) => {
      if (!matchBranch((cls as { branchId?: string }).branchId)) return false;
      if (!q) return true;
      return cls.name.toLowerCase().includes(q) || cls.taxability.toLowerCase().includes(q);
    });
  }, [vatClassifications, searchTerm, matchBranch, branchFilter]);

  const columns = useMemo<EnterpriseColumnDef<any>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (classification) => (
          <span className="font-medium text-[12px] text-[var(--ds-text-default)]">
            {classification.name}
          </span>
        ),
      },
      {
        id: "taxability",
        header: "Taxability",
        cell: (classification) => (
          <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-blue-100 text-blue-700">
            {getTaxabilityLabel(classification.taxability)}
          </span>
        ),
      },
      {
        id: "vatRate",
        header: "VAT rate %",
        align: "right",
        cell: (classification) => (
          <span className="font-mono text-[12px] text-[var(--ds-text-default)]">
            {classification.vatRate}%
          </span>
        ),
      },
      {
        id: "inputOutput",
        header: "Input/output",
        cell: (classification) => (
          <span className="text-[12px] text-[var(--ds-text-default)]">
            {getInputOutputLabel(classification.inputOutput)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        align: "center",
        cell: (classification) => (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
              classification.isActive
                ? "bg-[var(--ds-status-success-surface)] text-[var(--ds-status-success)]"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {classification.isActive ? "Active" : "Inactive"}
          </span>
        ),
      },
    ],
    [],
  );

  const resetForm = () => {
    setForm(emptyForm());
    setSelected(null);
    setShowForm(false);
    clearEntity(pageId);
  };

  const handleOpenCreate = () => {
    setForm(emptyForm());
    setSelected(null);
    setShowForm(true);
    openEntity(pageId, "new");
  };

  const handleOpenEdit = (classification: any) => {
    setForm({
      name: classification.name || "",
      taxability: classification.taxability || "",
      vatRate: classification.vatRate || 0,
      inputOutput: classification.inputOutput || "both",
      effectiveDate: classification.effectiveDate || "",
      isActive: classification.isActive ?? true,
    });
    setSelected(classification);
    setShowForm(true);
    openEntity(pageId, classification.id);
  };

  // Deep link: /app/vat-classifications/:id | /app/vat-classifications/new
  useEffect(() => {
    if (route.pageId !== pageId) return;
    if (route.entityId === "new") {
      setSelected(null);
      setForm(emptyForm());
      setShowForm(true);
      return;
    }
    if (route.entityId) {
      const classification = (vatClassifications || []).find((c) => c.id === route.entityId);
      if (classification) {
        setSelected(classification);
        setForm({
          name: classification.name || "",
          taxability: classification.taxability || "",
          vatRate: classification.vatRate || 0,
          inputOutput: classification.inputOutput || "both",
          effectiveDate: classification.effectiveDate || "",
          isActive: classification.isActive ?? true,
        });
        setShowForm(true);
      }
      return;
    }
    if (showForm) setShowForm(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.pageId, route.entityId, vatClassifications]);

  const handleTaxabilityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    let rate = 0;
    if (value === "taxable") {
      rate = 13;
    }
    setForm({ ...form, taxability: value, vatRate: rate });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Classification Name is required");
      return;
    }
    if (!form.taxability) {
      toast.error("Taxability is required");
      return;
    }

    try {
      if (selected) {
        await updateVATClassification(selected.id, {
          ...form,
          branchId: selected.branchId || readActiveBranchId() || undefined,
        } as any);
        toast.success("Updated successfully");
      } else {
        await addVATClassification({
          ...form,
          branchId: readActiveBranchId() || undefined,
        } as any);
        toast.success("Saved successfully");
      }
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An error occurred while saving.");
    }
  };

  const handleDelete = async (classification: any) => {
    const snapshot = { ...classification };
    try {
      await deleteVATClassification(classification.id);
      if (selected?.id === classification.id) resetForm();
      toast.undo(`"${classification.name}" deleted`, async () => {
        try {
          const { id, ...rest } = snapshot;
          await addVATClassification({ ...rest, id } as any);
        } catch (err: any) {
          toast.error(err?.message || "Failed to restore VAT classification.");
        }
      });
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("An error occurred while deleting.");
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-gray-50">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0 flex flex-col gap-3">
          <PageHeader
            title="VAT Classification Master (Nepal)"
            description="Manage tax classifications and nature of transactions"
            meta={
              <PageMeta>
                {filteredClassifications.length} of {(vatClassifications || []).length}{" "}
                classifications
              </PageMeta>
            }
            primaryAction={
              <Button
                variant="primary"
                size="small"
                onClick={handleOpenCreate}
                startIcon={<Plus className="h-3.5 w-3.5" />}
              >
                Add classification
              </Button>
            }
          />

          <div className="relative max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search classifications..."
              className={`${inputCls} pl-8`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
          <EnterpriseDataTable
            columns={columns}
            rows={filteredClassifications}
            getRowId={(classification) => classification.id}
            loading={vatClassifications == null || initLifecycle === "loading"}
            emptyTitle={
              searchTerm ? "No classifications match your search" : "No VAT classifications found"
            }
            emptyDescription={
              searchTerm
                ? "Try a different search term."
                : 'Click "Add classification" to create your first VAT classification.'
            }
            emptyAction={
              !searchTerm ? (
                <Button
                  variant="primary"
                  size="small"
                  onClick={handleOpenCreate}
                  startIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  Add classification
                </Button>
              ) : undefined
            }
            onRowClick={handleOpenEdit}
            rowActions={(classification) => [
              { label: "Edit", onSelect: () => handleOpenEdit(classification) },
              {
                label: "Delete",
                destructive: true,
                onSelect: () => handleDelete(classification),
              },
            ]}
            caption="VAT classifications"
          />
        </div>
      </div>

      {showForm && (
        <div className="w-[400px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
            <span className="text-[13px] font-semibold text-gray-700">
              {selected ? "Edit VAT classification" : "Add VAT classification"}
            </span>
            <button type="button" className="text-gray-500 hover:text-gray-700" onClick={resetForm}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <div>
              <label className={labelCls}>
                Classification name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter name"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  Taxability <span className="text-red-500">*</span>
                </label>
                <select
                  className={inputCls}
                  value={form.taxability}
                  onChange={handleTaxabilityChange}
                >
                  <option value="">— Select —</option>
                  <option value="taxable">Taxable</option>
                  <option value="exempt">Exempt</option>
                  <option value="zero_rated">Zero Rated</option>
                  <option value="non_vat">Non-VAT</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>VAT rate %</label>
                <div className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-end font-mono text-gray-700">
                  {form.vatRate}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Input/output</label>
                <select
                  className={inputCls}
                  value={form.inputOutput}
                  onChange={(e) => setForm({ ...form, inputOutput: e.target.value })}
                >
                  <option value="input">Input</option>
                  <option value="output">Output</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Effective date</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.effectiveDate}
                  onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                />
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                <input
                  type="checkbox"
                  className="rounded border-gray-200 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Active
              </label>
            </div>
          </div>

          <div className="flex gap-2 p-4 border-t border-gray-200 shrink-0">
            <button type="button" className={btnPrimary} onClick={handleSubmit}>
              <Save className="h-3.5 w-3.5" />
              {selected ? "Update" : "Save"}
            </button>
            <button type="button" className={btnOutline} onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VATClassificationMaster;
