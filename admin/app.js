document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const statusDiv = document.getElementById('status');
    const actionsArea = document.getElementById('actions');
    const downloadBtn = document.getElementById('download-btn');

    let parsedData = null;

    // Drag & Drop Handlers
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('dragover');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) handleFile(files[0]);
    });

    fileInput.addEventListener('change', function () {
        if (this.files.length) handleFile(this.files[0]);
    });

    function handleFile(file) {
        showStatus('Processing...', '');
        actionsArea.classList.add('hidden');
        parsedData = null;

        const reader = new FileReader();

        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                // Read workbook
                const workbook = XLSX.read(data, { type: 'array' });
                // Treat first sheet as truth
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Convert to JSON
                // We know headers are on row 4 (index 3), so we will read as array of arrays first
                const jsonRaw = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

                // The headers are at row index 4
                if (jsonRaw.length <= 5) {
                    showStatus('Error decoding file:', 'File does not have enough rows.', true);
                    return;
                }

                const headers = jsonRaw[4].map(h => (h || '').toString().trim());

                // Filter out empty rows and build objects
                const validData = [];
                for (let i = 5; i < jsonRaw.length; i++) {
                    const row = jsonRaw[i];
                    // Skip if the first cell (# or strategy name) is deeply empty
                    if (!row[0] && !row[1]) continue;

                    let obj = {};
                    let hasContent = false;
                    for (let j = 0; j < headers.length; j++) {
                        if (headers[j]) { // Only save columns that have a header
                            obj[headers[j]] = row[j] !== undefined ? row[j] : '';
                            if (row[j] !== '' && row[j] !== undefined) hasContent = true;
                        }
                    }
                    if (hasContent) {
                        validData.push(obj);
                    }
                }

                if (validData.length === 0) {
                    showStatus('Error parsing file:', 'No valid data rows found after headers.', true);
                    return;
                }

                parsedData = validData;
                showStatus(`Successfully parsed ${parsedData.length} strategies.`, '');
                actionsArea.classList.remove('hidden');

            } catch (error) {
                console.error(error);
                showStatus('Error processing file:', error.message, true);
            }
        };

        reader.readAsArrayBuffer(file);
    }

    function showStatus(title, message, isError = false) {
        statusDiv.innerHTML = `<strong>${title}</strong> ${message}`;
        statusDiv.className = `status-message ${isError ? 'status-error' : 'status-success'}`;
        statusDiv.classList.remove('hidden');
    }

    downloadBtn.addEventListener('click', () => {
        if (!parsedData) return;

        const jsonStr = JSON.stringify(parsedData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
});
