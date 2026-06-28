import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useF12Keyboard } from "../hooks/useF12Keyboard";
import Sidebar from "./Sidebar";
import { TitleBar, StatusBar, CommandHintBar, ShortcutSidebar } from "./BusyShell";
import BusyMenuBar from "./BusyMenuBar";
import TopMenuBar from "./topbar/TopMenuBar";
import { useIsMobile } from "../hooks/use-mobile";
import { Menu, X, Home, Users, Package, FileText, Settings, Calculator, BarChart3, FileStack, Banknote, CreditCard, ShoppingCart, Receipt, Building2, Briefcase, TrendingUp, PieChart, FolderOpen, UserRound, Globe, Calendar, Clock, AlertTriangle, FileSpreadsheet, Warehouse, Truck, NotebookTabs, MessageSquare, Shield, Key, Monitor, Laptop, Smartphone, Tablet, Watch, Camera, Headphones, Gamepad2, Radio, Speaker, Mic, Video, Image, File, Folder, FolderKanban, FolderLock, FolderSearch, FolderGit, FolderArchive, FolderInput, FolderOutput, FolderClock, FolderHeart, FolderStar, FolderX, FolderPlus, FolderMinus, FolderSymlink, FolderClosed, FolderDot, FolderOpenDot, FolderRoot, FolderTree, FolderSync, FolderUp, FolderDown, FolderArchiveX, FolderArchivePlus, FolderArchiveMinus, FolderArchiveOpen, FolderArchiveClosed, FolderArchiveDot, FolderArchiveOpenDot, FolderArchiveRoot, FolderArchiveTree, FolderArchiveSync, FolderArchiveUp, FolderArchiveDown, FolderArchiveHeart, FolderArchiveStar, FolderArchiveSymlink } from "lucide-react";

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isDbReady, login } = useStore();
  const { handleShortcut } = useKeyboardShortcuts();
  const { isF12Active } = useF12Keyboard();
  const isMobile = useIsMobile();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const SHELL = {
    bg:       "#f5f6fa",
    card:     "#ffffff",
    muted:    "#f3f4f6",
    hover:    "#e8f1ff",
    border:   "#e5e7eb",
    text:     "#1f2937",
    sideBg:   "#1e2433",
    sideBorder: "#2d3748",
  };

  const handleSidebarShortcut = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key >= "1" && key <= "9") {
        e.preventDefault();
        const index = parseInt(key) - 1;
        handleShortcut(index);
      }
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleSidebarShortcut);
    return () => window.removeEventListener("keydown", handleSidebarShortcut);
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      await login(username, password);
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (!isDbReady) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", background: SHELL.bg }}>
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}>
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}>
            <div style={{
              width: 120,
              height: 120,
              background: "#1557b0",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <div style={{
                fontSize: 28,
                fontWeight: 700,
                color: "#ffffff",
              }}>
                S
              </div>
            </div>
            <div style={{
              textAlign: "center",
            }}>
              <div style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#1f2937",
                letterSpacing: "1px",
                marginBottom: 4,
              }}>
                Sutra ERP
              </div>
              <div style={{
                fontSize: 12,
                color: "#6b7280",
              }}>
                Initializing database...
              </div>
            </div>
          </div>
          <div style={{
            display: "flex",
            gap: 6,
          }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  background: "#1557b0",
                  borderRadius: "50%",
                  animation: "bounce 1.2s infinite",
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", background: SHELL.bg }}>
        <div style={{
          width: 420,
          background: SHELL.sideBg,
          borderRight: `1px solid ${SHELL.sideBorder}`,
          padding: 40,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }} className="hidden lg:flex">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48 }}>
              <div style={{
                width: 40,
                height: 40,
                background: "#1557b0",
                border: "none",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 20,
                color: "#fff",
              }}>
                S
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 20, color: "#ffffff" }}>
                  Sutra ERP
                </div>
                <div style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#94a3b8",
                }}>
                  Nepal's Professional Accounting Solution
                </div>
              </div>
            </div>
            
            <div style={{ color: "#ffffff", fontSize: 14, lineHeight: 1.6 }}>
              <p>Streamline your business operations with our comprehensive ERP solution designed specifically for Nepal's unique requirements.</p>
              <p style={{ marginTop: 16 }}>Compliant with IRD regulations and built for local businesses.</p>
            </div>
          </div>
          
          <div style={{ color: "#6b7280", fontSize: 12 }}>
            © 2081 B.S. Sutra Software Pvt. Ltd. · Kathmandu, Nepal
          </div>
        </div>

        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}>
          <div style={{ width: "100%", maxWidth: 360 }}>
            <div style={{
              background: SHELL.card,
              border: `1px solid ${SHELL.border}`,
              borderRadius: 8,
              padding: 32,
            }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: SHELL.text,
                  marginBottom: 4,
                }}>
                  Sign In
                </div>
                <div style={{
                  fontSize: 13,
                  color: "#6b7280",
                }}>
                  Access your Sutra ERP account
                </div>
              </div>

              <form onSubmit={handleLoginSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#374151",
                    marginBottom: 6,
                  }}>
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{
                      width: "100%",
                      height: 36,
                      padding: "0 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 4,
                      fontSize: 13,
                      color: SHELL.text,
                      backgroundColor: "#ffffff",
                    }}
                    required
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#374151",
                    marginBottom: 6,
                  }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: "100%",
                      height: 36,
                      padding: "0 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 4,
                      fontSize: 13,
                      color: SHELL.text,
                      backgroundColor: "#ffffff",
                    }}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  style={{
                    width: "100%",
                    height: 38,
                    backgroundColor: "#1557b0",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: isLoggingIn ? "not-allowed" : "pointer",
                  }}
                  className="hover:bg-[#0f4a96]"
                >
                  {isLoggingIn ? "Authorizing..." : "Authorize Entry"}
                </button>
              </form>

              <div style={{
                marginTop: 20,
                textAlign: "center",
                fontSize: 11,
                color: "#6b7280",
              }}>
                All activities are logged for compliance.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isMobile) {
    const navigationItems = [
      { icon: Home, label: "Home", path: "/" },
      { icon: Users, label: "Parties", path: "/parties" },
      { icon: Package, label: "Items", path: "/items" },
      { icon: FileText, label: "Vouchers", path: "/vouchers" },
      { icon: Calculator, label: "Ledger", path: "/ledger" },
      { icon: BarChart3, label: "Reports", path: "/reports" },
      { icon: Settings, label: "Settings", path: "/settings" },
    ];

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: SHELL.sideBg }}>
        {/* Mobile Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          height: 48,
          background: SHELL.sideBg,
          borderBottom: `1px solid ${SHELL.sideBorder}`,
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <div style={{
              width: 32,
              height: 32,
              background: "#1557b0",
              border: "none",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 700,
              color: "#fff",
            }}>
              S
            </div>
            <span style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#cbd5e1",
            }}>
              {location.pathname.split('/').pop()?.replace(/-/g, ' ') || 'Home'}
            </span>
          </div>
          
          <button
            onClick={() => setMobileDrawerOpen(true)}
            style={{
              background: "transparent",
              border: "1px solid #374151",
              borderRadius: 4,
              padding: 8,
              color: "#cbd5e1",
            }}
          >
            <Menu size={16} />
          </button>
        </div>

        {/* Main Content */}
        <div style={{
          flex: 1,
          background: SHELL.bg,
          overflow: "auto",
        }}>
          {isMinimized ? (
            <div
              onClick={() => setIsMinimized(false)}
              style={{
                flex: 1,
                background: SHELL.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6b7280",
                fontSize: 13,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              Click here or press — again to restore Sutra ERP
            </div>
          ) : (
            <>
              <TopMenuBar />
              <div className="app-layout-with-topbar">
                {children}
              </div>
            </>
          )}
        </div>

        {/* Bottom Navigation */}
        <div style={{
          display: "flex",
          justifyContent: "space-around",
          padding: "8px 0",
          background: SHELL.sideBg,
          borderTop: `1px solid ${SHELL.sideBorder}`,
        }}>
          {navigationItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={index}
                onClick={() => window.location.hash = item.path}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 8px",
                  background: "transparent",
                  border: "none",
                  color: isActive ? "#cbd5e1" : "#6b7280",
                  fontWeight: isActive ? 700 : "normal",
                  fontSize: 10,
                }}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mobile Drawer */}
        {mobileDrawerOpen && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.5)",
          }}>
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: 280,
              background: SHELL.sideBg,
              boxShadow: "2px 0 8px rgba(0,0,0,0.2)",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px",
                background: SHELL.sideBg,
                borderBottom: `1px solid ${SHELL.sideBorder}`,
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    background: "#1557b0",
                    border: "none",
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#fff",
                  }}>
                    S
                  </div>
                  <span style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#cbd5e1",
                  }}>
                    Sutra ERP
                  </span>
                </div>
                
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  style={{
                    background: "transparent",
                    border: "1px solid #374151",
                    borderRadius: 4,
                    padding: 8,
                    color: "#cbd5e1",
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              
              <nav style={{ padding: "16px" }}>
                <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {navigationItems.map((item, index) => (
                    <li key={index}>
                      <button
                        onClick={() => {
                          window.location.hash = item.path;
                          setMobileDrawerOpen(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          width: "100%",
                          padding: "10px 12px",
                          background: location.pathname === item.path ? SHELL.hover : "transparent",
                          border: "none",
                          borderRadius: 4,
                          color: location.pathname === item.path ? "#cbd5e1" : "#94a3b8",
                          textAlign: "left",
                          fontSize: 13,
                        }}
                      >
                        <item.icon size={16} />
                        <span>{item.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: SHELL.sideBg,
    }}>
      {isF12Active && <ShortcutSidebar />}
      <TitleBar />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar />
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: SHELL.bg,
        }}>
          <BusyMenuBar />
          <TopMenuBar />
          <div style={{
            fontSize: 11,
            fontWeight: 500,
            color: "#6b7280",
            textAlign: "center",
            marginBottom: 6,
          }}>
            {location.pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Home'}
          </div>
          <div style={{ flex: 1, overflow: "auto" }}>
            {isMinimized ? (
              <div
                onClick={() => setIsMinimized(false)}
                style={{
                  flex: 1,
                  background: SHELL.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#6b7280",
                  fontSize: 13,
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                Click here or press — again to restore Sutra ERP
              </div>
            ) : (
              <div className="app-layout-with-topbar">
                {children}
              </div>
            )}
          </div>
        </div>
      </div>
      <StatusBar />
      <CommandHintBar />
    </div>
  );
};

export default Layout;
