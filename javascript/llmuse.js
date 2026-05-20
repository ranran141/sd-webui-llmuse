// no builtin protection — all presets are editable/deletable

const SVG_TRASH = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

/* ── プロンプト欄へ送信 ── */
function llmDecSend(text, tab) {
    const el = gradioApp().querySelector(`#${tab}_prompt textarea`);
    if (!el) return text;
    const existing = el.value.trim();
    el.value = existing ? existing + "\n" + text : text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return text;
}

/* ── ヘルパー ── */
function llmDecGetDropdownValue(tab) {
    const wrap = gradioApp().querySelector(`#llm_dec_dropdown_${tab}`);
    if (!wrap) return "";
    const input = wrap.querySelector("input");
    return input ? input.value : "";
}

function llmDecGetPresets(tab) {
    const el = gradioApp().querySelector(`#llm_dec_presets_json_${tab} textarea`);
    if (!el) return {};
    try { return JSON.parse(el.value); } catch { return {}; }
}

function llmDecCloseModal() {
    const m = document.getElementById("llm-dec-modal");
    if (m) m.remove();
}

/* ══════════════════════════════════════
   設定モーダル
   ══════════════════════════════════════ */
function llmDecOpenSettings(tab) {
    llmDecCloseSettings();
    const settingsEl = gradioApp().querySelector(`#llm_dec_settings_json_${tab} textarea`);
    const s = settingsEl ? (() => { try { return JSON.parse(settingsEl.value); } catch { return {}; } })() : {};
    const timeout    = s.timeout         ?? 30;
    const ttlEnabled = s.gpu_ttl_enabled ?? false;
    const ttl        = s.gpu_ttl         ?? 300;
    const lmUrl      = s.lm_url          ?? "http://localhost:1234";
    const autoSend   = s.auto_send       ?? false;
    const temp       = parseFloat(s.temperature ?? 0.8).toFixed(1);

    const modal = document.createElement("div");
    modal.id = "llm-dec-settings-modal";
    modal.innerHTML = `
        <div class="llm-dec-bd" onclick="llmDecCloseSettings()"></div>
        <div class="llm-dec-box llm-dec-settings-box">
            <div class="llm-dec-hdr">
                <span class="llm-dec-settings-title">⚙ Settings</span>
            </div>

            <div class="llm-dec-settings-body">

                <!-- URL -->
                <div class="llm-dec-settings-row">
                    <label class="llm-dec-settings-label">LM Studio URL</label>
                    <input type="text" class="llm-dec-settings-url" id="llm-dec-settings-url"
                        value="${lmUrl}" placeholder="http://localhost:1234">
                </div>

                <!-- Randomness -->
                <div class="llm-dec-settings-row">
                    <label class="llm-dec-settings-label">Randomness</label>
                    <div class="llm-dec-settings-inline">
                        <span class="llm-dec-settings-hint">Controls output creativity (0.1 – 2.0)</span>
                        <input type="number" class="llm-dec-settings-num" id="llm-dec-settings-temp"
                            min="0.1" max="2.0" step="0.1" value="${temp}">
                    </div>
                </div>

                <!-- Auto-send -->
                <div class="llm-dec-settings-row">
                    <label class="llm-dec-settings-label">Auto-send</label>
                    <label class="llm-dec-settings-check-label">
                        <input type="checkbox" id="llm-dec-settings-autosend"
                            ${autoSend ? "checked" : ""}>
                        Send to prompt automatically after generation
                    </label>
                </div>

                <!-- Auto-unload -->
                <div class="llm-dec-settings-row">
                    <label class="llm-dec-settings-label">Auto-unload</label>
                    <label class="llm-dec-settings-check-label">
                        <input type="checkbox" id="llm-dec-settings-ttl-enabled"
                            ${ttlEnabled ? "checked" : ""}
                            onchange="document.getElementById('llm-dec-settings-ttl').disabled=!this.checked">
                        <span class="llm-dec-settings-hint">Unload model from VRAM after use (sec)</span>
                        <span style="display:inline-flex; align-items:center; gap:4px">
                            <input type="number" class="llm-dec-settings-num" id="llm-dec-settings-ttl"
                                min="1" max="3600" value="${ttl}"
                                ${ttlEnabled ? "" : "disabled"}>
                        </span>
                    </label>
                </div>

                <!-- Timeout -->
                <div class="llm-dec-settings-row">
                    <label class="llm-dec-settings-label">Timeout</label>
                    <div class="llm-dec-settings-inline">
                        <span class="llm-dec-settings-hint">Abort if no response (sec)</span>
                        <input type="number" class="llm-dec-settings-num" id="llm-dec-settings-timeout"
                            min="5" max="300" value="${timeout}">
                    </div>
                </div>

                <!-- Force Unload -->
                <div class="llm-dec-settings-row">
                    <label class="llm-dec-settings-label">Force Unload</label>
                    <div class="llm-dec-settings-inline">
                        <span class="llm-dec-settings-hint">Remove all models from VRAM now</span>
                        <button class="llm-dec-settings-action-btn" id="llm-dec-force-unload-btn"
                            onclick="llmDecForceUnload('${tab}')">Unload</button>
                    </div>
                </div>

            </div>

            <div class="llm-dec-footer">
                <button class="llm-dec-btn llm-dec-btn-ok" onclick="llmDecSaveSettings('${tab}')">💾 Save</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

function llmDecCloseSettings() {
    const m = document.getElementById("llm-dec-settings-modal");
    if (m) m.remove();
}


function llmDecForceUnload(tab) {
    const btn = document.getElementById("llm-dec-force-unload-btn");
    const trigger = gradioApp().querySelector(`#llm_dec_force_unload_trigger_${tab} textarea`);
    const statusEl = gradioApp().querySelector(`#llm_dec_force_unload_status_${tab} textarea`);
    if (!trigger || !statusEl) return;
    if (btn) { btn.textContent = "…"; btn.disabled = true; }
    const prev = statusEl.value;
    llmDecFireTrigger(trigger, { ts: Date.now() });
    const poll = setInterval(() => {
        if (statusEl.value !== prev) {
            clearInterval(poll);
            const ok = statusEl.value.startsWith("✓");
            if (btn) {
                btn.textContent = ok ? "✓" : "✕";
                btn.style.color = ok ? "#6ee7b7" : "#f87171";
                btn.disabled = false;
                setTimeout(() => { btn.textContent = "Unload"; btn.style.color = ""; }, 2000);
            }
        }
    }, 300);
}

