document.addEventListener('DOMContentLoaded', () => {
    // State
    let strategies = [];
    let filteredStrategies = [];
    let activeFilters = {};
    let activeSearch = '';

    // Filter configuration defining which columns to use as filters (Sidebar)
    const filterConfig = [
        {
            group: 'Financial Impact', filters: [
                { key: 'Profit Direction?', label: 'Profit Direction' },
                { key: 'Spend Rate', label: 'Spend Rate' },
                { key: 'Cash Timing', label: 'Cash Timing' },
                { key: 'Short term benefit', label: 'Short Term Benefit' },
                { key: 'Financial Reports', label: 'Financial Reports' }
            ]
        },
        {
            group: 'Effort & Risk', filters: [
                { key: 'Category', label: 'Category' },
                { key: 'Risk', label: 'Risk' },
                { key: 'How long?', label: 'Duration' },
                { key: 'Pillar', label: 'Pillar' }
            ]
        },
        {
            group: 'Applicability', filters: [
                { key: 'Solo/Micro', label: 'Solo/Micro' },
                { key: 'Large Co.', label: 'Large Co.' },
                { key: 'Non-profit', label: 'Non-profit' },
                { key: 'Personal', label: 'Personal' },
                { key: 'Everyone', label: 'Everyone' }
            ]
        },
        {
            group: 'Operational Context', filters: [
                { key: 'Decision Control?', label: 'Decision Control' },
                { key: 'Symptom/Root', label: 'Symptom or Root' },
                { key: 'Frequency', label: 'Frequency' },
                { key: 'Use when?', label: 'Use When?' },
                { key: 'Mentor', label: 'Mentor' },
                { key: 'Bookkeeping', label: 'Bookkeeping' },
                { key: 'Free', label: 'Free Tool' }
            ]
        }
    ];

    // DOM Elements
    const testPanel = document.getElementById('test-panel');
    const appContainer = document.getElementById('app-container');
    const testDropZone = document.getElementById('test-drop-zone');
    const testFileInput = document.getElementById('test-file-input');
    const loadDefaultBtn = document.getElementById('load-default-btn');

    const filtersContainer = document.getElementById('filters-container');
    const strategiesTableContainer = document.getElementById('strategies-table-container');
    const strategiesTbody = document.getElementById('strategies-tbody');
    const totalResults = document.getElementById('total-results');
    const searchInput = document.getElementById('search-input');
    const reqDeptSelect = document.getElementById('req-dept-select');
    const reqDiffSelect = document.getElementById('req-diff-select');
    const noResultsState = document.getElementById('no-results-state');
    const resetFiltersBtn = document.getElementById('reset-filters');
    const emptyState = document.getElementById('empty-state');

    // Sort State
    let currentSortColumn = null;
    let currentSortDirection = 'asc'; // 'asc' or 'desc'

    // Test Panel Setup

    // Attempt auto-load first
    fetch('data.json')
        .then(res => {
            if (!res.ok) throw new Error('data.json not found');
            return res.json();
        })
        .then(data => initApp(data))
        .catch(err => {
            console.log('No default data.json loaded automatically, please upload or click load manually.');
        });

    loadDefaultBtn.addEventListener('click', () => {
        fetch('data.json')
            .then(res => {
                if (!res.ok) throw new Error('Network response was not ok');
                return res.json();
            })
            .then(data => initApp(data))
            .catch(err => {
                alert('Could not load data.json. Error: ' + err.message);
                console.error(err);
            });
    });

    testDropZone.addEventListener('click', () => testFileInput.click());
    testDropZone.addEventListener('dragover', e => { e.preventDefault(); testDropZone.classList.add('dragover'); });
    testDropZone.addEventListener('dragleave', () => testDropZone.classList.remove('dragover'));
    testDropZone.addEventListener('drop', e => {
        e.preventDefault();
        testDropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleTestFile(e.dataTransfer.files[0]);
    });
    testFileInput.addEventListener('change', e => {
        if (e.target.files.length) handleTestFile(e.target.files[0]);
    });

    function handleTestFile(file) {
        const reader = new FileReader();
        reader.onload = e => {
            let data;
            try {
                data = JSON.parse(e.target.result);
            } catch (err) {
                alert('Invalid JSON file.');
                return;
            }
            try {
                initApp(data);
            } catch (err) {
                alert('Error initializing app: ' + err.message);
                console.error(err);
            }
        };
        reader.readAsText(file);
    }

    // Initialize App
    function initApp(data) {
        strategies = data;
        filteredStrategies = []; // Start empty

        testPanel.classList.add('hidden');
        appContainer.classList.remove('hidden');

        buildRequiredFilters();
        buildFilters();
        applyFilters();
    }

    function buildRequiredFilters() {
        const depts = {};

        strategies.forEach(s => {
            if (s['Key Department']) {
                const dept = String(s['Key Department']).trim();
                depts[dept] = (depts[dept] || 0) + 1;
            }
        });

        // Clear existing options and add a default "Select" option
        reqDeptSelect.innerHTML = '';
        reqDeptSelect.add(new Option('Select Department', ''));
        Object.keys(depts).sort().forEach(d => {
            if (d) reqDeptSelect.add(new Option(`${d} (${depts[d]})`, d));
        });

        // Initialize Difficulty options
        updateDifficultyOptions();

        reqDeptSelect.addEventListener('change', () => {
            updateDifficultyOptions();
            buildFilters();
            applyFilters();
        });
        reqDiffSelect.addEventListener('change', () => {
            buildFilters();
            applyFilters();
        });
    }

    function updateDifficultyOptions() {
        const diffs = {};
        const reqDept = reqDeptSelect.value;
        const currentDiff = reqDiffSelect.value;

        strategies.forEach(s => {
            const rowDept = s['Key Department'] !== undefined && s['Key Department'] !== null ? String(s['Key Department']).trim() : '';
            if (reqDept && rowDept !== reqDept) return; // Only count difficulties for the currently selected department

            if (s['Difficulty']) {
                const diff = String(s['Difficulty']).trim();
                diffs[diff] = (diffs[diff] || 0) + 1;
            }
        });

        reqDiffSelect.innerHTML = '';
        reqDiffSelect.add(new Option('Select Difficulty', ''));
        Object.keys(diffs).sort().forEach(c => {
            if (c) {
                const opt = new Option(`${c} (${diffs[c]})`, c);
                // Keep the selection if it's still available
                if (c === currentDiff) opt.selected = true;
                reqDiffSelect.add(opt);
            }
        });
    }

    // Build Filters UI - scoped to the currently selected Dept + Difficulty
    function buildFilters() {
        // Save currently checked values before rebuilding
        const savedSelections = {};
        Object.keys(activeFilters).forEach(key => {
            if (activeFilters[key].size > 0) {
                savedSelections[key] = new Set(activeFilters[key]);
            }
        });

        filtersContainer.innerHTML = '';
        activeFilters = {};

        const reqDept = reqDeptSelect.value;
        const reqDiff = reqDiffSelect.value;

        // Compute a scoped subset of strategies based on the required filters
        const scopedStrategies = strategies.filter(s => {
            if (reqDept) {
                const d = s['Key Department'] !== undefined && s['Key Department'] !== null ? String(s['Key Department']).trim() : '';
                if (d !== reqDept) return false;
            }
            if (reqDiff) {
                const df = s['Difficulty'] !== undefined && s['Difficulty'] !== null ? String(s['Difficulty']).trim() : '';
                if (df !== reqDiff) return false;
            }
            return true;
        });

        filterConfig.forEach(groupConf => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'filter-accordion';

            const groupHeader = document.createElement('div');
            groupHeader.className = 'filter-accordion-header';
            groupHeader.innerHTML = `<span>${groupConf.group}</span> <i class="fa-solid fa-chevron-down"></i>`;

            const groupBody = document.createElement('div');
            groupBody.className = 'filter-accordion-body';

            groupHeader.addEventListener('click', () => {
                groupDiv.classList.toggle('expanded');
                const i = groupHeader.querySelector('i');
                if (groupDiv.classList.contains('expanded')) {
                    i.classList.replace('fa-chevron-down', 'fa-chevron-up');
                } else {
                    i.classList.replace('fa-chevron-up', 'fa-chevron-down');
                }
            });

            groupDiv.appendChild(groupHeader);

            groupConf.filters.forEach(conf => {
                const valuesMap = {};
                scopedStrategies.forEach(s => {
                    let val = s[conf.key];
                    if (val !== undefined && val !== null) {
                        val = String(val).trim();
                        if (val !== '') {
                            valuesMap[val] = (valuesMap[val] || 0) + 1;
                        }
                    }
                });

                const uniqueValues = Object.keys(valuesMap).sort();
                if (uniqueValues.length === 0) return;

                activeFilters[conf.key] = savedSelections[conf.key] || new Set();

                const innerGroup = document.createElement('div');
                innerGroup.className = 'filter-group';

                const title = document.createElement('div');
                title.className = 'filter-title';
                title.textContent = conf.label;
                innerGroup.appendChild(title);

                const optionsDiv = document.createElement('div');
                optionsDiv.className = 'filter-options';

                uniqueValues.forEach(val => {
                    const label = document.createElement('label');
                    label.className = 'filter-checkbox';

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = val;
                    // Restore previously checked state
                    if (activeFilters[conf.key].has(val)) {
                        checkbox.checked = true;
                    }
                    checkbox.addEventListener('change', (e) => handleFilterChange(conf.key, val, e.target.checked));

                    label.appendChild(checkbox);
                    label.appendChild(document.createTextNode(val));

                    const countBadge = document.createElement('span');
                    countBadge.className = 'filter-count';
                    countBadge.textContent = valuesMap[val];
                    label.appendChild(countBadge);

                    optionsDiv.appendChild(label);
                });

                innerGroup.appendChild(optionsDiv);
                groupBody.appendChild(innerGroup);
            });

            groupDiv.appendChild(groupBody);
            filtersContainer.appendChild(groupDiv);
        });
    }

    function handleFilterChange(key, value, isChecked) {
        if (isChecked) {
            activeFilters[key].add(value);
        } else {
            activeFilters[key].delete(value);
        }
        applyFilters();
    }

    searchInput.addEventListener('input', (e) => {
        activeSearch = e.target.value.toLowerCase();
        applyFilters();
    });

    resetFiltersBtn.addEventListener('click', () => {
        activeSearch = '';
        searchInput.value = '';
        document.querySelectorAll('.filter-checkbox input').forEach(cb => cb.checked = false);
        Object.keys(activeFilters).forEach(key => activeFilters[key].clear());
        reqDeptSelect.value = ''; // Reset required filters
        reqDiffSelect.value = ''; // Reset required filters
        currentSortColumn = null;
        currentSortDirection = 'asc';
        updateSortIcons();
        buildFilters();
        applyFilters();
    });

    function applyFilters() {
        const reqDept = reqDeptSelect.value;
        const reqDiff = reqDiffSelect.value;

        if (!activeSearch && (!reqDept || !reqDiff)) {
            filteredStrategies = [];
            strategiesTbody.innerHTML = '';
            totalResults.textContent = '0';
            strategiesTableContainer.classList.add('hidden');
            noResultsState.classList.add('hidden');
            emptyState.classList.remove('hidden'); // Show empty state if required filters not set and no search
            return;
        }

        filteredStrategies = strategies.filter(s => {
            // Check Search First - if there's a match, bypass required filters
            let searchMatch = false;
            if (activeSearch) {
                const searchString = JSON.stringify(Object.values(s)).toLowerCase();
                if (!searchString.includes(activeSearch)) return false;
                searchMatch = true;
            }

            // If not relying purely on search, enforce required filters
            if (!searchMatch) {
                const sDept = s['Key Department'] !== undefined && s['Key Department'] !== null ? String(s['Key Department']).trim() : '';
                if (sDept !== reqDept) return false;

                const sDiff = s['Difficulty'] !== undefined && s['Difficulty'] !== null ? String(s['Difficulty']).trim() : '';
                if (sDiff !== reqDiff) return false;
            }

            // Check Checkbox Filters
            for (const key of Object.keys(activeFilters)) {
                if (activeFilters[key].size > 0) {
                    const rowVal = s[key] !== undefined && s[key] !== null ? String(s[key]).trim() : '';
                    if (!activeFilters[key].has(rowVal)) {
                        return false;
                    }
                }
            }
            return true;
        });

        sortStrategies();
        renderStrategies();
        renderSummary();
    }

    function renderSummary() {
        totalResults.textContent = filteredStrategies.length;
        emptyState.classList.add('hidden'); // We know required are set if we reach here

        if (filteredStrategies.length === 0) {
            strategiesTableContainer.classList.add('hidden');
            noResultsState.classList.remove('hidden');
        } else {
            strategiesTableContainer.classList.remove('hidden');
            noResultsState.classList.add('hidden');
        }
    }

    // Sorting Logic
    function sortStrategies() {
        if (!currentSortColumn) return;

        filteredStrategies.sort((a, b) => {
            let valA = a[currentSortColumn];
            let valB = b[currentSortColumn];

            // Handle the '#' column numerically
            if (currentSortColumn === '#') {
                valA = Number(valA) || 0;
                valB = Number(valB) || 0;
                return currentSortDirection === 'asc' ? valA - valB : valB - valA;
            }

            // String sort for everything else
            valA = valA !== undefined && valA !== null ? String(valA).trim().toLowerCase() : '';
            valB = valB !== undefined && valB !== null ? String(valB).trim().toLowerCase() : '';

            if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    function updateSortIcons() {
        document.querySelectorAll('.sortable').forEach(th => {
            const icon = th.querySelector('.sort-icon');
            th.classList.remove('sort-active');
            icon.classList.remove('fa-sort-up', 'fa-sort-down');
            icon.classList.add('fa-sort');
        });

        if (currentSortColumn) {
            const activeTh = document.querySelector(`th[data-sort="${currentSortColumn}"]`);
            if (activeTh) {
                activeTh.classList.add('sort-active');
                const icon = activeTh.querySelector('.sort-icon');
                icon.classList.remove('fa-sort');
                icon.classList.add(currentSortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
            }
        }
    }

    // Attach header sort click listeners
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');
            if (currentSortColumn === column) {
                // Toggle direction
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = column;
                currentSortDirection = 'asc';
            }
            updateSortIcons();
            sortStrategies();
            renderStrategies();
        });
    });

    function renderStrategies() {
        strategiesTbody.innerHTML = '';

        filteredStrategies.forEach(s => {
            const tr = document.createElement('tr');

            const strategyStr = String(s['Strategy'] || '-');
            const num = s['#'] || '-';
            const decisionControl = String(s['Decision Control?'] || '-');
            const duration = s['How long?'] || '-';
            const prof = String(s['Profit Direction?'] || '-');
            const spend = String(s['Spend Rate'] || '-');
            const timing = String(s['Cash Timing'] || '-');
            const mentor = String(s['Mentor'] || '-');
            const sxRoot = String(s['Symptom/Root'] || '-');
            const pillar = String(s['Pillar'] || '-');
            const frequency = String(s['Frequency'] || '-');
            const shortTerm = String(s['Short term benefit'] || '-');
            const useWhen = String(s['Use when?'] || '-');
            const books = String(s['Bookkeeping'] || '-');
            const reports = String(s['Financial Reports'] || '-');
            const risk = String(s['Risk'] || '-');

            // Generate badge classes
            const riskClass = risk.includes('High') ? 'badge-red' : (risk.includes('Low') ? 'badge-green' : 'badge-gray');
            const timingClass = timing.includes('Sooner') ? 'badge-blue' : 'badge-gray';
            const profClass = prof.includes('Increase') ? 'badge-green' : 'badge-gray';

            tr.innerHTML = `
                <td class="sticky-col width-narrow text-muted"><strong>${num}</strong></td>
                <td class="sticky-col sticky-col-2 width-wide strategy-title-cell">${strategyStr}</td>
                <td>${decisionControl}</td>
                <td>${duration}</td>
                <td><span class="status-badge ${profClass}">${prof}</span></td>
                <td>${spend}</td>
                <td><span class="status-badge ${timingClass}">${timing}</span></td>
                <td>${mentor}</td>
                <td>${sxRoot}</td>
                <td>${pillar}</td>
                <td>${frequency}</td>
                <td>${shortTerm}</td>
                <td>${useWhen}</td>
                <td>${books}</td>
                <td>${reports}</td>
                <td><span class="status-badge ${riskClass}">${risk}</span></td>
            `;
            strategiesTbody.appendChild(tr);
        });
    }
});
