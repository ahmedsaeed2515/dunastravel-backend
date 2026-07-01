const fs = require('fs');
const path = 'pgsql/data/postgresql.conf';

try {
  // Read file assuming utf16le if it has null bytes, otherwise utf8
  let buffer = fs.readFileSync(path);
  let content = buffer.toString('utf8');
  
  if (content.includes('\0')) {
     console.log('File is likely UTF-16LE, fixing...');
     content = buffer.toString('utf16le');
  }

  // Remove the appended fsync lines
  let lines = content.split('\n');
  let newLines = lines.filter(line => !line.includes('fsync = off') && !line.includes('\x00'));

  // Ensure utf8 write
  fs.writeFileSync(path, newLines.join('\n'), 'utf8');
  
  // Now safely append fsync=off
  fs.appendFileSync(path, '\nfsync = off\n', 'utf8');
  
  console.log('Config fixed successfully');
} catch(e) {
  console.error(e);
}
