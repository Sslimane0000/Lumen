# Anna's Archive Proxy Server

## Installation & Setup

### 1. Install Dependencies
```bash
npm install express cors axios cheerio
```

### 2. Install Nodemon (Optional - for auto-restart during development)
```bash
npm install --save-dev nodemon
```

### 3. Start the Server
```bash
node server.js
```

Or with nodemon (auto-restart on file changes):
```bash
npx nodemon server.js
```

## Usage

Once the server is running on `http://localhost:3001`, you can test it:

### Test with Browser
Open: `http://localhost:3001/api/search?q=Harry+Potter`

### Test with curl
```bash
curl "http://localhost:3001/api/search?q=Harry+Potter"
```

## API Endpoints

### GET /api/search
- **Query Parameter**: `q` (required) - Search query
- **Returns**: JSON array of books with:
  - `title` - Book title
  - `author` - Author name
  - `extension` - File type (pdf/epub)
  - `size` - File size
  - `md5` - MD5 hash
  - `downloadLink` - Link to book page
  - `coverImage` - Cover image URL

## Notes
- Server runs on port 3001
- CORS is enabled for all origins
- The scraping logic may need updates if Anna's Archive changes their HTML structure
