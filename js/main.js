// js/main.js
import { s, getStageVoiceName, isPlayerWolfFaction, getWolfTeamRoles, speak, delay, resetGameState, resetNightState, vibrate, getActiveEffectsOn, getActionsByEffect, getNightTarget, insertNightStatusFlow, removeDeathEvent, logNightAction, findNearestWolf } from './core.js';
import { resetSelections } from './night.js';
import { calculateNightDeaths, generateDayReport, killPlayerDuringDay } from './day.js';
import { initSetupEvents } from './setup.js';
import { initSheriffScreen, initSheriffEvents } from './sheriff.js';
import { resolveInspectionResult, resolveNonInspectionAction } from './actions.js';
import { renderRolePanel } from './roleUI.js';
import { triggerTricksterVoteSection } from './vote.js';

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

function revealDeferredSpeechOrder() {
    if (!s.defer_speech_order_until_shooting) return;
    s.speech_order_text = generateSpeechOrder(null);
    s.defer_speech_order_until_shooting = false;
}

export function buildNightQueue() {
    s.night_queue = [];
    const active_roles = Object.values(s.player_roles);
    let queue_list = [];

    // 資料驅動：月靈狼咆哮判定
    let moonWolfSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'moon_wolf');
    if (moonWolfSeat && !s.final_killed.includes(parseInt(moonWolfSeat))) {
        let seat = parseInt(moonWolfSeat);
        let findAlive = (start, direction) => {
            let current = start;
            do {
                current += direction;
                if (current < 1) current = s.total_players;
                if (current > s.total_players) current = 1;
            } while (current !== start && s.final_killed.includes(current));
            return current;
        };
        let left = findAlive(seat, -1); let right = findAlive(seat, 1);

        let isGod = (st) => s.ROLE_DICT[s.player_roles[st]]?.type === 'god';
        s.moon_wolf_roar = isGod(left) || isGod(right);
    }

    let activeRolesSeats = {};
    Object.entries(s.player_roles).forEach(([seat, role]) => {
        if (!activeRolesSeats[role]) activeRolesSeats[role] = [];
        activeRolesSeats[role].push(parseInt(seat));
    });
    Object.values(activeRolesSeats).forEach(arr => arr.sort((a, b) => a - b));
    let usedSeats = {};

    const wake_queue = s.current_board?.wake_queue || [];

    wake_queue.forEach((qItem, index) => {
        let stage = qItem; let isFake = false; let seat = null; let subLabel = null;

        if (qItem === 'take_turns') {
            queue_list.push({ stage: 'take_turns', order: index, seat: null, subLabel: null, isFake: false });
            return;
        }

        // 群體與特定機制轉換
        if (['wolf', 'wolves', 'lucky_player', 'assistants', 'couple', 'infected', 'ghost_bride_and_groom', 'marriage_witness', 'fanatic', 'gift_receiver', 'lovers_meet', 'wolf_brother_meet', 'big_gray_wolf_meet'].includes(qItem)) {
            stage = qItem;
            if (qItem === 'wolf' || qItem === 'wolves') {
                stage = s.current_board?.id === '12_animals' ? 'wolf_meet' : 'wolf';
                if (!active_roles.some(r => getWolfTeamRoles().includes(r))) return;
            } else if (qItem === 'lucky_player') {
                stage = 'lucky_boy_action'; if (!active_roles.includes('miracle_merchant') && !active_roles.includes('super_black_market')) return;
            } else if (qItem === 'assistants') {
                stage = 'awaken_witch_assistant_action'; if (!active_roles.includes('awaken_witch')) return;
            } else if (qItem === 'couple' || qItem === 'lovers_meet') {
                stage = 'lovers_meet'; if (!active_roles.includes('cupid') && !active_roles.includes('thief')) return;
            } else if (qItem === 'infected') {
                stage = 'zombie_infected'; if (!active_roles.includes('zombie')) return;
            } else if (qItem === 'ghost_bride_and_groom') {
                stage = 'ghost_bride_couple'; if (!active_roles.includes('ghost_bride')) return;
            } else if (qItem === 'marriage_witness') {
                stage = 'ghost_bride_witness'; if (!active_roles.includes('ghost_bride')) return;
            } else if (qItem === 'fanatic') {
                stage = 'fanatic_action'; if (!active_roles.includes('jack_ripper')) return;
            } else if (qItem === 'wolf_brother_meet') {
                if (!active_roles.includes('wolf_brother')) return;
            } else if (qItem === 'big_gray_wolf_meet') {
                if (!active_roles.includes('big_gray_wolf')) return;
            } else if (qItem === 'gift_receiver') {
                if (!active_roles.includes('pandora')) return;
                stage = 'pandora_gift_receiver';
            }
        } else {
            let baseRole = qItem;
            let match = qItem.match(/^(.+)_([A-Z])$/);
            if (match && !s.ROLE_DICT[qItem]) {
                baseRole = match[1];
                subLabel = match[2];
            }

            if (activeRolesSeats[baseRole]) {
                let usedCount = usedSeats[baseRole] || 0;
                if (usedCount < activeRolesSeats[baseRole].length) {
                    seat = activeRolesSeats[baseRole][usedCount];
                    usedSeats[baseRole] = usedCount + 1;
                    stage = baseRole;
                } else return;
            } else if (s.discarded_roles.includes(baseRole) && ['seer', 'witch', 'hunter', 'cupid', 'guard', 'idiot'].includes(baseRole)) {
                isFake = true; stage = baseRole;
            } else return;
        }

        if (stage === 'seer' || stage === 'shadow_seer') {
            let s_a = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'seer_A');
            let s_b = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'seer_B');
            let shadow = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'shadow_seer');
            let seer_seat = Object.keys(s.player_roles).find(k => ['seer', 'pure_white', 'real_fox', 'psychic', 'awaken_seer'].includes(s.player_roles[k]));

            if (stage === 'seer' && s_a) { seat = parseInt(s_a); subLabel = 'A'; }
            else if (stage === 'seer' && seer_seat) { seat = parseInt(seer_seat); stage = s.player_roles[seer_seat]; }
            else if (stage === 'shadow_seer') { if (s_b) { seat = parseInt(s_b); stage = 'seer'; subLabel = 'B'; } else if (shadow) { seat = parseInt(shadow); stage = 'shadow_seer'; } }
        }

        queue_list.push({ stage, order: index, seat, subLabel, isFake });

        if (qItem === 'gift_receiver' && active_roles.includes('pandora')) {
            queue_list.push({ stage: 'pandora_knife_action', order: index + 0.5, seat: null, subLabel: null, isFake: false });
        }
    });

    queue_list.sort((a, b) => a.order - b.order);
    s.night_queue = queue_list;
}

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
    let w_target = getNightTarget('kill', 'wolf');

    const alchemist_call_section = document.getElementById('alchemist-call-section');
    const day_result_content = document.getElementById('day-result-content');

    if (alch_seat && !s.is_alchemist_snake_used && !s.final_killed.includes(parseInt(alch_seat))) {
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
                        removeDeathEvent(w_target);
                        s.is_alchemist_snake_used = true;
                        logNightAction(`【煉金魔女】使用了法老之蛇，救活了 ${w_target}號`);
                        s.death_events = s.death_events.filter(e => e.source !== 'chain');
                        import('./day.js').then(module => module.handleChainDeaths());
                    } else logNightAction(`【煉金魔女】未發動法老之蛇`);
                    speak("煉金魔女請閉眼，三秒後所有玩家睜眼，三、二、一。", () => { day_result_content.classList.remove('hidden'); proceedDayResultRender(); });
                };

                if (w_target) document.getElementById('btn-alch-save').onclick = () => finishAlchemist(true);
                document.getElementById('btn-alch-pass').onclick = () => finishAlchemist(false);
            });
        };
        return;
    }

    day_result_content.classList.remove('hidden');
    proceedDayResultRender();
}

