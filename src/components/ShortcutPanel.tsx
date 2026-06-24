import React, { useState } from "react";
import { Keyboard, Save, X, Edit2, Check } from "lucide-react";
import toast from "react-hot-toast";
import { useKeyboardShortcuts, Shortcut } from "../hooks/useKeyboardShortcuts";

export default function ShortcutPanel() {
  const { rawShortcuts, setShortcuts, showHelp, setShowHelp } = useKeyboardShortcuts();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCombo, setEditCombo] = useState("");
  const [saving, setSaving] = useState(false);

  if (!showHelp) return null;

  const handleEdit = (s: Shortcut) => {
    setEditingId(s.id);
    setEditCombo(s.key_combo);
  };

  const handleSave = async (id: number) => {
    try {
      setSaving(true);
      const res = await fetch(`/api/shortcuts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_combo: editCombo })
      });
      const json = await res.json();
      if (json.success) {
        setShortcuts(prev => prev.map(s => s.id === id ? { ...s, key_combo: editCombo } : s));
        setEditingId(null);
        toast.success("Shortcut updated");
      } else {
        toast.error(json.error || "Failed to update shortcut");
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (s: Shortcut) => {
    try {
      const res = await fetch(`/api/shortcuts/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !s.is_active })
      });
      const json = await res.json();
      if (json.success) {
        setShortcuts(prev => prev.map(item => item.id === s.id ? { ...item, is_active: !s.is_active } : item));
        toast.success(`Shortcut ${!s.is_active ? 'enabled' : 'disabled'}`);
      } else {
        toast.error(json.error || "Failed to toggle shortcut");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  // Group by category
  const categories = Array.from(new Set(rawShortcuts.map(s => s.category)));

  return (
    <>
      <button
        onClick={() => setShowHelp(!showHelp)}
        className="fixed bottom-6 right-6 bg-[#1557b0] text-white rounded-full p-3 shadow-lg hover:bg-[#0f4a96] z-40 cursor-pointer"
        title="Keyboard Shortcuts (Press ? to toggle)"
      >
        <Keyboard className="w-6 h-6" />
      </button>

      {showHelp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col border border-gray-200 shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-[#1557b0]" /> Keyboard Shortcuts Settings
              </h2>
              <button
                onClick={() => setShowHelp(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-5">
              {categories.map(cat => (
                <div key={cat} className="mb-6">
                  <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-widest mb-3 border-b border-gray-100 pb-1">{cat}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {rawShortcuts.filter(s => s.category === cat).map(shortcut => (
                      <div
                        key={shortcut.id}
                        className={`flex flex-col p-3 rounded-md border transition-colors ${shortcut.is_active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-75'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[12px] font-medium ${shortcut.is_active ? 'text-gray-800' : 'text-gray-500 line-through'}`}>
                            {shortcut.label}
                          </span>
                          <label className="flex items-center cursor-pointer">
                            <div className="relative">
                              <input 
                                type="checkbox" 
                                className="sr-only" 
                                checked={shortcut.is_active}
                                onChange={() => handleToggleActive(shortcut)}
                              />
                              <div className={`block w-8 h-4 rounded-full transition-colors ${shortcut.is_active ? 'bg-[#1557b0]' : 'bg-gray-300'}`}></div>
                              <div className={`dot absolute left-1 top-1 bg-white w-2 h-2 rounded-full transition-transform ${shortcut.is_active ? 'transform translate-x-4' : ''}`}></div>
                            </div>
                          </label>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-auto">
                          {editingId === shortcut.id ? (
                            <div className="flex w-full gap-1">
                              <input 
                                type="text" 
                                value={editCombo} 
                                onChange={(e) => setEditCombo(e.target.value)}
                                className="flex-1 h-7 px-2 text-[11px] font-mono border border-[#1557b0] rounded focus:outline-none focus:ring-1 focus:ring-[#1557b0]"
                                placeholder="e.g. Ctrl+Shift+N"
                              />
                              <button 
                                onClick={() => handleSave(shortcut.id)}
                                disabled={saving}
                                className="h-7 w-7 flex items-center justify-center bg-[#1557b0] text-white rounded hover:bg-[#0f4a96]"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => setEditingId(null)}
                                className="h-7 w-7 flex items-center justify-center bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex w-full justify-between items-center group">
                              <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-[11px] font-mono text-gray-700 shadow-sm">
                                {shortcut.key_combo}
                              </kbd>
                              <button 
                                onClick={() => handleEdit(shortcut)}
                                className="text-gray-400 hover:text-[#1557b0] opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 bg-gray-50 border-t border-gray-200 text-[11px] text-gray-500 flex justify-between items-center">
              <span>Press <b>?</b> to toggle this panel</span>
              <span>Supported modifiers: Ctrl, Alt, Shift</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
