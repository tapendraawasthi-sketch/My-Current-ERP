// @ts-nocheck
import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { Settings } from "lucide-react";

type Tab = "units" | "warehouses" | "tax-categories" | "bill-sundry" | "narrations";

export default function MiscMasters() {
  const store = useStore();
  const units = store.units || [];
  const warehouses = store.warehouses || [];
  const taxCategories = (store as any).taxCategories || [];
  const billSundries = (store as any).billSundryMasters || [];
  const narrations = (store as any).standardNarrations || [];

  const [tab, setTab] = useState<Tab>("units");

  const tabs: { id: Tab; label: string }[] = [
    { id: "units", label: "Units" },
    { id: "warehouses", label: "Warehouses" },
    { id: "tax-categories", label: "Tax Categories" },
    { id: "bill-sundry", label: "Bill Sundries" },
    { id: "narrations", label: "Narrations" },
  ];

  const th = "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
  const td = "px-3 py-2.5 text-[12px] text-gray-700";

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <Settings className="h-4 w-4 text-[#1557b0]" />
            Misc Masters
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Units, Warehouses, Tax Categories, Bill Sundries, Narrations
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-white border border-gray-200 rounded-lg p-1 w-fit shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`h-7 px-3 text-[11px] font-medium rounded transition-colors ${
              tab === t.id
                ? "bg-[#1557b0] text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        {tab === "units" && (
          <table className="w-full">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className={th}>Code</th>
                <th className={th}>Name</th>
                <th className={th}>Type</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u: any) => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className={`${td} font-mono`}>{u.code}</td>
                  <td className={td}>{u.name}</td>
                  <td className={td}>{u.type || "—"}</td>
                  <td className={td}>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${u.isActive ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-50 text-gray-500 border border-gray-200"}`}>
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
              {units.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-[12px] text-gray-400">No units found.</td></tr>
              )}
            </tbody>
          </table>
        )}

        {tab === "warehouses" && (
          <table className="w-full">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className={th}>Name</th>
                <th className={th}>Address</th>
                <th className={th}>Contact</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w: any) => (
                <tr key={w.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className={`${td} font-medium`}>{w.name}</td>
                  <td className={td}>{w.address || "—"}</td>
                  <td className={td}>{w.contactPerson || "—"}</td>
                  <td className={td}>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${w.isActive ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-50 text-gray-500 border border-gray-200"}`}>
                      {w.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
              {warehouses.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-[12px] text-gray-400">No warehouses found.</td></tr>
              )}
            </tbody>
          </table>
        )}

        {tab === "tax-categories" && (
          <table className="w-full">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className={th}>Name</th>
                <th className={th}>Rate %</th>
                <th className={th}>Type</th>
              </tr>
            </thead>
            <tbody>
              {taxCategories.map((t: any) => (
                <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className={td}>{t.name}</td>
                  <td className={`${td} font-mono text-right`}>{t.rate ?? "—"}</td>
                  <td className={td}>{t.type || "—"}</td>
                </tr>
              ))}
              {taxCategories.length === 0 && (
                <tr><td colSpan={3} className="p-8 text-center text-[12px] text-gray-400">No tax categories found.</td></tr>
              )}
            </tbody>
          </table>
        )}

        {tab === "bill-sundry" && (
          <table className="w-full">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className={th}>Name</th>
                <th className={th}>Type</th>
                <th className={th}>Calculation</th>
                <th className={th}>Rate</th>
              </tr>
            </thead>
            <tbody>
              {billSundries.map((b: any) => (
                <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className={td}>{b.name}</td>
                  <td className={td}>{b.type}</td>
                  <td className={td}>{b.calculationType || "—"}</td>
                  <td className={`${td} font-mono text-right`}>{b.rate ?? "—"}</td>
                </tr>
              ))}
              {billSundries.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-[12px] text-gray-400">No bill sundries found.</td></tr>
              )}
            </tbody>
          </table>
        )}

        {tab === "narrations" && (
          <table className="w-full">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className={th}>Narration</th>
                <th className={th}>Voucher Type</th>
              </tr>
            </thead>
            <tbody>
              {narrations.map((n: any) => (
                <tr key={n.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className={td}>{n.narration}</td>
                  <td className={td}>{n.voucherType || "All"}</td>
                </tr>
              ))}
              {narrations.length === 0 && (
                <tr><td colSpan={2} className="p-8 text-center text-[12px] text-gray-400">No standard narrations found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
