const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  const fileList = fs.readdirSync(dir);
  for (const file of fileList) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files);
    } else {
      if (name.endsWith('.tsx')) {
        files.push(name);
      }
    }
  }
  return files;
}

const files = getFiles('src/pages');
let changedFiles = 0;

for (let file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace uppercase in <td className="...">
  content = content.replace(/(<td\s+[^>]*className=["'][^"']*\b)uppercase(\b[^"']*["'][^>]*>)/g, '$1$2');
  content = content.replace(/(<td\s+[^>]*className=["'][^"']*\b)uppercase(\b[^"']*["'][^>]*>)/g, '$1$2');
  
  // Find spans that have uppercase but NOT badge
  content = content.replace(/(<span\s+[^>]*className=["'][^"']*\b)uppercase(\b[^"']*["'][^>]*>)/g, (match, p1, p2) => {
    if (match.includes('badge')) return match;
    return p1 + p2;
  });
  content = content.replace(/(<span\s+[^>]*className=["'][^"']*\b)uppercase(\b[^"']*["'][^>]*>)/g, (match, p1, p2) => {
    if (match.includes('badge')) return match;
    return p1 + p2;
  });

  // Find uppercase in <p> elements that might be displaying narration/description
  content = content.replace(/(<p\s+[^>]*className=["'][^"']*\b)uppercase(\b[^"']*["'][^>]*>)/g, '$1$2');

  // Find uppercase in <div> elements except section headers
  content = content.replace(/(<div\s+[^>]*className=["'][^"']*\b)uppercase(\b[^"']*["'][^>]*>)/g, (match, p1, p2) => {
    if (match.includes('section-label') || match.includes('section-header') || match.includes('page-header')) return match;
    return p1 + p2;
  });

  // Clean up double spaces created by removal inside quotes
  content = content.replace(/ className=(["'])(.*?)\1/g, (match, quote, classes) => {
    const cleaned = classes.replace(/\s+/g, ' ').trim();
    return ` className=${quote}${cleaned}${quote}`;
  });

  if (content !== original) {
    fs.writeFileSync(file, content);
    changedFiles++;
    console.log('Updated: ' + file);
  }
}

console.log('Total files changed: ' + changedFiles);
