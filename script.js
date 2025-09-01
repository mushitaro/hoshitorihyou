        document.addEventListener("DOMContentLoaded", async () => {
            let maintenanceData;
            let years;

            const savedMaintenanceData = localStorage.getItem('maintenanceData');
            const savedYears = localStorage.getItem('years');

            if (savedMaintenanceData && savedYears) {
                maintenanceData = JSON.parse(savedMaintenanceData);
                years = JSON.parse(savedYears);
            } else {
                try {
                    const response = await fetch('testdata.json');
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const initialData = await response.json();
                    maintenanceData = initialData.maintenanceData;
                    years = initialData.years;
                } catch (error) {
                    console.error("初期データの読み込みに失敗しました:", error);
                    // エラー時のフォールバックデータ
                    maintenanceData = [];
                    years = [];
                    alert("データの読み込みに失敗しました。アプリケーションを初期化できません。");
                    return;
                }
            }
            let dataMap = new Map();

            // DOM Elements
            const tableHeader = document.getElementById("table-header");
            const tableBody = document.getElementById("table-body");
            const editMenu = document.getElementById("edit-menu");
            const importFileInput = document.getElementById('import-file-input');
            let currentEditCell = null;
            
            const saveToastEl = document.getElementById('save-toast');
            const saveToast = new bootstrap.Toast(saveToastEl);
            const operationModalEl = document.getElementById('operation-modal');
            const operationModal = new bootstrap.Modal(operationModalEl);

            function saveData() {
                localStorage.setItem('maintenanceData', JSON.stringify(maintenanceData));
                localStorage.setItem('years', JSON.stringify(years));
                saveToast.show();
            }

            function processData(items, parentCode, parentId) {
                items.forEach((item, index) => {
                    dataMap.set(item.id, item);
                    item.parentId = parentId;
                    const currentCode = parentCode ? `${parentCode}.${index + 1}` : `${index + 1}`;
                    item.bomCode = currentCode;
                    if (item.level === 4) {
                        if(item.cycle === undefined) item.cycle = (item.id % 3 === 0) ? 1 : (item.id % 3 === 1) ? 3 : 5;
                    } else {
                        item.cycle = '';
                    }
                    if (item.children) processData(item.children, currentCode, item.id);
                });
            }

            function calculateRollups(item) {
                if (!item.children) return item.results || {};
                item.rolledUpResults = {};
                item.children.forEach(child => {
                    const childResults = calculateRollups(child);
                    for (const year in childResults) {
                        if (!item.rolledUpResults[year]) item.rolledUpResults[year] = { planned: false, actual: false };
                        if (childResults[year].planned) item.rolledUpResults[year].planned = true;
                        if (childResults[year].actual) item.rolledUpResults[year].actual = true;
                    }
                });
                return item.rolledUpResults;
            }
            
            function toggleChildren(parentId, icon) {
                const isOpening = icon.textContent === "▶";
                const parentRow = tableBody.querySelector(`tr[data-id='${parentId}']`);
                parentRow.querySelectorAll('.summary-mark').forEach(mark => { mark.style.display = isOpening ? 'none' : 'block'; });
                icon.textContent = isOpening ? "▼" : "▶";
                tableBody.querySelectorAll(`[data-parent-id="${parentId}"]`).forEach(child => {
                    child.classList.toggle("d-none");
                    if (!isOpening) {
                        const childIcon = child.querySelector('.toggle-icon');
                        if (childIcon && childIcon.textContent === '▼') {
                            childIcon.click();
                        }
                    }
                });
            }

            function getOpenStates() {
                const openStates = new Set();
                document.querySelectorAll('tr.has-children').forEach(row => {
                    if (row.style.display !== 'none' && row.querySelector('.toggle-icon')?.textContent === '▼') {
                        openStates.add(String(row.dataset.id));
                    }
                });
                return openStates;
            }

            function renderTable(openStates) {
                tableHeader.innerHTML = '';
                tableBody.innerHTML = '';
                const headerRow = document.createElement("tr");
                const createTh = (className, text) => { const th = document.createElement("th"); th.className = className; th.textContent = text; return th; };
                headerRow.appendChild(createTh("task-name-col", "実施項目"));
                headerRow.appendChild(createTh("bom-code-col", "BOMコード"));
                headerRow.appendChild(createTh("cycle-col", "周期(年)"));
                years.forEach(year => headerRow.appendChild(createTh("year-col", `${year}年度`)));
                tableHeader.appendChild(headerRow);

                const createRow = (item, parentId) => {
                    const dataRow = document.createElement("tr");
                    dataRow.dataset.id = item.id;
                    dataRow.classList.add('level-' + item.level);
                    if (item.children) dataRow.classList.add('has-children');
                    if (parentId) dataRow.dataset.parentId = parentId;
                    
                    const tdTask = document.createElement("td");
                    tdTask.className = "task-name-col";
                    const contentDiv = document.createElement("div");
                    contentDiv.className = "task-name-content";
                    contentDiv.style.paddingLeft = `${(item.level - 1) * 20 + 5}px`;

                    const iconContainer = document.createElement("span");
                    iconContainer.className = "toggle-icon";
                    if (item.children) {
                        iconContainer.textContent = "▶";
                        iconContainer.style.cursor = "pointer";
                        iconContainer.addEventListener("click", () => toggleChildren(item.id, iconContainer));
                    }
                    
                    const taskTextContainer = document.createElement("div");
                    taskTextContainer.className = "task-text-container";
                    taskTextContainer.textContent = " " + item.task;

                    const actionsContainer = document.createElement('div');
                    actionsContainer.className = 'task-actions';

                    if (item.level === 3) {
                        actionsContainer.innerHTML = `<i class="bi bi-plus-circle-fill action-icon add" title="項目を追加"></i>`;
                    } else if (item.level === 4) {
                        actionsContainer.innerHTML = `
                            <i class="bi bi-pencil-fill action-icon edit" title="項目名を編集"></i>
                            <i class="bi bi-trash-fill action-icon delete" title="項目を削除"></i>`;
                    }
                    
                    contentDiv.appendChild(iconContainer);
                    contentDiv.appendChild(taskTextContainer);
                    contentDiv.appendChild(actionsContainer);
                    tdTask.appendChild(contentDiv);
                    dataRow.appendChild(tdTask);
                    
                    dataRow.appendChild(Object.assign(document.createElement("td"), { className: "bom-code-col", textContent: item.bomCode }));

                    const tdCycle = document.createElement("td");
                    tdCycle.className = "cycle-col";
                    const cycleContent = document.createElement("div");
                    cycleContent.className = "cycle-col-content";
                    const cycleText = document.createElement("span");
                    cycleText.textContent = item.cycle;
                    cycleContent.appendChild(cycleText);

                    if (item.level === 4 && item.cycle && parseInt(item.cycle, 10) > 0) {
                        const bulkAddIcon = document.createElement("i");
                        bulkAddIcon.className = "bi bi-magic action-icon bulk-add";
                        bulkAddIcon.title = "計画を一括登録";
                        cycleContent.appendChild(bulkAddIcon);
                    }
                    tdCycle.appendChild(cycleContent);
                    dataRow.appendChild(tdCycle);

                    years.forEach((year) => {
                        const tdResult = document.createElement("td");
                        tdResult.className = "year-col";
                        tdResult.dataset.year = year;
                        const results = item.children ? item.rolledUpResults : item.results;
                        const dataForYear = results ? results[year] : null;
                        if (dataForYear) {
                            const plannedDiv = document.createElement('div');
                            const actualDiv = document.createElement('div');
                            actualDiv.className = 'actual-mark';
                            if (dataForYear.planned) plannedDiv.textContent = '〇';
                            if (dataForYear.actual) actualDiv.textContent = '●';
                            if (item.children) {
                                plannedDiv.classList.add('summary-mark');
                                actualDiv.classList.add('summary-mark', 'summary-actual');
                            }
                            tdResult.appendChild(plannedDiv);
                            tdResult.appendChild(actualDiv);
                        }
                        dataRow.appendChild(tdResult);
                    });
                    tableBody.appendChild(dataRow);
                    if (item.children) item.children.forEach(child => createRow(child, item.id));
                };

                maintenanceData.forEach(item => createRow(item, null));
                tableBody.querySelectorAll('tr[data-parent-id]').forEach(row => row.classList.add('d-none'));
                
                openStates.forEach(id => {
                    const rowToOpen = tableBody.querySelector(`tr[data-id="${id}"]`);
                    if(rowToOpen) {
                        rowToOpen.querySelector('.toggle-icon').textContent = '▼';
                        tableBody.querySelectorAll(`[data-parent-id="${id}"]`).forEach(child => child.classList.remove('d-none'));
                        rowToOpen.querySelectorAll('.summary-mark').forEach(mark => mark.style.display = 'none');
                    }
                });

                document.getElementById('show-bom-code-check').dispatchEvent(new Event('change'));
                document.getElementById('show-cycle-check').dispatchEvent(new Event('change'));
            }

            function initialize(openStates = new Set()){
                dataMap.clear();
                processData(maintenanceData, '', null);
                maintenanceData.forEach(item => calculateRollups(item));
                renderTable(openStates);
            }

            // --- Modal Handlers ---

            function handleAddTask(parentId) {
                const parentItem = dataMap.get(parentId);
                if (!parentItem || parentItem.level !== 3) return;
                const modalTitle = document.getElementById('modal-title');
                const modalBody = document.getElementById('modal-body');
                const modalFooter = document.getElementById('modal-footer');
                modalTitle.textContent = `新規項目を追加`;
                modalBody.innerHTML = `
                    <p>「${parentItem.task}」に新しい項目を追加します。</p>
                    <input type="text" id="modal-input-task" class="form-control" placeholder="新しい項目名">
                    <div class="error-message" id="modal-error-message"></div>`;
                modalFooter.innerHTML = `
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">キャンセル</button>
                    <button type="button" class="btn btn-primary" id="modal-confirm-btn">追加</button>`;
                operationModal.show();
                document.getElementById('modal-confirm-btn').onclick = () => {
                    const input = document.getElementById('modal-input-task');
                    const errorMsg = document.getElementById('modal-error-message');
                    const newTaskName = input.value.trim();
                    if (!newTaskName) {
                        errorMsg.textContent = '項目名を入力してください。';
                        errorMsg.style.display = 'block';
                        return;
                    }
                    if (!parentItem.children) parentItem.children = [];
                    const newId = (dataMap.size > 0 ? Math.max(...Array.from(dataMap.keys())) : 0) + 1;
                    const newItem = { id: newId, task: newTaskName, level: 4, results: {} };
                    parentItem.children.push(newItem);
                    const openStates = getOpenStates();
                    openStates.add(String(parentId));
                    saveData();
                    initialize(openStates);
                    operationModal.hide();
                };
            }

            function handleEditTask(itemId, textContainer) {
                if (textContainer.querySelector('input')) return;
                const item = dataMap.get(itemId);
                const originalText = item.task;
                textContainer.innerHTML = '';
                const input = document.createElement('input');
                input.type = 'text';
                input.value = originalText;
                textContainer.appendChild(input);
                input.focus();
                input.select();
                const save = () => {
                    const newText = input.value.trim();
                    if (newText && newText !== originalText) {
                        item.task = newText;
                        saveData();
                    }
                    textContainer.textContent = " " + item.task;
                };
                input.addEventListener('blur', save);
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') input.blur();
                    if (e.key === 'Escape') {
                        input.removeEventListener('blur', save);
                        textContainer.textContent = " " + originalText;
                    }
                });
            }

            function handleDeleteTask(itemId) {
                const item = dataMap.get(itemId);
                if (!item || !item.parentId) return;
                const parentItem = dataMap.get(item.parentId);
                const modalTitle = document.getElementById('modal-title');
                const modalBody = document.getElementById('modal-body');
                const modalFooter = document.getElementById('modal-footer');
                modalTitle.textContent = '項目の削除';
                modalBody.innerHTML = `<p>項目「<strong>${item.task}</strong>」を削除します。この操作は元に戻せません。よろしいですか？</p>`;
                modalFooter.innerHTML = `
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">キャンセル</button>
                    <button type="button" class="btn btn-danger" id="modal-final-delete-btn">完全に削除</button>`;
                operationModal.show();
                document.getElementById('modal-final-delete-btn').onclick = () => {
                    parentItem.children = parentItem.children.filter(child => child.id !== itemId);
                    saveData();
                    initialize(getOpenStates());
                    operationModal.hide();
                };
            }
            
            function handleBulkAddPlans(itemId) {
                const item = dataMap.get(itemId);
                const cycle = parseInt(item.cycle, 10);
                if (!item || isNaN(cycle) || cycle <= 0) return;

                const modalTitle = document.getElementById('modal-title');
                const modalBody = document.getElementById('modal-body');
                const modalFooter = document.getElementById('modal-footer');

                modalTitle.textContent = '計画の一括登録';
                modalBody.innerHTML = `
                    <p>項目「<strong>${item.task}</strong>」(周期: ${cycle}年) の計画を登録します。</p>
                    <div class="mb-3">
                        <label for="start-year-select" class="form-label">開始年度</label>
                        <select class="form-select" id="start-year-select">
                            ${years.map(y => `<option value="${y}">${y}</option>`).join('')}
                        </select>
                        <div id="modal-warning-message" class="alert alert-warning p-2 mt-2" style="display: none; font-size: 0.875rem;"></div>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="overwrite-check">
                        <label class="form-check-label" for="overwrite-check">
                            指定年度以降の計画をリセットして再作成する
                        </label>
                    </div>`;
                modalFooter.innerHTML = `
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">キャンセル</button>
                    <button type="button" class="btn btn-primary" id="modal-confirm-btn">実行</button>`;
                
                operationModal.show();

                const startYearSelect = document.getElementById('start-year-select');
                const overwriteCheck = document.getElementById('overwrite-check');
                const warningMsg = document.getElementById('modal-warning-message');
                const confirmBtn = document.getElementById('modal-confirm-btn');

                const updateModalState = () => {
                    const selectedYear = parseInt(startYearSelect.value, 10);
                    const hasPlan = item.results && item.results[selectedYear] && item.results[selectedYear].planned;
                    
                    warningMsg.style.display = 'none';
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = '実行';
                    confirmBtn.classList.remove('btn-warning');
                    confirmBtn.classList.add('btn-primary');

                    if (hasPlan) {
                        warningMsg.textContent = '！この年度には既に計画が存在します。';
                        warningMsg.style.display = 'block';
                        if (overwriteCheck.checked) {
                            confirmBtn.textContent = 'リセットして実行';
                            confirmBtn.classList.remove('btn-primary');
                            confirmBtn.classList.add('btn-warning');
                        } else {
                            confirmBtn.disabled = true;
                        }
                    }
                };

                startYearSelect.addEventListener('change', updateModalState);
                overwriteCheck.addEventListener('change', updateModalState);
                updateModalState();

                document.getElementById('modal-confirm-btn').onclick = () => {
                    const startYear = parseInt(startYearSelect.value, 10);
                    const shouldOverwrite = overwriteCheck.checked;

                    if (!item.results) item.results = {};
                    
                    if (shouldOverwrite) {
                        years.forEach(year => {
                            if (year >= startYear && item.results[year]) {
                                item.results[year].planned = false;
                                if (!item.results[year].actual) {
                                    delete item.results[year];
                                }
                            }
                        });
                    }

                    const plannedYears = Object.keys(item.results)
                        .filter(y => item.results[y].planned)
                        .map(Number).sort((a,b) => a - b);
                    
                    let referenceYear = plannedYears.length > 0 ? plannedYears[0] : startYear;

                    years.forEach(year => {
                        if (year < startYear) return;
                        if ((year - referenceYear) % cycle === 0) {
                            const existingResult = item.results[year] || { planned: false, actual: false };
                            item.results[year] = { planned: true, actual: existingResult.actual };
                        }
                    });

                    saveData();
                    initialize(getOpenStates());
                    operationModal.hide();
                };
            }

            // --- Data I/O Handlers ---
            function handleExportData() {
                const dataToExport = { years, maintenanceData };
                const jsonString = JSON.stringify(dataToExport, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'hoshitori_data.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

            function handleImportData() {
                importFileInput.click();
            }

            function handleResetData() {
                const modalTitle = document.getElementById('modal-title');
                const modalBody = document.getElementById('modal-body');
                const modalFooter = document.getElementById('modal-footer');

                modalTitle.textContent = 'データの初期化';
                modalBody.innerHTML = '<p>すべてのデータを初期状態に戻します。この操作は元に戻せません。よろしいですか？</p>';
                modalFooter.innerHTML = `
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">キャンセル</button>
                    <button type="button" class="btn btn-danger" id="modal-confirm-reset-btn">初期化する</button>`;
                operationModal.show();

                document.getElementById('modal-confirm-reset-btn').onclick = () => {
                    localStorage.removeItem('maintenanceData');
                    localStorage.removeItem('years');
                    location.reload();
                };
            }
            
            // --- Event Listeners ---

            // Controls
            document.getElementById('expand-all-btn').addEventListener('click', () => { document.querySelectorAll('tr.has-children .toggle-icon').forEach(icon => { if (icon.textContent === '▶') icon.click(); }); });
            document.getElementById('collapse-all-btn').addEventListener('click', () => { document.querySelectorAll('tr.has-children .toggle-icon').forEach(icon => { if (icon.textContent === '▼') icon.click(); }); });
            document.getElementById('show-bom-code-check').addEventListener('change', (e) => {
                const display = e.target.checked ? '' : 'none';
                document.querySelectorAll('.bom-code-col').forEach(cell => cell.style.display = display);
                document.querySelector('.cycle-col').style.left = e.target.checked ? '400px' : '250px';
            });
            document.getElementById('show-cycle-check').addEventListener('change', (e) => { document.querySelectorAll('.cycle-col').forEach(cell => cell.style.display = e.target.checked ? '' : 'none'); });

            // Year Operations
            document.getElementById('add-year-btn').addEventListener('click', (e) => {
                e.preventDefault();
                const modalTitle = document.getElementById('modal-title');
                const modalBody = document.getElementById('modal-body');
                const modalFooter = document.getElementById('modal-footer');
                modalTitle.textContent = '年度の追加';
                modalBody.innerHTML = `<p>追加する年度を4桁の数字で入力してください。</p><input type="number" id="modal-input-year" class="form-control" placeholder="例: 2026"><div class="error-message" id="modal-error-message"></div>`;
                modalFooter.innerHTML = `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">キャンセル</button><button type="button" class="btn btn-primary" id="modal-confirm-btn">追加</button>`;
                operationModal.show();
                document.getElementById('modal-confirm-btn').onclick = () => {
                    const input = document.getElementById('modal-input-year');
                    const errorMsg = document.getElementById('modal-error-message');
                    const newYear = parseInt(input.value, 10);
                    errorMsg.style.display = 'none';
                    if (isNaN(newYear) || newYear < 1000 || newYear > 9999) {
                        errorMsg.textContent = '無効な年度です。4桁の数字で入力してください。';
                        errorMsg.style.display = 'block';
                        return;
                    }
                    if (years.includes(newYear)) {
                        errorMsg.textContent = 'その年度は既に存在します。';
                        errorMsg.style.display = 'block';
                        return;
                    }
                    const openStates = getOpenStates();
                    years.push(newYear);
                    years.sort((a, b) => a - b);
                    saveData();
                    initialize(openStates);
                    operationModal.hide();
                };
            });

            document.getElementById('delete-year-btn').addEventListener('click', (e) => {
                e.preventDefault();
                const modalTitle = document.getElementById('modal-title');
                const modalBody = document.getElementById('modal-body');
                const modalFooter = document.getElementById('modal-footer');
                const deletableYears = years.filter(year => Array.from(dataMap.values()).every(item => !item.results || !item.results[year]));
                if (deletableYears.length === 0) {
                     modalTitle.textContent = 'エラー';
                     modalBody.innerHTML = '<p>削除できる年度がありません。計画または実績が入力されている年度は削除できません。</p>';
                     modalFooter.innerHTML = '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">閉じる</button>';
                     operationModal.show();
                     return;
                }
                modalTitle.textContent = '年度の削除';
                modalBody.innerHTML = `<p>削除する年度を選択してください。</p><select class="form-select" id="modal-select-year">${deletableYears.map(y => `<option value="${y}">${y}</option>`).join('')}</select>`;
                modalFooter.innerHTML = `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">キャンセル</button><button type="button" class="btn btn-danger" id="modal-confirm-btn">削除</button>`;
                operationModal.show();
                document.getElementById('modal-confirm-btn').onclick = () => {
                    const yearToDelete = parseInt(document.getElementById('modal-select-year').value, 10);
                    modalTitle.textContent = '削除の確認';
                    modalBody.innerHTML = `<p><strong>${yearToDelete}年度</strong>を削除します。この操作は元に戻せません。よろしいですか？</p>`;
                    modalFooter.innerHTML = `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">キャンセル</button><button type="button" class="btn btn-danger" id="modal-final-delete-btn">完全に削除</button>`;
                    document.getElementById('modal-final-delete-btn').onclick = () => {
                        const openStates = getOpenStates();
                        years.splice(years.indexOf(yearToDelete), 1);
                        saveData();
                        initialize(openStates);
                        operationModal.hide();
                    };
                };
            });
            
            // Data I/O Listeners
            document.getElementById('export-data-btn').addEventListener('click', (e) => { e.preventDefault(); handleExportData(); });
            document.getElementById('import-data-btn').addEventListener('click', (e) => { e.preventDefault(); handleImportData(); });
            document.getElementById('reset-data-btn').addEventListener('click', (e) => { e.preventDefault(); handleResetData(); });

            importFileInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importedData = JSON.parse(e.target.result);
                        if (!importedData.years || !Array.isArray(importedData.years) || !importedData.maintenanceData || !Array.isArray(importedData.maintenanceData)) {
                            throw new Error('Invalid file format.');
                        }

                        const modalTitle = document.getElementById('modal-title');
                        const modalBody = document.getElementById('modal-body');
                        const modalFooter = document.getElementById('modal-footer');
                        
                        modalTitle.textContent = 'データのインポート';
                        modalBody.innerHTML = `<p>ファイルからデータをインポートします。現在の作業内容は上書きされますが、よろしいですか？</p><p class="text-muted small">ファイル名: ${file.name}</p>`;
                        modalFooter.innerHTML = `
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">キャンセル</button>
                            <button type="button" class="btn btn-primary" id="modal-confirm-import-btn">インポート実行</button>`;
                        operationModal.show();

                        document.getElementById('modal-confirm-import-btn').onclick = () => {
                            years = importedData.years;
                            maintenanceData = importedData.maintenanceData;
                            saveData();
                            initialize();
                            operationModal.hide();
                        };
                    } catch (error) {
                        const modalTitle = document.getElementById('modal-title');
                        const modalBody = document.getElementById('modal-body');
                        const modalFooter = document.getElementById('modal-footer');
                        modalTitle.textContent = 'インポートエラー';
                        modalBody.innerHTML = '<p>ファイルの形式が正しくありません。有効なJSONファイルを選択してください。</p>';
                        modalFooter.innerHTML = '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">閉じる</button>';
                        operationModal.show();
                    } finally {
                        importFileInput.value = '';
                    }
                };
                reader.readAsText(file);
            });

            // Search
            document.getElementById('search-input').addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase().trim();
                const openStates = getOpenStates();
                
                if (!searchTerm) {
                    initialize(openStates);
                    return;
                }
            
                const idsToShow = new Set();
                dataMap.forEach(item => {
                    if (item.task.toLowerCase().includes(searchTerm)) {
                        idsToShow.add(item.id);
                        let current = item;
                        while (current.parentId) {
                            idsToShow.add(current.parentId);
                            current = dataMap.get(current.parentId);
                        }
                    }
                });
            
                tableBody.querySelectorAll('tr').forEach(row => {
                    const rowId = parseInt(row.dataset.id, 10);
                    if (idsToShow.has(rowId)) {
                        row.style.display = '';
                        const icon = row.querySelector('.toggle-icon');
                        if (icon) {
                            icon.textContent = '▼';
                            row.querySelectorAll('.summary-mark').forEach(mark => mark.style.display = 'none');
                        }
                    } else {
                        row.style.display = 'none';
                    }
                });
            });

            // Table Body Clicks
            tableBody.addEventListener('click', (e) => {
                const target = e.target;
                const row = target.closest('tr');
                if (!row) return;
                const id = parseInt(row.dataset.id);

                if (target.classList.contains('bulk-add')) {
                    handleBulkAddPlans(id);
                    return;
                }
                
                if (target.classList.contains('action-icon')) {
                    if (target.classList.contains('add')) { handleAddTask(id); } 
                    else if (target.classList.contains('edit')) { handleEditTask(id, row.querySelector('.task-text-container')); }
                    else if (target.classList.contains('delete')) { handleDeleteTask(id); }
                    return;
                }
                
                if (target.closest('.toggle-icon')) return;
                
                const yearCell = target.closest('.year-col');
                if (yearCell) { handleYearCellClick(yearCell); return; }
                
                const cycleCell = target.closest('.cycle-col');
                if (cycleCell && !target.classList.contains('action-icon')) { 
                    handleCycleCellClick(cycleCell); 
                    return; 
                }
            });

            function handleYearCellClick(cell) {
                const row = cell.closest('tr');
                const item = dataMap.get(parseInt(row.dataset.id));
                if (!item || item.children) return;
                currentEditCell = cell;
                const rect = cell.getBoundingClientRect();
                editMenu.style.display = 'block';
                editMenu.style.top = `${rect.bottom + window.scrollY}px`;
                editMenu.style.left = `${rect.left + window.scrollX}px`;
            }

            function handleCycleCellClick(cell) {
                const row = cell.closest('tr');
                const item = dataMap.get(parseInt(row.dataset.id));
                if (!item || item.level !== 4 || cell.querySelector('input')) return;
                
                const contentDiv = cell.querySelector('.cycle-col-content');
                const originalValue = item.cycle;
                contentDiv.innerHTML = '';
                
                const input = document.createElement('input');
                input.type = 'number';
                input.value = originalValue;
                input.min = 0;
                contentDiv.appendChild(input);
                input.focus();

                const saveChange = () => {
                    const newValue = input.value.trim();
                    const newCycle = newValue === '' ? '' : parseInt(newValue, 10);
                    if (item.cycle !== newCycle) {
                        item.cycle = newCycle;
                        saveData();
                    }
                    initialize(getOpenStates());
                };
                input.addEventListener('blur', saveChange);
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') input.blur();
                    else if (e.key === 'Escape') {
                         input.removeEventListener('blur', saveChange);
                         initialize(getOpenStates());
                    }
                });
            }

            editMenu.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (!action || !currentEditCell) return;
                const openStates = getOpenStates();
                const row = currentEditCell.closest('tr');
                const item = dataMap.get(parseInt(row.dataset.id));
                const year = currentEditCell.dataset.year;
                if (!item.results) item.results = {};
                switch (action) {
                    case 'plan_only': item.results[year] = { planned: true, actual: false }; break;
                    case 'actual_only': item.results[year] = { planned: false, actual: true }; break;
                    case 'plan_and_actual': item.results[year] = { planned: true, actual: true }; break;
                    case 'clear': delete item.results[year]; break;
                }
                editMenu.style.display = 'none';
                saveData();
                initialize(openStates);
            });

            document.addEventListener('click', (e) => {
                if (currentEditCell && !editMenu.contains(e.target) && !currentEditCell.contains(e.target)) {
                    editMenu.style.display = 'none';
                    currentEditCell = null;
                }
            });
            
            initialize();
        });