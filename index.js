document.addEventListener('DOMContentLoaded', () => {
    // ================= CONFIG =================
    const STORAGE_KEY = 'trinh_hg_v23_config';
    const M = { RS: '\uE000', RE: '\uE001', CS: '\uE002', CE: '\uE003', MS: '\uE004', ME: '\uE005' };
    
    const defaultState = {
        currentMode: 'default',
        modes: { 
            default: { pairs: [], matchCase: false, wholeWord: false, autoCaps: false, exceptions: 'jpg, png' } 
        },
        ui: { font: "'Montserrat', sans-serif", size: "15px" }
    };

    let state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultState;
    if(!state.modes[state.currentMode]) state.currentMode = 'default';

    // ================= DOM =================
    const el = (id) => document.getElementById(id);
    const els = {
        tabs: document.querySelectorAll('.tab-btn'),
        contents: document.querySelectorAll('.tab-content'),
        // Replace
        inpRep: el('inp-replace'), outRep: el('out-replace'), btnRep: el('btn-do-replace'), 
        btnCopyRep: el('btn-copy-rep'), badgeRep: el('badge-rep'), badgeCaps: el('badge-caps'),
        // Standardize
        inpStd: el('inp-std'), btnDoStd: el('btn-do-std'), btnCopyStd: el('btn-copy-std'),
        stdRadios: document.getElementsByName('std-format'),
        // Split
        inpSplit: el('inp-split'), outSplitContainer: el('out-split-container'), 
        btnSplit: el('btn-do-split'), splitRadios: document.getElementsByName('split-mode'),
        splitChips: document.querySelectorAll('.chip'), splitRegexInput: el('inp-split-regex'),
        // Settings Sidebar
        sbItems: document.querySelectorAll('.sb-item'),
        panels: document.querySelectorAll('.panel'),
        // Settings Data
        listPairs: el('list-pairs'), btnAddPair: el('btn-add-pair'), btnSaveAll: el('btn-save-all'),
        selMode: el('sel-mode'), btnAddMode: el('btn-add-mode'), btnDelMode: el('btn-del-mode'),
        btnImport: el('btn-import'), btnExport: el('btn-export'),
        // Config & UI
        tgCase: el('tg-case'), tgWord: el('tg-word'), tgCaps: el('tg-caps'), 
        inpExc: el('inp-exceptions'), btnSaveConfig: el('btn-save-config'),
        selFont: el('sel-font'), selSize: el('sel-size'), btnApplyUI: el('btn-apply-ui')
    };

    // ================= CORE FUNCTIONS =================
    function canonicalize(str) { return str ? str.normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim() : ''; }
    function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    function showNotify(msg, type='success') {
        const d = document.createElement('div'); d.className = `notify ${type}`; d.textContent = msg;
        el('notify-box').appendChild(d); setTimeout(() => d.remove(), 3000);
    }

    // ================= NAVIGATION =================
    function switchTab(id) {
        els.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === id));
        els.contents.forEach(c => c.classList.toggle('active', c.id === id));
    }
    els.tabs.forEach(t => t.onclick = () => switchTab(t.dataset.tab));

    function switchPanel(id) {
        els.sbItems.forEach(i => i.classList.toggle('active', i.dataset.panel === id));
        els.panels.forEach(p => p.classList.toggle('active', p.id === id));
    }
    els.sbItems.forEach(i => i.onclick = () => switchPanel(i.dataset.panel));

    // ================= FEATURE: REPLACE =================
    els.btnRep.onclick = () => {
        const raw = els.inpRep.value; if(!raw) return showNotify('Trống!', 'error');
        let text = raw.normalize('NFC').replace(/\r\n/g, '\n');
        const mode = state.modes[state.currentMode];
        let cRep = 0, cCaps = 0;

        // 1. Replace
        mode.pairs.filter(p=>p.find).sort((a,b)=>b.find.length - a.find.length).forEach(p => {
            const find = canonicalize(p.find);
            const regex = new RegExp(mode.wholeWord ? `(?<![\\p{L}_])${escapeRegExp(find)}(?![\\p{L}_])` : escapeRegExp(find), mode.matchCase ? 'gu' : 'giu');
            text = text.replace(regex, (m) => {
                cRep++;
                let r = canonicalize(p.replace);
                if(!mode.matchCase && m[0] === m[0].toUpperCase()) r = r.charAt(0).toUpperCase() + r.slice(1);
                return `${M.RS}${r}${M.RE}`;
            });
        });

        // 2. Auto Caps
        if(mode.autoCaps) {
            const exc = (mode.exceptions||'').split(',').map(s=>s.trim().toLowerCase());
            const rx = /(^|[.?!]\s+)(?:(\uE000)(.*?)(\uE001)|([^\s\uE000\uE001]+))/gmu;
            text = text.replace(rx, (m, pre, mS, mC, mE, word) => {
                const w = mC || word; if(!w || exc.includes(w.toLowerCase())) return m;
                if(w[0] === w[0].toUpperCase() && !mS) return m;
                cCaps++;
                return `${pre}${mS ? M.MS : M.CS}${w[0].toUpperCase() + w.slice(1)}${mE || M.CE}`;
            });
        }

        // 3. Render
        let html = ''; let buf = '';
        for(let c of text) {
            if(Object.values(M).includes(c)) {
                html += buf.replace(/&/g,"&amp;").replace(/</g,"&lt;") + (c===M.RS?'<mark class="hl-yellow">':c===M.CS?'<mark class="hl-blue">':c===M.MS?'<mark class="hl-orange">':'</mark>');
                buf = '';
            } else buf += c;
        }
        els.outRep.innerHTML = html + buf.replace(/&/g,"&amp;").replace(/</g,"&lt;");
        els.badgeRep.textContent = `Rep: ${cRep}`; els.badgeCaps.textContent = `Caps: ${cCaps}`;
        showNotify('Hoàn tất!');
    };
    els.btnCopyRep.onclick = () => { navigator.clipboard.writeText(els.outRep.innerText); showNotify('Đã chép!'); };
    els.inpRep.oninput = () => el('wc-input').textContent = els.inpRep.value.split(/\s+/).length + ' Words';

    // ================= FEATURE: STANDARDIZE (NEW) =================
    els.btnDoStd.onclick = () => {
        let txt = els.inpStd.value; if(!txt) return;
        const fmt = document.querySelector('input[name="std-format"]:checked').value;
        // Logic: Context : "Dialogue"
        const regex = /(^|\n)\s*(.*?)\s*:\s*(?:\r?\n\s*)?["“](.*?)["”]/gs;
        
        txt = txt.replace(regex, (m, start, ctx, dia) => {
            const cleanCtx = ctx.trim(); const cleanDia = dia.trim();
            if(fmt === 'inline') return `${start}${cleanCtx}: “${cleanDia}”`;
            if(fmt === 'newline') return `${start}${cleanCtx}:\n\n“${cleanDia}”`;
            if(fmt === 'dash') return `${start}${cleanCtx}:\n\n- ${cleanDia}`;
        });
        els.inpStd.value = txt; showNotify('Đã chuẩn hóa!');
    };
    els.btnCopyStd.onclick = () => { navigator.clipboard.writeText(els.inpStd.value); showNotify('Đã chép!'); };

    // ================= FEATURE: SPLIT =================
    Array.from(els.splitRadios).forEach(r => r.onchange = e => {
        const isRg = e.target.value === 'regex';
        els.splitRegexInput.parentElement.classList.toggle('hidden', !isRg);
        el('split-count-opts').classList.toggle('hidden', isRg);
    });
    els.splitChips.forEach(c => c.onclick = () => { els.splitChips.forEach(x=>x.classList.remove('active')); c.classList.add('active'); });
    els.btnSplit.onclick = () => {
        const txt = els.inpSplit.value; if(!txt) return;
        const mode = document.querySelector('input[name="split-mode"]:checked').value;
        els.outSplitContainer.innerHTML = '';
        let parts = [];

        if(mode === 'regex') {
            const rgxStr = els.splitRegexInput.value; if(!rgxStr) return showNotify('Thiếu Regex', 'error');
            const matches = [...txt.matchAll(new RegExp(rgxStr, 'gmi'))];
            if(!matches.length) return showNotify('Không tìm thấy chương', 'error');
            for(let i=0; i<matches.length; i++) {
                parts.push(txt.substring(matches[i].index, matches[i+1]?.index || txt.length).trim());
            }
        } else {
            const cnt = parseInt(document.querySelector('.chip.active').dataset.val);
            const w = txt.split(/\s+/); const chunk = Math.ceil(w.length/cnt);
            for(let i=0;i<cnt;i++) parts.push(w.slice(i*chunk, (i+1)*chunk).join(' '));
        }
        parts.forEach((p,i) => {
            const div = document.createElement('div'); div.className = 'split-item';
            div.innerHTML = `<b>Phần ${i+1}</b><textarea class="full-width custom-scrollbar" style="height:100px;margin-top:5px" readonly>${p}</textarea><button class="btn btn-sm btn-success mt-10" onclick="navigator.clipboard.writeText(this.previousElementSibling.value)">Copy</button>`;
            els.outSplitContainer.appendChild(div);
        });
    };

    // ================= SETTINGS LOGIC =================
    function renderPairs() {
        els.listPairs.innerHTML = '';
        state.modes[state.currentMode].pairs.forEach((p, i) => {
            const d = document.createElement('div'); d.className = 'pair-item';
            d.innerHTML = `<input class="find" value="${p.find.replace(/"/g,'&quot;')}" placeholder="Tìm"><input class="rep" value="${p.replace.replace(/"/g,'&quot;')}" placeholder="Thay"><button class="btn btn-danger btn-sm" onclick="delPair(${i})">X</button>`;
            d.querySelector('.find').oninput = e => state.modes[state.currentMode].pairs[i].find = e.target.value;
            d.querySelector('.rep').oninput = e => state.modes[state.currentMode].pairs[i].replace = e.target.value;
            els.listPairs.appendChild(d);
        });
    }
    window.delPair = (i) => { state.modes[state.currentMode].pairs.splice(i,1); renderPairs(); };
    els.btnAddPair.onclick = () => { state.modes[state.currentMode].pairs.unshift({find:'',replace:''}); renderPairs(); };
    
    function saveAll() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); showNotify('Đã lưu!'); applyUI(); }
    els.btnSaveAll.onclick = saveAll; els.btnSaveConfig.onclick = saveAll; els.btnApplyUI.onclick = saveAll;

    // Config Toggles
    const toggler = (el, prop) => {
        el.onclick = () => { 
            state.modes[state.currentMode][prop] = !state.modes[state.currentMode][prop];
            updateConfigUI(); 
        };
    };
    toggler(els.tgCase, 'matchCase'); toggler(els.tgWord, 'wholeWord'); toggler(els.tgCaps, 'autoCaps');
    
    function updateConfigUI() {
        const m = state.modes[state.currentMode];
        const setBtn = (b, v, t) => { b.textContent = `${t}: ${v?'BẬT':'Tắt'}`; b.classList.toggle('active', v); };
        setBtn(els.tgCase, m.matchCase, 'Match Case');
        setBtn(els.tgWord, m.wholeWord, 'Whole Word');
        setBtn(els.tgCaps, m.autoCaps, 'Auto Caps');
        els.inpExc.value = m.exceptions || '';
        
        // Mode Select
        els.selMode.innerHTML = '';
        Object.keys(state.modes).forEach(k => {
            const o = document.createElement('option'); o.value = k; o.textContent = k;
            els.selMode.appendChild(o);
        });
        els.selMode.value = state.currentMode;
    }
    
    els.selMode.onchange = e => { state.currentMode = e.target.value; updateConfigUI(); renderPairs(); };
    els.btnAddMode.onclick = () => { const n = prompt('Tên?'); if(n && !state.modes[n]) { state.modes[n] = JSON.parse(JSON.stringify(defaultState.modes.default)); state.currentMode = n; updateConfigUI(); renderPairs(); } };
    els.btnDelMode.onclick = () => { if(confirm('Xóa?')) { delete state.modes[state.currentMode]; state.currentMode = Object.keys(state.modes)[0]||'default'; if(!state.modes.default) state.modes.default = defaultState.modes.default; updateConfigUI(); renderPairs(); } };

    // Import/Export
    els.btnExport.onclick = () => {
        let csv = "find,replace\n" + state.modes[state.currentMode].pairs.map(p=>`"${p.find}","${p.replace}"`).join('\n');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv])); a.download = 'data.csv'; a.click();
    };
    els.btnImport.onclick = () => {
        const i = document.createElement('input'); i.type='file'; i.onchange = e => {
            const r = new FileReader(); r.onload = ev => {
                ev.target.result.split('\n').forEach(l => {
                    const c = l.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
                    if(c && c.length>=2) state.modes[state.currentMode].pairs.push({find:canonicalize(c[0].replace(/"/g,'')), replace:canonicalize(c[1].replace(/"/g,''))});
                }); renderPairs();
            }; r.readAsText(e.target.files[0]);
        }; i.click();
    };

    // UI Styles
    function applyUI() {
        state.ui.font = els.selFont.value; state.ui.size = els.selSize.value;
        const css = `.pane textarea, .output-div, #inp-std { font-family: ${state.ui.font} !important; font-size: ${state.ui.size} !important; }`;
        let s = el('dyn-css'); if(!s) { s = document.createElement('style'); s.id='dyn-css'; document.head.appendChild(s); }
        s.innerHTML = css;
        els.selFont.value = state.ui.font; els.selSize.value = state.ui.size;
    }

    // Init
    updateConfigUI(); renderPairs(); applyUI();
    els.inpExc.oninput = e => state.modes[state.currentMode].exceptions = e.target.value;
    els.selFont.onchange = applyUI; els.selSize.onchange = applyUI;
});
