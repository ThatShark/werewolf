import { s, getStageVoiceName, getActualTarget, applyTimeWolfReflection, wolf_faction, evil_roles, speak, resetGameState, vibrate } from './core.js';
import { resetSelections } from './night.js';
import { calculateNightDeaths, proceedDayResultRender, handleChainDeaths } from './day.js';
import { initSetupEvents } from './setup.js';
import { initSheriffScreen, initSheriffEvents } from './sheriff.js';
import { resolveInspectionResult, resolveNonInspectionAction } from './actions.js';
import { renderRolePanel } from './roleUI.js';

// ==========================================
// 1. 遊戲核心流程與佇列建置函式
// ==========================================

export function generateSpeechOrder(candidates_array) {
    let pool = candidates_array ? [...candidates_array] : [];
    if (!candidates_array) {
        for (let i = 1; i <= s.total_players; i++) {
            if (!s.final_killed.includes(i)) pool.push(i);
        }
    }
    if (pool.length === 0) return "無人發言";
    let start_player = pool[Math.floor(Math.random() * pool.length)];
    let direction = Math.random() > 0.5 ? "順序 (號碼遞增)" : "逆序 (號碼遞減)";
    return `請從 【 ${start_player} 號 】 玩家開始<br>以 【 ${direction} 】 進行發言。`;
}

export function buildNightQueue() {
    s.night_queue = [];
    const active_roles = Object.values(s.player_roles);
    let queue_list = [];

    let order_map = {};
    active_roles.forEach(role => {
        let orders = s.ROLE_DICT[role]?.wakeOrder;
        if (orders) {
            orders.forEach(o => {
                if (!order_map[o]) order_map[o] = new Set();
                order_map[o].add(role);
            });
        }
    });

    s.discarded_roles.forEach(role => {
        let orders = s.ROLE_DICT[role]?.wakeOrder;
        if (orders && ['seer', 'witch', 'hunter', 'cupid'].includes(role)) {
            queue_list.push({ stage: role, order: orders[0], seat: null, subLabel: null, isFake: true });
        }
    });

    let active_order_arr = Object.keys(order_map).map(Number).sort((a, b) => a - b);

    active_order_arr.forEach(order => {
        if (order === 3350) return;
        let roles = Array.from(order_map[order]);
        let stage = null;

        switch (order) {
            case 750: stage = 'ghost_bride_couple'; break;
            case 790: stage = 'ghost_bride_witness'; break;
            case 800: stage = 'lovers_meet'; break;
            case 900: stage = 'wolf_brother_meet'; break;
            case 2000: stage = 'gray_wolf_steal'; break;
            case 4400: stage = 'gray_wolf_action'; break;
            case 2700: stage = s.current_board?.id === '12_animals' ? 'wolf_meet' : 'wolf'; break;
            case 2800: stage = 'awaken_wolf_king_gun'; break;
            case 2900: stage = 'wolf_gun_confirm'; break;
            case 3600: stage = 'lucky_boy_action'; break;
            case 3400: stage = 'awaken_witch_assistant_action'; break;
            case 4700: stage = 'awaken_dreamwalker_result'; break;
            default: stage = roles[0]; break;
        }
        if (stage) {
            queue_list.push({ stage, order, seat: null, subLabel: null, isFake: false });
        }
    });

    if (active_roles.includes('ghost_bride')) {
        for (let i = 1; i <= s.total_players; i++) queue_list.push({ stage: `notify_groom_${i}`, order: 720, seat: null, subLabel: null, isFake: false });
        for (let i = 1; i <= s.total_players; i++) queue_list.push({ stage: `notify_witness_${i}`, order: 770, seat: null, subLabel: null, isFake: false });
    }

    if (active_roles.some(r => ['black_market', 'miracle_merchant'].includes(r))) {
        for (let i = 1; i <= s.total_players; i++) queue_list.push({ stage: `notify_luckyboy_${i}`, order: 3550, seat: null, subLabel: null, isFake: false });
    }

    if (active_roles.includes('awaken_witch')) {
        for (let i = 1; i <= s.total_players; i++) queue_list.push({ stage: `notify_assistant_${i}`, order: 3380, seat: null, subLabel: null, isFake: false });
    }

    let has_other_notify_roles = active_roles.some(r => ['cupid', 'seed_wolf'].includes(r));
    if (has_other_notify_roles) {
        let base_notify_pos = active_roles.includes('seed_wolf') ? 2750 : 350;
        for (let i = 1; i <= s.total_players; i++) queue_list.push({ stage: `notify_general_${i}`, order: base_notify_pos, seat: null, subLabel: null, isFake: false });
    }

    if (active_roles.includes('awaken_gargoyle') || active_roles.includes('awaken_gargoyle_A') || active_roles.includes('awaken_gargoyle_B') || active_roles.includes('awaken_dreamwalker')) {
        for (let i = 1; i <= s.total_players; i++) queue_list.push({ stage: `notify_end_${i}`, order: 9900, seat: null, subLabel: null, isFake: false });
    }

    if (s.current_board?.id === '12_variable_wolf' && active_roles.includes('bear')) {
        let b_seat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'bear');
        queue_list.push({ stage: 'bear', order: 4500, seat: b_seat, subLabel: null, isFake: false });
    }

    queue_list.sort((a, b) => a.order - b.order);

    queue_list.forEach(q => {
        if (q.stage === 'seer' || q.stage === 'shadow_seer' || q.stage === 'seer_A' || q.stage === 'seer_B') {
            if (q.order === 3800) {
                let s_a = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'seer_A');
                let seer_seat = Object.keys(s.player_roles).find(k => ['seer', 'pure_white', 'real_fox', 'psychic', 'awaken_seer'].includes(s.player_roles[k]));
                q.seat = s_a || seer_seat;
                if (s_a) { q.subLabel = 'A'; q.stage = 'seer'; }
                else if (seer_seat) { q.stage = s.player_roles[seer_seat]; }
            } else if (q.order === 3850) {
                let s_b = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'seer_B');
                let shadow = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'shadow_seer');
                q.seat = s_b || shadow;
                if (s_b) { q.subLabel = 'B'; q.stage = 'seer'; }
                else if (shadow) { q.stage = 'shadow_seer'; }
            }
        }
    });

    if (s.discarded_roles.includes('cupid')) {
        queue_list.push({ stage: 'lovers_meet', order: 800, seat: null, subLabel: null, isFake: true });
        queue_list.sort((a, b) => a.order - b.order);
    }

    s.night_queue = queue_list;
}

