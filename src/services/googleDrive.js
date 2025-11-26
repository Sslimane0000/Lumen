const CLIENT_ID = '1043970088020-r9bn7avv36oqbpjii9eapm9hbvga7s92.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

let tokenClient;
let gapiInited = false;
let gisInited = false;

export const initGoogleDrive = async () => {
    console.log('Initializing Google Drive integration...');
    console.log('Client ID:', CLIENT_ID);
    console.log('Origin:', window.location.origin);

    return new Promise((resolve) => {
        const script1 = document.createElement('script');
        script1.src = 'https://apis.google.com/js/api.js';
        script1.onload = () => {
            window.gapi.load('client', async () => {
                try {
                    await window.gapi.client.init({
                        discoveryDocs: [DISCOVERY_DOC],
                    });
                    gapiInited = true;
                    console.log('GAPI initialized');
                    if (gisInited) resolve();
                } catch (error) {
                    console.error('GAPI init error:', error);
                }
            });
        };
        document.body.appendChild(script1);

        const script2 = document.createElement('script');
        script2.src = 'https://accounts.google.com/gsi/client';
        script2.onload = () => {
            try {
                tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: '', // defined later
                });
                gisInited = true;
                console.log('GIS initialized');
                if (gapiInited) resolve();
            } catch (error) {
                console.error('GIS init error:', error);
            }
        };
        document.body.appendChild(script2);
    });
};

export const signIn = async () => {
    console.log('Sign in requested');
    if (!tokenClient) await initGoogleDrive();
    return new Promise((resolve, reject) => {
        tokenClient.callback = async (resp) => {
            if (resp.error) {
                console.error('Sign in error response:', resp);
                reject(resp);
            }
            // Save token to localStorage
            const token = window.gapi.client.getToken();
            if (token) {
                console.log('Token received');
                localStorage.setItem('gdrive_token', JSON.stringify({
                    ...token,
                    expires_at: Date.now() + (token.expires_in * 1000)
                }));
            } else {
                console.error('No token received after callback');
            }
            resolve(resp);
        };
        tokenClient.requestAccessToken({ prompt: 'consent' });
    });
};

export const signOut = () => {
    const token = window.gapi.client.getToken();
    if (token !== null) {
        window.google.accounts.oauth2.revoke(token.access_token);
        window.gapi.client.setToken('');
        localStorage.removeItem('gdrive_token');
    }
};

export const restoreSession = async () => {
    await initGoogleDrive();
    const stored = localStorage.getItem('gdrive_token');
    if (stored) {
        const token = JSON.parse(stored);
        if (Date.now() < token.expires_at) {
            window.gapi.client.setToken(token);
            return true;
        } else {
            localStorage.removeItem('gdrive_token');
        }
    }
    return false;
};

export const listFiles = async (query = null) => {
    let q = "trashed = false";
    if (query) {
        q += ` and ${query}`;
    }

    const response = await window.gapi.client.drive.files.list({
        'pageSize': 100,
        'fields': 'files(id, name, modifiedTime, mimeType)',
        'q': q
    });
    return response.result.files;
};

export const createFolder = async (name) => {
    const metadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
    };

    const accessToken = window.gapi.client.getToken().access_token;
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
        body: form,
    });
    return response.json();
};

export const uploadFile = async (name, content, mimeType, existingId = null, parentId = null) => {
    const metadata = {
        name: name,
        mimeType: mimeType,
    };
    if (parentId && !existingId) {
        metadata.parents = [parentId];
    }

    const accessToken = window.gapi.client.getToken().access_token;
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', content);

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';

    if (existingId) {
        url = `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`;
        method = 'PATCH';
    }

    const response = await fetch(url, {
        method: method,
        headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
        body: form,
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Drive Upload Error (${response.status}):`, errorText);
        throw new Error(`Drive Upload Failed: ${response.status} ${errorText}`);
    }

    return response.json();
};

export const downloadFile = async (fileId, onProgress) => {
    const accessToken = window.gapi.client.getToken().access_token;
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        method: 'GET',
        headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
    });

    if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
    }

    const contentLength = response.headers.get('Content-Length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    // Signal download start
    if (onProgress) {
        onProgress(total > 0 ? 0 : -1); // -1 means indeterminate
    }

    const reader = response.body.getReader();
    const chunks = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;

        if (onProgress) {
            if (total > 0) {
                // Report percentage
                onProgress(loaded / total);
            } else {
                // Report bytes (negative to indicate indeterminate)
                onProgress(-loaded);
            }
        }
    }

    // Combine chunks into a single ArrayBuffer
    const result = new Uint8Array(loaded);
    let position = 0;
    for (const chunk of chunks) {
        result.set(chunk, position);
        position += chunk.length;
    }

    return result.buffer;
};

export const checkAuth = () => {
    return window.gapi && window.gapi.client && window.gapi.client.getToken() !== null;
};
