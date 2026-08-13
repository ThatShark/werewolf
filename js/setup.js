import { s, wolf_faction, speak } from './core.js';
import { buildNightQueue, runNextNightRole } from './main.js';

// ==========================================
// 設定頁初始化、角色錄入、隨機發牌、板子選擇、事件綁定
// ==========================================

/** 開啟角色選擇彈窗 */
function openRoleModal(role_setup_grid) {
    const modal_role_options = document.getElementById('modal-role-options');
    const role_modal = document.getElementById('role-modal');
    modal_role_options.innerHTML = '';
    for (const role_id of Object.keys(s.current_board.roles)) {
        const btn = document.createElement('button');
        btn.classList.add('role-select-btn');
        btn.innerHTML = `${s.ROLE_DICT[role_id].icon} ${s.ROLE_DICT[role_id].name}`;
        btn.addEventListener('click', () => {
            s.player_roles[s.current_editing_seat] = role_id;
            const grid_btn = role_setup_grid.children[s.current_editing_seat - 1];
            grid_btn.dataset.status = 'set';
            grid_btn.innerHTML = `<span class="seat-num">${s.current_editing_seat}號</span><span class="role-name">✔️已隱藏</span>`;
            role_modal.classList.add('hidden');
        });
        modal_role_options.appendChild(btn);
    }
    role_modal.classList.remove('hidden');
}

/** 隨機模式下逐位查看身分 */
function renderRandomRoleView(btn_start_night) {
    let container = document.getElementById('random-role-ui');
    if (s.current_viewing_seat > s.total_players) {
        container.innerHTML = `<h3 style="color:#00ff88;">✅ 所有玩家確認完畢</h3>`;
        btn_start_night.classList.remove('hidden');
        return;
    }
    let disp_role = s.player_roles[s.current_viewing_seat];
    let display_role_key = disp_role;
    if (s.current_board?.id === '12_shadow' && (disp_role === 'seer_A' || disp_role === 'seer_B')) {
        display_role_key = 'seer';
    }

    container.innerHTML = `
        <button id="btn-view-role" class="num-btn" style="width:100%; padding:30px; font-size:22px;">點擊查看 ${s.current_viewing_seat} 號 身分</button>
        <div id="view-role-result" class="hidden" style="background:var(--bg-card); padding:30px; border-radius:12px; width:100%; border:2px solid var(--color-accent);">
            <p style="margin:0; color:var(--color-text-muted); font-size:18px;">你的身分是：</p>
            <p style="font-size:40px; margin:10px 0; font-weight:bold; color:var(--color-accent);">${s.ROLE_DICT[display_role_key].icon} ${s.ROLE_DICT[display_role_key].name}</p>
        </div>
        <button id="btn-next-view" class="primary-btn hidden" style="margin-top:10px;">確認並換下一位</button>
    `;
    document.getElementById('btn-view-role').onclick = () => {
        document.getElementById('btn-view-role').classList.add('hidden');
        document.getElementById('view-role-result').classList.remove('hidden');
        document.getElementById('btn-next-view').classList.remove('hidden');
    };
    document.getElementById('btn-next-view').onclick = () => {
        s.current_viewing_seat++;
        renderRandomRoleView(btn_start_night);
    };
}

