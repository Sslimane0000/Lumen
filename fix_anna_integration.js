// Minimal integration fix script for AnnasSidebar
// Run this manually if needed

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'Library.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Add import
if (!content.includes('AnnasSidebar')) {
    content = content.replace(
        /import MetadataRepairModal from '.\/components\/MetadataRepairModal';/,
        `import MetadataRepairModal from '../components/MetadataRepairModal';\nimport AnnasSidebar from '../components/AnnasSidebar';`
    );
}

// 2. Add state
if (!content.includes('showAnnasSidebar')) {
    content = content.replace(
        /const \[showMetadataModal, setShowMetadataModal\] = useState\(false\);/,
        `const [showMetadataModal, setShowMetadataModal] = useState(false);\n    const [showAnnasSidebar, setShowAnnasSidebar] = useState(false);`
    );
}

// 3. Add button
if (!content.includes('Anna\'s Archive Button')) {
    content = content.replace(
        /\{\/\* Repair Metadata Button \*\/\}/,
        `{/* Anna's Archive Button */}
                    <button
                        onClick={() => setShowAnnasSidebar(!showAnnasSidebar)}
                        className={\`p-2 rounded-lg transition-colors \${showAnnasSidebar ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}\`}
                        title="Search Anna's Archive"
                    >
                        <Search className="w-5 h-5" />
                    </button>

                    {/* Repair Metadata Button */}`
    );
}

// 4. Add component render
if (!content.includes('<AnnasSidebar')) {
    content = content.replace(
        /\{\/\* Metadata Repair Modal \*\/\}\s+\{showMetadataModal/s,
        `{/* Anna's Archive Sidebar */}
            <AnnasSidebar 
                isOpen={showAnnasSidebar}
                onClose={() => setShowAnnasSidebar(false)}
            />

            {/* Metadata Repair Modal */}
            {showMetadataModal`
    );
}

fs.writeFileSync(filePath, content);
console.log('✅ Successfully integrated AnnasSidebar into Library.jsx');
