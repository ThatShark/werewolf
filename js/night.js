// js/night.js
import { s, getNightTarget, getNightTargets, getWolfTeamRoles, vibrate } from './core.js';

export function resetSelections() {
    document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
    ['btn-optional-skip', 'btn-witch-save', 'btn-witch-poison', 'btn-witch-skip'].forEach(id => { let el = document.getElementById(id); if (el) el.classList.remove('action-selected'); });
    const action_pad = document.getElementById('action-pad'); if (action_pad) { action_pad.innerHTML = ''; action_pad.classList.add('hidden'); }
    s.selected_number = null; s.selected_numbers_arr = [];
}

export function createNumberPad() {
    const number_pad = document.getElementById('number-pad'); number_pad.innerHTML = '';
    let actual_current_actor_seat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === s.current_stage || s.player_roles[k] === 'awaken_' + s.current_stage) || -1);
    if (s.current_actor_seat) actual_current_actor_seat = parseInt(s.current_actor_seat);
    if (s.current_stage === 'awaken_wolf_king_gun') actual_current_actor_seat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'awaken_wolf_king'));
    if (s.current_stage === 'gray_wolf_steal' || s.current_stage === 'gray_wolf_action') actual_current_actor_seat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'gray_wolf'));

    let base_stage = s.current_stage.replace(/_[AB]$/, '');
    let stageRoleData = s.ROLE_DICT[base_stage] || {};

    for (let i = 1; i <= s.total_players; i++) {
        const btn = document.createElement('button'); btn.classList.add('num-btn'); btn.textContent = i; let is_disabled = false;

        let divinerMark = getNightTarget('mark', 'diviner');
        let alchFogs = getNightTargets('mark', 'alchemist');

        if (s.current_stage === 'alchemist' && s.final_killed.includes(i)) is_disabled = true;
        // 資料驅動：查驗型技能不能點死人
        if (stageRoleData.ui_type === 'inspection' && s.final_killed.includes(i)) is_disabled = true;

        if (['wolf', 'big_bad_wolf', 'big_gray_wolf'].includes(s.current_stage)) {
            const targetRoleData = s.ROLE_DICT[s.player_roles[i]] || {};
            if (targetRoleData.faction === 'wolf' && targetRoleData.tags?.includes('cannot_be_wolf_target')) {
                is_disabled = true;
            }
            if (divinerMark) {
                let dm = parseInt(divinerMark);
                let p1 = dm - 1 < 1 ? s.total_players : dm - 1;
                let p2 = dm + 1 > s.total_players ? 1 : dm + 1;
                if (i !== dm && i !== p1 && i !== p2) is_disabled = true;
            }
            if (alchFogs.length > 0 && s.current_stage === 'wolf') {
                if (!alchFogs.includes(i.toString()) && !alchFogs.includes(i)) is_disabled = true;
            }
        }

        // 資料驅動：取代原本近40個角色的不能自選名單
        if (i === actual_current_actor_seat) {
            let can_select = stageRoleData.can_select_self !== false;
            // 例外：覺醒女巫選協助者時可以選自己
            if (s.current_stage === 'awaken_witch' && s.awk_witch_step === 'assistant_target') can_select = true;
            if (!can_select) is_disabled = true;
        }

        if (s.current_stage === 'awaken_wolf_king_gun' && (!['wolf', 'little_gray_wolf'].includes(s.player_roles[i]) || i === actual_current_actor_seat)) is_disabled = true;
        if (s.current_stage === 'ghost_bride_couple' && (i === parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'ghost_bride')) || i === s.ghost_bride_groom)) is_disabled = true;
        if (s.current_stage === 'lucky_boy_action' && ['seer', 'poison'].includes(s.merchant_item) && i === actual_current_actor_seat) is_disabled = true;

        // 資料驅動：替換掉 third_party_roles 陣列
        if (['awaken_gargoyle', 'awaken_gargoyle_A', 'awaken_gargoyle_B'].includes(s.current_stage)) {
            let all_wolf_seats = Object.keys(s.player_roles).filter(k => getWolfTeamRoles().includes(s.player_roles[k]));
            let adjacent_seats = [];
            all_wolf_seats.forEach(w => { let ws = parseInt(w); adjacent_seats.push(ws - 1 < 1 ? s.total_players : ws - 1, ws + 1 > s.total_players ? 1 : ws + 1); });
            let w_seats = all_wolf_seats.map(k => parseInt(k));

            let valid_seats = [...new Set(adjacent_seats)].filter(seat => {
                let targetRoleData = s.ROLE_DICT[s.player_roles[seat]] || {};
                return targetRoleData.faction === 'good' && !s.player_status[seat]?.isConvertedWolf;
            });
            if (!valid_seats.includes(i)) is_disabled = true;
        }

        if (s.current_stage === 'evil_merchant' && s.player_roles[i] !== 'wolf') is_disabled = true;
        if (s.current_stage === 'dark_messenger' && !getWolfTeamRoles().includes(s.player_roles[i])) is_disabled = true;

        if (s.current_stage === 'puppet_select') {
            let all_wolf_seats = Object.keys(s.player_roles).filter(k => getWolfTeamRoles().includes(s.player_roles[k]));
            let adj = [];
            all_wolf_seats.forEach(w => { let ws = parseInt(w); adj.push(ws - 1 < 1 ? s.total_players : ws - 1, ws + 1 > s.total_players ? 1 : ws + 1); });
            let w_nums = all_wolf_seats.map(k => parseInt(k)); let valid = [...new Set(adj)].filter(seat => !w_nums.includes(seat));
            if (!valid.includes(i)) is_disabled = true;
        }

        if (is_disabled) { btn.disabled = true; btn.style.opacity = '0.3'; btn.style.cursor = 'not-allowed'; }

        btn.addEventListener('click', () => {
            if (s.is_current_role_feared || s.is_current_role_frozen || ['zombie_infected', 'wolf_brother_meet', 'wolf_gun_confirm', 'lovers_meet', 'wolf_meet', 'hidden_wolf', 'eclipse_maid', 'curse_fox', 'awaken_dreamwalker_result', 'ghost_bride_witness'].includes(s.current_stage) || s.current_stage.startsWith('notify_')) return;
            vibrate(10);
            const btn_confirm_action = document.getElementById('btn-confirm-action');
            if (s.current_stage === 'awaken_witch' && s.awk_witch_step === 'poison_target') { resetSelections(); btn.classList.add('selected'); s.selected_number = i; btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "下一步"; return; }
            if (s.current_stage === 'awaken_witch' && s.awk_witch_step === 'assistant_target') { resetSelections(); btn.classList.add('selected'); s.awk_witch_assistant = parseInt(i); btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "確認"; return; }

            // 資料驅動：處理單選與多選邏輯
            let max_select = stageRoleData.max_targets || 1;
            let min_select = stageRoleData.min_targets !== undefined ? stageRoleData.min_targets : max_select;

            if (max_select > 1) {
                if (s.selected_number === 'skip') { s.selected_number = null; document.getElementById('btn-optional-skip').classList.remove('action-selected'); }
                if (s.selected_numbers_arr.includes(i)) { s.selected_numbers_arr = s.selected_numbers_arr.filter(n => n !== i); btn.classList.remove('selected'); }
                else if (s.selected_numbers_arr.length < max_select) { s.selected_numbers_arr.push(i); btn.classList.add('selected'); }
                btn_confirm_action.classList.toggle('hidden', s.selected_numbers_arr.length < min_select); btn_confirm_action.textContent = "確認";
            } else {
                resetSelections(); btn.classList.add('selected'); s.selected_number = i; btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "確認";
            }
        });
        number_pad.appendChild(btn);
    }
}