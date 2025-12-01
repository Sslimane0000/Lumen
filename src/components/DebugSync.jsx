import React, { useState } from 'react';
import { useSync } from '../context/SyncContext';
import { listFiles } from '../services/googleDrive';
import { Loader2, AlertTriangle, CheckCircle, Folder, FileText } from 'lucide-react';

export default function DebugSync() {
    const { googleUser, login } = useSync();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    const addLog = (msg, type = 'info') => {
        setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);
    };

    const runDiagnostics = async () => {
        setLoading(true);
        setLogs([]);
        addLog('Starting Diagnostics...', 'info');

        try {
            if (!googleUser) {
                addLog('User not signed in. Please sign in first.', 'error');
                setLoading(false);
                return;
            }

            // 1. Check Scopes (indirectly by trying to list)
            addLog('Checking Drive Access...', 'info');
            try {
                const folders = await listFiles("name = 'EbookReaderData' and mimeType = 'application/vnd.google-apps.folder'");
                addLog(`Found ${folders.length} folders named 'EbookReaderData' (including trashed)`, 'success');

                for (const folder of folders) {
                    const status = folder.trashed ? '[TRASHED]' : '[ACTIVE]';
                    addLog(`Folder: ${folder.name} (${folder.id}) ${status}`, 'info');

                    // Check contents
                    try {
                        const contents = await listFiles(`'${folder.id}' in parents`);
                        addLog(`  - Contains ${contents.length} files`, 'info');
                        contents.forEach(f => {
                            addLog(`    - ${f.name} (${f.mimeType})`, 'info');
                        });
                    } catch (e) {
                        addLog(`  - Failed to list contents: ${e.message}`, 'error');
                    }
                }

                if (folders.length === 0) {
                    addLog('WARNING: No "EbookReaderData" folder found!', 'warning');
                }

            } catch (e) {
                addLog(`Failed to list folders. Missing Scope? Error: ${e.message}`, 'error');
            }

            // 2. Check Local Storage
            const cachedId = localStorage.getItem('ebookReaderDriveFolderId');
            addLog(`Cached Folder ID: ${cachedId || 'None'}`, cachedId ? 'info' : 'warning');

        } catch (error) {
            addLog(`Unexpected Error: ${error.message}`, 'error');
        } finally {
            setLoading(false);
            addLog('Diagnostics Complete', 'success');
        }
    };

    return (
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    Sync Diagnostics
                </h3>
                <button
                    onClick={runDiagnostics}
                    disabled={loading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Run Diagnostics'}
                </button>
            </div>

            <div className="bg-black/50 rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs space-y-1">
                {logs.length === 0 ? (
                    <p className="text-gray-500 italic">Click run to start diagnostics...</p>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className={`flex gap-2 ${log.type === 'error' ? 'text-red-400' :
                                log.type === 'warning' ? 'text-yellow-400' :
                                    log.type === 'success' ? 'text-emerald-400' :
                                        'text-gray-300'
                            }`}>
                            <span className="text-gray-600">[{log.time}]</span>
                            <span>{log.msg}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
