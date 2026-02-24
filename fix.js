const fs = require('fs');
const file = 'src/pages/admin/AdminProductForm.jsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// Remove the premature closing of Main Column
let mainCloseIdx = lines.findIndex(l => l.includes('name="comboItems"')) + 2;
if (lines[mainCloseIdx].trim() === '</div>') {
    lines.splice(mainCloseIdx, 1);
    console.log('Removed premature Main Column closing at index', mainCloseIdx);
}

// Find Organization Card bounds
let sidebarStart = lines.findIndex(l => l.includes('{/* Sidebar Column */}'));
let orgStart = lines.findIndex(l => l.includes('{/* Organization Card */}'));
let mediaStart = lines.findIndex(l => l.includes('Media Gallery') && l.includes('text-sm font-semibold'));
// The Organization card ends exactly 4 lines before the Media Gallery header starts...
// Wait, the Media gallery block starts with:
//             <div className="rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-5 space-y-4">
//               {/* Header */}

let mediaHeaderIdx = lines.findIndex(l => l.includes('{/* Header */}'));
let orgEndIdx = mediaHeaderIdx - 2;

console.log('Sidebar Start:', sidebarStart);
console.log('Org End:', orgEndIdx);

let orgBlock = lines.splice(sidebarStart, orgEndIdx - sidebarStart + 1);
console.log('Extracted lines:', orgBlock.length);

// Insert at the very end, before </form>
let formCloseIdx = lines.findIndex(l => l.trim() === '</form>');
console.log('Form close is at:', formCloseIdx);

lines.splice(formCloseIdx, 0, ...orgBlock);

fs.writeFileSync(file, lines.join('\n'));
console.log('Done.');
