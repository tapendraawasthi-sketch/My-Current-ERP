// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import toast from "react-hot-toast";
import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  Save,
  FileText,
  Settings,
  Users,
  History,
  AlertTriangle,
  CheckCircle,
  Tag,
} from "lucide-react";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const DEFAULT_LEVELS = [
  {
    id: "pl-1",
    code: "RETAIL",
    name: "Retail / MRP",
    description: "Maximum Retail Price for walk-in customers",
    isDefault: true,
  },
  { id: "pl-2", code: "WHOLE", name: "Wholesale", description: "Bulk buyers and wholesalers" },
  { id: "pl-3", code: "DIST", name: "Distributor", description: "Authorized distributors" },
  { id: "pl-4", code: "EXPORT", name: "Export", description: "Export customers" },
  {
    id: "pl-5",
    code: "SPECIAL",
    name: "Special Customer",
    description: "VIP and negotiated pricing",
  },
];

const cardClass = "bg-white border border-gray-200 rounded-md shadow-sm p-4";
const tableHeadClass =
  "bg-[#f5f6fa] border-b border-gray-200 px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const tableCellClass = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";

const primaryBtn =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-sm";
const outlineBtn =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5";
const inputClass =
  "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] transition-shadow";

export function getPriceForItemAndParty(
  itemId: string,
  partyId: string,
  quantity: number,
  date: string,
  priceLists: any[],
  partyPriceLevels: any[],
  parties: any[],
): { rate: number; discount: number; priceListName: string; slabApplied: boolean } {
  const partyLevel = (partyPriceLevels || []).find((p) => p.partyId === partyId);
  const party = (parties || []).find((p) => p.id === partyId);
  const priceLevelId = partyLevel?.priceLevelId || party?.priceLevelId || "pl-1";

  const activeList = (priceLists || [])
    .filter(
      (pl) =>
        pl.priceLevelId === priceLevelId &&
        pl.status === "Active" &&
        pl.effectiveFrom <= date &&
        (!pl.effectiveTo || pl.effectiveTo >= date),
    )
    .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime())[0];

  if (!activeList) return { rate: 0, discount: 0, priceListName: "", slabApplied: false };

  const itemLine = (activeList.items || []).find((i: any) => i.itemId === itemId);
  if (!itemLine)
    return { rate: 0, discount: 0, priceListName: activeList.name, slabApplied: false };

  if (itemLine.slabs && itemLine.slabs.length > 0) {
    const slab = itemLine.slabs.find(
      (s: any) =>
        quantity >= Number(s.fromQty || 0) &&
        (Number(s.toQty || 0) === 0 || quantity <= Number(s.toQty || 0)),
    );
    if (slab) {
      return {
        rate: Number(slab.rate || 0),
        discount: Number(slab.discount || 0),
        priceListName: activeList.name,
        slabApplied: true,
      };
    }
  }

  return {
    rate: Number(itemLine.rate || 0),
    discount: Number(itemLine.discount || 0),
    priceListName: activeList.name,
    slabApplied: false,
  };
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function getStatus(pl: any) {
  const today = todayISO();
  if (pl.status === "Inactive") return "Inactive";
  if (pl.effectiveFrom > today) return "Upcoming";
  if (pl.effectiveTo && pl.effectiveTo < today) return "Expired";
  return "Active";
}

function statusBadge(status: string) {
  switch (status) {
    case "Active":
      return (
        <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-[10px] font-semibold uppercase tracking-wide">
          Active
        </span>
      );
    case "Inactive":
      return (
        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 border border-gray-200 rounded text-[10px] font-semibold uppercase tracking-wide">
          Inactive
        </span>
      );
    case "Upcoming":
      return (
        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-semibold uppercase tracking-wide">
          Upcoming
        </span>
      );
    case "Expired":
      return (
        <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-[10px] font-semibold uppercase tracking-wide">
          Expired
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 border border-gray-200 rounded text-[10px] font-semibold uppercase tracking-wide">
          {status}
        </span>
      );
  }
}

