export type WorkflowStatus = "open" | "partial" | "closed" | "cancelled";

export type WorkflowDocRef = {
  type: string;
  id: string;
  no: string;
  date: string;
};

export interface WorkflowVoucherLine {
  id?: string;
  itemId: string;
  itemName: string;
  itemCode?: string;

  qty?: number;
  quantity?: number;
  rate?: number;
  amount?: number;

  acceptedQty?: number;
  rejectedQty?: number;

  sourceOrderId?: string;
  sourceOrderLineId?: string;

  sourceGrnId?: string;
  sourceGrnLineId?: string;

  sourceDcId?: string;
  sourceDcLineId?: string;
}

export interface WorkflowVoucher {
  id: string;
  voucherNo?: string;
  invoiceNo?: string;
  orderNo?: string;
  challanNo?: string;
  grnNo?: string;

  type: string;
  date: string;
  dateNepali?: string;

  partyId?: string;
  partyName?: string;

  status?: string;
  workflowStatus?: WorkflowStatus;

  linkedPoIds?: string[];
  linkedGrnIds?: string[];
  linkedSoIds?: string[];
  linkedDcIds?: string[];

  linkedDocuments?: WorkflowDocRef[];

  lines: WorkflowVoucherLine[];

  grandTotal?: number;
  totalAmount?: number;
  narration?: string;
}

export interface OutstandingLine {
  orderId: string;
  orderNo: string;
  date: string;
  dateNepali?: string;
  partyId?: string;
  partyName?: string;

  itemId: string;
  itemName: string;
  orderedQty: number;
  receivedOrDispatchedQty: number;
  billedOrInvoicedQty: number;
  rejectedQty: number;
  pendingQty: number;

  rate: number;
  orderValue: number;
  pendingValue: number;
  workflowStatus: WorkflowStatus;
}

export interface PendingAlertSummary {
  purchaseOrdersPendingGrnOlderThan7Days: number;
  grnsPendingBilling: number;
  salesOrdersPendingDispatchOlderThan7Days: number;
  deliveryChallansPendingBilling: number;
}

const PURCHASE_ORDER_TYPES = new Set([
  "purchase-order",
  "purchase_order",
  "PURCHASE_ORDER",
]);

const GRN_TYPES = new Set([
  "grn",
  "goods-receipt-note",
  "goods_receipt_note",
  "receipt-note",
  "receipt_note",
  "RECEIPT_NOTE",
]);

const PURCHASE_INVOICE_TYPES = new Set([
  "purchase-invoice",
  "purchase_invoice",
  "purchase-voucher",
  "purchase_voucher",
  "PURCHASE_INVOICE",
]);

const SALES_ORDER_TYPES = new Set([
  "sales-order",
  "sales_order",
  "SALES_ORDER",
]);

const DELIVERY_CHALLAN_TYPES = new Set([
  "delivery-challan",
  "delivery_challan",
  "delivery-note",
  "delivery_note",
  "DELIVERY_NOTE",
]);

const SALES_INVOICE_TYPES = new Set([
  "sales-invoice",
  "sales_invoice",
  "sales-voucher",
  "sales_voucher",
  "SALES_INVOICE",
]);

const REJECTION_OUT_TYPES = new Set([
  "rejection-out",
  "rejection_out",
  "REJECTION_OUT",
]);

function normType(type: string): string {
  return String(type || "").trim();
}

export function isPurchaseOrder(v: WorkflowVoucher) {
  return PURCHASE_ORDER_TYPES.has(normType(v.type));
}

export function isGrn(v: WorkflowVoucher) {
  return GRN_TYPES.has(normType(v.type));
}

export function isPurchaseInvoice(v: WorkflowVoucher) {
  return PURCHASE_INVOICE_TYPES.has(normType(v.type));
}

export function isSalesOrder(v: WorkflowVoucher) {
  return SALES_ORDER_TYPES.has(normType(v.type));
}

export function isDeliveryChallan(v: WorkflowVoucher) {
  return DELIVERY_CHALLAN_TYPES.has(normType(v.type));
}

