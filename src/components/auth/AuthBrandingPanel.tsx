import React from "react";
import { CheckCircle, Shield, FileText } from "lucide-react";

export default function AuthBrandingPanel() {
  return (
    <div
      className="flex-1 p-12 flex-col justify-between hidden lg:flex"
      style={{
        background: "linear-gradient(145deg, #0f2444 0%, #1557b0 60%, #1a6bcc 100%)",
        color: "#ffffff",
      }}
    >
      <div>
        <div className="flex items-center space-x-3 mb-12">
          <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center font-bold text-[22px] text-white">
            S
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Sutra ERP</h1>
            <p className="text-sm mt-1 text-white/70">Professional Accounting for Nepal</p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold mb-4 text-white">Why Choose Sutra ERP?</h2>

          {[
            {
              icon: CheckCircle,
              title: "Nepal-First Design",
              desc: "Built specifically for Nepali businesses with BS date support, VAT compliance, and IRD integration",
            },
            {
              icon: FileText,
              title: "Complete Accounting",
              desc: "Journal entries, invoicing, inventory management, multi-currency support, and comprehensive reporting",
            },
            {
              icon: Shield,
              title: "Secure & Reliable",
              desc: "Role-based access control, audit logs, data encryption, and automated backups",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3 bg-white/10 rounded-lg p-3">
              <Icon className="w-5 h-5 flex-shrink-0 mt-0.5 text-white" />
              <div>
                <h3 className="font-semibold text-white text-[13px]">{title}</h3>
                <p className="text-[12px] text-white/70 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[11px] text-white/50">
        Version 2.0 | © 2025 Sutra ERP | All rights reserved
      </div>
    </div>
  );
}
