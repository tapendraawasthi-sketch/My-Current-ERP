throw new Error("LEGACY SCRIPT DO NOT RUN");
const fs = require('fs');

// 1. BusyShell.tsx
let content = fs.readFileSync('src/components/BusyShell.tsx', 'utf8');
content = content.replace(/#1f2a44/g, '#4A89DC'); // TitleBar
content = content.replace(/#1557b0/g, '#F08A2C'); // S box
content = content.replace(/#e0e0e0/g, '#4A89DC'); // StatusBar bg
content = content.replace(/#a0a0a0/g, '#357ABD'); // StatusBar borders
content = content.replace(/#555/g, '#E6F2FF'); // Status subtext
content = content.replace(/#cc0000/g, '#f08a2c'); // ACC SOFTWARE pill
content = content.replace(/#d8d8d8/g, '#4A89DC'); // Hint bar
content = content.replace(/#bbb/g, '#357ABD'); // Hint border
content = content.replace(/#444/g, '#E6F2FF'); // Hint text
content = content.replace(/#f0f0f0/g, '#5CA3E6'); // Shortcut bg
content = content.replace(/#c8d4e0/g, '#4A89DC'); // Shortcut header bg
content = content.replace(/#d0d0d0/g, '#357ABD'); // Shortcut borders
content = content.replace(/#e8e8e8/g, '#5CA3E6'); // Shortcut row bg
content = content.replace(/#d0e0f5/g, '#4A89DC'); // Shortcut row hover
content = content.replace(/#8b1a1a/g, '#F08A2C'); // F-key
content = content.replace(/#000/g, '#ffffff'); // texts
content = content.replace(/#e8e4f0/g, '#6FB0EF'); // FormPanel
content = content.replace(/#a89cc4/g, '#4A89DC'); // FormPanel border
content = content.replace(/#808080/g, '#357ABD'); // BusyInput border
content = content.replace(/#fff/g, '#ffffff');
fs.writeFileSync('src/components/BusyShell.tsx', content);

// 2. BusyMenuBar.tsx
let menu = fs.readFileSync('src/components/BusyMenuBar.tsx', 'utf8');
menu = menu.replace(/#a8c5e8/g, '#4A89DC');
menu = menu.replace(/#6a99cc/g, '#357ABD');
menu = menu.replace(/#333/g, '#E6F2FF');
menu = menu.replace(/#3b6fb8/g, '#F08A2C');
menu = menu.replace(/#000000/g, '#ffffff');
menu = menu.replace(/#f0f0f0/g, '#5CA3E6');
menu = menu.replace(/#808080/g, '#357ABD');
menu = menu.replace(/#b0b0b0/g, '#357ABD');
menu = menu.replace(/#000/g, '#ffffff');
menu = menu.replace(/#c0c0c0/g, '#F08A2C');
fs.writeFileSync('src/components/BusyMenuBar.tsx', menu);

// 3. Layout.tsx
let layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');
layout = layout.replace(/bg-\\[#16213e\\]/g, 'bg-[#4A89DC]');
layout = layout.replace(/bg-\\[#1557b0\\]/g, 'bg-[#F08A2C]');
layout = layout.replace(/bg-\\[#f0f4ff\\]/g, 'bg-[#5CA3E6]');
layout = layout.replace(/bg-\\[#1e2433\\]/g, 'bg-[#4A89DC]');
layout = layout.replace(/bg-\\[#0f4a96\\]/g, 'bg-[#d97c26]'); // hover orange
layout = layout.replace(/text-\\[#1557b0\\]/g, 'text-[#F08A2C]');
layout = layout.replace(/text-gray-400/g, 'text-[#E6F2FF]');
layout = layout.replace(/text-slate-400/g, 'text-[#E6F2FF]');
layout = layout.replace(/text-slate-600/g, 'text-[#E6F2FF]');
layout = layout.replace(/#dde8f5/g, '#5CA3E6');
layout = layout.replace(/#555/g, '#E6F2FF');
layout = layout.replace(/border-\\[#2d3748\\]/g, 'border-[#357ABD]');
fs.writeFileSync('src/components/Layout.tsx', layout);

console.log('Fixed');
