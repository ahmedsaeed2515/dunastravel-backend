import * as fs from 'fs';
import * as path from 'path';

const localesDir = path.resolve('..', 'DUNASTRAVEL-private-main', 'src', 'i18n', 'locales');
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
const ar = JSON.parse(fs.readFileSync(path.join(localesDir, 'ar.json'), 'utf8'));

console.log('en["completoEgypt.title"]:', en['completoEgypt.title']);
console.log('ar["completoEgypt.title"]:', ar['completoEgypt.title']);
console.log('en["mct007.title"]:', en['mct007.title']);
console.log('en["mct009.title"]:', en['mct009.title']);

// Let's search keys in en.json matching mct or completo
const keys = Object.keys(en).filter(k => k.toLowerCase().includes('mct') || k.toLowerCase().includes('completo'));
console.log('Matching keys in en.json:', keys);