export function isSalesInvoice(v: WorkflowVoucher) {
  return SALES_INVOICE_TYPES.has(normType(v.type));
}

export function isRejectionOut(v: WorkflowVoucher) {
  return REJECTION_OUT_TYPES.has(normType(v.type));
}

export function docNo(v: WorkflowVoucher): string {
  return (
    v.voucherNo ||
    v.invoiceNo ||
    v.orderNo ||
    v.challanNo ||
    v.grnNo ||
    v.id
  );
}

export function docRef(v: WorkflowVoucher): WorkflowDocRef {
  return {
    type: v.type,
    id: v.id,
    no: docNo(v),
    date: v.date,
  };
}

export function ensureWorkflowFields<T extends WorkflowVoucher>(voucher: T): T {
  return {
    ...voucher,
    linkedPoIds: voucher.linkedPoIds || [],
    linkedGrnIds: voucher.linkedGrnIds || [],
    linkedSoIds: voucher.linkedSoIds || [],
    linkedDcIds: voucher.linkedDcIds || [],
    linkedDocuments: voucher.linkedDocuments || [],
    workflowStatus: voucher.workflowStatus || "open",
  };
}

export function lineQty(line: WorkflowVoucherLine): number {
  return Number(line.qty ?? line.quantity ?? 0);
}

export function lineAcceptedQty(line: WorkflowVoucherLine): number {
  if (line.acceptedQty !== undefined) return Number(line.acceptedQty || 0);
  return Math.max(0, lineQty(line) - Number(line.rejectedQty || 0));
}

export function lineAmount(line: WorkflowVoucherLine): number {
  return Number(line.amount ?? lineQty(line) * Number(line.rate || 0));
}

export function sameParty(a: WorkflowVoucher, b: WorkflowVoucher): boolean {
  if (!a.partyId || !b.partyId) return a.partyName === b.partyName;
  return a.partyId === b.partyId;
}

export function addUnique<T>(arr: T[] | undefined, value: T): T[] {
  return Array.from(new Set([...(arr || []), value]));
}

export function addLinkedDocument(
  voucher: WorkflowVoucher,
  ref: WorkflowDocRef,
): WorkflowDocRef[] {
  const existing = voucher.linkedDocuments || [];
  if (existing.some((d) => d.id === ref.id && d.type === ref.type)) return existing;
  return [...existing, ref];
}

