import * as fs from 'fs';
import * as path from 'path';

function searchDirectory(dir: string, pattern: string): void {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      if (f.name !== 'node_modules' && f.name !== '.git') searchDirectory(full, pattern);
    } else if (f.isFile()) {
      try {
        const content = fs.readFileSync(full, 'utf8');
        if (content.includes(pattern)) {
          console.log(`Found "${pattern}" in: ${full}`);
          const lines = content.split('\n');
          lines.forEach((l, i) => {
            if (l.includes(pattern)) {
              console.log(`  Line ${i + 1}: ${l.trim().slice(0, 120)}`);
            }
          });
        }
      } catch {}
    }
  }
}

const targetDir = path.resolve('..', 'DUNASTRAVEL-private-main');
console.log('Searching for "mct005.title"...');
searchDirectory(targetDir, 'mct005.title');

console.log('\nSearching for "mct007.title"...');
searchDirectory(targetDir, 'mct007.title');

console.log('\nSearching for "mct005"...');
searchDirectory(targetDir, 'mct005');
