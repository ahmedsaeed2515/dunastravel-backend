import * as fs from 'fs';
import * as path from 'path';

const localesDir = path.resolve('..', 'DUNASTRAVEL-private-main', 'src', 'i18n', 'locales');
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));

console.log('--- Checking keys matching mct in en.json ---');
for (const k of Object.keys(en)) {
  if (k.toLowerCase().includes('mct')) {
    console.log(k, '->', typeof en[k] === 'string' ? en[k].slice(0, 60) : en[k]);
  }
}

console.log('\n--- Checking keys matching completo in en.json ---');
for (const k of Object.keys(en)) {
  if (k.toLowerCase().includes('completo')) {
    console.log(k, '->', typeof en[k] === 'string' ? en[k].slice(0, 60) : en[k]);
  }
}
