document.addEventListener('DOMContentLoaded', () => {
    // === CẤU HÌNH & TRẠNG THÁI ===
    const STORAGE_KEY = 'trinh_hg_v22_pro';
    
    let state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
        currentMode: 'default',
        activeTab: 'settings',
        formatMode: 'none', // none, inline, newline, dash
        modes: {
            default: { 
                pairs: [], 
                matchCase: false, 
                wholeWord: false, 
                autoCaps: false, 
                exceptions: 'jpg, png, com' 
            }
        }
    };

    // === HÀM CHUẨN HÓA UNICODE (FIX LỖI KHÔNG KHỚP) ===
    function normalizeUnicode(str) {
        if (!str) return '';
        return str
            .normalize('NFC')
            // Chuyển mọi loại ngoặc kép về ngoặc kép thẳng để xử lý logic, sau đó sẽ render lại smart quotes nếu muốn
            .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB\u275D\u275E\u301D-\u301F\uFF02]/g, '"')
            // Chuyển mọi loại ngoặc đơn
            .replace(/[\u2018\u2019\u201A\u201B\u2039\u203A\u275B\u275C\uFF07]/g, "'")
            // Chuyển các loại gạch ngang
            .replace(/[\u2013\u2014\u2015]/g, '-')
            // Chuyển dấu ba chấm
            .replace(/\u2026/g, '...')
            .trim();
    }

    // === CORE LOGIC: THỰC HIỆN THAY THẾ ===
    function performProcess() {
        const inputEl = document.getElementById('input-text');
        let text = inputEl.value;
        if (!text) return alert("Vui lòng nhập văn bản!");

        const mode = state.modes[state.currentMode];
        let countRep = 0;
        let countCaps = 0;

        // BƯỚC 1: REPLACE (Với Unicode Normalization)
        let processed = text; 
        // Chúng ta chuẩn hóa văn bản đầu vào để khớp với database đã chuẩn hóa
        processed = normalizeUnicode(processed);

        if (mode.pairs.length > 0) {
            // Sắp xếp cặp dài trước để tránh replace đè
            const sortedPairs = [...mode.pairs].sort((a, b) => b.find.length - a.find.length);
            
            sortedPairs.forEach(pair => {
                const findStr = normalizeUnicode(pair.find);
                const repStr = normalizeUnicode(pair.replace);
                if (!findStr) return;

                const flags = mode.matchCase ? 'g' : 'gi';
                const pattern = findStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = mode.wholeWord 
                    ? new RegExp(`(?<![\\p{L}\\p{N}_])${pattern}(?![\\p{L}\\p{N}_])`, flags + 'u')
                    : new RegExp(pattern, flags);

                processed = processed.replace(regex, () => {
                    countRep++;
                    return `\uE000${repStr}\uE001`; // Tạm bọc Marker
                });
            });
        }

        // BƯỚC 2: AUTO CAPS
        if (mode.autoCaps) {
            const exList = (mode.exceptions || "").split(',').map(s => s.trim().toLowerCase());
            const capRegex = /(^|[.?!]\s+)(\uE000.*?\uE001|[^\s\uE000\uE001]+)/gmu;

            processed = processed.replace(capRegex, (match, p1, p2) => {
                let cleanWord = p2.replace(/\uE000|\uE001/g, '');
                if (exList.includes(cleanWord.toLowerCase())) return match;
                
                let capped = cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1);
                countCaps++;
                
                if (p2.includes('\uE000')) {
                    return p1 + `\uE004${capped}\uE005`; // Marker cho cả hai
                }
                return p1 + `\uE002${capped}\uE003`; // Marker cho Caps
            });
        }

        // BƯỚC 3: CHUẨN HÓA FORMAT (LOGIC MỚI)
        if (state.formatMode !== 'none') {
            // Regex bắt: [Dẫn chuyện]: [Khoảng trắng/Xuống dòng] [Ngoặc kép] [Thoại] [Ngoặc kép]
            // Chú ý: Đã normalizeUnicode nên chỉ cần check ngoặc kép thẳng "
            const formatRegex = /([^:\n\r]+):\s*["“]([^"”]+)["”]/gu;

            processed = processed.replace(formatRegex, (match, action, dialog) => {
                const trimmedAction = action.trim();
                const trimmedDialog = dialog.trim();

                switch (state.formatMode) {
                    case 'inline':
                        return `${trimmedAction}: “${trimmedDialog}”`;
                    case 'newline':
                        return `${trimmedAction}:\n“${trimmedDialog}”`;
                    case 'dash':
                        return `${trimmedAction}:\n- ${trimmedDialog}`;
                    default:
                        return match;
                }
            });
        }

        // RENDER KẾT QUẢ
        renderHTML(processed, countRep, countCaps);
    }

    function renderHTML(text, cR, cC) {
        const out = document.getElementById('output-text');
        let html = text
            .replace(/\uE000(.*?)\uE001/g, '<mark>$1</mark>')
            .replace(/\uE002(.*?)\uE003/g, '<mark class="hl-blue">$1</mark>')
            .replace(/\uE004(.*?)\uE005/g, '<mark class="hl-orange">$1</mark>');
        
        out.innerHTML = html.replace(/\n/g, '<br>');
        document.getElementById('count-replace').textContent = `${cR} R`;
        document.getElementById('count-caps').textContent = `${cC} C`;
    }

    // === QUẢN LÝ GIAO DIỆN & EVENTS ===
    function init() {
        // Tab switching
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.nav-item, .tab-pane').forEach(el => el.classList.remove('active'));
                btn.classList.add('active');
                const target = btn.dataset.tab;
                document.getElementById(target).classList.add('active');
                document.getElementById('page-title').textContent = btn.querySelector('span').textContent;
                state.activeTab = target;
                save();
            };
        });

        // Toggle Buttons trong Sidebar Cài đặt
        const bindToggle = (id, prop) => {
            const btn = document.getElementById(id);
            btn.onclick = () => {
                state.modes[state.currentMode][prop] = !state.modes[state.currentMode][prop];
                btn.classList.toggle('active', state.modes[state.currentMode][prop]);
                save();
            };
            btn.classList.toggle('active', state.modes[state.currentMode][prop]);
        };
        bindToggle('match-case', 'matchCase');
        bindToggle('whole-word', 'wholeWord');
        bindToggle('auto-caps', 'autoCaps');

        // Format Mode Radio
        document.querySelectorAll('input[name="format-mode"]').forEach(radio => {
            radio.onchange = (e) => { state.formatMode = e.target.value; save(); };
            if (radio.value === state.formatMode) radio.checked = true;
        });

        // Add Pair
        document.getElementById('add-pair').onclick = () => addPairUI('', '');
        
        // Save All
        document.getElementById('save-settings').onclick = () => {
            const pairs = [];
            document.querySelectorAll('.punctuation-item').forEach(row => {
                const f = row.querySelector('.find').value;
                const r = row.querySelector('.replace').value;
                if (f) pairs.push({ find: normalizeUnicode(f), replace: normalizeUnicode(r) });
            });
            state.modes[state.currentMode].pairs = pairs;
            save();
            alert("Đã lưu!");
        };

        document.getElementById('replace-button').onclick = performProcess;
        
        loadModes();
        loadPairs();
    }

    function addPairUI(f, r) {
        const div = document.createElement('div');
        div.className = 'punctuation-item';
        div.innerHTML = `
            <input type="text" class="find" value="${f}" placeholder="Tìm...">
            <input type="text" class="replace" value="${r}" placeholder="Thay thế...">
            <button class="btn btn-danger btn-sm remove-btn">×</button>
        `;
        div.querySelector('.remove-btn').onclick = () => div.remove();
        document.getElementById('punctuation-list').appendChild(div);
    }

    function loadPairs() {
        const list = document.getElementById('punctuation-list');
        list.innerHTML = '';
        state.modes[state.currentMode].pairs.forEach(p => addPairUI(p.find, p.replace));
    }

    function loadModes() {
        const sel = document.getElementById('mode-select');
        sel.innerHTML = '';
        Object.keys(state.modes).forEach(m => {
            const opt = document.createElement('option');
            opt.value = m; opt.textContent = m;
            sel.appendChild(opt);
        });
        sel.value = state.currentMode;
        sel.onchange = (e) => { state.currentMode = e.target.value; loadPairs(); save(); };
    }

    function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

    init();
});
