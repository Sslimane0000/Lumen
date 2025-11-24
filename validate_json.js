const fs = require('fs');
try {
    const content = fs.readFileSync('src/locales/ar.json', 'utf8');
    JSON.parse(content);
    console.log('Valid JSON');
} catch (e) {
    console.log(e.message);
}