// ==========================================
// 2. 白天與夜晚介面切換與運作邏輯
// ==========================================

export function showDayResult() {
    document.getElementById('screen-night').classList.add('hidden');
    document.getElementById('screen-day').classList.remove('hidden');
    document.getElementById('day-skill-section').classList.add('hidden');
    document.getElementById('day-result-content').classList.add('hidden');

    let crow_panel = document.getElementById('crow-record-panel');
    let btn_show_crow = document.getElementById('btn-show-crow');
    if (crow_panel) crow_panel.classList.add('hidden');
    if (btn_show_crow) btn_show_crow.classList.add('hidden');

    let alch_seat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'alchemist');
    let w_target = s.wolf_kill_target;

    const alchemist_call_section = document.getElementById('alchemist-call-section');
    const day_result_content = document.getElementById('day-result-content');

    if (alch_seat && !s.is_alchemist_snake_used && !s.primary_killed.includes(parseInt(alch_seat))) {
        let order_html = s.speech_order_text ? `<div style="background:#16213e; padding:10px; border-radius:6px; margin: 15px 0;"><span style="color:#00ff88; font-size:18px; font-weight:bold;">🗣️ 發言順序：<br>${s.speech_order_text}</span></div>` : "";

        alchemist_call_section.innerHTML = `
            <div style="background:#24345e; padding:20px; border-radius:8px; margin-bottom: 20px;">
                <h3 style="color:#fca311; margin-top:0;">🗣️ 白天發言階段</h3>
                ${order_html}
                <p style="color:#a2a8d3;">請所有玩家進行發言。發言結束後，法官將公佈昨晚被狼刀的對象，並由煉金魔女決定是否使用法老之蛇。</p>
                <button id="btn-end-speech" class="primary-btn" style="margin-top:15px;">發言結束，公佈狼刀</button>
            </div>
        `;
        alchemist_call_section.classList.remove('hidden');

        document.getElementById('btn-end-speech').onclick = () => {
            speak("所有玩家請閉眼，煉金魔女請睜眼。", () => {
                let target_text = w_target ? `【 ${w_target} 號 】` : `【 無 】`;
                alchemist_call_section.innerHTML = `
                    <div style="background:#24345e; padding:20px; border-radius:8px; margin-bottom: 20px;">
                        <h3 style="color:#fca311; margin-top:0;">⚗️ 煉金魔女 法老之蛇</h3>
                        <p style="font-size:18px;">昨晚被狼刀的是：${target_text}</p>
                        ${w_target ? `<p style="color:#a2a8d3;">請問是否使用法老之蛇將其救活？</p>
                        <div style="display:flex; gap:10px; margin-top:15px;">
                            <button id="btn-alch-save" class="primary-btn">使用 (救活)</button>
                            <button id="btn-alch-pass" class="secondary-btn">不使用</button>
                        </div>` : `<div style="margin-top:15px;"><button id="btn-alch-pass" class="secondary-btn">繼續結算</button></div>`}
                    </div>
                `;

                const finishAlchemist = (saved) => {
                    alchemist_call_section.classList.add('hidden');
                    if (saved) {
                        s.primary_killed = s.primary_killed.filter(k => k !== parseInt(w_target));
                        s.chain_killed = [];
                        s.final_killed = [...s.primary_killed];
                        handleChainDeaths();
                        s.is_alchemist_snake_used = true;
                        s.night_action_log.push(`【煉金魔女】使用了法老之蛇，救活了 ${w_target}號`);
                    } else {
                        s.night_action_log.push(`【煉金魔女】未發動法老之蛇`);
                    }
                    speak("煉金魔女請閉眼，三秒後所有玩家睜眼，三、二、一。", () => {
                        day_result_content.classList.remove('hidden');
                        proceedDayResultRender();
                    });
                };

                if (w_target) {
                    document.getElementById('btn-alch-save').onclick = () => finishAlchemist(true);
                }
                document.getElementById('btn-alch-pass').onclick = () => finishAlchemist(false);
            });
        };
        return;
    }

    day_result_content.classList.remove('hidden');
    proceedDayResultRender();
}