/** 初始化角色設定頁面（手動或隨機模式） */
function initRoleSetup(count_select, setting_board, role_setup_grid, btn_start_night) {
    s.total_players = parseInt(count_select.value);
    s.current_board = s.BOARD_CONFIGS[s.total_players].find(b => b.id === setting_board.value);
    s.player_roles = {};
    s.player_status = {};
    s.is_random_mode = document.getElementById('setting-random-role').checked;

    let p_tag = document.querySelector('#screen-setup p');
    if (s.is_random_mode) {
        role_setup_grid.classList.add('hidden');
        if (p_tag) p_tag.classList.add('hidden');
        btn_start_night.classList.add('hidden');
        if (!document.getElementById('random-role-ui')) {
            let rr_div = document.createElement('div');
            rr_div.id = 'random-role-ui';
            rr_div.style = "margin-top:20px; display:flex; flex-direction:column; gap:15px; align-items:center;";
            role_setup_grid.parentNode.insertBefore(rr_div, role_setup_grid);
        }
        document.getElementById('random-role-ui').classList.remove('hidden');
        let roles_arr = [];
        for (let r in s.current_board.roles) {
            for (let i = 0; i < s.current_board.roles[r]; i++) roles_arr.push(r);
        }
        roles_arr.sort(() => Math.random() - 0.5);

        if (s.current_board.id === '12_thief_cupid') {
            let thief_index = roles_arr.indexOf('thief');
            if (thief_index >= 12) {
                let swap_index = Math.floor(Math.random() * 12);
                [roles_arr[thief_index], roles_arr[swap_index]] = [roles_arr[swap_index], roles_arr[thief_index]];
            }
            s.spare_cards = roles_arr.slice(12);
            s.discarded_roles = [...s.spare_cards];
        }

        // 假面之夜：5個神職隨機選3個，棄掉2個
        if (s.current_board.id === '10_mask_night') {
            let god_roles = ['seer', 'witch', 'hunter', 'guard', 'idiot'];
            god_roles.sort(() => Math.random() - 0.5);
            let discarded = god_roles.slice(3); // 棄掉 2 個
            roles_arr = roles_arr.filter(r => !discarded.includes(r));
            s.discarded_roles = discarded;
        }

        for (let i = 1; i <= s.total_players; i++) {
            s.player_roles[i] = roles_arr[i - 1];
            s.player_status[i] = { poisoned: false, injured: false, isWhiteCatFlipped: false, isVWK: false, deathReason: null };
        }
        s.current_viewing_seat = 1;
        renderRandomRoleView(btn_start_night);
    } else {
        role_setup_grid.classList.remove('hidden');
        if (p_tag) p_tag.classList.remove('hidden');
        btn_start_night.classList.remove('hidden');
        if (document.getElementById('random-role-ui')) document.getElementById('random-role-ui').classList.add('hidden');
        role_setup_grid.innerHTML = '';
        for (let i = 1; i <= s.total_players; i++) {
            s.player_roles[i] = null;
            s.player_status[i] = { poisoned: false, injured: false, isWhiteCatFlipped: false, isVWK: false, deathReason: null };
            const btn = document.createElement('div');
            btn.classList.add('role-btn');
            btn.dataset.status = 'unset';
            btn.innerHTML = `<span class="seat-num">${i}號</span><span class="role-name">未設定</span>`;
            btn.addEventListener('click', () => {
                s.current_editing_seat = i;
                document.getElementById('modal-seat-title').textContent = `設定 ${i} 號身分`;
                openRoleModal(role_setup_grid);
            });
            role_setup_grid.appendChild(btn);
        }
    }

    // === 性別指定面板（開膛手板子）===
    renderGenderPanel();
}

/** 渲染性別指定面板（僅 hasGender 板子顯示）*/
function renderGenderPanel() {
    const section = document.getElementById('gender-setup-section');
    const grid = document.getElementById('gender-grid');
    const count_el = document.getElementById('gender-count');
    if (!section || !grid) return;

    if (!s.current_board.hasGender) {
        section.classList.add('hidden');
        s.player_genders = {};
        return;
    }

    section.classList.remove('hidden');
    grid.innerHTML = '';
    s.player_genders = s.player_genders || {};

    for (let i = 1; i <= s.total_players; i++) {
        if (!s.player_genders[i]) s.player_genders[i] = null;
        const btn = document.createElement('div');
        btn.classList.add('role-btn');
        btn.style.cursor = 'pointer';
        btn.style.textAlign = 'center';
        btn.style.padding = '10px 5px';
        updateGenderBtn(btn, i);
        btn.addEventListener('click', () => {
            // 循環切換：null → male → female → male ...
            if (!s.player_genders[i]) s.player_genders[i] = 'male';
            else if (s.player_genders[i] === 'male') s.player_genders[i] = 'female';
            else s.player_genders[i] = 'male';
            updateGenderBtn(btn, i);
            updateGenderCount();
        });
        grid.appendChild(btn);
    }
    updateGenderCount();

    function updateGenderBtn(btn, seat) {
        let g = s.player_genders[seat];
        if (g === 'male') {
            btn.innerHTML = `<span style="font-size:20px;">♂️</span><br><span style="font-size:12px;">${seat}號 男</span>`;
            btn.style.borderColor = '#4fc3f7';
            btn.style.background = 'rgba(79,195,247,0.15)';
        } else if (g === 'female') {
            btn.innerHTML = `<span style="font-size:20px;">♀️</span><br><span style="font-size:12px;">${seat}號 女</span>`;
            btn.style.borderColor = '#f48fb1';
            btn.style.background = 'rgba(244,143,177,0.15)';
        } else {
            btn.innerHTML = `<span style="font-size:20px;">❓</span><br><span style="font-size:12px;">${seat}號</span>`;
            btn.style.borderColor = 'var(--color-border)';
            btn.style.background = 'var(--bg-card)';
        }
    }

    function updateGenderCount() {
        let m = Object.values(s.player_genders).filter(g => g === 'male').length;
        let f = Object.values(s.player_genders).filter(g => g === 'female').length;
        let half = s.total_players / 2;
        count_el.textContent = `男：${m}/${half}　女：${f}/${half}`;
        count_el.style.color = (m === half && f === half) ? 'var(--color-success)' : 'var(--color-text-muted)';
    }
}

