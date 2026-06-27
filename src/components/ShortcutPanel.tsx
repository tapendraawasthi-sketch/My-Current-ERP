import React, { useState } from "react";
import { Keyboard, Save, X, Edit2, Check } from "lucide-react";
import toast from "react-hot-toast";
import { useKeyboardShortcuts, Shortcut } from "../hooks/useKeyboardShortcuts";
import { getDB } from "../lib/db";

export default function ShortcutPanel() {
  const { rawShortcuts, setShortcuts, showHelp, setShowHelp } = useKeyboardShortcuts();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCombo, setEditCombo] = useState("");
  const [saving, setSaving] = useState(false);


  const handleEdit = (s: Shortcut) => {
    setEditingId(s.id);
    setEditCombo(s.key_combo);
  };

  const handleSave = async (id: number) => {
    try {
      setSaving(true);
      const db = getDB();
      await db.shortcuts.update(id, { key_combo: editCombo });
      setShortcuts(prev => prev.map(s => s.id === id ? { ...s, key_combo: editCombo } : s));
      setEditingId(null);
      toast.success("Shortcut updated");
    } catch (err) {
      toast.error("Failed to update shortcut");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (s: Shortcut) => {
    try {
      const db = getDB();
      await db.shortcuts.update(s.id, { is_active: !s.is_active });
      setShortcuts(prev => prev.map(item => item.id === s.id ? { ...item, is_active: !s.is_active } : item));
      toast.success(`Shortcut ${!s.is_active ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error("Failed to toggle shortcut");
    }
  };

  // Group by category
  const categories = Array.from(new Set(rawShortcuts.map(s => s.category)));

  return (
    <>
      <button
        onClick={() => setShowHelp(!showHelp)}
        className="fixed bottom-6 right-6 bg-[#3D6B25] text-white rounded-full p-3 shadow-lg hover:bg-[#2D5A1A] z-40 cursor-pointer"
        title="Keyboard Shortcuts (Press ? to toggle)"
      >
        <Keyboard className="w-6 h-6" />
      </button>

      {showHelp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col border border-[#9DC07A] shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#9DC07A] bg-[#EBF5E2]">
              <h2 className="text-[15px] font-semibold text-[#000000] flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-[#1557b0]" /> Keyboard Shortcuts Settings
              </h2>
              <button
                onClick={() => setShowHelp(false)}
                className="text-[#000000] hover:text-[#000000]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-5">
              {categories.map(cat => (
                <div key={cat} className="mb-6">
                  <h3 className="text-[12px] font-bold text-[#000000] uppercase tracking-widest mb-3 border-b border-[#9DC07A] pb-1">{cat}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {rawShortcuts.filter(s => s.category === cat).map(shortcut => (
                      <div
                        key={shortcut.id}
                        className={`flex flex-col p-3 rounded-md border transition-colors ${shortcut.is_active ? 'bg-white border-[#9DC07A]' : 'bg-[#EBF5E2] border-[#9DC07A] opacity-75'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[12px] font-medium ${shortcut.is_active ? 'text-[#000000]' : 'text-[#000000] line-through'}`}>
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
                              <div className={`block w-8 h-4 rounded-full transition-colors ${shortcut.is_active ? 'bg-[#3D6B25]' : 'bg-[#EBF5E2]'}`}></div>
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
                                className="h-7 w-7 flex items-center justify-center bg-[#3D6B25] text-white rounded hover:bg-[#2D5A1A]"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => setEditingId(null)}
                                className="h-7 w-7 flex items-center justify-center bg-[#EBF5E2] text-[#000000] rounded hover:bg-[#EBF5E2]"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex w-full justify-between items-center group">
                              <kbd className="px-2 py-1 bg-[#EBF5E2] border border-[#9DC07A] rounded text-[11px] font-mono text-[#000000] shadow-sm">
                                {shortcut.key_combo}
                              </kbd>
                              <button 
                                onClick={() => handleEdit(shortcut)}
                                className="text-[#000000] hover:text-[#1557b0] opacity-0 group-hover:opacity-100 transition-opacity"
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
            
            <div className="p-4 bg-[#EBF5E2] border-t border-[#9DC07A] text-[11px] text-[#000000] flex justify-between items-center">
              <span>Press <b>?</b> to toggle this panel</span>
              <span>Supported modifiers: Ctrl, Alt, Shift</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