export function runNextNightRole() {
    const btn_confirm_action = document.getElementById('btn-confirm-action');
    const btn_optional_skip = document.getElementById('btn-optional-skip');
    const number_pad = document.getElementById('number-pad');
    const action_pad = document.getElementById('action-pad');
    const night_role_title = document.getElementById('night-role-title');
    const night_instruction = document.getElementById('night-instruction');

    let existing_custom_panel = document.getElementById('custom-action-panel');
    if (existing_custom_panel) existing_custom_panel.remove();

    btn_confirm_action.classList.add('hidden');
    btn_optional_skip.classList.add('hidden');
    number_pad.classList.add('hidden');
    action_pad.classList.add('hidden');
    action_pad.innerHTML = '';
    night_instruction.innerHTML = "";

    resetSelections();
    s.is_showing_result = false; s.is_current_role_feared = false; s.is_current_role_frozen = false; s.is_fake_wake = false;
    s.current_sub_label = null; s.awk_witch_step = null; s.is_seed_wolf_infecting = false;

    if (s.night_queue.length === 0) {
        night_role_title.textContent = "🌅 天亮結算中";
        night_instruction.textContent = "法官正在處理昨晚的行動結果...";
        calculateNightDeaths();
        let morning_voice = document.getElementById('setting-sheriff').checked ? "要競選警長的請舉手，三秒後天亮，三、二、一。" : "三秒後天亮，三、二、一。";
        speak(morning_voice, () => {
            if (document.getElementById('setting-sheriff').checked) {
                document.getElementById('screen-night').classList.add('hidden');
                document.getElementById('screen-sheriff').classList.remove('hidden');
                initSheriffScreen();
            } else {
                s.speech_order_text = generateSpeechOrder(null);
                showDayResult();
            }
        });
        return;
    }

    let next_task = s.night_queue.shift();
    s.current_stage = next_task.stage; s.current_actor_seat = next_task.seat; s.current_sub_label = next_task.subLabel; s.is_fake_wake = next_task.isFake;

    if (s.is_fake_wake) {
        let fake_name = s.ROLE_DICT[s.current_stage]?.name || getStageVoiceName(s.current_stage, s.current_sub_label);
        night_role_title.textContent = `🎭 ${fake_name}行動 (偽裝)`;
        night_instruction.textContent = "該身分已被棄掉，模擬睜眼等待中...";
        let wait_time = Math.random() * 2000 + 3000;
        speak(`${getStageVoiceName(s.current_stage, s.current_sub_label)}請睜眼。`, () => {
            setTimeout(() => {
                night_instruction.textContent = "請閉眼等待...";
                speak(`${getStageVoiceName(s.current_stage, s.current_sub_label)}請閉眼。`, () => setTimeout(runNextNightRole, s.role_transition_delay * 1000));
            }, wait_time);
        });
        return;
    }

    if (s.current_stage === 'lucky_boy_action' && (!s.merchant_target || evil_roles.includes(s.player_roles[s.merchant_target]))) return runNextNightRole();
    if (s.current_stage === 'awaken_witch_assistant_action' && (!s.awk_witch_assistant || !s.witch_poison_target)) return runNextNightRole();
    if (s.current_stage === 'awaken_dreamwalker_result' && !s.awk_dreamwalker_target) return runNextNightRole();

    // 第一晚「確認身分」類角色 — 線上法官已知底牌，什麼都不用做的角色直接跳過
    const first_night_confirm_only = ['idiot', 'knight', 'bear', 'pufferfish', 'white_cat',
        'rusty_knight', 'high_villager', 'grave_keeper', 'order_prince', 'detective', 'police_dog',
        'perseus', 'bar_fighter', 'masked_man', 'alien_prince', 'wolf_crow', 'day_scholar',
        'night_mentor', 'medium', 'white_night', 'dancer', 'mask_wolf', 'wolf_servant',
        'butler', 'curse_fox', 'night_noble', 'little_girl', 'nine_tail_fox', 'anubis'];
    if (first_night_confirm_only.includes(s.current_stage)) return runNextNightRole();

    // 大野狼額外刀限制：只有四狼全在場時才能用
    if (s.current_stage === 'big_bad_wolf') {
        let total_wolves = Object.values(s.player_roles).filter(r => wolf_faction.includes(r)).length;
        let alive_wolves = Object.keys(s.player_roles).filter(k => wolf_faction.includes(s.player_roles[k]) && s.player_status[k]?.alive !== false).length;
        if (alive_wolves < total_wolves) return runNextNightRole();
    }

    let actor_seat = s.current_actor_seat || Object.keys(s.player_roles).find(k => s.player_roles[k] === s.current_stage || s.player_roles[k] === 'awaken_' + s.current_stage);
    let is_vwk_turn = actor_seat && s.player_status[actor_seat]?.isVWK;

    if (s.seed_wolf_target === parseInt(actor_seat)) {
        let name = getStageVoiceName(s.current_stage, s.current_sub_label);
        let base_role = s.current_stage.replace('_A', '').replace('_B', '');
        night_role_title.textContent = `${s.ROLE_DICT[base_role]?.icon || '🎭'} ${name}行動 (已被感染)`;
        night_instruction.innerHTML = `<span style="color:#e94560; font-weight:bold;">你已被感染成狼人，原技能失效。</span><br>請等待自動閉眼...`;

        number_pad.classList.add('hidden'); action_pad.classList.add('hidden'); btn_confirm_action.classList.add('hidden'); btn_optional_skip.classList.add('hidden');
        s.night_action_log.push(`【${name}】已被種狼感染，跳過技能`);

        speak(`${name}請睜眼。`, () => {
            setTimeout(() => {
                speak(`${name}請閉眼。`, () => setTimeout(runNextNightRole, s.role_transition_delay * 1000));
            }, 3000 + Math.random() * 2000);
        });
        return;
    }

    // 灰太狼偷竊阻擋機制
    let is_stolen = s.gray_wolf_stolen_player && parseInt(actor_seat) === s.gray_wolf_stolen_player && s.gray_wolf_stolen_player !== s.pleasant_goat_anti_theft;

    if (is_stolen) {
        let role_name = getStageVoiceName(s.current_stage, s.current_sub_label);
        // 獵人不提示被偷，讓他看正常的狀態面板 (但內部 is_stolen 為 true，會判定為不能開槍)
        if (s.current_stage === 'witch' || s.current_stage === 'awaken_witch') {
            // 女巫僅毒藥被封鎖，仍可自發進入女巫環節
        } else if (!s.current_stage.startsWith('notify_') && !['wolf', 'wolf_meet', 'little_gray_wolf', 'gray_wolf_steal', 'gray_wolf_action', 'pleasant_goat', 'hunter'].includes(s.current_stage)) {
            night_role_title.textContent = `🚫 ${role_name}行動 (技能被偷取)`;
            night_instruction.textContent = "今晚你的技能被灰太狼偷取，無法發動。";
            btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "確認並閉眼";
            speak(`${role_name}請睜眼。`); return;
        }
    }

    if (is_vwk_turn) {
        night_instruction.innerHTML = `<span style="color:#e94560; font-weight:bold;">(你被指派為百變狼王)</span><br><br>` + night_instruction.innerHTML;
    }

    if (s.nightmare_target && parseInt(actor_seat) === s.nightmare_target && !s.current_stage.startsWith('notify_') && !['lovers_meet', 'wolf_meet', 'lucky_boy_action', 'awaken_wolf_king_gun', 'wolf_gun_confirm', 'awaken_witch_assistant_action', 'hidden_wolf', 'curse_fox', 'ghost_bride_couple', 'ghost_bride_witness', 'awaken_dreamwalker_result'].includes(s.current_stage)) {
        s.is_current_role_feared = true;
        let role_name = getStageVoiceName(s.current_stage, s.current_sub_label);
        if (s.current_stage === 'wolf') {
            let w_seats = Object.keys(s.player_roles).filter(k => wolf_faction.includes(s.player_roles[k]));
            let has_lg = Object.values(s.player_roles).includes('little_girl');
            if (has_lg) w_seats.push(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'little_girl'));
            w_seats.sort((a, b) => a - b);
            night_role_title.textContent = has_lg ? "🐺 狼隊與小女孩行動 (被恐懼)" : "🐺 狼人行動 (被恐懼)";
            night_instruction.innerHTML = `<span style="color:#e94560;">今晚已被夢魘恐懼，無法刀人。</span><br><br>🐺 睜眼名單：${has_lg ? '【隱藏】' : w_seats.map(id => id + '號').join(', ')}`;
            btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "確認並閉眼";
            speak(`${has_lg ? "狼隊和小女孩" : "狼人"}請睜眼。`); return;
        }
        night_role_title.textContent = `🚫 ${role_name}行動 (被恐懼)`;
        night_instruction.textContent = "今晚已被夢魘恐懼，無法發動技能。";
        btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "確認並閉眼";
        speak(`${role_name}請睜眼。`); return;
    }

    // === 企鵝冰凍攔截 ===
    // 規則：被冰凍的人當晚無法發動技能
    if (s.penguin_target && parseInt(actor_seat) === s.penguin_target && !s.current_stage.startsWith('notify_') && !['lovers_meet', 'wolf_meet', 'lucky_boy_action', 'awaken_wolf_king_gun', 'wolf_gun_confirm', 'awaken_witch_assistant_action', 'hidden_wolf', 'curse_fox', 'ghost_bride_couple', 'ghost_bride_witness', 'awaken_dreamwalker_result'].includes(s.current_stage)) {
        s.is_current_role_frozen = true;
        let role_name = getStageVoiceName(s.current_stage, s.current_sub_label);
        if (s.current_stage === 'wolf') {
            // 冰到狼人 → 全隊空刀（已在 day.js 中處理 isWolfFrozen），此處顯示提示
            let w_seats = Object.keys(s.player_roles).filter(k => wolf_faction.includes(s.player_roles[k]));
            let has_lg = Object.values(s.player_roles).includes('little_girl');
            if (has_lg) w_seats.push(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'little_girl'));
            w_seats.sort((a, b) => a - b);
            night_role_title.textContent = has_lg ? "🐺 狼隊與小女孩行動 (被冰凍)" : "🐺 狼人行動 (被冰凍)";
            night_instruction.innerHTML = `<span style="color:#4fc3f7;">今晚有狼人被企鵝冰凍，全隊無法刀人。</span><br><br>🐺 睜眼名單：${has_lg ? '【隱藏】' : w_seats.map(id => id + '號').join(', ')}<br><span style="color:#fca311;">被冰凍的是：${s.penguin_target}號</span>`;
            btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "確認並閉眼";
            speak(`${has_lg ? "狼隊和小女孩" : "狼人"}請睜眼。`); return;
        }
        night_role_title.textContent = `🧊 ${role_name}行動 (被冰凍)`;
        night_instruction.textContent = "今晚已被企鵝冰凍，無法發動技能。";
        btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "確認並閉眼";
        speak(`${role_name}請睜眼。`); return;
    }

    if (s.current_stage === 'bear' && !is_vwk_turn) {
        night_role_title.textContent = "🐻 熊確認";
        night_instruction.innerHTML = `<span style="color:#00ff88; font-weight:bold;">你是一般的熊 (不是百變狼王)。</span><br>請確認後閉眼。`;
        number_pad.classList.add('hidden');
        btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "確認並閉眼";
        speak(`熊請睜眼。`);
        return;
    }

    let auto_close_stages = ['wolf_gun_confirm', 'lovers_meet', 'wolf_meet', 'hidden_wolf', 'eclipse_maid', 'curse_fox', 'ghost_bride_witness'];

    if (auto_close_stages.includes(s.current_stage)) {
        if (s.current_stage === 'wolf_gun_confirm') {
            night_role_title.textContent = "🐺 三小狼確認分槍";
            let t = s.awk_wolf_gun_target ? s.awk_wolf_gun_target + " 號" : "無 (狼王自己保留兩把槍)";
            night_instruction.innerHTML = `狼王分槍的對象是：<br><span style="color:#e94560; font-size:24px; font-weight:bold;">${t}</span>`;
        } else if (s.current_stage === 'ghost_bride_witness') {
            night_role_title.textContent = "🕊️ 證婚人確認";
            let gb = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'ghost_bride'));
            let couple = [gb, s.ghost_bride_groom].sort((a, b) => a - b);
            night_instruction.innerHTML = `這對鬼魅夫妻是：<br><span style='color:#e94560; font-size: 24px; font-weight:bold;'>${couple[0]}號 與 ${couple[1]}號</span><br><span style='color:#a2a8d3; font-size: 14px;'>(你不知道誰是新娘誰是新郎)</span>`;
        } else if (s.current_stage === 'hidden_wolf') {
            night_role_title.textContent = "🐺😶‍🌫️ 隱狼確認";
            let w = Object.keys(s.player_roles).filter(k => evil_roles.includes(s.player_roles[k]) && s.player_roles[k] !== 'hidden_wolf');
            night_instruction.innerHTML = `狼人陣營同伴是：<br><span style="color:#e94560;">${w.length ? w.join(', ') + ' 號' : '無'}</span>`;
        } else if (s.current_stage === 'eclipse_maid') {
            night_role_title.textContent = "🌞 蝕日侍女確認";
            let w = Object.keys(s.player_roles).filter(k => wolf_faction.includes(s.player_roles[k]) && s.player_roles[k] !== 'eclipse_maid');
            night_instruction.innerHTML = `狼人陣營同伴是：<br><span style="color:#e94560;">${w.length ? w.join(', ') + ' 號' : '無'}</span>`;
        } else {
            if (s.current_stage === 'lovers_meet') night_role_title.textContent = "💕 情侶相認";
            if (s.current_stage === 'wolf_meet') night_role_title.textContent = "🐺 狼隊相認";
            night_instruction.textContent = s.current_stage === 'wolf_meet' ? "請狼隊伍互相確認身分 (首夜不刀人)。" : "請互相確認身分。";
        }
        number_pad.classList.add('hidden');
        btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "確認並閉眼";

        let v = getStageVoiceName(s.current_stage, s.current_sub_label);
        if (s.current_stage === 'wolf_meet' && Object.values(s.player_roles).includes('little_girl')) v = "狼隊和小女孩";
        speak(`${v}請睜眼。`);
        return;
    }

    if (s.current_stage === 'wolf_brother_meet') {
        night_role_title.textContent = "🐺 狼兄狼弟相認";
        let wb = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'wolf_brother');
        let wbl = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'wolf_brother_little');
        night_instruction.innerHTML = `狼兄是：<span style='color:#e94560; font-weight:bold;'>${wb}號</span><br>狼弟是：<span style='color:#e94560; font-weight:bold;'>${wbl}號</span>`;
        number_pad.classList.add('hidden');
        btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "確認並閉眼";
        speak(`狼兄狼弟請睜眼. `);
        return;
    }

    if (s.current_stage === 'awaken_dreamwalker_result') {
        night_role_title.textContent = "💤✨ 覺醒攝夢人確認";
        let t = s.awk_dreamwalker_target;
        let did_act = s.acted_players.includes(parseInt(t)) || s.player_roles[t] === 'grave_keeper';
        night_instruction.innerHTML = `你指定的夢語者是：<br><span style="color:#fca311; font-size:24px; font-weight:bold;">${t} 號</span><br><br>該玩家今晚<span style="color:${did_act ? '#00ff88' : '#e94560'}; font-weight:bold; font-size:20px;">${did_act ? '有行動' : '沒有行動'}</span>`;
        number_pad.classList.add('hidden');
        btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "確認並閉眼";
        speak(`覺醒攝夢人請睜眼。`);
        return;
    }

    if (s.current_stage === 'awaken_witch_assistant_action') {
        night_role_title.textContent = "👤 協助者確認";
        night_instruction.innerHTML = `覺醒女巫選擇毒殺：<span style='color:#e94560; font-weight:bold; font-size:24px;'>${s.witch_poison_target} 號</span><br>請問你是否同意這項行動？`;
        number_pad.classList.add('hidden'); action_pad.innerHTML = ''; action_pad.classList.remove('hidden');

        let btn_agree = document.createElement('button'); btn_agree.className = 'primary-btn'; btn_agree.textContent = "同意";
        let btn_disagree = document.createElement('button'); btn_disagree.className = 'secondary-btn'; btn_disagree.textContent = "不同意";

        btn_agree.onclick = () => { s.awk_witch_assistant_agreed = true; btn_confirm_action.click(); };
        btn_disagree.onclick = () => { s.awk_witch_assistant_agreed = false; btn_confirm_action.click(); };

        action_pad.appendChild(btn_agree); action_pad.appendChild(btn_disagree);
        speak(`協助者請睜眼。`);
        return;
    }

    // 渲染角色操作面板（已抽出到 roleUI.js）+ 淡入動畫
    const night_screen = document.getElementById('screen-night');
    night_screen.classList.remove('night-fade-in');
    void night_screen.offsetWidth; // 強制 reflow 重置動畫
    night_screen.classList.add('night-fade-in');
    renderRolePanel(is_stolen, is_vwk_turn, actor_seat);

    let voice_name = getStageVoiceName(s.current_stage, s.current_sub_label);
    if (s.current_stage === 'wolf' && Object.values(s.player_roles).includes('little_girl')) voice_name = "狼隊和小女孩";
    speak(`${voice_name}請睜眼。`);
}

