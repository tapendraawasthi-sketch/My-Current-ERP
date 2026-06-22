/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CBMSConfig {
  clientId: string;
  clientSecret: string;
  environment: "sandbox" | "production";
}

export async function submitToCBMS(
  invoice: {
    billNo: string;
    billDate: string;
    partyName: string;
    partyPAN?: string;
    taxableAmount: number;
    vatAmount: number;
    grandTotal: number;
    items: Array<{ description: string; qty: number; rate: number; amount: number }>;
  },
  config: CBMSConfig,
): Promise<{ success: boolean; referenceNo?: string; error?: string }> {
  const baseUrl =
    config.environment === "production"
      ? "https://cbms.ird.gov.np/api/v1"
      : "https://sandbox.cbms.ird.gov.np/api/v1";
  try {
    const res = await fetch(`${baseUrl}/invoice/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.clientSecret}`,
      },
      body: JSON.stringify(invoice),
    });
    const data = await res.json();
    return res.ok
      ? { success: true, referenceNo: data.referenceNo }
      : { success: false, error: data.message };
  } catch {
    return { success: false, error: "Network error" };
  }
}
