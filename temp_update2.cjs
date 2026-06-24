const fs = require('fs');

function processBusyShell() {
    const path = 'src/components/BusyShell.tsx';
    if (!fs.existsSync(path)) return;
    let c = fs.readFileSync(path, 'utf8');
    c = c.replace(/#0d1b2a/gi, '#A8CC88');
    c = c.replace(/#1b3a5c/gi, '#8FB870');
    c = c.replace(/#162a46/gi, '#B2D494');
    c = c.replace(/#2563eb/gi, '#4A7A30');
    c = c.replace(/#60a5fa/gi, '#111111');
    c = c.replace(/#94a3b8/gi, '#111111');
    c = c.replace(/#fffffffff/gi, '#111111');
    c = c.replace(/color:\s*["']#ffffff["']/gi, 'color: "#111111"');
    c = c.replace(/#f08a2c/gi, '#4A7A30');
    fs.writeFileSync(path, c);
    console.log('BusyShell.tsx done');
}

function processSidebar() {
    const path = 'src/components/Sidebar.tsx';
    if (!fs.existsSync(path)) return;
    let c = fs.readFileSync(path, 'utf8');
    
    // specific multi-word replacements first
    c = c.replace(/style=\{\{\s*background:\s*["']#357ABD["']\s*\}\}/g, 'style={{ background: "#B2D494" }}');
    c = c.replace(/hover:bg-\[#357ABD\]/g, 'hover:bg-[#B2D494]');
    c = c.replace(/hover:text-slate-100/g, 'hover:text-[#111111]');
    c = c.replace(/hover:text-white/g, 'hover:text-[#111111]');
    c = c.replace(/bg-amber-500/g, 'bg-[#4A7A30]');
    c = c.replace(/text-amber-950/g, 'text-white');
    c = c.replace(/style=\{\{\s*color:\s*["']#E6F2FF["']\s*\}\}/g, 'style={{ color: "#111111" }}');
    c = c.replace(/text-\[#F08A2C\]/gi, 'text-[#4A7A30]');
    c = c.replace(/bg-\[#1557b0\]/gi, 'bg-[#4A7A30]');

    // then single words
    c = c.replace(/text-white/g, 'text-[#111111]');
    c = c.replace(/text-slate-100/g, 'text-[#111111]');
    c = c.replace(/text-slate-300/g, 'text-[#111111]');
    c = c.replace(/text-slate-400/g, 'text-[#111111]');
    c = c.replace(/text-slate-500/g, 'text-[#111111]');

    // hex colors
    c = c.replace(/#1557b0/gi, '#4A7A30');
    c = c.replace(/#357ABD/gi, '#8FB870');

    // restore red ones if we broke any (we shouldn't have)
    // we didn't touch text-red-400 or hover:text-red-200
    
    fs.writeFileSync(path, c);
    console.log('Sidebar.tsx done');
}

function processRoutesIndex() {
    const path = 'src/routes/index.tsx';
    if (!fs.existsSync(path)) return;
    let c = fs.readFileSync(path, 'utf8');
    c = c.replace(/background:\s*["']#f0f2f5["']/gi, 'background: "#C5E1A5"');
    c = c.replace(/border:\s*["']3px solid #1557b0["']/gi, 'border: "3px solid #4A7A30"');
    fs.writeFileSync(path, c);
    console.log('Routes index.tsx done');
}

function processMenuBar() {
    const path = 'src/components/BusyMenuBar.tsx';
    if (!fs.existsSync(path)) return;
    let c = fs.readFileSync(path, 'utf8');
    c = c.replace(/#0d1b2a/gi, '#A8CC88');
    c = c.replace(/#1b3a5c/gi, '#8FB870');
    c = c.replace(/#162a46/gi, '#B2D494');
    fs.writeFileSync(path, c);
    console.log('BusyMenuBar.tsx done');
}

processBusyShell();
processSidebar();
processRoutesIndex();
processMenuBar();