function llmDecSaveSettings(tab) {
    const trigger  = gradioApp().querySelector(`#llm_dec_settings_trigger_${tab} textarea`);
    const timeout  = parseInt(document.getElementById("llm-dec-settings-timeout")?.value)  || 30;
    const temp     = parseFloat(document.getElementById("llm-dec-settings-temp")?.value)   || 0.8;
    const ttlEn    = document.getElementById("llm-dec-settings-ttl-enabled")?.checked      ?? false;
    const ttl      = parseInt(document.getElementById("llm-dec-settings-ttl")?.value)      || 300;
    const lmUrl    = document.getElementById("llm-dec-settings-url")?.value.trim()         || "http://localhost:1234";
    const autoSend = document.getElementById("llm-dec-settings-autosend")?.checked         ?? false;

    llmDecFireTrigger(trigger, { temperature: temp, timeout, gpu_ttl_enabled: ttlEn, gpu_ttl: ttl, lm_url: lmUrl, auto_send: autoSend });

    const saveBtn = document.querySelector("#llm-dec-settings-modal .llm-dec-btn-ok");
    if (saveBtn) {
        const orig = saveBtn.innerHTML;
        saveBtn.textContent = "✓ Saved";
        saveBtn.disabled = true;
        setTimeout(() => { saveBtn.innerHTML = orig; saveBtn.disabled = false; }, 1000);
    }
}

function llmDecAutoSend(text, tab) {
    if (text) llmDecSend(text, tab);
    return text;
}

