# Cash is Clear Maximizer

A prototype web app for browsing cash flow & profit optimization strategies from the Cash is Clear Maximizer spreadsheet.

## Structure

```
admin/        – Browser-based tool to convert the Excel file to JSON
prototype/    – The main strategy browser app
```

## Setup

### 1. Generate data.json from the Excel file

**Option A – Browser (no install needed)**

Open `admin/index.html` directly in a browser. Upload the `.xlsx` file and download the resulting `data.json` into the `prototype/` folder.

**Option B – Node script**

```bash
cd prototype
npm install
node generate_data.js
```

This reads `Cash is Clear Maximizer ver EZ 224.xlsx` from the project root and writes `prototype/data.json`.

### 2. Run the prototype

Open `prototype/index.html` in a browser (no server needed).

On the Developer Test Panel, either:
- Click **Load Default data.json** (requires the file to be served, e.g. via a local server), or
- Click **Upload JSON** and select the `data.json` you generated above.

#### Optional: local server

```bash
cd prototype
npx serve .
# then open http://localhost:3000
```

## Deploy to GitHub Pages

> **Before deploying**, make sure `prototype/data.json` exists and is committed — the app fetches it at runtime.

1. Push the repo to GitHub.
2. Go to **Settings → Pages**.
3. Under *Build and deployment*, set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`.
4. Save. GitHub will publish the site at `https://fh-ndiritu.github.io/bug-free-barnacle/`.

The root `index.html` redirects visitors to the prototype automatically. The admin converter tool is accessible at `/admin/`.
