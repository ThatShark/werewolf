// js/setup.js
import { s, isWolfRole, getWolfTeamRoles } from './core.js';
import { buildNightQueue } from './main.js';

// ==========================================
// 設定頁初始化、角色錄入、隨機發牌、板子選擇、事件綁定
// ==========================================

/** 開啟角色選擇彈窗 (單一座位連貫錄入，不跳轉號碼) */
function openRoleModal(role_setup_grid) {
    const modal_role_options = document.getElementById('modal-role-options');
    const role_modal = document.getElementById('role-modal');
    
    // 鎖定當前正在設定的座位
    const seat = s.current_editing_seat;

    const needsGender = s.current_board.hasGender || s.current_board.id.includes('jack_ripper');
    const needsSecondary = s.current_board.id === '12_jack_ripper_v2';

    // 階段 3：完成該座位的設定並關閉視窗 (絕對不跳轉下一個號碼)
    const finishSeatSetup = () => {
        const grid_btn = role_setup_grid.children[seat - 1];
        grid_btn.dataset.status = 'set';
        
        // 卡片上不顯示傑克，只顯示號碼、性別與已隱藏
        grid_btn.innerHTML = `<span class="seat-num">${seat}號</span><span class="role-name">✔️已隱藏</span>`;
        
        // 關閉視窗，完成此座位的設定
        role_modal.classList.add('hidden');
    };

    // 階段 2-2：第二身分錄入 (開膛手傑克板子專用)
    const renderSecondarySelection = () => {
        document.getElementById('modal-seat-title').textContent = `設定 ${seat} 號第二身分`;
        modal_role_options.innerHTML = '';
        
        // 使用垂直大按鈕
        const btnJack = document.createElement('button');
        btnJack.className = 'role-select-btn';
        btnJack.innerHTML = '🔪 開膛手傑克';
        btnJack.onclick = () => {
            if (!s.player_second_roles) s.player_second_roles = {};
            s.player_second_roles[seat] = 'jack_ripper';
            finishSeatSetup();
        };

        const btnDet = document.createElement('button');
        btnDet.className = 'role-select-btn';
        btnDet.innerHTML = '🔍 偵探';
        btnDet.onclick = () => {
            if (!s.player_second_roles) s.player_second_roles = {};
            s.player_second_roles[seat] = 'detective';
            finishSeatSetup();
        };

        modal_role_options.appendChild(btnJack);
        modal_role_options.appendChild(btnDet);
    };

    // 階段 2-1：性別錄入 (若板子需要性別)
    const renderGenderSelection = () => {
        document.getElementById('modal-seat-title').textContent = `設定 ${seat} 號性別`;
        modal_role_options.innerHTML = '';

        // 使用垂直大按鈕
        const btnMale = document.createElement('button');
        btnMale.className = 'role-select-btn';
        btnMale.innerHTML = '♂️ 男性';
        btnMale.onclick = () => {
            s.player_genders[seat] = 'male';
            if (needsSecondary) renderSecondarySelection(); else finishSeatSetup();
        };

        const btnFemale = document.createElement('button');
        btnFemale.className = 'role-select-btn';
        btnFemale.innerHTML = '♀️ 女性';
        btnFemale.onclick = () => {
            s.player_genders[seat] = 'female';
            if (needsSecondary) renderSecondarySelection(); else finishSeatSetup();
        };

        modal_role_options.appendChild(btnMale);
        modal_role_options.appendChild(btnFemale);
    };

    // 階段 1：基礎身分錄入
    const renderBaseRoleSelection = () => {
        document.getElementById('modal-seat-title').textContent = `設定 ${seat} 號身分`;
        modal_role_options.innerHTML = '';

        for (const role_id of Object.keys(s.current_board.roles)) {
            const base_role_id = role_id.replace(/_[A-Z]$/, '');
            if (!s.ROLE_DICT[base_role_id]) continue;

            const btn = document.createElement('button');
            btn.classList.add('role-select-btn');
            
            let displayName = s.ROLE_DICT[base_role_id].name;
            const suffixMatch = role_id.match(/_([A-Z])$/);
            if (suffixMatch) displayName += ` ${suffixMatch[1]}`;

            btn.innerHTML = `${s.ROLE_DICT[base_role_id].icon} ${displayName}`;
            btn.addEventListener('click', () => {
                s.player_roles[seat] = role_id;
                
                // 依序判斷進入下一階段
                if (needsGender) {
                    renderGenderSelection();
                } else if (needsSecondary) {
                    renderSecondarySelection();
                } else {
                    finishSeatSetup();
                }
            });
            modal_role_options.appendChild(btn);
        }
    };

    // 啟動流程
    renderBaseRoleSelection();
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
    let display_role_key = disp_role.replace(/_[A-Z]$/, '');

    // 處理性別顯示
    let gender_html = '';
    if (s.current_board.hasGender || s.current_board.id.includes('jack_ripper')) {
        let gender = s.player_genders[s.current_viewing_seat];
        if (gender === 'male') {
            gender_html = `<p style="font-size:24px; margin:15px 0 0 0; font-weight:bold; color:#51c9c1;">性別：♂️ 男性</p>`;
        } else if (gender === 'female') {
            gender_html = `<p style="font-size:24px; margin:15px 0 0 0; font-weight:bold; color:#ff7b93;">性別：♀️ 女性</p>`;
        }
    }

    // 處理第二身分顯示
    let sec_role_html = '';
    if (s.current_board.id === '12_jack_ripper_v2') {
        let sec_role = s.player_second_roles[s.current_viewing_seat];
        if (sec_role === 'jack_ripper') {
            sec_role_html = `<p style="font-size:24px; margin:15px 0 0 0; font-weight:bold; color:#e94560;">附加身分：🔪 開膛手傑克</p>`;
        } else if (sec_role === 'detective') {
            sec_role_html = `<p style="font-size:24px; margin:15px 0 0 0; font-weight:bold; color:#a2a8d3;">附加身分：🔍 偵探</p>`;
        }
    }

    container.innerHTML = `
        <button id="btn-view-role" class="num-btn" style="width:100%; padding:30px; font-size:22px;">點擊查看 ${s.current_viewing_seat} 號 身分</button>
        <div id="view-role-result" class="hidden" style="background:var(--bg-card); padding:30px; border-radius:12px; width:100%; border:2px solid var(--color-accent);">
            <p style="margin:0; color:var(--color-text-muted); font-size:18px;">你的身分是：</p>
            <p style="font-size:40px; margin:10px 0 0 0; font-weight:bold; color:var(--color-accent);">${s.ROLE_DICT[display_role_key].icon} ${s.ROLE_DICT[display_role_key].name}</p>
            ${gender_html}
            ${sec_role_html}
        </div>
        <button id="btn-next-view" class="primary-btn hidden" style="margin-top:15px;">確認並換下一位</button>
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
    s.player_second_roles = {};
    s.player_genders = {};
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

        if (s.current_board.id === '10_mask_night') {
            let god_roles = ['seer', 'witch', 'hunter', 'guard', 'idiot'];
            god_roles.sort(() => Math.random() - 0.5);
            let discarded = god_roles.slice(3);
            roles_arr = roles_arr.filter(r => !discarded.includes(r));
            s.discarded_roles = discarded;
        }

        for (let i = 1; i <= s.total_players; i++) {
            s.player_roles[i] = roles_arr[i - 1];
            s.player_status[i] = { poisoned: false, injured: false, isWhiteCatFlipped: false, isVWK: false, deathReason: null };
        }
        
        // --- 隨機模式自動分配性別 ---
        if (s.current_board.hasGender || s.current_board.id.includes('jack_ripper')) {
            let genders = [];
            for(let i = 0; i < s.total_players / 2; i++) {
                genders.push('male');
                genders.push('female');
            }
            genders.sort(() => Math.random() - 0.5);
            for (let i = 1; i <= s.total_players; i++) {
                s.player_genders[i] = genders[i - 1];
            }
        }
        
        // --- 隨機模式自動分配第二身分 ---
        if (s.current_board.id === '12_jack_ripper_v2') {
            let sec_roles = ['jack_ripper'];
            for(let i = 1; i < s.total_players; i++) {
                sec_roles.push('detective');
            }
            sec_roles.sort(() => Math.random() - 0.5);
            for (let i = 1; i <= s.total_players; i++) {
                s.player_second_roles[i] = sec_roles[i - 1];
            }
        }

        if (s.current_board.id === '12_treasure_hunter') {
            s.spare_cards = roles_arr.slice(s.total_players);
            s.discarded_roles = [...s.spare_cards];
        }
        
        s.current_viewing_seat = 1;
        renderRandomRoleView(btn_start_night);
    } else {
        role_setup_grid.classList.remove('hidden');
        if (p_tag) p_tag.classList.remove('hidden');
        btn_start_night.classList.remove('hidden');
        if (document.getElementById('random-role-ui')) document.getElementById('random-role-ui').classList.add('hidden');
        
        // 隱藏舊版的性別面板 (若有)
        let gender_section = document.getElementById('gender-setup-section');
        if (gender_section) gender_section.classList.add('hidden');
        
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
                openRoleModal(role_setup_grid);
            });
            role_setup_grid.appendChild(btn);
        }
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
            const search_input = document.getElementById('board-search');
            if (search_input && !board_list.classList.contains('hidden')) {
                search_input.value = '';
                search_input.focus();
                board_list.querySelectorAll('.dropdown-item').forEach(item => item.style.display = '');
            }
        });
    }

    document.addEventListener('input', (e) => {
        if (e.target.id !== 'board-search') return;
        const keyword = e.target.value.toLowerCase();
        const items = document.querySelectorAll('#board-list .dropdown-item');
        items.forEach(item => {
            item.style.display = item.textContent.toLowerCase().includes(keyword) ? '' : 'none';
        });
    });

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
                    board_list_el.querySelectorAll('.dropdown-item').forEach(el => el.remove());
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
        
        // 依賴 JSON 定義，徹底移除 boards_with_spare_cards
        const has_spare_cards = s.current_board.spare_cards_count > 0;
        
        if (!is_match && !has_spare_cards) return alert(error_msg);
        if (has_spare_cards) {
            for (const [role_id, count] of Object.entries(current_counts)) {
                if (count > (s.current_board.roles[role_id] || 0)) return alert(error_msg);
            }
        }
    }

    if (['10_mask_night', '12_thief_cupid', '12_treasure_hunter'].includes(s.current_board.id)) {
        s.spare_cards = [];
        let temp_board = { ...s.current_board.roles };
        for (let i = 1; i <= 12; i++) temp_board[s.player_roles[i]]--;
        for (let r in temp_board) {
            while (temp_board[r] > 0) { s.spare_cards.push(r); temp_board[r]--; }
        }
        s.discarded_roles = [...s.spare_cards];
        if (s.current_board.id === '12_thief_cupid' && s.spare_cards.filter(r => isWolfRole(r)).length === 2) {
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

    let w_seats = Object.keys(s.player_roles).filter(k => getWolfTeamRoles().includes(s.player_roles[k]));
    if (w_seats.length > 0) s.phantom_known_wolf = w_seats[Math.floor(Math.random() * w_seats.length)];

    let thief_key = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'thief');
    s.initial_thief_seat = thief_key ? parseInt(thief_key) : null;

    // === 性別機制驗證 ===
    if (s.current_board.hasGender || s.current_board.id.includes('jack_ripper')) {
        let male_count = Object.values(s.player_genders).filter(g => g === 'male').length;
        let female_count = Object.values(s.player_genders).filter(g => g === 'female').length;
        if (male_count + female_count < s.total_players) {
            return alert("請先指定所有玩家的性別！\n(點擊已隱藏的號碼卡片重新設定)");
        }
        if (male_count !== s.total_players / 2 || female_count !== s.total_players / 2) {
            return alert(`性別分配必須為 ${s.total_players / 2} 男 ${s.total_players / 2} 女！`);
        }
    }
    
    // === 傑克機制驗證 ===
    if (s.current_board.id === '12_jack_ripper_v2') {
        let jack_count = s.player_second_roles ? Object.values(s.player_second_roles).filter(r => r === 'jack_ripper').length : 0;
        if (jack_count !== 1) {
            return alert("⚠️ 附加身分配置錯誤！\n全場必須有且僅有 1 名開膛手傑克。\n(點擊已隱藏的號碼卡片重新設定)");
        }
    }

    if (s.current_board.hasSleepingBeauty) {
        let alien_seat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'alien_prince');
        let all_seats = Object.keys(s.player_roles).map(Number);
        let candidate = all_seats[Math.floor(Math.random() * all_seats.length)];
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

    if (document.getElementById('setting-transition-delay')) {
        document.getElementById('setting-transition-delay').addEventListener('input', (e) => {
            s.role_transition_delay = parseFloat(e.target.value);
            document.getElementById('transition-delay-value').textContent = `${e.target.value}s`;
        });
    }

    loadGameData(count_select);

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

    btn_start_night.addEventListener('click', () => handleStartNight(count_select, setting_board));
    document.getElementById('btn-cancel-lock').addEventListener('click', () => lock_modal.classList.add('hidden'));
}