/* change イベントで Gradio にコマンドを送る */
function llmDecFireTrigger(el, payload) {
    if (!el) return;
    el.value = JSON.stringify({ ...payload, ts: Date.now() });
    el.dispatchEvent(new Event("input",  { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
}

/* ══════════════════════════════════════
   統合モーダル
   isNew=false: ✏ 編集（現在のプリセットをロード）
   isNew=true : ＋ 新規（空欄でスタート）
   ══════════════════════════════════════ */
function llmDecOpenModal(tab, isNew) {
    isNew = !!isNew;
    const hidden = gradioApp().querySelector(`#llm_dec_sp_${tab} textarea`);
    if (!hidden) return;
    llmDecCloseModal();

    const currentName    = isNew ? "" : llmDecGetDropdownValue(tab);
    const currentContent = isNew ? "" : hidden.value;
    const presets        = llmDecGetPresets(tab);
    const isLast         = Object.keys(presets).length <= 1;

    const loadOpts = `<option value="">Select preset</option>` +
        Object.keys(presets).map(n => `<option value="${n}">${n}</option>`).join("");

    const SVG_PLUS = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

    const modal = document.createElement("div");
    modal.id = "llm-dec-modal";
    modal.innerHTML = `
        <div class="llm-dec-bd" onclick="llmDecCloseModal()"></div>
        <div class="llm-dec-box">

            <div class="llm-dec-hdr">
                <select class="llm-dec-load-sel" id="llm-dec-load-sel"
                    onchange="llmDecLoadIntoModal('${tab}')">
                    ${loadOpts}
                </select>
                <button class="llm-dec-icon-btn llm-dec-new-btn"
                    onclick="llmDecStartNew('${tab}')" title="新規">
                    ${SVG_PLUS}
                </button>
                <button class="llm-dec-icon-btn llm-dec-del-btn" id="llm-dec-del-btn"
                    onclick="llmDecDeleteFromModal('${tab}')" title="削除"
                    ${isNew || isLast ? "disabled" : ""}>
                    ${SVG_TRASH}
                </button>
            </div>

            <div class="llm-dec-name-row" id="llm-dec-name-row" style="display:${isNew ? 'flex' : 'none'}">
                <input type="text" class="llm-dec-name-input" id="llm-dec-name">
            </div>

            <textarea class="llm-dec-ta" id="llm-dec-ta"
                spellcheck="false">${currentContent}</textarea>

            <div class="llm-dec-footer">
                <button class="llm-dec-btn llm-dec-btn-ok" id="llm-dec-save-btn"
                    onclick="llmDecSaveModal('${tab}')">💾 Save</button>
            </div>
        </div>`;
    document.body.appendChild(modal);

    if (isNew) {
        document.getElementById("llm-dec-name").focus();
    } else {
        const sel = document.getElementById("llm-dec-load-sel");
        if (sel && currentName) sel.value = currentName;
        document.getElementById("llm-dec-ta").focus();
    }
}

/* ＋ボタン: 名前入力行を表示して新規モードへ（ヘッダーは変えない） */
function llmDecStartNew(tab) {
    const sel     = document.getElementById("llm-dec-load-sel");
    const nameRow = document.getElementById("llm-dec-name-row");
    const nameEl  = document.getElementById("llm-dec-name");
    const ta      = document.getElementById("llm-dec-ta");
    const delBtn  = document.getElementById("llm-dec-del-btn");
    if (sel) sel.value = "";
    if (ta)  ta.value  = "";
    if (nameEl) nameEl.value = "";
    if (nameRow) nameRow.style.display = "flex";
    if (delBtn)  delBtn.disabled = true;
    if (nameEl)  nameEl.focus();
}

/* 既存プリセットをモーダルに読み込む */
function llmDecLoadIntoModal(tab) {
    const sel     = document.getElementById("llm-dec-load-sel");
    const ta      = document.getElementById("llm-dec-ta");
    const nameRow = document.getElementById("llm-dec-name-row");
    if (!sel?.value) return;
    const presets = llmDecGetPresets(tab);
    if (ta) ta.value = presets[sel.value] || "";
    if (nameRow) nameRow.style.display = "none";
    llmDecSyncDelBtn(tab);
}

/* 🗑 ボタンの有効/無効を同期 */
function llmDecSyncDelBtn(tab) {
    const nameRow = document.getElementById("llm-dec-name-row");
    const sel     = document.getElementById("llm-dec-load-sel");
    const delBtn  = document.getElementById("llm-dec-del-btn");
    if (!delBtn) return;
    const isNewMode = nameRow?.style.display !== "none";
    if (isNewMode) { delBtn.disabled = true; return; }
    const presets = tab ? llmDecGetPresets(tab) : {};
    delBtn.disabled = !sel?.value || Object.keys(presets).length <= 1;
}

/* 保存（モーダルは閉じない） */
function llmDecSaveModal(tab) {
    const ta      = document.getElementById("llm-dec-ta");
    const saveBtn = document.getElementById("llm-dec-save-btn");
    const hidden  = gradioApp().querySelector(`#llm_dec_sp_${tab} textarea`);
    const trigger = gradioApp().querySelector(`#llm_dec_save_trigger_${tab} textarea`);
    if (!ta || !hidden) return;

    const nameRow = document.getElementById("llm-dec-name-row");
    const nameEl  = document.getElementById("llm-dec-name");
    const sel     = document.getElementById("llm-dec-load-sel");
    const isNewMode = nameRow?.style.display !== "none";
    const name = (isNewMode ? nameEl?.value.trim() : sel?.value.trim()) || "";
    if (!name) {
        const target = isNewMode ? nameEl : sel;
        if (target) {
            target.style.borderColor = "#ef4444";
            target.focus();
            setTimeout(() => { target.style.borderColor = ""; }, 1500);
        }
        return;
    }

    hidden.value = ta.value;
    hidden.dispatchEvent(new Event("input",  { bubbles: true }));
    hidden.dispatchEvent(new Event("change", { bubbles: true }));

    llmDecFireTrigger(trigger, { name, content: ta.value });

    if (saveBtn) {
        const orig = saveBtn.innerHTML;
        saveBtn.textContent = "✓ Saved";
        saveBtn.disabled = true;
        setTimeout(() => {
            saveBtn.innerHTML = orig;
            saveBtn.disabled  = false;
            llmDecRefreshLoadSel(tab, name);
        }, 1000);
    }
}

/* セレクトを保存後に更新 */
function llmDecRefreshLoadSel(tab, savedName) {
    const sel     = document.getElementById("llm-dec-load-sel");
    const nameRow = document.getElementById("llm-dec-name-row");
    if (!sel) return;
    const presets = llmDecGetPresets(tab);
    const names = Object.keys(presets);
    if (savedName && !names.includes(savedName)) names.push(savedName);
    sel.innerHTML = `<option value="">Select preset</option>` +
        names.map(n => `<option value="${n}">${n}</option>`).join("");
    sel.value = savedName || "";
    if (nameRow) nameRow.style.display = "none";
    llmDecSyncDelBtn(tab);
}

/* 削除（モーダルは閉じない） */
function llmDecDeleteFromModal(tab) {
    const sel  = document.getElementById("llm-dec-load-sel");
    const name = sel?.value.trim() || "";
    if (!name) return;
    const presets = llmDecGetPresets(tab);
    if (Object.keys(presets).length <= 1) return;
    const trigger = gradioApp().querySelector(`#llm_dec_delete_trigger_${tab} textarea`);
    llmDecFireTrigger(trigger, { name });

    for (const opt of [...sel.options]) {
        if (opt.value === name) { opt.remove(); break; }
    }
    const nextOpt = [...sel.options].find(o => o.value);
    if (nextOpt) {
        sel.value = nextOpt.value;
        llmDecLoadIntoModal(tab);
    } else {
        const ta = document.getElementById("llm-dec-ta");
        if (ta) ta.value = "";
        sel.value = "";
        const delBtn = document.getElementById("llm-dec-del-btn");
        if (delBtn) delBtn.disabled = true;
    }
}

/* ── スタイル ── */
(function injectStyle() {
    const css = `
.llm-dec-sp-hidden { display: none !important; }

/* ── モーダル共通 ── */
#llm-dec-modal,
#llm-dec-settings-modal {
    position: fixed; inset: 0; z-index: 9999;
    display: flex; align-items: center; justify-content: center;
}
.llm-dec-bd {
    position: absolute; inset: 0;
    background: rgba(0,0,0,0.55); backdrop-filter: blur(3px);
}
.llm-dec-box {
    position: relative; z-index: 1; width: min(680px, 94vw);
    background: var(--background-fill-primary);
    border: 1px solid var(--border-color-primary);
    border-radius: 10px; box-shadow: 0 20px 60px rgba(0,0,0,0.65);
    display: flex; flex-direction: column; overflow: hidden;
}

/* ヘッダー行 */
.llm-dec-hdr {
    display: flex; align-items: center; gap: 7px;
    padding: 10px 12px;
    background: var(--background-fill-secondary);
}
.llm-dec-load-sel {
    flex: 1.5; min-width: 0; height: 32px; padding: 0 8px;
    background: var(--input-background-fill);
    border: 1px solid var(--border-color-primary);
    border-radius: 6px; color: var(--body-text-color);
    font-size: 14px; font-family: 'Segoe UI', sans-serif; outline: none; cursor: pointer;
}
.llm-dec-load-sel:focus { border-color: var(--body-text-color-subdued); }
.llm-dec-icon-btn {
    width: 28px; height: 28px; flex-shrink: 0; padding: 0;
    border: 1px solid var(--border-color-primary);
    border-radius: 6px; background: transparent;
    color: var(--body-text-color-subdued); cursor: pointer; transition: all 0.15s;
    display: flex; align-items: center; justify-content: center;
}
.llm-dec-del-btn:not(:disabled):hover {
    border-color: #ef4444; color: #f87171; background: rgba(239,68,68,0.08);
}
.llm-dec-icon-btn:disabled { opacity: 0.2; cursor: not-allowed; }

/* 名前入力行（新規作成時のみ表示） */
.llm-dec-name-row {
    padding: 8px 12px;
    background: var(--background-fill-secondary);
    border-bottom: 1px solid var(--border-color-primary);
    align-items: center;
}
.llm-dec-name-input {
    width: 100%; height: 32px; padding: 0 10px; box-sizing: border-box;
    background: var(--input-background-fill);
    border: 1px solid var(--border-color-primary);
    border-radius: 6px; color: var(--body-text-color);
    font-size: 13px; outline: none; transition: border-color 0.15s;
}
.llm-dec-name-input:focus { border-color: var(--body-text-color-subdued); }
.llm-dec-name-input::placeholder { color: var(--border-color-primary); }

/* テキストエリア */
.llm-dec-ta {
    flex: 1; min-height: 200px; max-height: 50vh; padding: 14px;
    background: var(--input-background-fill);
    border: none; border-bottom: 1px solid var(--border-color-primary);
    outline: none; color: var(--body-text-color);
    font-family: 'Segoe UI', sans-serif; font-size: 13px; line-height: 1.65; resize: none;
}
.llm-dec-ta::placeholder { color: var(--body-text-color-subdued); }

/* フッター */
.llm-dec-footer {
    display: flex; justify-content: flex-end; gap: 6px;
    padding: 10px 12px;
    background: var(--background-fill-secondary);
}
.llm-dec-btn {
    height: 32px; padding: 0 14px; border-radius: 6px;
    border: 1px solid var(--border-color-primary);
    background: transparent; color: var(--body-text-color-subdued);
    font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s;
}
.llm-dec-btn:hover { background: var(--background-fill-primary); color: var(--body-text-color); }
.llm-dec-btn-ok {
    border-color: var(--body-text-color-subdued) !important;
    color: var(--body-text-color) !important;
    background: var(--background-fill-secondary) !important;
}
.llm-dec-btn-ok:hover   { background: var(--background-fill-primary) !important; }
.llm-dec-btn-ok:disabled { opacity: 0.5; cursor: default; }

/* ── 設定モーダル ── */
.llm-dec-settings-box { width: min(480px, 94vw) !important; }
.llm-dec-settings-title {
    font-size: 13px; font-weight: 600; color: var(--body-text-color);
}
.llm-dec-settings-body {
    display: flex; flex-direction: column; gap: 0;
    padding: 4px 0;
}
.llm-dec-settings-row {
    display: flex; flex-direction: column; gap: 5px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color-primary);
}
.llm-dec-settings-row:last-child { border-bottom: none; }
.llm-dec-settings-label {
    font-size: 12px; font-weight: 600;
    color: var(--body-text-color);
    text-transform: uppercase; letter-spacing: 0.05em;
}
.llm-dec-settings-action-btn {
    width: 72px; height: 30px; padding: 0; flex-shrink: 0;
    background: transparent; border: 1px solid var(--border-color-primary);
    border-radius: 6px; color: var(--body-text-color-subdued);
    font-size: 13px; cursor: pointer; transition: all 0.15s;
}
.llm-dec-settings-action-btn:hover { border-color: var(--body-text-color-subdued); color: var(--body-text-color); }
.llm-dec-settings-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.llm-dec-settings-inline {
    display: flex; align-items: center; gap: 8px;
}
.llm-dec-settings-num {
    width: 72px; height: 30px; padding: 0 8px; text-align: center;
    background: var(--input-background-fill);
    border: 1px solid var(--border-color-primary);
    border-radius: 6px; color: var(--body-text-color);
    font-size: 13px; outline: none;
}
.llm-dec-settings-num:focus { border-color: var(--body-text-color-subdued); }
.llm-dec-settings-hint { flex: 1; font-size: 13px; color: var(--body-text-color-subdued); }
.llm-dec-settings-check-label {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; color: var(--body-text-color-subdued); cursor: pointer;
}
.llm-dec-settings-check-label input[type="checkbox"] { accent-color: var(--body-text-color-subdued); cursor: pointer; }
.llm-dec-settings-url {
    width: 100%; height: 30px; padding: 0 8px; box-sizing: border-box;
    background: var(--input-background-fill);
    border: 1px solid var(--border-color-primary);
    border-radius: 6px; color: var(--body-text-color);
    font-size: 12px; font-family: monospace; outline: none;
}
.llm-dec-settings-url:focus { border-color: var(--body-text-color-subdued); }

`;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
})();
