// @ts-nocheck
import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { computeOutstandingReceivables } from "../lib/accounting";
import { computeAllStockPositions } from "../lib/stockUtils";
import { formatNumber, dateToAD } from "../lib/utils";
import { formatADToBS, getDaysInNepaliMonth } from "../lib/nepaliDate";
import Card from "./ui/Card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase text-right">Current Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stockAlerts.length === 0 ? (
                  <tr><td colSpan={2} className="text-center py-4 text-[12px] text-gray-500">Stock levels healthy</td></tr>
                ) : (
                  stockAlerts.map(alert => (
                    <tr key={alert.id} className="hover:bg-red-50/30">
                      <td className="px-3 py-2">
                         <div className="text-[12px] font-semibold text-gray-800">{alert.name}</div>
                         <div className="text-[10px] text-gray-500">Reorder: {alert.reorderLevel} {alert.unit}</div>
                      </td>
                      <td className="px-3 py-2 text-right">
                         <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${alert.qty === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                           {alert.qty} {alert.unit}
                         </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Key Compliance Dates */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="bg-indigo-50 px-3 py-2.5 border-b border-indigo-100 flex justify-between items-center">
            <h3 className="text-[13px] font-bold text-indigo-800 flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Compliance Deadlines
            </h3>
          </div>
          <div className="flex-1 overflow-x-auto p-3">
             <div className="space-y-3">
               {complianceDates.map(cd => (
                 <div key={cd.name} className="border border-indigo-100 rounded-md p-3 bg-white shadow-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[12px] font-bold text-gray-700 flex items-center gap-1.5">
                         <FileCheck className="w-3.5 h-3.5 text-indigo-500" /> {cd.name}
                      </span>
                      <span className={`text-[13px] font-bold font-mono ${cd.date < todayBS ? 'text-red-600' : 'text-indigo-700'}`}>{cd.date}</span>
                    </div>
                    <div className="text-[10px] font-medium text-gray-500 ml-5">
                      Deadline in BS Date
                    </div>
                 </div>
               ))}
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;

