import { getDB } from "../lib/db";
import {
  WorkflowVoucher,
  WorkflowVoucherLine,
  addLinkedDocument,
  addUnique,
  buildDcLinesFromSalesOrder,
  buildGrnLinesFromPurchaseOrder,
  buildPurchaseInvoiceLinesFromGrns,
  buildSalesInvoiceLinesFromDcs,
  computePurchaseOrderStatus,
  computeSalesOrderStatus,
  docRef,
  getDcsPendingBilling,
  getGrnsPendingBilling,
} from "../lib/workflowUtils";

function sumAmount(lines: WorkflowVoucherLine[]) {
  return lines.reduce((s, l) => s + Number(l.amount || Number(l.qty || 0) * Number(l.rate || 0)), 0);
}

function sumQty(lines: WorkflowVoucherLine[]) {
  return lines.reduce((s, l) => s + Number(l.qty || 0), 0);
}

function docNoCompat(v: any) {
  return v.voucherNo || v.invoiceNo || v.orderNo || v.challanNo || v.grnNo || v.id;
}

export const createWorkflowActions = (set: any, get: any) => ({
  async createGrnAgainstPo(args: {
    poIds: string[];
    grn: Partial<WorkflowVoucher>;
    lines?: WorkflowVoucherLine[];
  }) {
    const db = getDB();
    const allVouchers: WorkflowVoucher[] = (await db.vouchers.toArray()) as unknown as WorkflowVoucher[];
    const pos = allVouchers.filter((v) => args.poIds.includes(v.id));

    const lines =
      args.lines ||
      pos.flatMap((po) => buildGrnLinesFromPurchaseOrder(po, allVouchers));

    const grn: WorkflowVoucher = {
      id: crypto.randomUUID(),
      type: "goods-receipt-note",
      voucherNo: args.grn.voucherNo,
      date: args.grn.date!,
      dateNepali: args.grn.dateNepali,
      partyId: args.grn.partyId || pos[0]?.partyId,
      partyName: args.grn.partyName || pos[0]?.partyName,
      status: "posted",
      workflowStatus: "open",
      linkedPoIds: args.poIds,
      linkedGrnIds: [],
      linkedSoIds: [],
      linkedDcIds: [],
      linkedDocuments: pos.map(docRef),
      lines,
      grandTotal: sumAmount(lines),
      narration: args.grn.narration,
    };

    const updates: WorkflowVoucher[] = [];

    const nextAll = [...allVouchers, grn];

    for (const po of pos) {
      const updatedPo: WorkflowVoucher = {
        ...po,
        linkedDocuments: addLinkedDocument(po, docRef(grn)),
        workflowStatus: computePurchaseOrderStatus(po, nextAll),
      };
      updates.push(updatedPo);
    }

    await db.transaction("rw", db.vouchers, async () => {
      await db.vouchers.put(grn as any);
      await db.goodsReceiptNotes.put({ ...grn, grnNo: grn.voucherNo } as any);
      await db.vouchers.bulkPut(updates as any);
    });

    set({ vouchers: await db.vouchers.toArray(), goodsReceiptNotes: await db.goodsReceiptNotes.toArray() });
    return grn;
  },

  async createPurchaseInvoiceAgainstGrn(args: {
    grnIds: string[];
    invoice: Partial<WorkflowVoucher>;
    lines?: WorkflowVoucherLine[];
  }) {
    const db = getDB();
    const allVouchers: WorkflowVoucher[] = (await db.vouchers.toArray()) as unknown as WorkflowVoucher[];
    const grns = allVouchers.filter((v) => args.grnIds.includes(v.id));

    const poIds = Array.from(
      new Set(grns.flatMap((g) => g.linkedPoIds || [])),
    );

    const lines =
      args.lines ||
      buildPurchaseInvoiceLinesFromGrns(grns, allVouchers);

    const invoice: WorkflowVoucher = {
      id: crypto.randomUUID(),
      type: "purchase-invoice",
      voucherNo: args.invoice.voucherNo,
      invoiceNo: args.invoice.invoiceNo,
      date: args.invoice.date!,
      dateNepali: args.invoice.dateNepali,
      partyId: args.invoice.partyId || grns[0]?.partyId,
      partyName: args.invoice.partyName || grns[0]?.partyName,
      status: "posted",
      workflowStatus: "closed",
      linkedPoIds: poIds,
      linkedGrnIds: args.grnIds,
      linkedSoIds: [],
      linkedDcIds: [],
      linkedDocuments: [
        ...grns.map(docRef),
        ...allVouchers.filter((v) => poIds.includes(v.id)).map(docRef),
      ],
      lines,
      grandTotal: sumAmount(lines),
      narration: args.invoice.narration,
    };

    const nextAll = [...allVouchers, invoice];

    const linkedDocsToUpdate = allVouchers.filter(
      (v) => args.grnIds.includes(v.id) || poIds.includes(v.id),
    );

    const updates = linkedDocsToUpdate.map((doc) => {
      let workflowStatus = doc.workflowStatus || "open";

      if (poIds.includes(doc.id)) {
        workflowStatus = computePurchaseOrderStatus(doc, nextAll);
      }

      if (args.grnIds.includes(doc.id)) {
        const pending = getGrnsPendingBilling(nextAll, doc.partyId).some((g) => g.id === doc.id);
        workflowStatus = pending ? "partial" : "closed";
      }

      return {
        ...doc,
        workflowStatus,
        linkedDocuments: addLinkedDocument(doc, docRef(invoice)),
      };
    });

    await db.transaction("rw", db.vouchers, async () => {
      await db.vouchers.put(invoice as any);
      await db.invoices.put({ ...invoice } as any);
      await db.vouchers.bulkPut(updates as any);
    });

    set({ vouchers: await db.vouchers.toArray(), goodsReceiptNotes: await db.goodsReceiptNotes.toArray() });
    return invoice;
  },

  async createDcAgainstSo(args: {
    soIds: string[];
    dc: Partial<WorkflowVoucher>;
    lines?: WorkflowVoucherLine[];
  }) {
    const db = getDB();
    const allVouchers: WorkflowVoucher[] = (await db.vouchers.toArray()) as unknown as WorkflowVoucher[];
    const sos = allVouchers.filter((v) => args.soIds.includes(v.id));

    const lines =
      args.lines ||
      sos.flatMap((so) => buildDcLinesFromSalesOrder(so, allVouchers));

    const dc: WorkflowVoucher = {
      id: crypto.randomUUID(),
      type: "delivery-challan",
      voucherNo: args.dc.voucherNo,
      challanNo: args.dc.challanNo,
      date: args.dc.date!,
      dateNepali: args.dc.dateNepali,
      partyId: args.dc.partyId || sos[0]?.partyId,
      partyName: args.dc.partyName || sos[0]?.partyName,
      status: "posted",
      workflowStatus: "open",
      linkedSoIds: args.soIds,
      linkedDcIds: [],
      linkedPoIds: [],
      linkedGrnIds: [],
      linkedDocuments: sos.map(docRef),
      lines,
      grandTotal: sumAmount(lines),
      narration: args.dc.narration,
    };

    const nextAll = [...allVouchers, dc];

    const updates = sos.map((so) => ({
      ...so,
      workflowStatus: computeSalesOrderStatus(so, nextAll),
      linkedDocuments: addLinkedDocument(so, docRef(dc)),
    }));

    await db.transaction("rw", db.vouchers, async () => {
      await db.vouchers.put(dc as any);
      await db.deliveryChallans.put({ ...dc, challanNo: dc.voucherNo } as any);
      await db.vouchers.bulkPut(updates as any);
    });

    set({ vouchers: await db.vouchers.toArray(), goodsReceiptNotes: await db.goodsReceiptNotes.toArray() });
    return dc;
  },

  async createSalesInvoiceAgainstDc(args: {
    dcIds: string[];
    invoice: Partial<WorkflowVoucher>;
    lines?: WorkflowVoucherLine[];
  }) {
    const db = getDB();
    const allVouchers: WorkflowVoucher[] = (await db.vouchers.toArray()) as unknown as WorkflowVoucher[];
    const dcs = allVouchers.filter((v) => args.dcIds.includes(v.id));

    const soIds = Array.from(
      new Set(dcs.flatMap((d) => d.linkedSoIds || [])),
    );

    const lines =
      args.lines ||
      buildSalesInvoiceLinesFromDcs(dcs, allVouchers);

    const invoice: WorkflowVoucher = {
      id: crypto.randomUUID(),
      type: "sales-invoice",
      voucherNo: args.invoice.voucherNo,
      invoiceNo: args.invoice.invoiceNo,
      date: args.invoice.date!,
      dateNepali: args.invoice.dateNepali,
      partyId: args.invoice.partyId || dcs[0]?.partyId,
      partyName: args.invoice.partyName || dcs[0]?.partyName,
      status: "posted",
      workflowStatus: "closed",
      linkedSoIds: soIds,
      linkedDcIds: args.dcIds,
      linkedPoIds: [],
      linkedGrnIds: [],
      linkedDocuments: [
        ...dcs.map(docRef),
        ...allVouchers.filter((v) => soIds.includes(v.id)).map(docRef),
      ],
      lines,
      grandTotal: sumAmount(lines),
      narration: args.invoice.narration,
    };

    const nextAll = [...allVouchers, invoice];

    const linkedDocsToUpdate = allVouchers.filter(
      (v) => args.dcIds.includes(v.id) || soIds.includes(v.id),
    );

    const updates = linkedDocsToUpdate.map((doc) => {
      let workflowStatus = doc.workflowStatus || "open";

      if (soIds.includes(doc.id)) {
        workflowStatus = computeSalesOrderStatus(doc, nextAll);
      }

      if (args.dcIds.includes(doc.id)) {
        const pending = getDcsPendingBilling(nextAll, doc.partyId).some((d) => d.id === doc.id);
        workflowStatus = pending ? "partial" : "closed";
      }

      return {
        ...doc,
        workflowStatus,
        linkedDocuments: addLinkedDocument(doc, docRef(invoice)),
      };
    });

    await db.transaction("rw", db.vouchers, async () => {
      await db.vouchers.put(invoice as any);
      await db.invoices.put({ ...invoice } as any);
      await db.vouchers.bulkPut(updates as any);
    });

    set({ vouchers: await db.vouchers.toArray(), goodsReceiptNotes: await db.goodsReceiptNotes.toArray() });
    return invoice;
  },

  async createRejectionOutAgainstGrn(args: {
    grnId: string;
    rejection: Partial<WorkflowVoucher>;
    lines: WorkflowVoucherLine[];
  }) {
    const db = getDB();
    const allVouchers: WorkflowVoucher[] = (await db.vouchers.toArray()) as unknown as WorkflowVoucher[];
    const grn = allVouchers.find((v) => v.id === args.grnId);

    if (!grn) throw new Error("Linked GRN not found.");

    const poIds = grn.linkedPoIds || [];

    const rejection: WorkflowVoucher = {
      id: crypto.randomUUID(),
      type: "rejection-out",
      voucherNo: args.rejection.voucherNo,
      date: args.rejection.date!,
      dateNepali: args.rejection.dateNepali,
      partyId: args.rejection.partyId || grn.partyId,
      partyName: args.rejection.partyName || grn.partyName,
      status: "posted",
      workflowStatus: "closed",
      linkedPoIds: poIds,
      linkedGrnIds: [grn.id],
      linkedSoIds: [],
      linkedDcIds: [],
      linkedDocuments: [docRef(grn)],
      lines: args.lines,
      grandTotal: sumAmount(args.lines),
      narration: args.rejection.narration || `Rejection against ${docNoCompat(grn)}`,
    };

    const nextAll = [...allVouchers, rejection];

    const updates = allVouchers
      .filter((v) => v.id === grn.id || poIds.includes(v.id))
      .map((doc) => {
        let workflowStatus = doc.workflowStatus || "open";

        if (poIds.includes(doc.id)) {
          workflowStatus = computePurchaseOrderStatus(doc, nextAll);
        }

        if (doc.id === grn.id) {
          workflowStatus = "partial";
        }

        return {
          ...doc,
          workflowStatus,
          linkedDocuments: addLinkedDocument(doc, docRef(rejection)),
        };
      });

    await db.transaction("rw", db.vouchers, async () => {
      await db.vouchers.put(rejection as any);
      await db.vouchers.bulkPut(updates as any);
    });

    set({ vouchers: await db.vouchers.toArray(), goodsReceiptNotes: await db.goodsReceiptNotes.toArray() });
    return rejection;
  },
});