export function proceedDayResultRender() {
    let report = generateDayReport();
    if (report.shootersQueue.length === 0) revealDeferredSpeechOrder();

    let crowTarget = getNightTarget('curse_vote', 'crow');
    if (crowTarget) document.getElementById('btn-show-crow').classList.remove('hidden');

    let htmlOutput = report.bearRoarText + report.extraText;
    if (report.isPeaceful) { htmlOutput += "<span style='color:#00ff88;'>🎉 昨晚是平安夜，沒有人死亡！</span>"; }
    else {
        htmlOutput += `<span style='color:#e94560;'>💀 昨晚死亡的是：${report.killedSeats.join(' 號、')} 號</span>`;
        if (report.isSnakeWin) htmlOutput += `<br><br><span style="color:#ff00ff; font-size:28px;">🎉 千年之戀達成！<br>許仙與白蛇雙雙殉情，直接獲勝！</span>`;
    }
    if (s.is_pandora_win) htmlOutput += `<br><br><span style="color:#ff00ff; font-size:28px;">🎉 潘朵拉使用希望之光，獲得勝利！</span>`;

    if (s.speech_order_text) htmlOutput += `<br><br><span style="color:#51c9c1; font-size: 20px;">🗣️ 發言順序：<br>${s.speech_order_text}</span>`;
    document.getElementById('day-result').innerHTML = htmlOutput;

    if (report.shootersQueue.length > 0) processNextShooter(); else triggerTricksterVoteSection();
}

