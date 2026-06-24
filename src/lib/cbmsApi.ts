// src/lib/cbmsApi.ts

export interface CBMSResponse {
  success: boolean;
  irn?: string;
  qrCode?: string;
  error?: string;
}

export async function submitToCBMS(
  invoice: any,
  companySettings: any
): Promise<CBMSResponse> {
  try {
    const apiUrl = companySettings?.cbmsApiUrl || "https://cbms.ird.gov.np/api";
    const apiKey = companySettings?.cbmsApiKey || "";

    if (!apiKey) {
      return { success: false, error: "CBMS API key not configured" };
    }

    const payload = {
      invoiceNo: invoice.invoiceNo,
      date: invoice.date,
      panNo: companySettings?.panNumber,
      buyerPan: invoice.partyPan,
      buyerName: invoice.partyName,
      taxableAmount: invoice.taxableAmount,
      vatAmount: invoice.vatAmount,
      grandTotal: invoice.grandTotal,
      items: (invoice.lines || []).map((l: any) => ({
        name: l.itemName,
        qty: l.qty,
        rate: l.rate,
        amount: l.totalAmount || l.netAmount,
      })),
    };

    const response = await fetch(`${apiUrl}/invoice/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: err || "CBMS submission failed" };
    }

    const data = await response.json();
    return {
      success: true,
      irn: data.irn || data.invoiceReferenceNumber,
      qrCode: data.qrCode,
    };
  } catch (err: any) {
    if (err.name === "TimeoutError") {
      return { success: false, error: "CBMS request timed out" };
    }
    return { success: false, error: err?.message || "CBMS network error" };
  }
}