/** 載入 data.json 並初始化板子下拉選單 */
function loadGameData(count_select) {
    const board_selected = document.getElementById('board-selected');
    const board_list = document.getElementById('board-list');

    if (board_selected) {
        board_selected.addEventListener('click', (e) => {
            e.stopPropagation();
            board_list.classList.toggle('hidden');
            // 開啟時聚焦搜尋框並清空
            const search_input = document.getElementById('board-search');
            if (search_input && !board_list.classList.contains('hidden')) {
                search_input.value = '';
                search_input.focus();
                // 顯示所有選項
                board_list.querySelectorAll('.dropdown-item').forEach(item => item.style.display = '');
            }
        });
    }

    // 板子搜尋過濾
    document.addEventListener('input', (e) => {
        if (e.target.id !== 'board-search') return;
        const keyword = e.target.value.toLowerCase();
        const items = document.querySelectorAll('#board-list .dropdown-item');
        items.forEach(item => {
            item.style.display = item.textContent.toLowerCase().includes(keyword) ? '' : 'none';
        });
    });

    // 防止搜尋框點擊時關閉下拉選單
    document.addEventListener('click', (e) => {
        if (e.target.id === 'board-search') e.stopPropagation();
    });
    document.addEventListener('click', () => {
        if (board_list && !board_list.classList.contains('hidden')) {
            board_list.classList.add('hidden');
        }
    });

    fetch('data.json')
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(data => {
            s.ROLE_DICT = data.ROLE_DICT;
            s.BOARD_CONFIGS = data.BOARD_CONFIGS;

            const updateBoards = () => {
                if (!s.BOARD_CONFIGS || Object.keys(s.BOARD_CONFIGS).length === 0) return;

                const setting_board = document.getElementById('setting-board');
                const board_list_el = document.getElementById('board-list');
                const board_selected_el = document.getElementById('board-selected');

                setting_board.innerHTML = '';
                if (board_list_el) {
                    // 保留搜尋框，只清除選項
                    board_list_el.querySelectorAll('.dropdown-item').forEach(el => el.remove());
                    // 確保搜尋框存在
                    if (!document.getElementById('board-search')) {
                        const search_input = document.createElement('input');
                        search_input.type = 'text';
                        search_input.id = 'board-search';
                        search_input.placeholder = '搜尋板子...';
                        search_input.style = 'width:100%; padding:10px; border:none; border-bottom:1px solid var(--color-border); background:var(--bg-input); color:var(--color-text); font-size:16px; outline:none; position:sticky; top:0; z-index:1;';
                        board_list_el.prepend(search_input);
                    }
                }

                const boards = s.BOARD_CONFIGS[count_select.value] || [];

                boards.forEach((b, index) => {
                    const opt = document.createElement('option');
                    opt.value = b.id;
                    opt.textContent = b.name;
                    setting_board.appendChild(opt);

                    if (board_list_el) {
                        const item = document.createElement('div');
                        item.className = 'dropdown-item';
                        item.textContent = b.name;
                        item.onclick = (e) => {
                            e.stopPropagation();
                            setting_board.value = b.id;
                            board_selected_el.textContent = b.name;
                            board_list_el.classList.add('hidden');
                            document.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
                            item.classList.add('active');
                        };
                        if (index === 0) {
                            board_selected_el.textContent = b.name;
                            item.classList.add('active');
                        }
                        board_list_el.appendChild(item);
                    }
                });
            };

            count_select.addEventListener('change', updateBoards);
            updateBoards();
        })
        .catch(err => {
            console.error('載入 data.json 失敗：', err);
            const container = document.querySelector('.container');
            if (container) {
                container.innerHTML = `
                    <div style="background:#e94560; color:white; padding:20px; border-radius:8px; text-align:center; margin-top:20px;">
                        <h2>⚠️ 資料載入失敗</h2>
                        <p>無法載入遊戲資料 (data.json)，請確認：</p>
                        <ul style="text-align:left; display:inline-block;">
                            <li>是否透過 HTTP 伺服器開啟（不可用 file:// 協定）</li>
                            <li>data.json 檔案是否存在於同一目錄</li>
                        </ul>
                        <p style="color:#fca311; margin-top:15px;">錯誤訊息：${err.message}</p>
                        <button onclick="location.reload()" style="margin-top:10px; padding:10px 20px; border:none; border-radius:4px; background:white; color:#e94560; font-weight:bold; cursor:pointer;">重新載入</button>
                    </div>
                `;
            }
        });
}