export function daysOld(date: string, asOf = new Date().toISOString().split("T")[0]) {
  const a = new Date(date).getTime();
  const b = new Date(asOf).getTime();
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function statusFromQty(baseQty: number, progressedQty: number): WorkflowStatus {
  if (baseQty <= 0) return "open";
  if (progressedQty <= 0) return "open";
  if (progressedQty >= baseQty - 0.000001) return "closed";
  return "partial";
}

/**
 * Computes ordered, received, rejected, billed quantity for one purchase order line.
 */
export function computePurchaseOrderLineProgress(
  po: WorkflowVoucher,
  poLine: WorkflowVoucherLine,
  allVouchers: WorkflowVoucher[],
) {
  const orderedQty = lineQty(poLine);

  const grns = allVouchers.filter(
    (v) => isGrn(v) && (v.linkedPoIds || []).includes(po.id) && v.status !== "cancelled",
  );

  const rejections = allVouchers.filter(
    (v) =>
      isRejectionOut(v) &&
      (v.linkedPoIds || []).includes(po.id) &&
      v.status !== "cancelled",
  );

  const receivedQty = grns.reduce((sum, grn) => {
    const qty = grn.lines
      .filter(
        (l) =>
          l.itemId === poLine.itemId &&
          (!l.sourceOrderLineId || l.sourceOrderLineId === poLine.id),
      )
      .reduce((s, l) => s + lineAcceptedQty(l), 0);

    return sum + qty;
  }, 0);

  const rejectedQty = rejections.reduce((sum, rej) => {
    const qty = rej.lines
      .filter(
        (l) =>
          l.itemId === poLine.itemId &&
          (!l.sourceOrderLineId || l.sourceOrderLineId === poLine.id),
      )
      .reduce((s, l) => s + lineQty(l), 0);

    return sum + qty;
  }, 0);

  const netReceivedQty = Math.max(0, receivedQty - rejectedQty);

  const purchaseInvoices = allVouchers.filter(
    (v) =>
      isPurchaseInvoice(v) &&
      v.status !== "cancelled" &&
      (v.linkedPoIds || []).includes(po.id),
  );

  const billedQty = purchaseInvoices.reduce((sum, inv) => {
    const qty = inv.lines
      .filter(
        (l) =>
          l.itemId === poLine.itemId &&
          (!l.sourceOrderLineId || l.sourceOrderLineId === poLine.id),
      )
      .reduce((s, l) => s + lineQty(l), 0);

    return sum + qty;
  }, 0);

  const pendingQty = Math.max(0, orderedQty - netReceivedQty);

  return {
    orderedQty,
    receivedQty: netReceivedQty,
    rejectedQty,
    billedQty,
    pendingQty,
    receiveStatus: statusFromQty(orderedQty, netReceivedQty),
    billStatus: statusFromQty(orderedQty, billedQty),
  };
}

export function computePurchaseOrderStatus(
  po: WorkflowVoucher,
  allVouchers: WorkflowVoucher[],
): WorkflowStatus {
  if (po.status === "cancelled") return "cancelled";

  const totalOrdered = po.lines.reduce((s, l) => s + lineQty(l), 0);
  const totalReceived = po.lines.reduce(
    (s, l) => s + computePurchaseOrderLineProgress(po, l, allVouchers).receivedQty,
    0,
  );
  const totalBilled = po.lines.reduce(
    (s, l) => s + computePurchaseOrderLineProgress(po, l, allVouchers).billedQty,
    0,
  );

  // For final closure, both receipt and billing should be complete.
  return statusFromQty(totalOrdered * 2, totalReceived + totalBilled);
}

export function getPendingPurchaseOrders(
  allVouchers: WorkflowVoucher[],
  supplierId?: string,
): WorkflowVoucher[] {
  return allVouchers
    .filter((v) => isPurchaseOrder(v) && v.status !== "cancelled")
    .map((v) => ({
      ...v,
      workflowStatus: computePurchaseOrderStatus(v, allVouchers),
    }))
    .filter((v) => v.workflowStatus !== "closed")
    .filter((v) => !supplierId || v.partyId === supplierId);
}

/**
 * Creates GRN lines from PO pending quantities.
 */
export function buildGrnLinesFromPurchaseOrder(
  po: WorkflowVoucher,
  allVouchers: WorkflowVoucher[],
): WorkflowVoucherLine[] {
  return po.lines
    .map((line) => {
      const progress = computePurchaseOrderLineProgress(po, line, allVouchers);

      return {
        id: crypto.randomUUID(),
        itemId: line.itemId,
        itemName: line.itemName,
        itemCode: line.itemCode,
        qty: progress.pendingQty,
        acceptedQty: progress.pendingQty,
        rejectedQty: 0,
        rate: line.rate || 0,
        amount: progress.pendingQty * Number(line.rate || 0),
        sourceOrderId: po.id,
        sourceOrderLineId: line.id,
      };
    })
    .filter((line) => line.qty && line.qty > 0);
}

export function getGrnsPendingBilling(
  allVouchers: WorkflowVoucher[],
  supplierId?: string,
): WorkflowVoucher[] {
  const grns = allVouchers.filter(
    (v) => isGrn(v) && v.status !== "cancelled" && (!supplierId || v.partyId === supplierId),
  );

  return grns.filter((grn) => {
    const receivedQty = grn.lines.reduce((s, l) => s + lineAcceptedQty(l), 0);

    const billedQty = allVouchers
      .filter(
        (v) =>
          isPurchaseInvoice(v) &&
          v.status !== "cancelled" &&
          (v.linkedGrnIds || []).includes(grn.id),
      )
      .reduce((sum, inv) => {
        return (
          sum +
          inv.lines.reduce((s, l) => {
            if (l.sourceGrnId && l.sourceGrnId !== grn.id) return s;
            return s + lineQty(l);
          }, 0)
        );
      }, 0);

    return billedQty < receivedQty - 0.000001;
  });
}

export function buildPurchaseInvoiceLinesFromGrns(
  grns: WorkflowVoucher[],
  allVouchers: WorkflowVoucher[],
): WorkflowVoucherLine[] {
  const lines: WorkflowVoucherLine[] = [];

  for (const grn of grns) {
    for (const grnLine of grn.lines) {
      const receivedQty = lineAcceptedQty(grnLine);

      const alreadyBilled = allVouchers
        .filter(
          (v) =>
            isPurchaseInvoice(v) &&
            v.status !== "cancelled" &&
            (v.linkedGrnIds || []).includes(grn.id),
        )
        .reduce((sum, inv) => {
          return (
            sum +
            inv.lines
              .filter(
                (l) =>
                  l.itemId === grnLine.itemId &&
                  (!l.sourceGrnLineId || l.sourceGrnLineId === grnLine.id),
              )
              .reduce((s, l) => s + lineQty(l), 0)
          );
        }, 0);

      const pendingQty = Math.max(0, receivedQty - alreadyBilled);

      if (pendingQty > 0) {
        lines.push({
          id: crypto.randomUUID(),
          itemId: grnLine.itemId,
          itemName: grnLine.itemName,
          itemCode: grnLine.itemCode,
          qty: pendingQty,
          rate: grnLine.rate || 0,
          amount: pendingQty * Number(grnLine.rate || 0),

          sourceOrderId: grnLine.sourceOrderId,
          sourceOrderLineId: grnLine.sourceOrderLineId,
          sourceGrnId: grn.id,
          sourceGrnLineId: grnLine.id,
        });
      }
    }
  }

  return lines;
}

export function buildPurchaseOrderOutstandingReport(
  allVouchers: WorkflowVoucher[],
): OutstandingLine[] {
  const purchaseOrders = allVouchers.filter((v) => isPurchaseOrder(v));

  return purchaseOrders.flatMap((po) =>
    po.lines.map((line) => {
      const p = computePurchaseOrderLineProgress(po, line, allVouchers);
      const rate = Number(line.rate || 0);

      return {
        orderId: po.id,
        orderNo: docNo(po),
        date: po.date,
        dateNepali: po.dateNepali,
        partyId: po.partyId,
        partyName: po.partyName,

        itemId: line.itemId,
        itemName: line.itemName,
        orderedQty: p.orderedQty,
        receivedOrDispatchedQty: p.receivedQty,
        billedOrInvoicedQty: p.billedQty,
        rejectedQty: p.rejectedQty,
        pendingQty: p.pendingQty,

        rate,
        orderValue: p.orderedQty * rate,
        pendingValue: p.pendingQty * rate,
        workflowStatus: computePurchaseOrderStatus(po, allVouchers),
      };
    }),
  );
}

/**
 * Sales order progress: ordered, dispatched through DC, invoiced through SI.
 */
export function computeSalesOrderLineProgress(
  so: WorkflowVoucher,
  soLine: WorkflowVoucherLine,
  allVouchers: WorkflowVoucher[],
) {
  const orderedQty = lineQty(soLine);

  const dcs = allVouchers.filter(
    (v) =>
      isDeliveryChallan(v) &&
      v.status !== "cancelled" &&
      (v.linkedSoIds || []).includes(so.id),
  );

  const dispatchedQty = dcs.reduce((sum, dc) => {
    const qty = dc.lines
      .filter(
        (l) =>
          l.itemId === soLine.itemId &&
          (!l.sourceOrderLineId || l.sourceOrderLineId === soLine.id),
      )
      .reduce((s, l) => s + lineQty(l), 0);

    return sum + qty;
  }, 0);

  const salesInvoices = allVouchers.filter(
    (v) =>
      isSalesInvoice(v) &&
      v.status !== "cancelled" &&
      (v.linkedSoIds || []).includes(so.id),
  );

  const invoicedQty = salesInvoices.reduce((sum, inv) => {
    const qty = inv.lines
      .filter(
        (l) =>
          l.itemId === soLine.itemId &&
          (!l.sourceOrderLineId || l.sourceOrderLineId === soLine.id),
      )
      .reduce((s, l) => s + lineQty(l), 0);

    return sum + qty;
  }, 0);

  const pendingQty = Math.max(0, orderedQty - dispatchedQty);

  return {
    orderedQty,
    dispatchedQty,
    invoicedQty,
    pendingQty,
    dispatchStatus: statusFromQty(orderedQty, dispatchedQty),
    invoiceStatus: statusFromQty(orderedQty, invoicedQty),
  };
}

export function computeSalesOrderStatus(
  so: WorkflowVoucher,
  allVouchers: WorkflowVoucher[],
): WorkflowStatus {
  if (so.status === "cancelled") return "cancelled";

  const totalOrdered = so.lines.reduce((s, l) => s + lineQty(l), 0);
  const totalDispatched = so.lines.reduce(
    (s, l) => s + computeSalesOrderLineProgress(so, l, allVouchers).dispatchedQty,
    0,
  );
  const totalInvoiced = so.lines.reduce(
    (s, l) => s + computeSalesOrderLineProgress(so, l, allVouchers).invoicedQty,
    0,
  );

  return statusFromQty(totalOrdered * 2, totalDispatched + totalInvoiced);
}

export function getPendingSalesOrders(
  allVouchers: WorkflowVoucher[],
  customerId?: string,
): WorkflowVoucher[] {
  return allVouchers
    .filter((v) => isSalesOrder(v) && v.status !== "cancelled")
    .map((v) => ({
      ...v,
      workflowStatus: computeSalesOrderStatus(v, allVouchers),
    }))
    .filter((v) => v.workflowStatus !== "closed")
    .filter((v) => !customerId || v.partyId === customerId);
}

export function buildDcLinesFromSalesOrder(
  so: WorkflowVoucher,
  allVouchers: WorkflowVoucher[],
): WorkflowVoucherLine[] {
  return so.lines
    .map((line) => {
      const progress = computeSalesOrderLineProgress(so, line, allVouchers);

      return {
        id: crypto.randomUUID(),
        itemId: line.itemId,
        itemName: line.itemName,
        itemCode: line.itemCode,
        qty: progress.pendingQty,
        rate: line.rate || 0,
        amount: progress.pendingQty * Number(line.rate || 0),
        sourceOrderId: so.id,
        sourceOrderLineId: line.id,
      };
    })
    .filter((line) => line.qty && line.qty > 0);
}

export function getDcsPendingBilling(
  allVouchers: WorkflowVoucher[],
  customerId?: string,
): WorkflowVoucher[] {
  const dcs = allVouchers.filter(
    (v) =>
      isDeliveryChallan(v) &&
      v.status !== "cancelled" &&
      (!customerId || v.partyId === customerId),
  );

  return dcs.filter((dc) => {
    const dcQty = dc.lines.reduce((s, l) => s + lineQty(l), 0);

    const invoicedQty = allVouchers
      .filter(
        (v) =>
          isSalesInvoice(v) &&
          v.status !== "cancelled" &&
          (v.linkedDcIds || []).includes(dc.id),
      )
      .reduce((sum, inv) => {
        return (
          sum +
          inv.lines.reduce((s, l) => {
            if (l.sourceDcId && l.sourceDcId !== dc.id) return s;
            return s + lineQty(l);
          }, 0)
        );
      }, 0);

    return invoicedQty < dcQty - 0.000001;
  });
}

export function buildSalesInvoiceLinesFromDcs(
  dcs: WorkflowVoucher[],
  allVouchers: WorkflowVoucher[],
): WorkflowVoucherLine[] {
  const lines: WorkflowVoucherLine[] = [];

  for (const dc of dcs) {
    for (const dcLine of dc.lines) {
      const dispatchedQty = lineQty(dcLine);

      const alreadyInvoiced = allVouchers
        .filter(
          (v) =>
            isSalesInvoice(v) &&
            v.status !== "cancelled" &&
            (v.linkedDcIds || []).includes(dc.id),
        )
        .reduce((sum, inv) => {
          return (
            sum +
            inv.lines
              .filter(
                (l) =>
                  l.itemId === dcLine.itemId &&
                  (!l.sourceDcLineId || l.sourceDcLineId === dcLine.id),
              )
              .reduce((s, l) => s + lineQty(l), 0)
          );
        }, 0);

      const pendingQty = Math.max(0, dispatchedQty - alreadyInvoiced);

      if (pendingQty > 0) {
        lines.push({
          id: crypto.randomUUID(),
          itemId: dcLine.itemId,
          itemName: dcLine.itemName,
          itemCode: dcLine.itemCode,
          qty: pendingQty,
          rate: dcLine.rate || 0,
          amount: pendingQty * Number(dcLine.rate || 0),

          sourceOrderId: dcLine.sourceOrderId,
          sourceOrderLineId: dcLine.sourceOrderLineId,
          sourceDcId: dc.id,
          sourceDcLineId: dcLine.id,
        });
      }
    }
  }

  return lines;
}

export function buildSalesOrderOutstandingReport(
  allVouchers: WorkflowVoucher[],
): OutstandingLine[] {
  const salesOrders = allVouchers.filter((v) => isSalesOrder(v));

  return salesOrders.flatMap((so) =>
    so.lines.map((line) => {
      const p = computeSalesOrderLineProgress(so, line, allVouchers);
      const rate = Number(line.rate || 0);

      return {
        orderId: so.id,
        orderNo: docNo(so),
        date: so.date,
        dateNepali: so.dateNepali,
        partyId: so.partyId,
        partyName: so.partyName,

        itemId: line.itemId,
        itemName: line.itemName,
        orderedQty: p.orderedQty,
        receivedOrDispatchedQty: p.dispatchedQty,
        billedOrInvoicedQty: p.invoicedQty,
        rejectedQty: 0,
        pendingQty: p.pendingQty,

        rate,
        orderValue: p.orderedQty * rate,
        pendingValue: p.pendingQty * rate,
        workflowStatus: computeSalesOrderStatus(so, allVouchers),
      };
    }),
  );
}

export function buildDocumentTrail(
  root: WorkflowVoucher,
  allVouchers: WorkflowVoucher[],
): WorkflowVoucher[] {
  const result: WorkflowVoucher[] = [];
  const visited = new Set<string>();

  const visit = (doc: WorkflowVoucher) => {
    if (visited.has(doc.id)) return;
    visited.add(doc.id);
    result.push(doc);

    const children = allVouchers.filter((v) => {
      return (
        (v.linkedPoIds || []).includes(doc.id) ||
        (v.linkedGrnIds || []).includes(doc.id) ||
        (v.linkedSoIds || []).includes(doc.id) ||
        (v.linkedDcIds || []).includes(doc.id) ||
        (v.linkedDocuments || []).some((d) => d.id === doc.id)
      );
    });

    children.forEach(visit);
  };

  visit(root);

  return result;
}

export function computePendingAlerts(
  allVouchers: WorkflowVoucher[],
  asOfDate = new Date().toISOString().split("T")[0],
): PendingAlertSummary {
  const purchaseOrdersPendingGrnOlderThan7Days = getPendingPurchaseOrders(allVouchers).filter(
    (po) => daysOld(po.date, asOfDate) > 7,
  ).length;

  const grnsPendingBilling = getGrnsPendingBilling(allVouchers).length;

  const salesOrdersPendingDispatchOlderThan7Days = getPendingSalesOrders(allVouchers).filter(
    (so) => daysOld(so.date, asOfDate) > 7,
  ).length;

  const deliveryChallansPendingBilling = getDcsPendingBilling(allVouchers).length;

  return {
    purchaseOrdersPendingGrnOlderThan7Days,
    grnsPendingBilling,
    salesOrdersPendingDispatchOlderThan7Days,
    deliveryChallansPendingBilling,
  };
}
