# Deploying Lumen eBook Reader

This guide explains how to deploy Lumen to a public website (e.g., GitHub Pages).

## Important Notes

### Firebase API Key
The Firebase API key in `src/lib/firebase.js` is **safe to expose publicly**. Firebase uses it to identify your project, but access is controlled by Firebase Security Rules, not the API key itself. You do NOT need to hide it.

### What You MUST Configure

#### 1. Google OAuth Redirect URI
When you deploy to a public URL (e.g., `https://yourusername.github.io/ebook-reader/`), you must:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Find your OAuth 2.0 Client ID
4. Add your **public URL** to **Authorized Redirect URIs**:
   - Example: `https://yourusername.github.io/ebook-reader/`
   - The redirect URI must match exactly (including trailing slashes)

#### 2. Gemini API Key (Optional)
If users want to use AI-powered dictionary features, they need to provide their own Gemini API key in the Settings tab. This is user-specific, not a deployment concern.

## Deployment Options

### Option 1: GitHub Pages

1. **Build the app:**
   ```bash
   npm run build
   ```

2. **Push the `dist` folder to a `gh-pages` branch:**
   ```bash
   git subtree push --prefix dist origin gh-pages
   ```

3. **Enable GitHub Pages:**
   - Go to your repo → Settings → Pages
   - Source: Deploy from a branch
   - Branch: `gh-pages` / `root`

4. **Configure `vite.config.js`:**
   If your repo is `https://github.com/username/ebook-reader`, set:
   ```javascript
   export default defineConfig({
     base: '/ebook-reader/', // Your repo name
     // ... rest of config
   })
   ```

5. **Rebuild and redeploy** after changing `base`.

### Option 2: Other Static Hosts (Netlify, Vercel, etc.)

1. Connect your GitHub repo to the hosting service
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Deploy!

## For Local Testing by Others

Anyone cloning your repo can run it locally by:

1. **Clone the repo:**
   ```bash
   git clone https://github.com/username/ebook-reader.git
   cd ebook-reader
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run dev server:**
   ```bash
   npm run dev
   ```
   OR use the batch files: `run_dev.bat` (Windows)

The app will open at `http://localhost:5173/`

## What Users Need to Know

- **Data is Local:** All books and vocabulary are stored in the browser (IndexedDB). They are NOT synced across devices unless the user signs in with Google.
- **Gemini API Key:** Users must provide their own API key in Settings if they want AI translations.
- **Google Sign-In:** Works only on the authorized domains you configure in Google Cloud Console.