/** 處理「確認配置並進入黑夜」按鈕邏輯 */
function handleStartNight(count_select, setting_board) {
    if (!s.is_random_mode) {
        for (let i = 1; i <= s.total_players; i++) {
            if (!s.player_roles[i]) return alert(`請設定 ${i} 號玩家的身分！`);
        }
        let current_counts = {};
        for (let i = 1; i <= s.total_players; i++) {
            let role = s.player_roles[i];
            current_counts[role] = (current_counts[role] || 0) + 1;
        }
        let error_msg = "⚠️ 職業配置錯誤！\n\n";
        let is_match = true;
        s.discarded_roles = [];

        for (const [role_id, req_count] of Object.entries(s.current_board.roles)) {
            if ((current_counts[role_id] || 0) !== req_count) {
                is_match = false;
                error_msg += `${s.ROLE_DICT[role_id].name}: 配置數量錯誤\n`;
            }
        }
        if (!is_match && s.current_board.id !== '12_thief_cupid' && s.current_board.id !== '10_mask_night') return alert(error_msg);
    }

    if (s.current_board.id === '12_thief_cupid') {
        s.spare_cards = [];
        let temp_board = { ...s.current_board.roles };
        for (let i = 1; i <= 12; i++) temp_board[s.player_roles[i]]--;
        for (let r in temp_board) {
            while (temp_board[r] > 0) { s.spare_cards.push(r); temp_board[r]--; }
        }
        if (s.spare_cards.filter(r => wolf_faction.includes(r)).length === 2) {
            alert("底牌為雙狼，此局必須重開！");
            document.getElementById('btn-reset').click();
            return;
        }
    }

    if (s.current_board.id === '12_shadow') {
        let s_a = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'seer_A');
        let s_b = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'seer_B');
        s.shadow_seer_seat = Math.random() > 0.5 ? parseInt(s_a) : parseInt(s_b);
    }

    if (s.current_board.id === '12_variable_wolf') {
        let god_seats = Object.keys(s.player_roles).filter(k => ['seer', 'witch', 'hunter', 'dreamwalker', 'bear'].includes(s.player_roles[k]));
        s.vwk_seat = parseInt(god_seats[Math.floor(Math.random() * god_seats.length)]);
        s.player_status[s.vwk_seat].isVWK = true;
    }

    let w_seats = Object.keys(s.player_roles).filter(k => wolf_faction.includes(s.player_roles[k]) && !['eclipse_maid', 'hidden_wolf', 'gray_wolf'].includes(s.player_roles[k]));
    if (w_seats.length > 0) s.phantom_known_wolf = w_seats[Math.floor(Math.random() * w_seats.length)];

    let thief_key = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'thief');
    s.initial_thief_seat = thief_key ? parseInt(thief_key) : null;

    // === 性別機制驗證（開膛手傑克板子）===
    if (s.current_board.hasGender) {
        let male_count = Object.values(s.player_genders).filter(g => g === 'male').length;
        let female_count = Object.values(s.player_genders).filter(g => g === 'female').length;
        if (male_count + female_count < s.total_players) {
            return alert("請先指定所有玩家的性別！");
        }
        if (male_count !== s.total_players / 2 || female_count !== s.total_players / 2) {
            return alert(`性別分配必須為 ${s.total_players / 2} 男 ${s.total_players / 2} 女！`);
        }
    }

    // === 睡美人板子：隨機抽選睡美人 ===
    if (s.current_board.hasSleepingBeauty) {
        let alien_seat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'alien_prince');
        let all_seats = Object.keys(s.player_roles).map(Number);
        let candidate = all_seats[Math.floor(Math.random() * all_seats.length)];
        // 規則：若抽中異族王子，本場沒有睡美人
        if (candidate === parseInt(alien_seat)) {
            s.sleeping_beauty_seat = null;
        } else {
            s.sleeping_beauty_seat = candidate;
        }
        s.is_sleeping_beauty_active = true;
    }

    buildNightQueue();
    s.night_action_log = [];
    document.getElementById('lock-modal').classList.remove('hidden');
}