export function processNextShooter() {
    if (s.day_shooters_queue.length === 0) {
        revealDeferredSpeechOrder();
        document.getElementById('day-skill-section').classList.add('hidden');
        if (s.speech_order_text) {
            let dayResult = document.getElementById('day-result');
            if (dayResult && !dayResult.innerHTML.includes('發言順序')) dayResult.innerHTML += `<br><br><span style="color:#51c9c1; font-size: 20px;">🗣️ 發言順序：<br>${s.speech_order_text}</span>`;
        }
        triggerTricksterVoteSection();
        return;
    }

    document.getElementById('btn-reset').classList.add('hidden');
    const currentShooter = s.day_shooters_queue[0];
    const section = document.getElementById('day-skill-section');
    section.classList.remove('hidden');
    document.getElementById('day-skill-notice').textContent = `🎯 【 ${currentShooter.seat} 號 】玩家，請問是否發動技能？`;
    let pad = document.getElementById('day-skill-pad'); pad.innerHTML = '';

    const finishShooterTurn = () => {
        let sorted_final_killed = [...s.final_killed].sort((a, b) => a - b);
        let dayResultStr = `<span style='color:#e94560;'>💀 本局目前死亡名單：${sorted_final_killed.join(' 號、')} 號</span>` + (s.speech_order_text ? `<br><br><span style="color:#51c9c1;">🗣️ ${s.speech_order_text}</span>` : "");
        if (s.is_snake_win) dayResultStr += `<br><br><span style="color:#ff00ff; font-size:28px;">🎉 千年之戀達成！<br>許仙與白蛇雙雙殉情，直接獲勝！</span>`;
        if (s.is_pandora_win) dayResultStr += `<br><br><span style="color:#ff00ff; font-size:28px;">🎉 潘朵拉使用希望之光，獲得勝利！</span>`;
        document.getElementById('day-result').innerHTML = dayResultStr;
        s.day_shooters_queue.shift(); processNextShooter();
    };

    let troubleTarget = getNightTarget('trouble', 'troublemaker');
    if (troubleTarget === currentShooter.seat && ['hunter', 'awaken_hunter'].includes(currentShooter.role)) {
        logNightAction(`【${currentShooter.seat}號獵人】被搗蛋鬼耍寶，開槍帶走自己`);
        s.day_shooters_queue.shift(); processNextShooter();
        return;
    }

    if (currentShooter.role === 'awaken_hunter') {
        pad.innerHTML = `<button class="num-btn" id="btn-hunter-asc" style="grid-column: span 2; font-size: 18px;">順序 (號碼遞增)</button><button class="num-btn" id="btn-hunter-desc" style="grid-column: span 2; font-size: 18px;">逆序 (號碼遞減)</button>`;
        document.getElementById('btn-hunter-asc').onclick = () => { let t = findNearestWolf(currentShooter.seat, 1); if (t) killPlayerDuringDay(t, true, true, 'awaken_hunter'); finishShooterTurn(); };
        document.getElementById('btn-hunter-desc').onclick = () => { let t = findNearestWolf(currentShooter.seat, -1); if (t) killPlayerDuringDay(t, true, true, 'awaken_hunter'); finishShooterTurn(); };
        document.getElementById('btn-day-skill-skip').onclick = finishShooterTurn; document.getElementById('btn-day-skill-confirm').classList.add('hidden');
        return;
    }

    let selectedDayTarget = null;
    for (let i = 1; i <= s.total_players; i++) {
        const btn = document.createElement('button'); btn.classList.add('num-btn'); btn.textContent = i;
        if (s.final_killed.includes(i)) { btn.disabled = true; btn.style.opacity = '0.3'; btn.style.cursor = 'not-allowed'; }
        else {
            btn.onclick = () => { document.querySelectorAll('#day-skill-pad .num-btn').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); selectedDayTarget = i; document.getElementById('btn-day-skill-confirm').classList.remove('hidden'); };
        }
        pad.appendChild(btn);
    }
    document.getElementById('btn-day-skill-skip').onclick = finishShooterTurn;
    document.getElementById('btn-day-skill-confirm').onclick = () => { document.getElementById('btn-day-skill-confirm').classList.add('hidden'); killPlayerDuringDay(selectedDayTarget, true, true, currentShooter.role); finishShooterTurn(); };
}

function getStatusStageVoice(stage) {
    const group_match = stage.match(/^status_check_group_(\d+)$/);
    if (group_match) return `${group_match[1]}號`;

    const notify_match = stage.match(/^status_notify_(.+)_(\d+)$/);
    if (notify_match) {
        const flow = s.night_status_flows.find(item => item.id === notify_match[1]);
        if (!flow) return `${notify_match[2]}號`;
        if (flow.type === 'super_black_market') {
            const gift = flow.metadata?.gifts?.find(item => item.seat === parseInt(notify_match[2]));
            return gift ? `幸運兒${gift.label}` : '幸運兒';
        }
        const names = { merchant: '幸運兒', lovers: '情侶', assistant: '協助者', gargoyle_conversion: '覺醒石像鬼轉化者', ghost_groom: '新郎', ghost_witness: '證婚人', seed_wolf: '感染者' };
        return names[flow.type] || '特殊身份';
    }
    return null;
}

function hideNightUIIngame(title = "🌙 夜晚持續中", instruction = "請閉上眼睛，等待法官指示...") {
    document.getElementById('night-instruction').innerHTML = instruction;
    document.getElementById('night-role-title').textContent = title;
    document.getElementById('number-pad').classList.add('hidden');
    document.getElementById('action-pad').classList.add('hidden');
    document.getElementById('btn-optional-skip').classList.add('hidden');
    document.getElementById('btn-confirm-action').classList.add('hidden');
    let custom_panel = document.getElementById('custom-action-panel');
    if (custom_panel) custom_panel.remove();
}

