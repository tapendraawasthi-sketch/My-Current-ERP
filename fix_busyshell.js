const fs = require('fs');
let content = fs.readFileSync('src/components/BusyShell.tsx', 'utf8');

// Title Bar
content = content.replace(/background: "#1f2a44"/g, 'background: "#0d1b2a"');
// Logo box S
content = content.replace(/background: "#1557b0"/g, 'background: "#2563eb"');

// Status Bar
content = content.replace(/background: "#e0e0e0"/g, 'background: "#0d1b2a"');
content = content.replace(/borderTop: "1px solid #a0a0a0"/g, 'borderTop: "1px solid #1b3a5c"');
content = content.replace(/borderRight: "1px solid #a0a0a0"/g, 'borderRight: "1px solid #1b3a5c"');
content = content.replace(/borderLeft: "1px solid #a0a0a0"/g, 'borderLeft: "1px solid #1b3a5c"');
content = content.replace(/color: "#1557b0"/g, 'color: "#60a5fa"');
content = content.replace(/color: "#555"/g, 'color: "#94a3b8"');
content = content.replace(/background: "#cc0000"/g, 'background: "#f08a2c"');

// Command Hint Bar
content = content.replace(/background: "#d8d8d8"/g, 'background: "#162a46"');
content = content.replace(/borderTop: "1px solid #bbb"/g, 'borderTop: "1px solid #1b3a5c"');
content = content.replace(/color: "#444"/g, 'color: "#94a3b8"');

// Shortcut Sidebar
content = content.replace(/background: "#f0f0f0"/g, 'background: "#0d1b2a"');
content = content.replace(/background: "#c8d4e0", textAlign: "center"/g, 'background: "#162a46", color: "#ffffff", textAlign: "center"');
content = content.replace(/borderBottom: "1px solid #a0a0a0"/g, 'borderBottom: "1px solid #1b3a5c"');
content = content.replace(/borderBottom: "1px solid #d0d0d0"/g, 'borderBottom: "1px solid #1b3a5c"');
content = content.replace(/background: "#e8e8e8"/g, 'background: "#0d1b2a"');
content = content.replace(/= "#d0e0f5"/g, '= "#1b3a5c"');
content = content.replace(/= "#e8e8e8"/g, '= "#0d1b2a"');
content = content.replace(/color: "#8b1a1a"/g, 'color: "#f08a2c"');
content = content.replace(/color: "#000"/g, 'color: "#ffffff"');

// FormPanel
content = content.replace(/background: "#e8e4f0"/g, 'background: "#0d1b2a"');
content = content.replace(/border: "1px solid #a89cc4"/g, 'border: "1px solid #1b3a5c"');

// BusyInput
content = content.replace(/border: "1px solid #808080", background: "#fff", color: "#000"/g, 'border: "1px solid #1b3a5c", background: "#162a46", color: "#ffffff"');

fs.writeFileSync('src/components/BusyShell.tsx', content);
console.log('Updated BusyShell.tsx');