// ==========================================
// 3. 系統初始化與 DOM 事件綁定
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    // 設定頁相關初始化（板子選擇、角色錄入、進入黑夜）
    initSetupEvents();

    // 警長競選相關事件
    initSheriffEvents();

    const btn_confirm_action = document.getElementById('btn-confirm-action');
    const btn_optional_skip = document.getElementById('btn-optional-skip');
    const btn_show_judge = document.getElementById('btn-show-judge');
    const btn_reset = document.getElementById('btn-reset');

    const judge_modal = document.getElementById('judge-modal');
    const btn_close_judge = document.getElementById('btn-close-judge');
    const judge_player_status = document.getElementById('judge-player-status');
    const judge_night_log = document.getElementById('judge-night-log');

    const action_pad = document.getElementById('action-pad');
    const number_pad = document.getElementById('number-pad');
    const night_instruction = document.getElementById('night-instruction');

    const action_container = document.createElement('div');
    action_container.style = 'display:flex; justify-content:center; gap:10px; margin-bottom:10px;';
    btn_show_judge.parentNode.insertBefore(action_container, btn_show_judge);
    action_container.appendChild(btn_show_judge);

    const btn_show_crow = document.createElement('button');
    btn_show_crow.id = 'btn-show-crow'; btn_show_crow.className = 'text-btn hidden';
    btn_show_crow.style = 'border: 1px solid #4b5563;'; btn_show_crow.textContent = '🐦‍⬛ 查看烏鴉詛咒';
    action_container.appendChild(btn_show_crow);
    btn_show_judge.style.marginBottom = '0';

    const crow_panel = document.createElement('div');
    crow_panel.id = 'crow-record-panel'; crow_panel.className = 'hidden';
    crow_panel.style = 'background:#24345e; padding:15px; border-radius:8px; margin-bottom:15px; text-align:left;';
    crow_panel.innerHTML = `
        <h3 style="margin-top:0; color:#fca311;">🐦‍⬛ 烏鴉詛咒紀錄</h3>
        <p style="font-size:16px;">昨晚被烏鴉詛咒的玩家是：<span id="crow-panel-target" style="color:#e94560; font-weight:bold; font-size:20px;">無 號</span></p>
        <p style="color:#a2a8d3; font-size:14px; margin-bottom:0;">該玩家在今日的放逐投票中，將被額外計算一票。</p>
    `;
    action_container.parentNode.insertBefore(crow_panel, action_container.nextSibling);
    btn_show_crow.onclick = () => {
        document.getElementById('crow-panel-target').textContent = s.crow_target ? `${s.crow_target} 號` : '無';
        crow_panel.classList.toggle('hidden');
    };


    btn_confirm_action.addEventListener('click', () => {
        vibrate(20);

        let is_real_action = (s.selected_number !== 'skip' && s.selected_number !== null) || s.selected_numbers_arr.length > 0 || s.is_witch_saved || s.current_stage === 'awaken_witch_assistant_action';
        if (is_real_action && s.current_stage !== 'awaken_witch') {
            if (s.current_actor_seat) s.acted_players.push(parseInt(s.current_actor_seat));
            else {
                let p = Object.keys(s.player_roles).find(k => s.player_roles[k] === s.current_stage || s.player_roles[k] === 'awaken_' + s.current_stage);
                if (p) s.acted_players.push(parseInt(p));
            }
            if (s.current_stage === 'wolf' && !s.is_seed_wolf_infecting) {
                let ws = Object.keys(s.player_roles).filter(k => wolf_faction.includes(s.player_roles[k]));
                ws.forEach(x => s.acted_players.push(parseInt(x)));
            }
        }

        if (s.is_current_role_feared) {
            let role_log = getStageVoiceName(s.current_stage, s.current_sub_label);
            if (s.current_board.id === '12_shadow' && parseInt(s.current_actor_seat) === s.shadow_seer_seat) {
                role_log += ' (燈影)';
            }
            s.night_action_log.push(`【${role_log}】被恐懼，跳過技能`);

            btn_confirm_action.classList.add('hidden');
            action_pad.innerHTML = ''; action_pad.classList.add('hidden');
            night_instruction.textContent = "請閉眼等待...";
            speak(`${getStageVoiceName(s.current_stage, s.current_sub_label)}請閉眼。`, () => setTimeout(runNextNightRole, s.role_transition_delay * 1000));
            return;
        }

        if (s.is_current_role_frozen) {
            let role_log = getStageVoiceName(s.current_stage, s.current_sub_label);
            s.night_action_log.push(`【${role_log}】被冰凍，跳過技能`);

            btn_confirm_action.classList.add('hidden');
            action_pad.innerHTML = ''; action_pad.classList.add('hidden');
            night_instruction.textContent = "請閉眼等待...";
            speak(`${getStageVoiceName(s.current_stage, s.current_sub_label)}請閉眼。`, () => setTimeout(runNextNightRole, s.role_transition_delay * 1000));
            return;
        }

        if (s.current_stage === 'awaken_witch_assistant_action') {
            btn_confirm_action.classList.add('hidden'); action_pad.classList.add('hidden');
            night_instruction.textContent = "請閉眼等待...";
            let agree_text = s.awk_witch_assistant_agreed ? "同意" : "不同意";
            s.night_action_log.push(`【覺醒女巫】對 ${s.witch_poison_target}號 使用毒藥 (指派 ${s.awk_witch_assistant}號 協助，他 ${agree_text})`);
            if (!s.awk_witch_assistant_agreed) s.witch_poison_target = null;
            speak(`協助者請閉眼。`, () => setTimeout(runNextNightRole, s.role_transition_delay * 1000));
            return;
        }

        if (['wolf_brother_meet', 'wolf_gun_confirm', 'lovers_meet', 'wolf_meet', 'hidden_wolf', 'eclipse_maid', 'curse_fox', 'ghost_bride_witness', 'hunter', 'bear'].includes(s.current_stage) || s.current_stage.startsWith('notify_')) {
            btn_confirm_action.classList.add('hidden');
            action_pad.innerHTML = ''; action_pad.classList.add('hidden');
            night_instruction.textContent = "請閉眼等待...";

            if (s.current_stage === 'wolf_meet') s.night_action_log.push(`【狼人】互相確認身分，首夜不刀人`);
            if (s.current_stage === 'hidden_wolf') s.night_action_log.push(`【隱狼】確認了狼人陣營隊友`);
            if (s.current_stage === 'eclipse_maid') s.night_action_log.push(`【蝕日侍女】確認了狼人陣營隊友`);

            let v = getStageVoiceName(s.current_stage, s.current_sub_label);
            if (s.current_stage === 'wolf_meet' && Object.values(s.player_roles).includes('little_girl')) v = "狼隊和小女孩";

            speak(`${v}請閉眼。`, () => setTimeout(runNextNightRole, s.role_transition_delay * 1000));
            return;
        }

        let needs_result_roles = ['seer', 'real_fox', 'awaken_seer', 'gargoyle', 'psychic', 'pure_white', 'fool_seer', 'wolf_witch', 'machine_wolf', 'snake_seer'];
        if (s.current_stage === 'lucky_boy_action' && s.merchant_item === 'seer' && s.merchant_type !== 'black_market') needs_result_roles.push('lucky_boy_action');
        if (s.current_stage === 'gray_wolf_action' && s.gray_wolf_stolen_skill === 'seer') needs_result_roles.push('gray_wolf_action');

        if (needs_result_roles.includes(s.current_stage) && s.selected_number !== 'skip' && !s.is_showing_result) {
            number_pad.classList.add('hidden');
            action_pad.innerHTML = '';
            action_pad.classList.remove('hidden');
            btn_confirm_action.textContent = "了解並閉眼";
            btn_optional_skip.classList.add('hidden');

            let { label, text, color } = resolveInspectionResult();

            let result_box = document.createElement('div');
            result_box.style = "padding: 20px; background-color: var(--bg-card); border-radius: 8px; width: 100%; text-align: center; border: 2px solid var(--color-accent); margin: 20px 0;";
            let lbl = document.createElement('p');
            lbl.style = "font-size: 18px; margin: 0; color: var(--color-text);"; lbl.textContent = label;
            let txt = document.createElement('p');
            txt.style = "font-size: 32px; font-weight: bold; margin: 10px 0 0 0;";
            txt.textContent = text; txt.style.color = color;
            result_box.appendChild(lbl); result_box.appendChild(txt); action_pad.appendChild(result_box);
            s.is_showing_result = true; return;
        }

        if (s.current_stage === 'awaken_witch' && s.awk_witch_step === 'poison_target') {
            s.awk_witch_step = 'assistant_target';
            resetSelections();
            btn_confirm_action.classList.add('hidden');
            document.getElementById('night-instruction').textContent = "請選擇你要指派的協助者：";
            return;
        }

        btn_confirm_action.classList.add('hidden');
        btn_optional_skip.classList.add('hidden');
        number_pad.classList.add('hidden');

        let custom_panel = document.getElementById('custom-action-panel');
        if (custom_panel) custom_panel.remove();
        action_pad.innerHTML = '';
        action_pad.classList.add('hidden');
        night_instruction.textContent = "請閉眼等待...";

        // 呼叫 actions.js 處理狀態寫入
        resolveNonInspectionAction();

        let v = getStageVoiceName(s.current_stage, s.current_sub_label);
        if (s.current_stage === 'wolf' && Object.values(s.player_roles).includes('little_girl')) v = "狼隊和小女孩";
        speak(`${v}請閉眼。`, () => setTimeout(runNextNightRole, s.role_transition_delay * 1000));
    });

    btn_optional_skip.addEventListener('click', () => {
        vibrate(10);
        if (s.current_stage === 'wolf' && btn_optional_skip.textContent === "返回選單") {
            resetSelections(); number_pad.classList.add('hidden'); action_pad.classList.remove('hidden');
            btn_optional_skip.classList.add('hidden'); btn_confirm_action.classList.add('hidden'); s.is_seed_wolf_infecting = false; return;
        }

        resetSelections();
        btn_optional_skip.classList.add('action-selected');
        s.selected_number = 'skip';
        btn_confirm_action.classList.remove('hidden');
        btn_confirm_action.textContent = "確認";
        if (s.current_stage === 'awaken_witch') s.awk_witch_step = null;
    });

    btn_show_judge.addEventListener('click', () => {
        let status_html = '';
        for (let i = 1; i <= s.total_players; i++) {
            let role = s.player_roles[i]; let status_strs = [];

            if (s.final_killed.includes(i)) status_strs.push(`💀 死亡 (${s.player_status[i].deathReason || "未知"})`);
            if (s.player_status[i].poisoned) status_strs.push("🧪 中毒");
            if (s.player_status[i].injured) status_strs.push("🏹 負傷");
            if (s.player_status[i].isWhiteCatFlipped) status_strs.push("🐱 已翻牌");
            if (s.player_status[i].isVWK) status_strs.push("🎭 百變狼王");

            if (s.merchant_target === i) {
                let item_map = { 'seer': '預查', 'poison': '毒藥', 'guard': '護盾', 'gun': '槍' };
                status_strs.push(`🎁 幸運兒 (${item_map[s.merchant_item] || '無'})`);
            }

            if (s.dream_target === i) status_strs.push("💤 被攝夢");
            if (s.guard_target === i) status_strs.push("🛡️ 被守護");
            if (s.pleasant_goat_guard === i) status_strs.push("🛡️ 喜羊羊守護");
            if (s.pleasant_goat_anti_theft === i) status_strs.push("🔒 喜羊羊防盜");
            if (s.gray_wolf_stolen_player === i) status_strs.push("🎩 被偷取技能");
            if (s.nightmare_target === i) status_strs.push("🌑 被恐懼");
            if (s.beauty_target === i || s.awk_beauty_target === i) status_strs.push("💋 被魅惑");
            if (s.phantom_targets.includes(i)) status_strs.push("🌸 被綁定");
            if (s.machine_wolf_target === i) status_strs.push("🤖 被學習");
            if (s.cupid_lovers.includes(i)) status_strs.push("💕 情侶");
            if (s.awk_wolf_gun_target === i) status_strs.push("🔫 獲槍");
            if (s.awk_witch_assistant === i) status_strs.push("👤 協助者");
            if (s.half_blood_target === i) status_strs.push("🩸 混血兒支持");
            if (s.wild_child_target === i) status_strs.push("👶 野孩子榜樣");
            if (s.lonely_girl_target === i) status_strs.push("👧 少女偶像");
            if (s.time_wolf_target === i) status_strs.push("⏳ 蝕時封鎖");
            if (s.awk_idiot_target === i) status_strs.push("🤡 白痴保護");
            if (s.crow_target === i) status_strs.push("🐦‍⬛ 烏鴉詛咒");
            if (s.seed_wolf_target === i) status_strs.push("🐺 感染成狼");
            if (s.awk_gargoyle_target === i) status_strs.push("🦇 覺石轉化");
            if (s.awk_gargoyle_target_a === i) status_strs.push("🦇 覺石A轉化");
            if (s.awk_gargoyle_target_b === i) status_strs.push("🦇 覺石B轉化");
            if (s.awk_dreamwalker_target === i) status_strs.push("💤 夢語者");
            if (s.ghost_bride_groom === i) status_strs.push("🤵 新郎");
            if (s.ghost_bride_witness === i) status_strs.push("🕊️ 證婚人");
            if (s.rust_sword_infected_target === i) status_strs.push("🦠 傷口感染");

            let status_badge = status_strs.length > 0 ? `<span style="color:#fca311;">(${status_strs.join(', ')})</span>` : '';
            let thief_tag = (i === s.initial_thief_seat) ? '(盜賊)' : '';

            let role_obj = s.ROLE_DICT[role];
            let name_text = role_obj?.name || role;
            if (s.current_board?.id === '12_shadow') {
                if (i === s.shadow_seer_seat) {
                    name_text = "燈影預言家";
                } else if (role === 'seer_A' || role === 'seer_B') {
                    name_text = "預言家";
                }
            }

            status_html += `<div style="margin-bottom:5px;"><b>${i}號</b> ${role_obj?.icon || ''}${name_text}${thief_tag} ${status_badge}</div>`;
        }
        judge_player_status.innerHTML = status_html;
        judge_night_log.innerHTML = s.night_action_log.map(log => `<div style="margin-bottom:5px;">• ${log}</div>`).join('');
        judge_modal.classList.remove('hidden');
    });

    btn_close_judge.addEventListener('click', () => judge_modal.classList.add('hidden'));

    btn_reset.addEventListener('click', () => {
        resetGameState();

        let t_calc = document.getElementById('trickster-calc'); if (t_calc) t_calc.remove();
        document.getElementById('crow-record-panel').classList.add('hidden');
        document.getElementById('screen-day').classList.add('hidden'); document.getElementById('screen-start').classList.remove('hidden');
    });
});