export async function runNextNightRole() {
    const btn_confirm_action = document.getElementById('btn-confirm-action');
    const btn_optional_skip = document.getElementById('btn-optional-skip');
    const number_pad = document.getElementById('number-pad');
    const action_pad = document.getElementById('action-pad');
    const night_role_title = document.getElementById('night-role-title');
    const night_instruction = document.getElementById('night-instruction');

    let existing_custom_panel = document.getElementById('custom-action-panel');
    if (existing_custom_panel) existing_custom_panel.remove();

    btn_confirm_action.classList.add('hidden'); btn_optional_skip.classList.add('hidden');
    number_pad.classList.add('hidden'); action_pad.classList.add('hidden'); action_pad.innerHTML = ''; night_instruction.innerHTML = "";

    resetSelections();
    s.is_showing_result = false; s.is_current_role_feared = false; s.is_current_role_frozen = false; s.is_fake_wake = false;
    s.current_sub_label = null; s.awk_witch_step = null; s.is_seed_wolf_infecting = false;

    if (s.night_queue.length === 0) {
        night_role_title.textContent = "🌅 天亮結算中"; night_instruction.textContent = "法官正在處理昨晚的行動結果...";
        calculateNightDeaths();
        let morning_voice = document.getElementById('setting-sheriff').checked ? "要競選警長的請舉手，三秒後天亮，三、二、一。" : "三秒後天亮，三、二、一。";

        await speak(morning_voice);
        if (document.getElementById('setting-sheriff').checked) {
            document.getElementById('screen-night').classList.add('hidden'); document.getElementById('screen-sheriff').classList.remove('hidden'); initSheriffScreen();
        } else {
            s.speech_order_text = null; s.defer_speech_order_until_shooting = true; showDayResult();
        }
        return;
    }

    let next_task = s.night_queue.shift();
    s.current_stage = next_task.stage; s.current_actor_seat = next_task.seat; s.current_sub_label = next_task.subLabel; s.is_fake_wake = next_task.isFake;

    if (s.current_stage === 'take_turns') {
        let stages = [];
        // 1. 強制產生 1~12 號的輪流點擊確認 (不論晚上有沒有人放技能)
        for (let seat = 1; seat <= s.total_players; seat++) {
            stages.push({ stage: `status_check_group_${seat}`, order: -1, seat: null, subLabel: null, isFake: false });
        }

        // 2. 把目前累積的狀態標記為「已處理」，若有需要單獨叫醒的再加進去
        let unprocessed = s.night_status_flows.filter(f => !f.processed);
        unprocessed.forEach(flow => {
            flow.processed = true;
            const reveal_targets = flow.metadata.reveal_targets ? [...flow.metadata.reveal_targets].map(Number).filter(Boolean) : flow.targets;
            reveal_targets.forEach((seat, idx) => {
                stages.push({ stage: `status_notify_${flow.id}_${seat}`, order: -1, seat: null, subLabel: idx, isFake: false });
            });
        });

        s.night_queue.unshift(...stages);
        return runNextNightRole();
    }

    if (s.current_stage === 'pandora_gift_receiver') {
        if (!s.pandora_target) return runNextNightRole();
        s.current_stage = `notify_pandora_${s.pandora_target}`;
    }
    if (s.current_stage === 'pandora_knife_action') {
        if (s.pandora_gift !== 'knife' || !s.pandora_target || s.player_roles[s.pandora_target] === 'pandora') return runNextNightRole();
        s.current_stage = 'pandora_knife';
        s.current_actor_seat = parseInt(s.pandora_target);
    }

    if (s.is_fake_wake) {
        let fake_name = s.ROLE_DICT[s.current_stage]?.name || getStageVoiceName(s.current_stage, s.current_sub_label);
        night_role_title.textContent = `🎭 ${fake_name}行動 (偽裝)`; night_instruction.textContent = "該身分已被棄掉，模擬睜眼等待中...";
        let wait_time = Math.random() * 2000 + 3000;

        await speak(`${getStageVoiceName(s.current_stage, s.current_sub_label)}請睜眼。`);
        await delay(wait_time);
        hideNightUIIngame();
        await speak(`${getStageVoiceName(s.current_stage, s.current_sub_label)}請閉眼。`);
        await delay(s.role_transition_delay * 1000);
        runNextNightRole();
        return;
    }

    if (s.current_stage === 'lucky_boy_action' && (!s.merchant_target || isPlayerWolfFaction(s.merchant_target))) return runNextNightRole();

    let witchPoisonTarget = getNightTarget('poison', 'witch') || getNightTarget('poison', 'awaken_witch');
    if (s.current_stage === 'awaken_witch_assistant_action' && (!s.awk_witch_assistant || !witchPoisonTarget)) return runNextNightRole();

    let awkDreamwalkerTarget = getNightTarget('dream', 'awaken_dreamwalker');
    if (s.current_stage === 'awaken_dreamwalker_result' && !awkDreamwalkerTarget) return runNextNightRole();

    if (s.current_stage.startsWith('notify_pandora_')) { let seat = parseInt(s.current_stage.split('_').pop()); if (!s.pandora_target || seat !== parseInt(s.pandora_target)) return runNextNightRole(); }
    if (s.current_stage.startsWith('notify_sp_lucky_')) { let seat = parseInt(s.current_stage.split('_').pop()); if (!s.sp_merchant_targets || !s.sp_merchant_targets.includes(seat)) return runNextNightRole(); }

    if (s.current_stage === 'big_bad_wolf') {
        let total_wolves = Object.values(s.player_roles).filter(r => getWolfTeamRoles().includes(r)).length;
        let alive_wolves = Object.keys(s.player_roles).filter(k => getWolfTeamRoles().includes(s.player_roles[k]) && s.player_status[k]?.alive !== false).length;
        if (alive_wolves < total_wolves) return runNextNightRole();
    }

    let actor_seat = s.current_actor_seat || Object.keys(s.player_roles).find(k => s.player_roles[k] === s.current_stage || s.player_roles[k] === 'awaken_' + s.current_stage);
    let is_vwk_turn = actor_seat && s.player_status[actor_seat]?.isVWK;

    if (actor_seat && s.player_status[actor_seat]?.isPandoraPoisoned) return runNextNightRole();

    if (actor_seat && s.player_status[actor_seat]?.isConvertedWolf && s.current_stage !== 'wolf') {
        s.is_current_role_converted = true;
        let role_name = getStageVoiceName(s.current_stage, s.current_sub_label);
        let base_role = s.current_stage.replace('_A', '').replace('_B', '');

        night_role_title.textContent = `${s.ROLE_DICT[base_role]?.icon || '🎭'} ${role_name}行動 (已被轉化)`;
        night_instruction.innerHTML = `<span style="color:#e94560; font-weight:bold;">你已被感染或轉化為狼人陣營，無法發動原技能。</span>`;

        number_pad.classList.add('hidden');
        action_pad.classList.add('hidden');
        btn_optional_skip.classList.add('hidden');

        btn_confirm_action.classList.remove('hidden');
        btn_confirm_action.textContent = "確認並閉眼";

        await speak(`${role_name}請睜眼。`);
        return;
    }

    let pgAntiTheft = getNightTarget('anti_theft', 'pleasant_goat') || getNightTarget('guard_and_anti_theft', 'pleasant_goat');
    let is_stolen = s.gray_wolf_stolen_player && parseInt(actor_seat) === s.gray_wolf_stolen_player && s.gray_wolf_stolen_player !== pgAntiTheft;

    if (is_stolen) {
        let role_name = getStageVoiceName(s.current_stage, s.current_sub_label);
        if (s.current_stage === 'witch' || s.current_stage === 'awaken_witch') { }
        else if (!s.current_stage.startsWith('notify_') && !['wolf', 'wolf_meet', 'little_gray_wolf', 'gray_wolf_steal', 'gray_wolf_action', 'pleasant_goat', 'hunter'].includes(s.current_stage)) {
            night_role_title.textContent = `🚫 ${role_name}行動 (技能被偷取)`; night_instruction.textContent = "今晚你的技能被灰太狼偷取，無法發動。";
            btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "確認並閉眼"; speak(`${role_name}請睜眼。`); return;
        }
    }

    if (is_vwk_turn) night_instruction.innerHTML = `<span style="color:#e94560; font-weight:bold;">(你被指派為百變狼王)</span><br><br>` + night_instruction.innerHTML;

    let nightmareTarget = getNightTarget('disable', 'nightmare');

    if (nightmareTarget && parseInt(actor_seat) === nightmareTarget && !s.current_stage.startsWith('notify_') && !['lovers_meet', 'wolf_meet', 'lucky_boy_action', 'awaken_wolf_king_gun', 'wolf_gun_confirm', 'awaken_witch_assistant_action', 'hidden_wolf', 'curse_fox', 'ghost_bride_couple', 'ghost_bride_witness', 'awaken_dreamwalker_result'].includes(s.current_stage)) {
        s.is_current_role_feared = true; let role_name = getStageVoiceName(s.current_stage, s.current_sub_label);
        if (s.current_stage === 'wolf') {
            let w_seats = Object.keys(s.player_roles).filter(k => getWolfTeamRoles().includes(s.player_roles[k]));
            let has_lg = Object.values(s.player_roles).includes('little_girl');
            if (has_lg) w_seats.push(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'little_girl'));
            w_seats.sort((a, b) => a - b);
            night_role_title.textContent = has_lg ? "🐺 狼隊與小女孩行動 (被恐懼)" : "🐺 狼人行動 (被恐懼)";
            night_instruction.innerHTML = `<span style="color:#e94560;">今晚已被夢魘恐懼，無法刀人。</span><br><br>🐺 睜眼名單：${has_lg ? '【隱藏】' : w_seats.map(id => id + '號').join(', ')}`;
            btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "確認並閉眼"; speak(`${has_lg ? "狼隊和小女孩" : "狼人"}請睜眼。`); return;
        }
        night_role_title.textContent = `🚫 ${role_name}行動 (被恐懼)`; night_instruction.textContent = "今晚已被夢魘恐懼，無法發動技能。"; btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "確認並閉眼"; speak(`${role_name}請睜眼。`); return;
    }

    let penguinTarget = getNightTarget('disable', 'penguin');

    let isWolfTeamFrozen = s.current_stage === 'wolf' && penguinTarget &&
        Object.keys(s.player_roles).filter(k => getWolfTeamRoles().includes(s.player_roles[k])).includes(penguinTarget.toString());

    if ((penguinTarget && parseInt(actor_seat) === penguinTarget || isWolfTeamFrozen) && !s.current_stage.startsWith('notify_') && !['lovers_meet', 'wolf_meet', 'lucky_boy_action', 'awaken_wolf_king_gun', 'wolf_gun_confirm', 'awaken_witch_assistant_action', 'hidden_wolf', 'curse_fox', 'ghost_bride_couple', 'ghost_bride_witness', 'awaken_dreamwalker_result'].includes(s.current_stage)) {
        s.is_current_role_frozen = true;
        let role_name = getStageVoiceName(s.current_stage, s.current_sub_label);

        if (s.current_stage === 'wolf') {
            let w_seats = Object.keys(s.player_roles).filter(k => getWolfTeamRoles().includes(s.player_roles[k]));
            let has_lg = Object.values(s.player_roles).includes('little_girl');
            if (has_lg) w_seats.push(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'little_girl'));
            w_seats.sort((a, b) => a - b);
            night_role_title.textContent = has_lg ? "🐺 狼隊與小女孩行動 (被冰凍)" : "🐺 狼人行動 (被冰凍)";
            night_instruction.innerHTML = `<span style="color:#4fc3f7;">今晚有狼人被企鵝冰凍，全隊無法刀人或感染。</span><br><br>🐺 睜眼名單：${has_lg ? '【隱藏】' : w_seats.map(id => id + '號').join(', ')}<br><span style="color:#fca311;">被冰凍的是：${penguinTarget}號</span>`;
            btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "確認並閉眼"; speak(`${has_lg ? "狼隊和小女孩" : "狼人"}請睜眼。`); return;
        }
        night_role_title.textContent = `🧊 ${role_name}行動 (被冰凍)`; night_instruction.textContent = "今晚已被企鵝冰凍，無法發動技能。"; btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "確認並閉眼"; speak(`${role_name}請睜眼。`); return;
    }

    if (s.current_stage === 'bear' && !is_vwk_turn) {
        night_role_title.textContent = "🐻 熊確認"; night_instruction.innerHTML = `<span style="color:#00ff88; font-weight:bold;">你是一般的熊 (不是百變狼王)。</span><br>請確認後閉眼。`;
        number_pad.classList.add('hidden'); btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "確認並閉眼"; speak(`熊請睜眼。`); return;
    }

    if (s.current_stage === 'awaken_dreamwalker_result') {
        night_role_title.textContent = "💤✨ 覺醒攝夢人確認";
        let t = awkDreamwalkerTarget;
        let did_act = s.acted_players.includes(parseInt(t)) || s.player_roles[t] === 'grave_keeper';
        night_instruction.innerHTML = `你指定的夢語者是：<br><span style="color:#fca311; font-size:24px; font-weight:bold;">${t} 號</span><br><br>該玩家今晚<span style="color:${did_act ? '#00ff88' : '#e94560'}; font-weight:bold; font-size:20px;">${did_act ? '有行動' : '沒有行動'}</span>`;
        number_pad.classList.add('hidden');
        btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "確認並閉眼";
        speak(`覺醒攝夢人請睜眼。`);
        return;
    }

    if (s.current_stage === 'awaken_witch_assistant_action') {
        night_role_title.textContent = "👤 協助者確認";
        let witchPoisonTarget = getNightTarget('poison', 'witch') || getNightTarget('poison', 'awaken_witch');
        night_instruction.innerHTML = `覺醒女巫選擇毒殺：<span style='color:#e94560; font-weight:bold; font-size:24px;'>${witchPoisonTarget} 號</span><br>請問你是否同意這項行動？`;
        number_pad.classList.add('hidden'); action_pad.innerHTML = ''; action_pad.classList.remove('hidden');

        let btn_agree = document.createElement('button'); btn_agree.className = 'primary-btn'; btn_agree.textContent = "同意";
        let btn_disagree = document.createElement('button'); btn_disagree.className = 'secondary-btn'; btn_disagree.textContent = "不同意";

        btn_agree.onclick = () => { s.awk_witch_assistant_agreed = true; btn_confirm_action.click(); };
        btn_disagree.onclick = () => { s.awk_witch_assistant_agreed = false; btn_confirm_action.click(); };

        action_pad.appendChild(btn_agree); action_pad.appendChild(btn_disagree);
        speak(`協助者請睜眼。`);
        return;
    }

    const night_screen = document.getElementById('screen-night');
    night_screen.classList.remove('night-fade-in');
    void night_screen.offsetWidth;
    night_screen.classList.add('night-fade-in');

    let baseRole = s.current_stage.replace(/_[AB]$/, '');
    let isInspection = s.ROLE_DICT[baseRole]?.ui_type === 'inspection';
    if (s.current_stage === 'lucky_boy_action' && (s.merchant_item === 'seer' || s.merchant_item === 'check') && s.merchant_type !== 'black_market') isInspection = true;
    if (s.current_stage === 'gray_wolf_action' && s.gray_wolf_stolen_skill === 'seer') isInspection = true;
    if (s.current_stage === 'machine_wolf' && !s.machine_wolf_learn_target) isInspection = true;

    renderRolePanel(is_stolen, is_vwk_turn, actor_seat);

    let voice_name = getStageVoiceName(s.current_stage, s.current_sub_label);
    if (s.current_stage.startsWith('status_')) voice_name = getStatusStageVoice(s.current_stage);
    if (s.current_stage === 'wolf' && Object.values(s.player_roles).includes('little_girl')) voice_name = "狼隊和小女孩";
    speak(`${voice_name}請睜眼。`);
}

