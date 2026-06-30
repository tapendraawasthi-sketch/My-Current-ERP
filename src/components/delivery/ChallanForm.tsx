// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared form for Delivery Challan and Goods Receipt Note entry.
 */

import React, { useMemo, useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import { Button, Card, Input, Select, PartySelect, ConfirmDialog, Badge } from "../ui";
import { ArrowLeft, Plus, Save, Truck, CheckCircle2, ClipboardList, FilePlus } from "lucide-react";
import toast from "react-hot-toast";
import { getDB } from "@/lib/db";
import { ChallanStatus, MovementType, PartyType } from "@/lib/types";

interface ChallanFormProps {
  type: "challan" | "grn";
  id?: string;
  salesOrderId?: string;
  purchaseOrderId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

interface ChallanLineState {
  id: string;
  itemId: string;
  itemName: string;
  itemCode?: string;
  description?: string;
  qty: number;
  unit?: string;
  warehouseId: string;
}

interface GrnLineState extends ChallanLineState {
  orderedQty: number;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
}

type LineState = ChallanLineState | GrnLineState;

const uid = () => Math.random().toString(36).slice(2, 10);

const defaultChallanLine = (): ChallanLineState => ({
  id: uid(),
  itemId: "",
  itemName: "",
  itemCode: "",
  description: "",
  qty: 0,
  unit: "",
  warehouseId: "",
});

const defaultGrnLine = (): GrnLineState => ({
  id: uid(),
  itemId: "",
  itemName: "",
  itemCode: "",
  description: "",
  qty: 0,
  unit: "",
  warehouseId: "",
  orderedQty: 0,
  receivedQty: 0,
  acceptedQty: 0,
  rejectedQty: 0,
});

const STATUS_VARIANT: Record<string, string> = {
  draft: "default",
  dispatched: "secondary",
  received: "success",
  invoiced: "success",
  cancelled: "danger",
};

const ChallanForm: React.FC<ChallanFormProps> = ({
  type,
  id,
  salesOrderId,
  purchaseOrderId,
  onSave,
  onCancel,
}) => {
  const {
    parties,
    items,
    warehouses,
    deliveryChallans,
    goodsReceiptNotes,
    salesOrders,
    purchaseOrders,
    addDeliveryChallan,
    addGoodsReceiptNote,
    initializeApp,
    accounts,
  } = useStore();

  const existing = useMemo(() => {
    if (type === "challan") {
      return deliveryChallans.find((record) => record.id === id);
    }
    return goodsReceiptNotes.find((record) => record.id === id);
  }, [type, id, deliveryChallans, goodsReceiptNotes]);

  const [date, setDate] = useState(existing?.date || new Date().toISOString().split("T")[0]);
  const [partyId, setPartyId] = useState(existing?.partyId || "");
  const [orderRef, setOrderRef] = useState(
    existing?.salesOrderId || existing?.purchaseOrderId || "",
  );
  const [vehicleNo, setVehicleNo] = useState(existing?.vehicleNo || "");
  const [driverName, setDriverName] = useState((existing as any)?.driverName || "");
  const [inspectedBy, setInspectedBy] = useState((existing as any)?.inspectedBy || "");
  const [status, setStatus] = useState(existing?.status || "draft");
  const partyType = type === "challan" ? PartyType.CUSTOMER : PartyType.SUPPLIER;
  const party = useMemo(() => parties.find((p) => p.id === partyId), [parties, partyId]);
  const [lines, setLines] = useState<LineState[]>(() => {
    if (!existing) {
      return type === "challan" ? [defaultChallanLine()] : [defaultGrnLine()];
    }

    return (existing.lines || []).map((line: any) => {
      if (type === "challan") {
        return {
          id: uid(),
          itemId: line.itemId || "",
          itemName: line.itemName || "",
          itemCode: line.itemCode || "",
          description: line.description || "",
          qty: Number(line.qty) || 0,
          unit: line.unit || "",
          warehouseId: line.warehouseId || "",
        };
      }

      return {
        id: uid(),
        itemId: line.itemId || "",
        itemName: line.itemName || "",
        itemCode: line.itemCode || "",
        description: line.description || "",
        qty: Number(line.qty) || 0,
        unit: line.unit || "",
        warehouseId: line.warehouseId || "",
        orderedQty: Number(line.orderedQty) || 0,
        receivedQty: Number(line.receivedQty) || 0,
        acceptedQty: Number(line.acceptedQty) || 0,
        rejectedQty: Number(line.rejectedQty) || 0,
      };
    });
  });

  const [saving, setSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (existing) {
      setDate(existing.date || new Date().toISOString().split("T")[0]);
      setPartyId(existing.partyId || "");
      setOrderRef(existing.salesOrderId || existing.purchaseOrderId || "");
      setVehicleNo(existing.vehicleNo || "");
      setDriverName((existing as any).driverName || "");
      setInspectedBy((existing as any).inspectedBy || "");
      setStatus(existing.status || "draft");
    }
  }, [existing]);

  const orderOptions = useMemo(() => {
    return (type === "challan" ? salesOrders : purchaseOrders).map((order) => ({
      value: order.id,
      label: `${order.orderNo} · ${order.partyName || ""} · ${order.date}`,
    }));
  }, [type, salesOrders, purchaseOrders]);

  const warehouseOptions = warehouses
    .filter((w) => w.isActive)
    .map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` }));
  const itemOptions = items.filter((i) => i.isActive);

  const linesWithTotals = useMemo(() => {
    return lines.map((line) => {
      if (type === "challan") {
        return {
          ...line,
          totalQty: Number((line as ChallanLineState).qty || 0),
        };
      }

      return {
        ...line,
        totalQty: Number((line as GrnLineState).receivedQty || 0),
        rejectedQty: Number((line as GrnLineState).rejectedQty || 0),
        acceptedQty: Number((line as GrnLineState).acceptedQty || 0),
      };
    });
  }, [lines, type]);

  const totalQty = useMemo(() => {
    return lines.reduce((sum, line) => {
      if (type === "challan") {
        return sum + Number((line as ChallanLineState).qty || 0);
      }
      return sum + Number((line as GrnLineState).receivedQty || 0);
    }, 0);
  }, [lines, type]);

  const statusOptions =
    type === "challan"
      ? [
          { value: "draft", label: "Draft" },
          { value: "dispatched", label: "Dispatched" },
          { value: "received", label: "Received" },
          { value: "invoiced", label: "Invoiced" },
        ]
      : [
          { value: "draft", label: "Draft" },
          { value: "received", label: "Received" },
          { value: "invoiced", label: "Invoiced" },
        ];

  const currentOrderLabel = useMemo(() => {
    const order =
      type === "challan"
        ? salesOrders.find((o) => o.id === orderRef)
        : purchaseOrders.find((o) => o.id === orderRef);
    return order?.orderNo || "";
  }, [type, orderRef, salesOrders, purchaseOrders]);

  const validate = () => {
    if (!date) return "Date is required.";
    if (!partyId) return `Select a ${type === "challan" ? "customer" : "supplier"}.`;

    const p = parties.find((x) => x.id === partyId);
    if (p) {
      const partyAcc = accounts.find((a) => a.id === p.accountId);
      if (partyAcc && partyAcc.isActive === false) return "Cannot save: party ledger is inactive.";
    }

    if (!lines.some((line) => line.itemId)) return "At least one line item is required.";
    if (type === "challan") {
      for (const line of lines as ChallanLineState[]) {
        if (!line.itemId) continue;
        if (!(Number(line.qty) > 0)) return "Challan item quantity must be greater than zero.";
        if (!line.warehouseId) return "Select a source warehouse for each line item.";
      }
    } else {
      for (const line of lines as GrnLineState[]) {
        if (!line.itemId) continue;
        if (!(Number(line.orderedQty) >= 0)) return "Ordered quantity cannot be negative.";
        if (!(Number(line.receivedQty) >= 0)) return "Received quantity cannot be negative.";
        if (!(Number(line.acceptedQty) >= 0)) return "Accepted quantity cannot be negative.";
        if (Number(line.acceptedQty) > Number(line.receivedQty))
          return "Accepted quantity cannot exceed received quantity.";
        if (!line.warehouseId) return "Select a warehouse for each received item.";
      }
    }
    return null;
  };

  const updateLine = (id: string, updates: Partial<LineState>) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...updates } as LineState;
        if (type === "grn") {
          const grnLine = next as GrnLineState;
          if (grnLine.receivedQty < 0) grnLine.receivedQty = 0;
          if (grnLine.acceptedQty < 0) grnLine.acceptedQty = 0;
          if (grnLine.acceptedQty > grnLine.receivedQty) {
            grnLine.acceptedQty = grnLine.receivedQty;
          }
          grnLine.rejectedQty = Math.max(0, grnLine.receivedQty - grnLine.acceptedQty);
        }
        return next;
      }),
    );
  };

  const addLine = () => {
    setLines((prev) => [...prev, type === "challan" ? defaultChallanLine() : defaultGrnLine()]);
  };

  const removeLine = (id: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== id) : prev));
  };

  const buildPayload = () => {
    const savedLines = lines
      .filter((line) => line.itemId)
      .map((line) => {
        if (type === "challan") {
          const challanLine = line as ChallanLineState;
          return {
            itemId: challanLine.itemId,
            itemName: challanLine.itemName,
            itemCode: challanLine.itemCode,
            description: challanLine.description,
            qty: challanLine.qty,
            unit: challanLine.unit,
            warehouseId: challanLine.warehouseId,
          };
        }

        const grnLine = line as GrnLineState;
        return {
          itemId: grnLine.itemId,
          itemName: grnLine.itemName,
          itemCode: grnLine.itemCode,
          description: grnLine.description,
          orderedQty: grnLine.orderedQty,
          receivedQty: grnLine.receivedQty,
          acceptedQty: grnLine.acceptedQty,
          rejectedQty: grnLine.rejectedQty,
          qty: grnLine.receivedQty,
          unit: grnLine.unit,
          warehouseId: grnLine.warehouseId,
        };
      });

    return {
      date,
      dateNepali: date,
      partyId,
      partyName: party?.name || "",
      salesOrderId: type === "challan" ? orderRef : undefined,
      purchaseOrderId: type === "grn" ? orderRef : undefined,
      lines: savedLines,
      totalQty,
      vehicleNo: type === "challan" ? vehicleNo : undefined,
      driverName: type === "challan" ? driverName : undefined,
      inspectedBy: type === "grn" ? inspectedBy : undefined,
      status,
      inventoryPosted: existing?.inventoryPosted || false,
    };
  };

  const postInventory = async (recordId: string, recordNo: string) => {
    const db = getDB();
    const movementItems = [];
    const activeWarehouse = warehouses.find((w) => w.isDefault && w.isActive) || warehouses[0];

    for (const line of lines) {
      if (!line.itemId || !line.warehouseId) continue;
      const item = items.find((it) => it.id === line.itemId);
      const rate = item?.purchaseRate || item?.salesRate || 0;
      const qty =
        type === "challan"
          ? Number((line as ChallanLineState).qty || 0)
          : Number((line as GrnLineState).acceptedQty || 0);
      if (qty <= 0) continue;

      movementItems.push({
        id: `mov-${recordId}-${line.id}`,
        date,
        dateNepali: date,
        type: type === "challan" ? MovementType.SALES : MovementType.PURCHASE,
        itemId: line.itemId,
        itemName: line.itemName,
        warehouseId: line.warehouseId || activeWarehouse?.id || "",
        warehouseName:
          warehouses.find((w) => w.id === line.warehouseId)?.name || activeWarehouse?.name || "",
        qty,
        rate,
        amount: Number((qty || 0) * rate),
        referenceId: recordId,
        referenceNo: recordNo,
        referenceType: type === "challan" ? "delivery-challan" : "goods-receipt-note",
        narration:
          type === "challan" ? `Dispatch from challan ${recordNo}` : `GRN receipt ${recordNo}`,
      });
    }

    if (!movementItems.length) {
      return;
    }

    await db.transaction(
      "rw",
      [db.stockMovements, db.deliveryChallans, db.goodsReceiptNotes],
      async () => {
        if (movementItems.length > 0) {
          await db.stockMovements.bulkAdd(movementItems);
        }
        if (type === "challan") {
          await db.deliveryChallans.update(recordId, { inventoryPosted: true } as any);
        } else {
          await db.goodsReceiptNotes.update(recordId, { inventoryPosted: true } as any);
        }
      },
    );
  };

  const handleSave = async (nextStatus?: string) => {
    const error = validate();
    if (error) {
      setValidationError(error);
      return;
    }

    setSaving(true);
    setValidationError("");

    try {
      const payload = buildPayload();
      if (nextStatus) payload.status = nextStatus;
      if (id && existing) {
        const db = getDB();
        await db.transaction("rw", [db.deliveryChallans, db.goodsReceiptNotes], async () => {
          if (type === "challan") {
            await db.deliveryChallans.update(id, payload);
          } else {
            await db.goodsReceiptNotes.update(id, payload);
          }
        });

        if (
          (nextStatus === "dispatched" && type === "challan") ||
          (nextStatus === "received" && type === "grn")
        ) {
          await postInventory(id, existing.challanNo || (existing as any).grnNo || "");
        }
      } else {
        if (type === "challan") {
          const created = await addDeliveryChallan(payload as any);
          if (nextStatus === "dispatched") {
            await getDB().deliveryChallans.update(created.id, { status: nextStatus });
            await postInventory(created.id, created.challanNo);
          }
        } else {
          const created = await addGoodsReceiptNote(payload as any);
          if (nextStatus === "received") {
            await getDB().goodsReceiptNotes.update(created.id, { status: nextStatus });
            await postInventory(created.id, created.grnNo);
          }
        }
      }

      await initializeApp();
      toast.success(`${type === "challan" ? "Delivery Challan" : "GRN"} saved successfully.`);
      onSave?.();
    } catch (err) {
      console.error(err);
      toast.error("Unable to save record.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateInvoice = () => {
    if (!existing?.id) {
      toast.error("Save the challan first before creating an invoice.");
      return;
    }
    const targetPage = type === "challan" ? "billing" : "purchase";
    toast.success(`Navigating to ${type === "challan" ? "Sales" : "Purchase"} Invoice...`);
    // Navigate with reference pre-filled
    const event = new CustomEvent("navigate", {
      detail: targetPage,
    });
    window.dispatchEvent(event);
  };

  const gridClass = "grid gap-3 md:grid-cols-2";

  return (
    <div className="space-y-5 animate-fadeIn text-xs">
      <div className="flex items-center justify-between border-b border-[#9DC07A] pb-4">
        <div>
          <div className="text-sm font-bold text-[#000000] tracking-tight flex items-center gap-2">
            {type === "challan" ? (
              <Truck className="h-5 w-5 text-[#1557b0]" />
            ) : (
              <ClipboardList className="h-5 w-5 text-[#1557b0]" />
            )}
            {type === "challan" ? "Delivery Challan" : "Goods Receipt Note"}
          </div>
          <p className="text-[11px] text-[#000000] mt-0.5 uppercase tracking-wider font-bold">
            {type === "challan"
              ? "Track dispatched goods before invoice creation."
              : "Capture goods received before purchase invoicing."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[status] || "default"} size="sm">
            {(status || "draft").toUpperCase()}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={onCancel}
          >
            Back
          </Button>
        </div>
      </div>

      <Card padding="lg" border>
        <div className={gridClass}>
          <Input label="Date" type="date" value={date} onChange={setDate} />
          <PartySelect
            label={type === "challan" ? "Customer" : "Supplier"}
            value={partyId}
            onChange={setPartyId}
            partyType={partyType}
            required
          />
        </div>

        <div className={gridClass}>
          <Select
            label={type === "challan" ? "Sales Order Reference" : "Purchase Order Reference"}
            value={orderRef}
            onChange={setOrderRef}
            options={[{ value: "", label: "-- none --" }, ...orderOptions]}
            placeholder="Select order reference"
          />
          {type === "challan" ? (
            <Input
              label="Vehicle No"
              value={vehicleNo}
              onChange={setVehicleNo}
              placeholder="DC-1234"
            />
          ) : (
            <Input
              label="Vehicle No"
              value={vehicleNo}
              onChange={setVehicleNo}
              placeholder="GRN vehicle no"
            />
          )}
        </div>

        <div className={gridClass}>
          {type === "challan" ? (
            <Input
              label="Driver Name"
              value={driverName}
              onChange={setDriverName}
              placeholder="Driver name"
            />
          ) : (
            <Input
              label="Inspected By"
              value={inspectedBy}
              onChange={setInspectedBy}
              placeholder="Inspector name"
            />
          )}
          <Select label="Status" value={status} onChange={setStatus} options={statusOptions} />
        </div>
      </Card>

      <Card
        title="Line Items"
        subtitle="Select item, quantity and stock warehouse for processing."
        border
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-[11px] border-separate border-spacing-0">
            <thead>
              <tr className="bg-[#EBF5E2] text-left text-[#000000] text-[10px] uppercase tracking-[0.25em]">
                <th className="px-2 py-2 font-semibold">Item</th>
                {type === "grn" && <th className="px-2 py-2 font-semibold">Ordered</th>}
                <th className="px-2 py-2 font-semibold">Received</th>
                {type === "grn" && <th className="px-2 py-2 font-semibold">Accepted</th>}
                {type === "grn" && <th className="px-2 py-2 font-semibold">Rejected</th>}
                {type === "challan" && <th className="px-2 py-2 font-semibold">Quantity</th>}
                <th className="px-2 py-2 font-semibold">Warehouse</th>
                <th className="px-2 py-2 font-semibold">Description</th>
                <th className="px-2 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const selectedItem = itemOptions.find((it) => it.id === line.itemId);
                return (
                  <tr key={line.id} className="border-t border-[#9DC07A]">
                    <td className="px-2 py-2">
                      <select
                        value={line.itemId}
                        onChange={(e) => {
                          const item = itemOptions.find((it) => it.id === e.target.value);
                          updateLine(line.id, {
                            itemId: item?.id || "",
                            itemName: item?.name || "",
                            itemCode: item?.code || "",
                            unit: item?.unit || "",
                          });
                        }}
                        className="w-full h-9 text-xs border border-[#9DC07A] rounded px-2"
                      >
                        <option value="">Select item</option>
                        {itemOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.code} · {item.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    {type === "grn" && (
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          value={(line as GrnLineState).orderedQty || ""}
                          onChange={(e) =>
                            updateLine(line.id, { orderedQty: Number(e.target.value) || 0 })
                          }
                          className="w-full h-9 text-xs border border-[#9DC07A] rounded px-2 text-right"
                          min={0}
                        />
                      </td>
                    )}
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={((line as any).receivedQty ?? (line as ChallanLineState).qty) || ""}
                        onChange={(e) =>
                          updateLine(line.id, {
                            receivedQty: Number(e.target.value) || 0,
                            qty: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full h-9 text-xs border border-[#9DC07A] rounded px-2 text-right"
                        min={0}
                      />
                    </td>
                    {type === "grn" && (
                      <>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            value={(line as GrnLineState).acceptedQty || ""}
                            onChange={(e) =>
                              updateLine(line.id, { acceptedQty: Number(e.target.value) || 0 })
                            }
                            className="w-full h-9 text-xs border border-[#9DC07A] rounded px-2 text-right"
                            min={0}
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          {(line as GrnLineState).rejectedQty || 0}
                        </td>
                      </>
                    )}
                    {type === "challan" && (
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          value={(line as ChallanLineState).qty || ""}
                          onChange={(e) =>
                            updateLine(line.id, { qty: Number(e.target.value) || 0 })
                          }
                          className="w-full h-9 text-xs border border-[#9DC07A] rounded px-2 text-right"
                          min={0}
                        />
                      </td>
                    )}
                    <td className="px-2 py-2">
                      <select
                        value={line.warehouseId}
                        onChange={(e) => updateLine(line.id, { warehouseId: e.target.value })}
                        className="w-full h-9 text-xs border border-[#9DC07A] rounded px-2"
                      >
                        <option value="">Select warehouse</option>
                        {warehouseOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={line.description || ""}
                        onChange={(e) => updateLine(line.id, { description: e.target.value })}
                        className="w-full h-9 text-xs border border-[#9DC07A] rounded px-2"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(line.id)}
                        className="h-9 px-3 text-xs rounded bg-red-50 text-red-700 border border-red-100 hover:bg-red-100"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={addLine}
          >
            Add line
          </Button>
          <div className="text-[11px] text-[#000000]">
            Total quantity: <span className="font-semibold text-[#000000]">{totalQty}</span>
          </div>
        </div>
      </Card>

      {validationError ? (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {validationError}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            icon={<Save className="h-4 w-4" />}
            onClick={() => handleSave("draft")}
            loading={saving}
          >
            Save as Draft
          </Button>
          {type === "challan" ? (
            <Button
              variant="success"
              size="sm"
              icon={<Truck className="h-4 w-4" />}
              onClick={() => handleSave("dispatched")}
              loading={saving}
            >
              Dispatch Challan
            </Button>
          ) : (
            <Button
              variant="success"
              size="sm"
              icon={<CheckCircle2 className="h-4 w-4" />}
              onClick={() => handleSave("received")}
              loading={saving}
            >
              Receive GRN
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            icon={<FilePlus className="h-4 w-4" />}
            onClick={handleCreateInvoice}
          >
            {type === "challan"
              ? "Create Invoice from Challan"
              : "Create Purchase Invoice from GRN"}
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(true)}>
          Cancel
        </Button>
      </div>

      <ConfirmDialog
        isOpen={confirmCancel}
        title="Discard changes?"
        message="Any unsaved changes will be lost."
        onConfirm={() => {
          setConfirmCancel(false);
          onCancel?.();
        }}
        onClose={() => setConfirmCancel(false)}
        confirmText="Discard"
        cancelText="Keep Editing"
      />
    </div>
  );
};

export default ChallanForm;
