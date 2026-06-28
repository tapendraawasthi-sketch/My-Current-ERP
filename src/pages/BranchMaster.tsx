// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import toast from "react-hot-toast";
import { Building2, Plus, Edit2, Trash2, CheckCircle, XCircle, MapPin, Phone, User, Mail } from "lucide-react";

const BORDER = "1px solid #000";
const BG = "#E4F1D9";
const BG_CARD = "#EBF5E2";
const BG_HEADER = "#D4EABD";
const BG_DEEP = "#C9DEB5";

const NEPAL_PROVINCES = [
  "Koshi",
  "Madhesh",
  "Bagmati",
  "Gandaki",
  "Lumbini",
  "Karnali",
  "Sudurpashchim"
];

const BRANCH_TYPES = [
  "Head Office",
  "Regional Branch",
  "Sales Outlet",
  "Godown",
  "Manufacturing Unit"
];

export default function BranchMaster() {
  const { warehouses, costCenters, vouchers, invoices, employees } = useStore();
  const [branches, setBranches] = useState([]);
  const [filteredBranches, setFilteredBranches] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    nameNepali: "",
    type: "Regional Branch",
    province: "Bagmati",
    district: "",
    city: "",
    wardNo: "",
    address: "",
    postalCode: "",
    phone: "",
    mobile: "",
    email: "",
    manager: "",
    warehouseId: "",
    costCenterId: "",
    openingDate: new Date().toISOString().split('T')[0],
    isActive: true,
    notes: ""
  });

  // Load branches from DB
  useEffect(() => {
    const db = getDB();
    db.branches.toArray()
      .then(setBranches)
      .catch(() => setBranches([]));
  }, []);

  // Update filtered branches when search changes
  useEffect(() => {
    const filtered = branches.filter(branch => 
      branch.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branch.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredBranches(filtered);
  }, [branches, searchTerm]);

  const handleInputChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const clearForm = () => {
    setForm({
      code: "",
      name: "",
      nameNepali: "",
      type: "Regional Branch",
      province: "Bagmati",
      district: "",
      city: "",
      wardNo: "",
      address: "",
      postalCode: "",
      phone: "",
      mobile: "",
      email: "",
      manager: "",
      warehouseId: "",
      costCenterId: "",
      openingDate: new Date().toISOString().split('T')[0],
      isActive: true,
      notes: ""
    });
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.code.trim()) { 
      toast.error("Branch Code is required"); 
      return; 
    }
    if (!form.name.trim()) { 
      toast.error("Branch Name is required"); 
      return; 
    }
    // Check duplicate code
    const existing = branches.find(b => b.code.toUpperCase() === form.code.toUpperCase() && b.id !== editingId);
    if (existing) { 
      toast.error("Branch code already exists"); 
      return; 
    }
    
    const db = getDB();
    const branchData = { ...form, code: form.code.toUpperCase(), updatedAt: new Date().toISOString() };
    
    try {
      if (editingId) {
        await db.branches.update(editingId, branchData);
        toast.success("Branch updated successfully");
      } else {
        await db.branches.put({ id: generateId(), ...branchData, createdAt: new Date().toISOString() });
        toast.success("Branch created successfully");
      }
      
      // Reload branches
      const updatedBranches = await db.branches.toArray();
      setBranches(updatedBranches);
      setFilteredBranches(updatedBranches);
      clearForm();
    } catch (error) {
      console.error("Error saving branch:", error);
      toast.error("Failed to save branch");
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    
    if (!window.confirm("Are you sure you want to delete this branch?")) {
      return;
    }
    
    try {
      const db = getDB();
      await db.branches.delete(editingId);
      toast.success("Branch deleted successfully");
      
      const updatedBranches = await db.branches.toArray();
      setBranches(updatedBranches);
      setFilteredBranches(updatedBranches);
      clearForm();
    } catch (error) {
      console.error("Error deleting branch:", error);
      toast.error("Failed to delete branch");
    }
  };

  const handleEdit = (branch) => {
    setForm({
      code: branch.code,
      name: branch.name,
      nameNepali: branch.nameNepali || "",
      type: branch.type || "Regional Branch",
      province: branch.province || "Bagmati",
      district: branch.district || "",
      city: branch.city || "",
      wardNo: branch.wardNo || "",
      address: branch.address || "",
      postalCode: branch.postalCode || "",
      phone: branch.phone || "",
      mobile: branch.mobile || "",
      email: branch.email || "",
      manager: branch.manager || "",
      warehouseId: branch.warehouseId || "",
      costCenterId: branch.costCenterId || "",
      openingDate: branch.openingDate || new Date().toISOString().split('T')[0],
      isActive: branch.isActive !== undefined ? branch.isActive : true,
      notes: branch.notes || ""
    });
    setEditingId(branch.id);
  };

  const handleSetAsDefault = (branchId) => {
    localStorage.setItem("erp_default_branch", branchId);
    toast.success("Default branch set successfully");
  };

  // Calculate branch statistics
  const getBranchStats = (branchId) => {
    const branchVouchers = vouchers.filter(v => v.branchId === branchId);
    const branchInvoices = invoices.filter(i => i.branchId === branchId);
    const branchEmployees = employees.filter(e => e.branchId === branchId);
    
    return {
      totalVouchers: branchVouchers.length,
      totalSales: branchInvoices.reduce((sum, inv) => sum + (inv.type === 'sales-invoice' ? inv.grandTotal : 0), 0),
      totalPurchase: branchInvoices.reduce((sum, inv) => sum + (inv.type === 'purchase-invoice' ? inv.grandTotal : 0), 0),
      activeEmployees: branchEmployees.filter(e => e.isActive).length,
      linkedWarehouses: warehouses.filter(w => w.branchId === branchId)
    };
  };

  return (
    <div style={{ backgroundColor: BG, minHeight: '100vh', display: 'flex' }}>
      {/* Left Panel */}
      <div style={{ width: '260px', backgroundColor: BG_CARD, borderRight: BORDER, padding: '15px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ backgroundColor: BG_HEADER, padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 'bold', color: '#000000', margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Building2 size={16} />
            BRANCHES
          </h2>
        </div>
        
        <button
          onClick={() => {
            clearForm();
            setEditingId(null);
          }}
          style={{
            backgroundColor: '#1557b0',
            color: 'white',
            border: BORDER,
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginBottom: '15px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <Plus size={14} />
          ADD NEW BRANCH
        </button>
        
        <div style={{ marginBottom: '15px' }}>
          <input
            type="text"
            placeholder="Search branches..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '6px', border: BORDER, borderRadius: '4px', fontSize: '12px' }}
          />
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredBranches.map(branch => (
            <div
              key={branch.id}
              onClick={() => handleEdit(branch)}
              style={{
                padding: '10px',
                border: BORDER,
                borderRadius: '4px',
                marginBottom: '5px',
                backgroundColor: editingId === branch.id ? BG_HEADER : 'transparent',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#000000' }}>{branch.code}</div>
                  <div style={{ fontSize: '11px', color: '#000000' }}>{branch.name}</div>
                </div>
                <div>
                  <span style={{
                    backgroundColor: branch.isActive ? '#059669' : '#dc2626',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                  }}>
                    {branch.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Right Panel */}
      <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        <div style={{ backgroundColor: BG_CARD, padding: '20px', borderRadius: '8px', border: BORDER }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#000000', marginBottom: '20px' }}>
            {editingId ? 'Edit Branch' : 'Add New Branch'}
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>Branch Code*</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
                maxLength={10}
                style={{ width: '100%', padding: '6px', border: BORDER, borderRadius: '4px', fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>Branch Name*</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                style={{ width: '100%', padding: '6px', border: BORDER, borderRadius: '4px', fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>Branch Name (Nepali)</label>
              <input
                type="text"
                value={form.nameNepali}
                onChange={(e) => handleInputChange('nameNepali', e.target.value)}
                style={{ width: '100%', padding: '6px', border: BORDER, borderRadius: '4px', fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>Branch Type</label>
              <select
                value={form.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
                style={{ width: '100%', padding: '6px', border: BORDER, borderRadius: '4px', fontSize: '12px' }}
              >
                {BRANCH_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>Province</label>
              <select
                value={form.province}
                onChange={(e) => handleInputChange('province', e.target.value)}
                style={{ width: '100%', padding: '6px', border: BORDER, borderRadius: '4px', fontSize: '12px' }}
              >
                {NEPAL_PROVINCES.map(prov => (
                  <option key={prov} value={prov}>{prov}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>District</label>
              <input
                type="text"
                value={form.district}
                onChange={(e) => handleInputChange('district', e.target.value)}
                style={{ width: '100%', padding: '6px', border: BORDER, borderRadius: '4px', fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>City/Municipality</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                style={{ width: '100%', padding: '6px', border: BORDER, borderRadius: '4px', fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>Ward No</label>
              <input
                type="text"
                value={form.wardNo}
                onChange={(e) => handleInputChange('wardNo', e.target.value)}
                style={{ width: '100%', padding: '6px', border: BORDER, borderRadius: '4px', fontSize: '12px' }}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>Full Address</label>
              <textarea
                value={form.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '6px', border: BORDER, borderRadius: '4px', fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>Postal Code</label>
              <input
                type="text"
                value={form.postalCode}
                onChange={(e) => handleInputChange('postalCode', e.target.value)}
                style={{ width: '100%', padding: '6px', border: BORDER, borderRadius: '4px', fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                style={{ width: '100%', padding: '6px', border: BORDER, borderRadius: '4px', fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>Mobile</label>
              <input
                type="text"
                value={form.mobile}
                onChange={(e) => handleInputChange('mobile', e.target.value)}
                style={{ width: '100%', padding: '6px', border: BORDER, borderRadius: '4px', fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>Email</label>
              <input
                type="text"
                value={form.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                style={{ width: '100%', padding: '6px', border: BORDER, borderRadius: '4px', fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>Branch Manager</label>
              <input
                type="text"
                value={form.manager}
                onChange={(e) => handleInputChange('manager', e.target.value)}
                style={{ width: '100%', padding: '6px', border: BORDER, borderRadius: '4px', fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>Linked Warehouse</label>
              <select
                value={form.warehouseId}
                onChange={(e) => handleInputChange('warehouseId', e.target.value)}
                style={{ width: '100%', padding: '6px', border: BORDER, borderRadius: '4px', fontSize: '12px' }}
              >
                <option value="">Select Warehouse</option>
                {warehouses.map(wh => (
                  <option key={wh.id} value={wh.id}>{wh.code} - {wh.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>Default Cost Center</label>
              <select
                value={form.costCenterId}
                onChange={(e) => handleInputChange('costCenterId', e.target.value)}
                style={{ width: '100%', padding: '6px', border: BORDER, borderRadius: '4px', fontSize: '12px' }}
              >
                <option value="">Select Cost Center</option>
                {costCenters.map(cc => (
                  <option key={cc.id} value={cc.id}>{cc.code} - {cc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>Opening Date</label>
              <input
                type="date"
                value={form.openingDate}
                onChange={(e) => handleInputChange('openingDate', e.target.value)}
                style={{ width: '100%', padding: '6px', border: BORDER, borderRadius: '4px', fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>Is Active</label>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => handleInputChange('isActive', e.target.checked)}
                style={{ marginRight: '5px' }}
              />
              Active
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>Notes/Description</label>
              <textarea
                value={form.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '6px', border: BORDER, borderRadius: '4px', fontSize: '12px' }}
              />
            </div>
          </div>
          
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              onClick={clearForm}
              style={{
                backgroundColor: BG_HEADER,
                color: '#000000',
                border: BORDER,
                padding: '6px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              CLEAR
            </button>
            <button
              onClick={handleSave}
              style={{
                backgroundColor: '#1557b0',
                color: 'white',
                border: BORDER,
                padding: '6px 20px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              SAVE
            </button>
            {editingId && (
              <button
                onClick={handleDelete}
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: BORDER,
                  padding: '6px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                DELETE
              </button>
            )}
          </div>
        </div>
        
        {/* Branch Statistics */}
        {editingId && (
          <div style={{ marginTop: '20px', backgroundColor: BG_CARD, padding: '20px', borderRadius: '8px', border: BORDER }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#000000', marginBottom: '15px' }}>
              Branch Statistics
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div style={{ backgroundColor: BG_HEADER, padding: '15px', borderRadius: '6px', border: BORDER }}>
                <div style={{ fontSize: '12px', color: '#000000', marginBottom: '5px' }}>Total Vouchers</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#000000' }}>
                  {getBranchStats(editingId).totalVouchers}
                </div>
              </div>
              <div style={{ backgroundColor: BG_HEADER, padding: '15px', borderRadius: '6px', border: BORDER }}>
                <div style={{ fontSize: '12px', color: '#000000', marginBottom: '5px' }}>Total Sales</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#000000' }}>
                  {getBranchStats(editingId).totalSales.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ backgroundColor: BG_HEADER, padding: '15px', borderRadius: '6px', border: BORDER }}>
                <div style={{ fontSize: '12px', color: '#000000', marginBottom: '5px' }}>Total Purchase</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#000000' }}>
                  {getBranchStats(editingId).totalPurchase.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ backgroundColor: BG_HEADER, padding: '15px', borderRadius: '6px', border: BORDER }}>
                <div style={{ fontSize: '12px', color: '#000000', marginBottom: '5px' }}>Active Employees</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#000000' }}>
                  {getBranchStats(editingId).activeEmployees}
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: '15px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#000000', marginBottom: '5px' }}>Linked Warehouses</div>
              <div>
                {getBranchStats(editingId).linkedWarehouses.length > 0 ? (
                  getBranchStats(editingId).linkedWarehouses.map(wh => (
                    <span key={wh.id} style={{ display: 'inline-block', marginRight: '10px', padding: '4px 8px', backgroundColor: BG_DEEP, borderRadius: '4px', fontSize: '11px' }}>
                      {wh.name}
                    </span>
                  ))
                ) : (
                  <span style={{ color: '#666', fontSize: '11px' }}>No warehouses linked to this branch</span>
                )}
              </div>
            </div>
            
            <div style={{ marginTop: '15px' }}>
              <button
                onClick={() => handleSetAsDefault(editingId)}
                style={{
                  backgroundColor: '#059669',
                  color: 'white',
                  border: BORDER,
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                SET AS DEFAULT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
