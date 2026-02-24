const fs = require('fs');
const file = 'src/pages/admin/AdminProductForm.jsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// 1. Find line 946 closing div
let mainCloseIdx = lines.findIndex(l => l.includes('name="comboItems"')) + 2;
// Check if it is literally </div>
if (lines[mainCloseIdx].trim() === '</div>') {
    lines.splice(mainCloseIdx, 1);
    console.log('Removed premature Main Column closing.');
}

// 2. Find Sidebar wrapper and Organization Card bounds
let sidebarStart = lines.findIndex(l => l.includes('{/* Sidebar Column */}'));
let orgStart = lines.findIndex(l => l.includes('{/* Organization Card */}'));

// Find where Organization Card ends. It's before Media Gallery.
let mediaHeaderIdx = lines.findIndex(l => l.includes('Media Gallery') && l.includes('text-sm font-semibold'));
// Organization Card ends around here
let orgEndIdx = lines.lastIndexOf('            </div>', mediaHeaderIdx - 3);

console.log('Sidebar Start:', sidebarStart);
console.log('Org End:', orgEndIdx);

// We want to extract from sidebarStart up to orgEndIdx.
// This block includes:
// {/* Sidebar Column */}
// <div className="space-y-6">
// ... Organization Card ...
// </div>
// Wait, the orgEndIdx is the end of the Organization Card, but NOT the end of the Sidebar Wrapper!
// Which means extracting from sidebarStart to orgEndIdx gives us EXACTLY the whole Sidebar wrapped around Organization Card!
let sidebarBlock = lines.splice(sidebarStart, (orgEndIdx - sidebarStart) + 1);
console.log('Extracted lines:', sidebarBlock.length);

// 3. Insert the extracted block AFTER the Main Column closes.
// Where does the Main Column close now? 
// It was closing at line 1909 or 1910 before.
// We look for </form> and insert RIGHT BEFORE IT.
let formCloseIdx = lines.findIndex(l => l.trim() === '</form>');
console.log('Form close is at:', formCloseIdx);

lines.splice(formCloseIdx, 0, ...sidebarBlock);

fs.writeFileSync(file, lines.join('\n'));
console.log('Done.');
