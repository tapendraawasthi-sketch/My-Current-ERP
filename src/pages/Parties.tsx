import React from "react";
import { PillTitle, FormPanel } from "../components/BusyShell";

const Parties: React.FC = () => (
  <div style={{ background: "#e8e4f0", padding: 12 }}>
    <PillTitle title="Parties Directory" />
    <FormPanel>
      <div className="p-6 text-sm text-gray-500">Parties page placeholder</div>
    </FormPanel>
  </div>
);
export default Parties;