document.addEventListener('DOMContentLoaded', () => {
    initSetupEvents();
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
        let crowTarget = getNightTarget('curse_vote', 'crow');
        document.getElementById('crow-panel-target').textContent = crowTarget ? `${crowTarget} 號` : '無';
        crow_panel.classList.toggle('hidden');
    };

    btn_confirm_action.addEventListener('click', async () => {
        vibrate(20);

        let is_real_action = (s.selected_number !== 'skip' && s.selected_number !== null) || s.selected_numbers_arr.length > 0 || s.is_witch_saved || s.current_stage === 'awaken_witch_assistant_action';
        if (is_real_action && s.current_stage !== 'awaken_witch') {
            if (s.current_actor_seat) s.acted_players.push(parseInt(s.current_actor_seat));
            else {
                let p = Object.keys(s.player_roles).find(k => s.player_roles[k] === s.current_stage || s.player_roles[k] === 'awaken_' + s.current_stage);
                if (p) s.acted_players.push(parseInt(p));
            }
            if (s.current_stage === 'wolf' && !s.is_seed_wolf_infecting) {
                let ws = Object.keys(s.player_roles).filter(k => getWolfTeamRoles().includes(s.player_roles[k]));
                ws.forEach(x => s.acted_players.push(parseInt(x)));
            }
        }

        if (s.is_current_role_feared) {
            let role_log = getStageVoiceName(s.current_stage, s.current_sub_label);
            if (s.current_board.id === '12_shadow' && parseInt(s.current_actor_seat) === s.shadow_seer_seat) {
                role_log += ' (燈影)';
            }
            logNightAction(`【${role_log}】被恐懼，跳過技能`);

            hideNightUIIngame();
            await speak(`${getStageVoiceName(s.current_stage, s.current_sub_label)}請閉眼。`);
            await delay(s.role_transition_delay * 1000);
            runNextNightRole();
            return;
        }

        if (s.is_current_role_frozen) {
            let role_log = getStageVoiceName(s.current_stage, s.current_sub_label);
            logNightAction(`【${role_log}】被冰凍，跳過技能`);

            hideNightUIIngame();
            await speak(`${getStageVoiceName(s.current_stage, s.current_sub_label)}請閉眼。`);
            await delay(s.role_transition_delay * 1000);
            runNextNightRole();
            return;
        }

        if (s.is_current_role_converted) {
            let role_log = getStageVoiceName(s.current_stage, s.current_sub_label);
            logNightAction(`【${role_log}】已被轉化為狼人，跳過技能`);

            hideNightUIIngame();
            await speak(`${getStageVoiceName(s.current_stage, s.current_sub_label)}請閉眼。`);
            await delay(s.role_transition_delay * 1000);
            runNextNightRole();
            return;
        }

        if (s.current_stage === 'awaken_witch_assistant_action') {
            let agree_text = s.awk_witch_assistant_agreed ? "同意" : "不同意";
            let witchPoisonTarget = getActionsByEffect('poison').find(a => ['witch', 'awaken_witch'].includes(a.role))?.resolved_targets[0];
            logNightAction(`【覺醒女巫】對 ${witchPoisonTarget}號 使用毒藥 (指派 ${s.awk_witch_assistant}號 協助，他 ${agree_text})`);
            if (!s.awk_witch_assistant_agreed) {
                let poisonAction = getActionsByEffect('poison').find(a => a.role === 'awaken_witch');
                if (poisonAction) poisonAction.status = 'cancelled';
            }
            hideNightUIIngame();
            speak(`協助者請閉眼。`, () => setTimeout(runNextNightRole, s.role_transition_delay * 1000));
            return;
        }

        if (s.current_stage.startsWith('status_check_group_')) {
            hideNightUIIngame("👤 狀態確認", "請閉上眼睛，將裝置傳給下一位玩家...");
            await speak(`${getStageVoiceName(s.current_stage, s.current_sub_label)}請閉眼。`);
            await delay(s.role_transition_delay * 1000);
            runNextNightRole();
            return;
        }

        // 一般的單獨狀態通知
        if (s.current_stage.startsWith('status_')) {
            hideNightUIIngame("🌙 夜晚持續中", "請閉上眼睛，等待法官指示...");
            await speak(`${getStageVoiceName(s.current_stage, s.current_sub_label)}請閉眼。`);
            await delay(s.role_transition_delay * 1000);
            runNextNightRole();
            return;
        }

        let baseRole = s.current_stage.replace(/_[AB]$/, '');
        if (s.ROLE_DICT[baseRole]?.ui_type === 'info_only' || s.current_stage.startsWith('notify_')) {
            let v = getStageVoiceName(s.current_stage, s.current_sub_label);
            if (s.current_stage === 'wolf_meet' && Object.values(s.player_roles).includes('little_girl')) v = "狼隊和小女孩";
            else if (s.current_stage === 'big_gray_wolf_meet') v = "大灰狼與小狼";

            hideNightUIIngame();
            await speak(`${v}請閉眼。`);
            await delay(s.role_transition_delay * 1000);
            runNextNightRole();
            return;
        }

        let isInspection = s.ROLE_DICT[baseRole]?.ui_type === 'inspection';
        if (s.current_stage === 'lucky_boy_action' && (s.merchant_item === 'seer' || s.merchant_item === 'check') && s.merchant_type !== 'black_market') isInspection = true;
        if (s.current_stage === 'gray_wolf_action' && s.gray_wolf_stolen_skill === 'seer') isInspection = true;
        if (s.current_stage === 'machine_wolf' && !s.machine_wolf_learn_target) isInspection = true;

        if (isInspection && s.selected_number !== 'skip' && !s.is_showing_result) {
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

        if (s.current_stage === 'awaken_witch' && s.awk_witch_step === 'assistant_target' && s.awk_witch_assistant) {
            insertNightStatusFlow('assistant', [s.awk_witch_assistant]);
        }

        resolveNonInspectionAction();

        hideNightUIIngame("🌙 夜晚持續中", "請閉上眼睛，等待法官指示...");
        let v = getStageVoiceName(s.current_stage, s.current_sub_label);
        if (s.current_stage === 'wolf' && Object.values(s.player_roles).includes('little_girl')) v = "狼隊和小女孩";

        await speak(`${v}請閉眼。`);
        await delay(s.role_transition_delay * 1000);
        runNextNightRole();
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

            if (s.sp_grave_keeper_heir === i) status_strs.push("⚰️ 超級守墓人繼承人");
            if (s.puppet_target === i) status_strs.push("🪆 傀儡目標");
            if (s.shadow_seer_seat === i) status_strs.push("💡 燈影預言家");

            if (s.merchant_target === i) {
                let item_map = { 'seer': '查驗', 'poison': '毒藥', 'guard': '護盾', 'gun': '槍' };
                status_strs.push(`🎁 幸運兒 (${item_map[s.merchant_item] || '無'})`);
            }

            let myEffects = getActiveEffectsOn(i);

            if (myEffects.some(a => a.effect === 'dream')) status_strs.push("💤 被攝夢");
            if (myEffects.some(a => a.effect === 'protect' && a.role === 'guard')) status_strs.push("🛡️ 被守護");
            if (myEffects.some(a => a.effect === 'guard' && a.role === 'pleasant_goat')) status_strs.push("🛡️ 喜羊羊守護");
            if (myEffects.some(a => a.effect === 'anti_theft' && a.role === 'pleasant_goat')) status_strs.push("🔒 喜羊羊防盜");
            if (myEffects.some(a => a.effect === 'guard_and_anti_theft' && a.role === 'pleasant_goat')) status_strs.push("🛡️🔒 雙重防護");

            if (getActionsByEffect('steal').some(a => a.resolved_targets.includes(i))) status_strs.push("🎩 被偷取技能");
            if (myEffects.some(a => a.effect === 'disable' && a.metadata?.mode === 'fear')) status_strs.push("🌑 被恐懼");
            if (myEffects.some(a => a.effect === 'charm')) status_strs.push("💋 被魅惑");
            if (myEffects.some(a => a.effect === 'link')) status_strs.push("🌸 被綁定");
            if (myEffects.some(a => a.effect === 'learn')) status_strs.push("🤖 被學習");

            if (s.cupid_lovers.includes(i)) status_strs.push("💕 情侶");
            if (myEffects.some(a => a.effect === 'grant_gun')) status_strs.push("🔫 獲槍");
            if (s.awk_witch_assistant === i) status_strs.push("👤 協助者");

            if (myEffects.some(a => a.effect === 'target_select' && a.role === 'half_blood')) status_strs.push("🩸 混血兒支持");
            if (myEffects.some(a => a.effect === 'target_select' && a.role === 'wild_child')) status_strs.push("👶 野孩子榜樣");
            if (myEffects.some(a => a.effect === 'target_select' && a.role === 'awaken_lonely_girl')) status_strs.push("👧 少女偶像");
            if (myEffects.some(a => a.effect === 'mark' && a.metadata?.type === 'time_block')) status_strs.push("⏳ 蝕時封鎖");

            if (myEffects.some(a => a.effect === 'protect' && a.role === 'awaken_idiot')) status_strs.push("🤡 白痴保護");
            if (myEffects.some(a => a.effect === 'curse_vote')) status_strs.push("🐦‍⬛ 烏鴉詛咒");
            if (s.player_status[i].isConvertedWolf && s.player_status[i].convertedFromRole) {
                let originalRoleName = s.ROLE_DICT[s.player_status[i].convertedFromRole]?.name || "未知";
                status_strs.push(`🐺 ${originalRoleName}被感染`);
            } else if (myEffects.some(a => a.effect === 'convert' && a.role === 'seed_wolf')) {
                status_strs.push("🐺 感染成狼");
            }
            if (myEffects.some(a => a.effect === 'convert' && a.role.includes('gargoyle'))) status_strs.push("🦇 覺石轉化");

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

    document.getElementById('btn-confirm-lock').addEventListener('click', () => {
        const lock_modal = document.getElementById('lock-modal');
        const screen_setup = document.getElementById('screen-setup');
        const screen_night = document.getElementById('screen-night');
        lock_modal.classList.add('hidden');
        screen_setup.classList.add('hidden');
        screen_night.classList.remove('hidden');
        document.getElementById('number-pad').classList.add('hidden');
        document.getElementById('night-role-title').textContent = "🐺 黑夜降臨";
        document.getElementById('night-instruction').textContent = "請大家閉上眼睛...";

        resetNightState();
        buildNightQueue();

        speak("天黑請閉眼。", runNextNightRole);
    });
});