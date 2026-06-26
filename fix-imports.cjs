const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) results = results.concat(walk(file));
    else if (file.endsWith('.js') || file.endsWith('.jsx')) results.push(file);
  });
  return results;
}

const files = walk('src/components/TopMenuBar');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  const replacements = [
    { regex: /from\s+['"].*?context\/AppContext['"]/g, to: "from '@/context/AppContext'" },
    { regex: /from\s+['"].*?context\/MenuContext['"]/g, to: "from '@/context/MenuContext'" },
    { regex: /from\s+['"].*?services\/companyService['"]/g, to: "from '@/services/companyService'" },
    { regex: /from\s+['"].*?services\/dataService['"]/g, to: "from '@/services/dataService'" },
    { regex: /from\s+['"].*?services\/exportService['"]/g, to: "from '@/services/exportService'" },
    { regex: /from\s+['"].*?utils\/auditLogger['"]/g, to: "from '@/utils/auditLogger'" },
    { regex: /from\s+['"].*?utils\/contextDetector['"]/g, to: "from '@/utils/contextDetector'" }
  ];

  replacements.forEach(({ regex, to }) => {
    if (regex.test(content)) {
      content = content.replace(regex, to);
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
