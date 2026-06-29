// @ts-nocheck
import React from "react";
import { Building2, CheckCircle, Shield, FileText } from "lucide-react";

export default function AuthBrandingPanel() {
  return (
    <div
      className="flex-1 p-12 flex-col justify-between hidden lg:flex"
      style={{ background: "#E4F1D9", color: "#1f2937" }}
    >
      <div>
        <div className="flex items-center space-x-3 mb-12">
          <Building2 className="w-10 h-10" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#1f2937" }}>
              Sutra ERP
            </h1>
            <p className="text-sm mt-1" style={{ color: "#1f2937" }}>
              Professional Accounting for Nepal
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-semibold mb-4" style={{ color: "#1f2937" }}>
            Why Choose Sutra ERP?
          </h2>

          <div className="flex items-start space-x-3">
            <CheckCircle className="w-6 h-6 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold" style={{ color: "#1f2937" }}>
                Nepal-First Design
              </h3>
              <p className="text-sm" style={{ color: "#1f2937" }}>
                Built specifically for Nepali businesses with BS date support, VAT compliance, and
                IRD integration
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <FileText className="w-6 h-6 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold" style={{ color: "#1f2937" }}>
                Complete Accounting
              </h3>
              <p className="text-sm" style={{ color: "#1f2937" }}>
                Journal entries, invoicing, inventory management, multi-currency support, and
                comprehensive reporting
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Shield className="w-6 h-6 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold" style={{ color: "#1f2937" }}>
                Secure &amp; Reliable
              </h3>
              <p className="text-sm" style={{ color: "#1f2937" }}>
                Role-based access control, audit logs, data encryption, and automated backups
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="text-sm" style={{ color: "#1f2937" }}>
        Version 2.0 | © 2025 Sutra ERP | All rights reserved
      </div>
    </div>
  );
}
