document.addEventListener('DOMContentLoaded', () => {

    // ── Config ───────────────────────────────────────────────────────────────
    // Single source of truth for what the prototype app expects.
    // Mark critical:true for columns the app cannot function without.
    const EXPECTED_COLUMNS = [
        { key: '#',                  critical: false },
        { key: 'Strategy',           critical: true  },
        { key: 'Key Department',     critical: true  },
        { key: 'Difficulty',         critical: true  },
        { key: 'Category',           critical: false },
        { key: 'Decision Control?',  critical: false },
        { key: 'How long?',          critical: false },
        { key: 'Profit Direction?',  critical: false },
        { key: 'Spend Rate',         critical: false },
        { key: 'Cash Timing',        critical: false },
        { key: 'Mentor',             critical: false },
        { key: 'Symptom/Root',       critical: false },
        { key: 'Pillar',             critical: false },
        { key: 'Frequency',          critical: false },
        { key: 'Short term benefit', critical: false },
        { key: 'Use when?',          critical: false },
        { key: 'Bookkeeping',        critical: false },
        { key: 'Financial Reports',  critical: false },
        { key: 'Risk',               critical: false },
        { key: 'Solo/Micro',         critical: false },
        { key: 'Large Co.',          critical: false },
        { key: 'Non-profit',         critical: false },
        { key: 'Personal',           critical: false },
        { key: 'Everyone',           critical: false },
        { key: 'Free',               critical: false },
    ];

    const HEADER_SCAN_ROWS  = 15; // max rows to scan when looking for the header
    const MIN_HEADER_MATCHES = 3; // minimum recognized columns to accept a row as the header
    const PREVIEW_ROW_COUNT  = 5; // sample rows shown in preview

    // Pre-compute normalized versions once
    const normalizedExpected = EXPECTED_COLUMNS.map(c => ({ ...c, norm: normalize(c.key) }));

    // ── State ─────────────────────────────────────────────────────────────────
    let workbook   = null;
    let parsedData = null;

    // ── DOM ───────────────────────────────────────────────────────────────────
    const dropZone       = document.getElementById('drop-zone');
    const fileInput      = document.getElementById('file-input');
    const statusDiv      = document.getElementById('status');
    const actionsArea    = document.getElementById('actions');
    const downloadBtn    = document.getElementById('download-btn');
    const sheetPicker    = document.getElementById('sheet-picker');
    const sheetSelect    = document.getElementById('sheet-select');
    const previewSection = document.getElementById('preview-section');

    // ── Drag & Drop ───────────────────────────────────────────────────────────
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
        dropZone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); });
    });
    ['dragenter', 'dragover'].forEach(ev => {
        dropZone.addEventListener(ev, () => dropZone.classList.add('dragover'));
    });
    ['dragleave', 'drop'].forEach(ev => {
        dropZone.addEventListener(ev, () => dropZone.classList.remove('dragover'));
    });
    dropZone.addEventListener('drop', e => {
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', function () {
        if (this.files.length) handleFile(this.files[0]);
    });

    sheetSelect.addEventListener('change', () => processSheet(sheetSelect.value));

    // ── File Handling ─────────────────────────────────────────────────────────
    function handleFile(file) {
        resetUI();
        showStatus('Reading file…', '', 'info');

        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = new Uint8Array(e.target.result);
                workbook = XLSX.read(data, { type: 'array' });

                if (workbook.SheetNames.length > 1) {
                    sheetSelect.innerHTML = workbook.SheetNames
                        .map(n => `<option value="${n}">${n}</option>`)
                        .join('');
                    sheetPicker.classList.remove('hidden');
                    showStatus(
                        `${workbook.SheetNames.length} sheets found.`,
                        'Select which sheet contains the strategy data.',
                        'info'
                    );
                } else {
                    processSheet(workbook.SheetNames[0]);
                }
            } catch (err) {
                console.error(err);
                showStatus('Could not read file.', err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // ── Sheet Processing ──────────────────────────────────────────────────────
    function processSheet(sheetName) {
        parsedData = null;
        actionsArea.classList.add('hidden');
        previewSection.innerHTML = '';
        previewSection.classList.add('hidden');

        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        // 1. Auto-detect the header row
        const headerRowIndex = detectHeaderRow(rows);

        if (headerRowIndex === -1) {
            showStatus(
                'Header row not found.',
                `Scanned the first ${HEADER_SCAN_ROWS} rows but matched fewer than ${MIN_HEADER_MATCHES} expected column names. ` +
                `Make sure the spreadsheet column headers match the expected names (case-insensitive).`,
                'error'
            );
            renderPreview(sheetName, -1, [], {}, [], 0);
            return;
        }

        // 2. Map detected headers to canonical column names
        const rawHeaders = rows[headerRowIndex].map(h => String(h || '').trim());
        const columnMap  = buildColumnMap(rawHeaders);

        // 3. Parse data rows
        const { data, skipped } = parseRows(rows, headerRowIndex, rawHeaders);

        if (data.length === 0) {
            showStatus(
                'No data rows found.',
                `Headers were detected on row ${headerRowIndex + 1} but no data rows followed. Check the file.`,
                'error'
            );
            renderPreview(sheetName, headerRowIndex, rawHeaders, columnMap, data, skipped);
            return;
        }

        // 4. Check for missing critical columns
        const missingCritical = EXPECTED_COLUMNS.filter(c => c.critical && !Object.prototype.hasOwnProperty.call(columnMap, c.key));

        if (missingCritical.length > 0) {
            showStatus(
                'Missing required columns:',
                missingCritical.map(c => `"${c.key}"`).join(', ') +
                '. Fix the spreadsheet headers and re-upload.',
                'error'
            );
        } else {
            const missingOptional = EXPECTED_COLUMNS.filter(c => !c.critical && !Object.prototype.hasOwnProperty.call(columnMap, c.key));
            if (missingOptional.length > 0) {
                showStatus(
                    `Parsed ${data.length} strategies — ${missingOptional.length} optional column(s) not found.`,
                    `Missing: ${missingOptional.map(c => `"${c.key}"`).join(', ')}. Those filter fields will be empty.`,
                    'warning'
                );
            } else {
                showStatus(
                    `Parsed ${data.length} strategies from "${sheetName}". All columns matched.`,
                    '',
                    'success'
                );
            }
            parsedData = data;
            actionsArea.classList.remove('hidden');
        }

        renderPreview(sheetName, headerRowIndex, rawHeaders, columnMap, data, skipped);
    }

    // ── Core Helpers ──────────────────────────────────────────────────────────

    // Normalize a string for comparison: lowercase, collapse whitespace, trim
    function normalize(str) {
        return String(str || '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    // Scan up to HEADER_SCAN_ROWS rows; return the index of the row with the
    // most cells matching expected column names (must meet MIN_HEADER_MATCHES).
    function detectHeaderRow(rows) {
        let bestIndex = -1;
        let bestCount = 0;
        const limit = Math.min(rows.length, HEADER_SCAN_ROWS);

        for (let i = 0; i < limit; i++) {
            const matches = rows[i].filter(cell => {
                const n = normalize(cell);
                return n && normalizedExpected.some(e => e.norm === n);
            }).length;

            if (matches > bestCount) {
                bestCount = matches;
                bestIndex = i;
            }
        }

        return bestCount >= MIN_HEADER_MATCHES ? bestIndex : -1;
    }

    // Build a map of { canonicalKey → columnIndex } from the detected header row.
    function buildColumnMap(rawHeaders) {
        const map = {};
        rawHeaders.forEach((h, i) => {
            const n = normalize(h);
            const match = normalizedExpected.find(e => e.norm === n);
            if (match) map[match.key] = i;
        });
        return map;
    }

    // Convert rows after the header row into objects keyed by raw header name.
    // Rows with fewer than 2 non-empty cells are skipped.
    function parseRows(rows, headerRowIndex, rawHeaders) {
        const data = [];
        let skipped = 0;

        for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            const nonEmpty = row.filter(cell => cell !== '' && cell !== null && cell !== undefined).length;
            if (nonEmpty < 2) { skipped++; continue; }

            const obj = {};
            rawHeaders.forEach((h, j) => {
                if (h) obj[h] = row[j] !== undefined ? row[j] : '';
            });
            data.push(obj);
        }

        return { data, skipped };
    }

    // ── Preview Rendering ─────────────────────────────────────────────────────
    function renderPreview(sheetName, headerRowIndex, rawHeaders, columnMap, data, skipped) {
        previewSection.classList.remove('hidden');
        previewSection.innerHTML = '';

        // Detection summary line
        const detectionDiv = document.createElement('div');
        detectionDiv.className = 'preview-detection';
        if (headerRowIndex >= 0) {
            detectionDiv.innerHTML =
                `Headers detected on <strong>row ${headerRowIndex + 1}</strong> ` +
                `of sheet <strong>"${sheetName}"</strong> — ` +
                `<strong>${data.length}</strong> data rows found` +
                (skipped > 0 ? `, <strong>${skipped}</strong> blank rows skipped` : '') + '.';
        } else {
            detectionDiv.innerHTML =
                `<strong>Could not detect headers</strong> in sheet <strong>"${sheetName}"</strong>. ` +
                `No row in the first ${HEADER_SCAN_ROWS} rows had ${MIN_HEADER_MATCHES}+ matching column names.`;
        }
        previewSection.appendChild(detectionDiv);

        // Column checklist
        const checklistDiv = document.createElement('div');
        checklistDiv.className = 'column-checklist';
        checklistDiv.innerHTML = '<h3>Column Detection</h3>';

        const grid = document.createElement('div');
        grid.className = 'checklist-grid';
        EXPECTED_COLUMNS.forEach(col => {
            const found = Object.prototype.hasOwnProperty.call(columnMap, col.key);
            const item = document.createElement('div');
            item.className = `checklist-item ${found ? 'found' : (col.critical ? 'missing-critical' : 'missing-optional')}`;
            item.innerHTML =
                `<span class="checklist-icon">${found ? '✓' : '✗'}</span>` +
                `<span class="checklist-key">${col.key}</span>` +
                (col.critical && !found ? '<span class="checklist-badge">required</span>' : '');
            grid.appendChild(item);
        });
        checklistDiv.appendChild(grid);

        // Extra columns not in the expected list (passed through as-is)
        const extras = rawHeaders.filter(h => h && !normalizedExpected.some(e => e.norm === normalize(h)));
        if (extras.length > 0) {
            const extraDiv = document.createElement('div');
            extraDiv.className = 'extra-columns';
            extraDiv.innerHTML =
                `<strong>Extra columns (passed through unchanged):</strong> ` +
                extras.map(e => `<code>${e}</code>`).join(', ');
            checklistDiv.appendChild(extraDiv);
        }
        previewSection.appendChild(checklistDiv);

        // Sample data table
        if (data.length > 0) {
            const sampleDiv = document.createElement('div');
            sampleDiv.className = 'sample-data';
            sampleDiv.innerHTML =
                `<h3>Sample Data — first ${Math.min(PREVIEW_ROW_COUNT, data.length)} of ${data.length} rows</h3>`;

            const tableWrap = document.createElement('div');
            tableWrap.className = 'sample-table-wrap';

            const table = document.createElement('table');
            table.className = 'sample-table';

            const thead = document.createElement('thead');
            const headerTr = document.createElement('tr');
            rawHeaders.filter(h => h).forEach(h => {
                const th = document.createElement('th');
                th.textContent = h;
                headerTr.appendChild(th);
            });
            thead.appendChild(headerTr);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            data.slice(0, PREVIEW_ROW_COUNT).forEach(row => {
                const tr = document.createElement('tr');
                rawHeaders.filter(h => h).forEach(h => {
                    const td = document.createElement('td');
                    td.textContent = row[h] !== undefined ? row[h] : '';
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            tableWrap.appendChild(table);
            sampleDiv.appendChild(tableWrap);
            previewSection.appendChild(sampleDiv);
        }
    }

    // ── Status ────────────────────────────────────────────────────────────────
    function showStatus(title, message, type) {
        const classMap = {
            success: 'status-success',
            error:   'status-error',
            warning: 'status-warning',
            info:    'status-info',
        };
        statusDiv.innerHTML = `<strong>${title}</strong>${message ? ' ' + message : ''}`;
        statusDiv.className = `status-message ${classMap[type] || 'status-success'}`;
        statusDiv.classList.remove('hidden');
    }

    function resetUI() {
        workbook = null;
        parsedData = null;
        actionsArea.classList.add('hidden');
        sheetPicker.classList.add('hidden');
        previewSection.innerHTML = '';
        previewSection.classList.add('hidden');
        statusDiv.classList.add('hidden');
    }

    // ── Download ──────────────────────────────────────────────────────────────
    downloadBtn.addEventListener('click', () => {
        if (!parsedData) return;
        const jsonStr = JSON.stringify(parsedData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = 'data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
});