/** 綁定所有設定頁相關的 DOM 事件 */
export function initSetupEvents() {
    const style = document.createElement('style');
    style.innerHTML = `.action-selected { background-color: #51c9c1 !important; color: white !important; border: 2px solid #fff !important; transform: scale(1.05); }`;
    document.head.appendChild(style);

    // 主題切換
    const theme_btn = document.getElementById('btn-theme-toggle');
    const saved_theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved_theme);
    theme_btn.textContent = saved_theme === 'dark' ? '🌙' : '☀️';
    theme_btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        theme_btn.textContent = next === 'dark' ? '🌙' : '☀️';
        localStorage.setItem('theme', next);
    });

    const count_select = document.getElementById('setting-player-count');
    const setting_board = document.getElementById('setting-board');
    const role_setup_grid = document.getElementById('role-setup-grid');

    const screen_start = document.getElementById('screen-start');
    const screen_setup = document.getElementById('screen-setup');
    const screen_night = document.getElementById('screen-night');

    const btn_go_setup = document.getElementById('btn-go-setup');
    const btn_back_start = document.getElementById('btn-back-start');
    const btn_start_night = document.getElementById('btn-start-night');
    const role_modal = document.getElementById('role-modal');
    const lock_modal = document.getElementById('lock-modal');
    const number_pad = document.getElementById('number-pad');
    const night_instruction = document.getElementById('night-instruction');

    // 閉眼→睜眼間隔秒數設定
    const delay_slider = document.getElementById('setting-transition-delay');
    const delay_label = document.getElementById('transition-delay-value');
    if (delay_slider) {
        delay_slider.addEventListener('input', () => {
            s.role_transition_delay = parseFloat(delay_slider.value);
            delay_label.textContent = `${delay_slider.value}s`;
        });
    }

    // 載入遊戲資料
    loadGameData(count_select);

    // 畫面切換
    document.getElementById('btn-close-modal').addEventListener('click', () => role_modal.classList.add('hidden'));
    btn_go_setup.addEventListener('click', () => {
        screen_start.classList.add('hidden');
        screen_setup.classList.remove('hidden');
        initRoleSetup(count_select, setting_board, role_setup_grid, btn_start_night);
    });
    btn_back_start.addEventListener('click', () => {
        if (!confirm('確定要返回？目前的設定將會遺失。')) return;
        screen_setup.classList.add('hidden');
        screen_start.classList.remove('hidden');
    });

    // 進入黑夜
    btn_start_night.addEventListener('click', () => handleStartNight(count_select, setting_board));

    document.getElementById('btn-cancel-lock').addEventListener('click', () => lock_modal.classList.add('hidden'));
    document.getElementById('btn-confirm-lock').addEventListener('click', () => {
        lock_modal.classList.add('hidden');
        screen_setup.classList.add('hidden');
        screen_night.classList.remove('hidden');
        number_pad.classList.add('hidden');
        document.getElementById('night-role-title').textContent = "🐺 黑夜降臨";
        night_instruction.textContent = "請大家閉上眼睛...";
        speak("天黑請閉眼。", runNextNightRole);
    });
}