function Modal({ open, title, children, onClose, wide = false }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-white border border-gray-200 shadow-xl rounded-lg w-full ${wide ? "max-w-6xl" : "max-w-2xl"} flex flex-col max-h-[90vh]`}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <h2 className="text-[15px] font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export default function PriceListMaster() {
  const {
    items = [],
    parties = [],
    itemGroups = [],
    currentFiscalYear = {},
    currentUser = {},
  } = useStore();

  const [activeTab, setActiveTab] = useState("Price Levels");
  const [priceLevels, setPriceLevels] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [partyPriceLevels, setPartyPriceLevels] = useState([]);

  const [levelModal, setLevelModal] = useState(false);
  const [editingLevel, setEditingLevel] = useState(null);
  const [levelForm, setLevelForm] = useState({
    name: "",
    code: "",
    description: "",
    isDefault: false,
  });

  const [listModal, setListModal] = useState(false);
  const [editingList, setEditingList] = useState(null);
  const [selectedList, setSelectedList] = useState(null);
  const [listForm, setListForm] = useState({
    name: "",
    priceLevelId: "pl-1",
    effectiveFrom: todayISO(),
    effectiveTo: "",
    status: "Active",
    notes: "",
    items: [],
  });
  const [copySourceId, setCopySourceId] = useState("");

  const [assignPartyId, setAssignPartyId] = useState("");
  const [assignLevelId, setAssignLevelId] = useState("pl-1");
  const [assignType, setAssignType] = useState("customer");

  const [selectedItemId, setSelectedItemId] = useState("");

  useEffect(() => {
    const db = getDB();
    db.table("priceLevels")
      .toArray()
      .catch(() => DEFAULT_LEVELS)
      .then(async (levels) => {
        const finalLevels = levels.length > 0 ? levels : DEFAULT_LEVELS;
        if (!levels.length) {
          for (const l of DEFAULT_LEVELS)
            await db
              .table("priceLevels")
              .put(l)
              .catch(() => {});
        }
        setPriceLevels(finalLevels);
      });
    db.table("priceLists")
      .toArray()
      .catch(() => [])
      .then(setPriceLists);
    db.table("partyPriceLevel")
      .toArray()
      .catch(() => [])
      .then(setPartyPriceLevels);
  }, []);

  function openLevel(level?: any) {
    setEditingLevel(level || null);
    setLevelForm(
      level
        ? {
            name: level.name || "",
            code: level.code || "",
            description: level.description || "",
            isDefault: Boolean(level.isDefault),
          }
        : { name: "", code: "", description: "", isDefault: false },
    );
    setLevelModal(true);
  }

  async function saveLevel() {
    if (!levelForm.name.trim()) return toast.error("Level name is required");
    if (!levelForm.code.trim()) return toast.error("Code is required");

    const db = getDB();
    const id = editingLevel?.id || generateId();
    let next = priceLevels.map((l) => (levelForm.isDefault ? { ...l, isDefault: false } : l));
    const row = { id, ...levelForm, code: levelForm.code.toUpperCase() };
    await db
      .table("priceLevels")
      .put(row)
      .catch(() => {});
    if (levelForm.isDefault) {
      for (const l of next)
        await db
          .table("priceLevels")
          .put(l)
          .catch(() => {});
    }
    next = next.filter((l) => l.id !== id).concat(row);
    setPriceLevels(next);
    setLevelModal(false);
    toast.success("Price level saved");
  }

  async function deleteLevel(id: string) {
    if (!confirm("Delete this price level?")) return;
    await getDB()
      .table("priceLevels")
      .delete(id)
      .catch(() => {});
    setPriceLevels((r) => r.filter((x) => x.id !== id));
    toast.success("Price level deleted");
  }

  function openPriceList(pl?: any) {
    setEditingList(pl || null);
    setListForm(
      pl
        ? { ...pl, items: pl.items || [] }
        : {
            name: "",
            priceLevelId: priceLevels[0]?.id || "pl-1",
            effectiveFrom: todayISO(),
            effectiveTo: "",
            status: "Active",
            notes: "",
            items: [],
          },
    );
    setSelectedList(pl || null);
    setListModal(true);
  }

  function loadAllItems() {
    const existing = new Map((listForm.items || []).map((x) => [x.itemId, x]));
    const rows = (items || []).map((item) => {
      const prev = existing.get(item.id);
      return (
        prev || {
          itemId: item.id,
          itemCode: item.code || item.itemCode || "",
          itemName: item.name,
          unit: item.unit || item.uom || "PCS",
          purchaseRate: Number(item.purchasePrice || item.purchaseRate || item.rate || 0),
          rate: Number(item.salesPrice || item.mrp || item.rate || 0),
          discount: 0,
          hasSlabs: false,
          slabs: [],
        }
      );
    });
    setListForm((f) => ({ ...f, items: rows }));
  }

  function updateItemLine(idx: number, changes: any) {
    setListForm((f) => {
      const rows = [...(f.items || [])];
      rows[idx] = { ...rows[idx], ...changes };
      return { ...f, items: rows };
    });
  }

  function addSlab(idx: number) {
    setListForm((f) => {
      const rows = [...(f.items || [])];
      rows[idx].slabs = [
        ...(rows[idx].slabs || []),
        { fromQty: 1, toQty: 0, rate: rows[idx].rate || 0, discount: rows[idx].discount || 0 },
      ];
      rows[idx].hasSlabs = true;
      return { ...f, items: rows };
    });
  }

  function updateSlab(rowIdx: number, slabIdx: number, changes: any) {
    setListForm((f) => {
      const rows = [...(f.items || [])];
      const slabs = [...(rows[rowIdx].slabs || [])];
      slabs[slabIdx] = { ...slabs[slabIdx], ...changes };
      rows[rowIdx] = { ...rows[rowIdx], slabs, hasSlabs: true };
      return { ...f, items: rows };
    });
  }

  function removeSlab(rowIdx: number, slabIdx: number) {
    setListForm((f) => {
      const rows = [...(f.items || [])];
      rows[rowIdx].slabs = (rows[rowIdx].slabs || []).filter((_, i) => i !== slabIdx);
      return { ...f, items: rows };
    });
  }

  function copyFromPriceList() {
    const src = priceLists.find((p) => p.id === copySourceId);
    if (!src) return toast.error("Select source price list");
    const srcMap = new Map((src.items || []).map((x) => [x.itemId, x]));
    const rows = (listForm.items || []).map((line) => {
      const s = srcMap.get(line.itemId);
      return s
        ? {
            ...line,
            rate: s.rate,
            discount: s.discount,
            slabs: s.slabs || [],
            hasSlabs: Boolean(s.slabs?.length),
          }
        : line;
    });
    setListForm((f) => ({ ...f, items: rows }));
    toast.success("Rates copied");
  }

  async function savePriceList() {
    if (!listForm.name.trim()) return toast.error("Price list name required");
    const id = editingList?.id || selectedList?.id || generateId();
    const row = {
      ...listForm,
      id,
      updatedBy: currentUser?.name || "",
      updatedAt: new Date().toISOString(),
    };
    await getDB()
      .table("priceLists")
      .put(row)
      .catch(() => {});
    setPriceLists((rows) => rows.filter((x) => x.id !== id).concat(row));
    setSelectedList(row);
    setEditingList(row);
    toast.success("Price list saved");
  }

  async function deletePriceList(id: string) {
    if (!confirm("Delete this price list?")) return;
    await getDB()
      .table("priceLists")
      .delete(id)
      .catch(() => {});
    setPriceLists((r) => r.filter((x) => x.id !== id));
    toast.success("Price list deleted");
  }

  function clonePriceList(pl: any) {
    const cloned = {
      ...pl,
      id: generateId(),
      name: `${pl.name} - Copy`,
      effectiveFrom: todayISO(),
      effectiveTo: "",
      status: "Inactive",
    };
    getDB()
      .table("priceLists")
      .put(cloned)
      .catch(() => {});
    setPriceLists((r) => [...r, cloned]);
    toast.success("Price list cloned");
  }

  async function assignPartyLevel() {
    if (!assignPartyId) return toast.error("Select party");
    const row = {
      id: generateId(),
      partyId: assignPartyId,
      priceLevelId: assignLevelId,
      assignedAt: new Date().toISOString(),
    };
    await getDB()
      .table("partyPriceLevel")
      .put(row)
      .catch(() => {});
    setPartyPriceLevels((r) => r.filter((x) => x.partyId !== assignPartyId).concat(row));
    toast.success("Price level assigned");
  }

  async function assignGroup() {
    const affected = parties.filter(
      (p) => String(p.type || "").toLowerCase() === assignType.toLowerCase(),
    );
    if (!affected.length) return toast.error("No parties found for selected type");
    if (!confirm(`Assign price level to ${affected.length} parties?`)) return;
    const db = getDB();
    const rows = affected.map((p) => ({
      id: generateId(),
      partyId: p.id,
      priceLevelId: assignLevelId,
      assignedAt: new Date().toISOString(),
    }));
    for (const row of rows)
      await db
        .table("partyPriceLevel")
        .put(row)
        .catch(() => {});
    setPartyPriceLevels((old) =>
      old.filter((x) => !affected.some((p) => p.id === x.partyId)).concat(rows),
    );
    toast.success("Group assignment completed");
  }

  const selectedItemHistory = useMemo(() => {
    if (!selectedItemId) return [];
    return priceLists
      .flatMap((pl) =>
        (pl.items || [])
          .filter((i) => i.itemId === selectedItemId)
          .map((i) => ({
            effectiveDate: pl.effectiveFrom,
            priceLevel:
              priceLevels.find((l) => l.id === pl.priceLevelId)?.name || String(pl.priceLevelId),
            rate: i.rate || 0,
            listName: pl.name,
            changedBy: pl.updatedBy || "System",
            status: getStatus(pl),
            validTo: pl.effectiveTo ? String(pl.effectiveTo) : "",
          })),
      )
      .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());
  }, [selectedItemId, priceLists, priceLevels]);

  const activePrices = useMemo(() => {
    if (!selectedItemId) return [];
    return priceLevels.map((level) => {
      const active = priceLists
        .filter((pl) => pl.priceLevelId === level.id && getStatus(pl) === "Active")
        .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime())
        .find((pl) => (pl.items || []).some((i) => i.itemId === selectedItemId));
      const line = active?.items?.find((i) => i.itemId === selectedItemId);
      return { level, list: active, line };
    });
  }, [selectedItemId, priceLevels, priceLists]);

  const tabs = [
    { id: "Price Levels", icon: <Settings size={14} /> },
    { id: "Price Lists", icon: <FileText size={14} /> },
    { id: "Party Price Assignment", icon: <Users size={14} /> },
    { id: "Price History", icon: <History size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4 text-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <Tag size={18} className="text-[#1557b0]" /> Price List Master
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Manage price levels, effective lists, and customer assignments
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-4 border-b border-gray-200 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-[12px] rounded-t-md font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === t.id
                ? "bg-white text-[#1557b0] border-t border-l border-r border-gray-200 shadow-[0_-2px_0_0_#1557b0]"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            {t.icon} {t.id}
          </button>
        ))}
      </div>

      {activeTab === "Price Levels" && (
        <div className={cardClass}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[14px] font-semibold text-gray-700">Configured Price Levels</h2>
            <button className={primaryBtn} onClick={() => openLevel()}>
              <Plus size={14} /> Add Price Level
            </button>
          </div>
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Level Name", "Code", "Description", "Is Default", "Actions"].map((h) => (
                    <th key={h} className={tableHeadClass}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {priceLevels.map((l) => (
                  <tr key={l.id} className="bg-white hover:bg-gray-50">
                    <td className={`${tableCellClass} font-medium`}>{l.name}</td>
                    <td className={`${tableCellClass} font-mono text-gray-500`}>{l.code}</td>
                    <td className={tableCellClass}>{l.description}</td>
                    <td className={tableCellClass}>
                      {l.isDefault ? (
                        <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-[10px] font-semibold uppercase">
                          Yes
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className={tableCellClass}>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openLevel(l)}
                          className="text-gray-500 hover:text-[#1557b0]"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => deleteLevel(l.id)}
                          className="text-gray-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "Price Lists" && (
        <div className={cardClass}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[14px] font-semibold text-gray-700">Effective Price Lists</h2>
            <button className={primaryBtn} onClick={() => openPriceList()}>
              <Plus size={14} /> Create Price List
            </button>
          </div>
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {[
                    "List Name",
                    "Price Level",
                    "Effective From",
                    "Effective To",
                    "Items Count",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th key={h} className={tableHeadClass}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {priceLists.map((pl) => (
                  <tr key={pl.id} className="bg-white hover:bg-gray-50">
                    <td className={`${tableCellClass} font-medium`}>{pl.name}</td>
                    <td className={tableCellClass}>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded text-[10px] font-semibold uppercase">
                        {priceLevels.find((l) => l.id === pl.priceLevelId)?.name || pl.priceLevelId}
                      </span>
                    </td>
                    <td className={tableCellClass}>{pl.effectiveFrom}</td>
                    <td className={tableCellClass}>
                      {pl.effectiveTo || <span className="text-gray-400 italic">Open</span>}
                    </td>
                    <td className={tableCellClass}>
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                        {(pl.items || []).length} items
                      </span>
                    </td>
                    <td className={tableCellClass}>{statusBadge(getStatus(pl))}</td>
                    <td className={tableCellClass}>
                      <div className="flex items-center gap-3">
                        <button
                          className="text-[11px] font-medium text-[#1557b0] hover:underline"
                          onClick={() => openPriceList(pl)}
                        >
                          View / Edit
                        </button>
                        <button
                          className="text-gray-500 hover:text-[#1557b0]"
                          onClick={() => clonePriceList(pl)}
                          title="Clone"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          className="text-gray-400 hover:text-red-600"
                          onClick={() => deletePriceList(pl.id)}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!priceLists.length && (
                  <tr>
                    <td
                      className="text-center p-8 text-gray-500 text-[12px] bg-gray-50/50"
                      colSpan={7}
                    >
                      No price lists created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "Party Price Assignment" && (
        <div className="space-y-4">
          <div className={cardClass}>
            <h2 className="text-[14px] font-semibold text-gray-700 mb-4 border-b border-gray-100 pb-2">
              Individual Party Assignment
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Select Party
                </label>
                <select
                  className={inputClass}
                  value={assignPartyId}
                  onChange={(e) => setAssignPartyId(e.target.value)}
                >
                  <option value="">-- Choose Party --</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Price Level
                </label>
                <select
                  className={inputClass}
                  value={assignLevelId}
                  onChange={(e) => setAssignLevelId(e.target.value)}
                >
                  {priceLevels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <button className={primaryBtn} onClick={assignPartyLevel}>
                  Assign Level
                </button>
              </div>
            </div>
          </div>

          <div className={`${cardClass} bg-blue-50/30 border-blue-100`}>
            <h2 className="text-[14px] font-semibold text-blue-800 mb-4 border-b border-blue-100 pb-2 flex items-center gap-2">
              <Users size={16} /> Bulk Group Assignment
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-medium text-blue-700 mb-1">
                  Party Type
                </label>
                <select
                  className={inputClass}
                  value={assignType}
                  onChange={(e) => setAssignType(e.target.value)}
                >
                  <option value="customer">Customer</option>
                  <option value="supplier">Supplier</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-blue-700 mb-1">
                  Price Level
                </label>
                <select
                  className={inputClass}
                  value={assignLevelId}
                  onChange={(e) => setAssignLevelId(e.target.value)}
                >
                  {priceLevels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <button
                  className="h-8 px-4 bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 text-[12px] font-medium rounded-md transition-colors"
                  onClick={assignGroup}
                >
                  Apply to Group
                </button>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {[
                      "Party Name",
                      "PAN",
                      "Type",
                      "Current Price Level",
                      "Date Assigned",
                      "Actions",
                    ].map((h) => (
                      <th key={h} className={tableHeadClass}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parties.map((p) => {
                    const row = partyPriceLevels.find((x) => x.partyId === p.id);
                    return (
                      <tr key={p.id} className="bg-white hover:bg-gray-50">
                        <td className={`${tableCellClass} font-medium`}>{p.name}</td>
                        <td className={tableCellClass}>
                          {p.panNumber || p.vatNumber || <span className="text-gray-400">-</span>}
                        </td>
                        <td className={tableCellClass}>
                          <span className="text-[10px] uppercase tracking-wide bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                            {p.type || "Other"}
                          </span>
                        </td>
                        <td className={tableCellClass}>
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-semibold uppercase">
                            {priceLevels.find((l) => l.id === row?.priceLevelId)?.name ||
                              "Retail / MRP"}
                          </span>
                        </td>
                        <td className={tableCellClass}>
                          {row?.assignedAt ? (
                            row.assignedAt.slice(0, 10)
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className={tableCellClass}>
                          <button
                            className="text-[11px] text-[#1557b0] hover:underline"
                            onClick={() => {
                              setAssignPartyId(p.id);
                              setAssignLevelId(row?.priceLevelId || "pl-1");
                            }}
                          >
                            Edit Level
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!parties.length && (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-8 text-center text-gray-500 text-[12px] bg-gray-50/50"
                      >
                        No parties found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Price History" && (
        <div className={cardClass}>
          <div className="mb-6 max-w-md">
            <label className="block text-[11px] font-medium text-gray-600 mb-1">
              Select Item to View History
            </label>
            <select
              className={inputClass}
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
            >
              <option value="">-- Choose Item --</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.code ? `${i.code} - ` : ""}
                  {i.name}
                </option>
              ))}
            </select>
          </div>

          {selectedItemId ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-[14px] font-semibold text-gray-800 mb-3 border-b border-gray-200 pb-1 flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-600" /> Current Active Prices
                </h2>
                <div className="overflow-x-auto rounded-md border border-gray-200 shadow-sm">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {["Price Level", "Current Rate", "Valid From", "Valid To"].map((h) => (
                          <th key={h} className={tableHeadClass}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {activePrices.map((r) => (
                        <tr key={r.level.id} className="bg-white hover:bg-gray-50">
                          <td className={`${tableCellClass} font-medium`}>{r.level.name}</td>
                          <td className={`${tableCellClass} font-semibold text-gray-900`}>
                            {r.line?.rate ? (
                              `Rs. ${money(r.line.rate)}`
                            ) : (
                              <span className="text-gray-400 font-normal italic">Not Set</span>
                            )}
                          </td>
                          <td className={tableCellClass}>
                            {r.list?.effectiveFrom || <span className="text-gray-400">-</span>}
                          </td>
                          <td className={tableCellClass}>
                            {r.list?.effectiveTo ||
                              (r.line?.rate ? (
                                <span className="text-gray-400 italic">Open</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h2 className="text-[14px] font-semibold text-gray-800 mb-3 border-b border-gray-200 pb-1 flex items-center gap-2">
                  <History size={14} className="text-gray-500" /> Historical Record
                </h2>
                <div className="overflow-x-auto rounded-md border border-gray-200 shadow-sm">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {[
                          "Effective Date",
                          "Price Level",
                          "Rate",
                          "List Name",
                          "Changed By",
                          "Status",
                        ].map((h) => (
                          <th key={h} className={tableHeadClass}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedItemHistory.map((h, idx) => (
                        <tr key={idx} className="bg-white hover:bg-gray-50">
                          <td className={tableCellClass}>{h.effectiveDate}</td>
                          <td className={tableCellClass}>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded text-[10px] font-semibold uppercase">
                              {h.priceLevel}
                            </span>
                          </td>
                          <td className={`${tableCellClass} font-semibold text-gray-900`}>
                            Rs. {money(h.rate)}
                          </td>
                          <td className={tableCellClass}>{h.listName}</td>
                          <td className={tableCellClass}>{h.changedBy}</td>
                          <td className={tableCellClass}>{statusBadge(h.status)}</td>
                        </tr>
                      ))}
                      {!selectedItemHistory.length && (
                        <tr>
                          <td
                            colSpan={6}
                            className="text-center p-6 text-gray-500 text-[12px] bg-gray-50/50"
                          >
                            No historical data available for this item.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-10 border border-dashed border-gray-300 rounded-lg bg-gray-50 flex flex-col items-center justify-center text-gray-500 text-center">
              <History size={32} className="mb-3 text-gray-400" />
              <p className="text-[13px] font-medium text-gray-700">No Item Selected</p>
              <p className="text-[11px] mt-1 max-w-sm">
                Select an item from the dropdown above to view its current active prices across all
                levels and its complete revision history.
              </p>
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      <Modal
        open={levelModal}
        title={editingLevel ? "Edit Price Level" : "Add Price Level"}
        onClose={() => setLevelModal(false)}
      >
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Level Name</label>
            <input
              className={inputClass}
              placeholder="e.g. Retail, Wholesale"
              value={levelForm.name}
              onChange={(e) => setLevelForm({ ...levelForm, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Level Code</label>
            <input
              className={inputClass}
              placeholder="e.g. RETAIL"
              value={levelForm.code}
              onChange={(e) => setLevelForm({ ...levelForm, code: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Description</label>
            <textarea
              className={`${inputClass} h-auto py-2`}
              rows={3}
              placeholder="Brief description of this level"
              value={levelForm.description}
              onChange={(e) => setLevelForm({ ...levelForm, description: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="isDefaultLevel"
              checked={levelForm.isDefault}
              onChange={(e) => setLevelForm({ ...levelForm, isDefault: e.target.checked })}
              className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
            />
            <label
              htmlFor="isDefaultLevel"
              className="text-[12px] font-medium text-gray-700 cursor-pointer"
            >
              Set as Default Price Level
            </label>
          </div>
          <div className="flex justify-end pt-3 border-t border-gray-100 mt-2">
            <button className={primaryBtn} onClick={saveLevel}>
              <Save size={14} /> Save Price Level
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={listModal}
        title={editingList ? "Edit Price List" : "Create Price List"}
        onClose={() => setListModal(false)}
        wide
      >
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-4">
          <h3 className="text-[12px] font-semibold text-gray-700 uppercase tracking-wide mb-3">
            General Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Price List Name
              </label>
              <input
                className={inputClass}
                placeholder="e.g. Summer Sale 2024"
                value={listForm.name}
                onChange={(e) => setListForm({ ...listForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Applies To Level
              </label>
              <select
                className={inputClass}
                value={listForm.priceLevelId}
                onChange={(e) => setListForm({ ...listForm, priceLevelId: e.target.value })}
              >
                {priceLevels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Status</label>
              <select
                className={inputClass}
                value={listForm.status}
                onChange={(e) => setListForm({ ...listForm, status: e.target.value })}
              >
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Effective From
              </label>
              <input
                className={inputClass}
                type="date"
                value={listForm.effectiveFrom}
                onChange={(e) => setListForm({ ...listForm, effectiveFrom: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Effective To (Leave empty if no expiry)
              </label>
              <input
                className={inputClass}
                type="date"
                value={listForm.effectiveTo}
                onChange={(e) => setListForm({ ...listForm, effectiveTo: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Notes</label>
              <input
                className={inputClass}
                placeholder="Optional notes"
                value={listForm.notes}
                onChange={(e) => setListForm({ ...listForm, notes: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 bg-blue-50/50 p-3 rounded-md border border-blue-100">
          <div className="flex items-center gap-3">
            <button className={outlineBtn} onClick={loadAllItems}>
              <Plus size={14} className="text-gray-500" /> Load Master Items
            </button>
            <div className="h-6 w-px bg-gray-300 hidden md:block"></div>
            <div className="flex items-center gap-2">
              <select
                className={`${inputClass} w-48`}
                value={copySourceId}
                onChange={(e) => setCopySourceId(e.target.value)}
              >
                <option value="">-- Copy From List --</option>
                {priceLists
                  .filter((p) => p.id !== listForm.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <button className={outlineBtn} onClick={copyFromPriceList}>
                <Copy size={14} className="text-gray-500" /> Apply Rates
              </button>
            </div>
          </div>
          <button className={primaryBtn} onClick={savePriceList}>
            <Save size={14} /> Save List
          </button>
        </div>

        <div className="overflow-x-auto rounded-md border border-gray-200 max-h-[400px] overflow-y-auto">
          <table className="w-full border-collapse sticky-header">
            <thead className="sticky top-0 bg-[#f5f6fa] z-10 shadow-sm">
              <tr>
                {[
                  "Item Code",
                  "Item Name",
                  "Unit",
                  "Std Purchase",
                  "Rate (NPR)",
                  "Discount (%)",
                  "Qty Slabs",
                ].map((h) => (
                  <th key={h} className={tableHeadClass}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(listForm.items || []).map((line, idx) => (
                <React.Fragment key={line.itemId}>
                  <tr className="bg-white hover:bg-gray-50">
                    <td className={`${tableCellClass} font-mono text-gray-500`}>{line.itemCode}</td>
                    <td className={`${tableCellClass} font-medium`}>{line.itemName}</td>
                    <td className={tableCellClass}>{line.unit}</td>
                    <td className={tableCellClass}>Rs. {money(line.purchaseRate)}</td>
                    <td className={tableCellClass}>
                      <input
                        className={`${inputClass} w-24 font-semibold`}
                        type="number"
                        value={line.rate}
                        onChange={(e) => updateItemLine(idx, { rate: Number(e.target.value) })}
                      />
                    </td>
                    <td className={tableCellClass}>
                      <input
                        className={`${inputClass} w-20`}
                        type="number"
                        value={line.discount}
                        onChange={(e) => updateItemLine(idx, { discount: Number(e.target.value) })}
                      />
                    </td>
                    <td className={tableCellClass}>
                      <div className="flex flex-col items-start gap-1">
                        <label className="flex gap-1.5 items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                            checked={line.hasSlabs}
                            onChange={(e) =>
                              updateItemLine(idx, {
                                hasSlabs: e.target.checked,
                                slabs: e.target.checked ? line.slabs || [] : [],
                              })
                            }
                          />
                          <span className="text-[11px] font-medium text-gray-600">Has Slabs</span>
                        </label>
                        {line.hasSlabs && (
                          <button
                            className="text-[10px] text-[#1557b0] hover:underline font-medium ml-5"
                            onClick={() => addSlab(idx)}
                          >
                            + Add Slab
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {line.hasSlabs &&
                    (line.slabs || []).map((s, si) => (
                      <tr key={si} className="bg-blue-50/40 border-l-2 border-l-[#1557b0]">
                        <td className={tableCellClass} colSpan={2}>
                          <div className="flex justify-end pr-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Slab {si + 1}
                          </div>
                        </td>
                        <td className={tableCellClass} colSpan={2}>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-gray-500 w-8 text-right">From</span>
                            <input
                              className={`${inputClass} w-20`}
                              type="number"
                              value={s.fromQty}
                              onChange={(e) =>
                                updateSlab(idx, si, { fromQty: Number(e.target.value) })
                              }
                            />
                            <span className="text-[11px] text-gray-500 w-8 text-right">To</span>
                            <input
                              className={`${inputClass} w-20`}
                              type="number"
                              value={s.toQty}
                              placeholder="Max"
                              onChange={(e) =>
                                updateSlab(idx, si, { toQty: Number(e.target.value) })
                              }
                            />
                          </div>
                        </td>
                        <td className={tableCellClass}>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-gray-500">Rate</span>
                            <input
                              className={`${inputClass} w-24`}
                              type="number"
                              value={s.rate}
                              onChange={(e) =>
                                updateSlab(idx, si, { rate: Number(e.target.value) })
                              }
                            />
                          </div>
                        </td>
                        <td className={tableCellClass}>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-gray-500">Disc</span>
                            <input
                              className={`${inputClass} w-20`}
                              type="number"
                              value={s.discount}
                              onChange={(e) =>
                                updateSlab(idx, si, { discount: Number(e.target.value) })
                              }
                            />
                          </div>
                        </td>
                        <td className={tableCellClass}>
                          <button
                            className="text-[11px] text-red-600 hover:underline font-medium flex items-center gap-1"
                            onClick={() => removeSlab(idx, si)}
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                </React.Fragment>
              ))}
              {(!listForm.items || listForm.items.length === 0) && (
                <tr>
                  <td colSpan={7} className="text-center p-8 text-gray-500 text-[12px]">
                    No items loaded. Click "Load Master Items" to begin assigning prices.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}
