import { s, wolf_faction, getActualTarget, applyTimeWolfReflection, vibrate } from './core.js';

export function resetSelections() {
    document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
    ['btn-optional-skip', 'btn-witch-save', 'btn-witch-poison', 'btn-witch-skip'].forEach(id => {
        let el = document.getElementById(id);
        if (el) el.classList.remove('action-selected');
    });
    const action_pad = document.getElementById('action-pad');
    if (action_pad) {
        action_pad.innerHTML = ''; action_pad.classList.add('hidden');
    }
    s.selected_number = null;
    s.selected_numbers_arr = [];
}

export function createNumberPad() {
    const number_pad = document.getElementById('number-pad');
    number_pad.innerHTML = '';

    // 確認當前真實行動者座位
    let actual_current_actor_seat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === s.current_stage || s.player_roles[k] === 'awaken_' + s.current_stage) || -1);
    if (s.current_actor_seat) actual_current_actor_seat = parseInt(s.current_actor_seat);

    // 覺醒狼王分槍時，需要正確抓取自己的座位以防自選
    if (s.current_stage === 'awaken_wolf_king_gun') {
        actual_current_actor_seat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'awaken_wolf_king'));
    }

    // 強制將灰太狼的階段對應到他的真實角色名稱
    if (s.current_stage === 'gray_wolf_steal' || s.current_stage === 'gray_wolf_action') {
        actual_current_actor_seat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'gray_wolf'));
    }

    for (let i = 1; i <= s.total_players; i++) {
        const btn = document.createElement('button');
        btn.classList.add('num-btn');
        btn.textContent = i;

        let is_disabled = false;

        // ==========================================
        // 規則 1：狼刀限制規則
        // ==========================================
        if (['wolf', 'big_bad_wolf', 'big_gray_wolf'].includes(s.current_stage)) {
            // 大狼不可自刀
            if (['ghost_rider', 'wolf_beauty', 'awaken_wolf_beauty'].includes(s.player_roles[i])) is_disabled = true;
            // 占卜師標記限制（規則：狼隊和大灰狼都受限）
            if (s.diviner_mark) {
                let dm = parseInt(s.diviner_mark);
                let p1 = dm - 1 < 1 ? s.total_players : dm - 1;
                let p2 = dm + 1 > s.total_players ? 1 : dm + 1;
                if (i !== dm && i !== p1 && i !== p2) is_disabled = true;
            }
            // 煉金魔女迷霧限制（規則：普通狼刀受限，狼鴉之爪不受限）
            if (s.alchemist_fog_targets && s.alchemist_fog_targets.length > 0 && s.current_stage === 'wolf') {
                if (!s.alchemist_fog_targets.includes(i.toString()) && !s.alchemist_fog_targets.includes(i)) is_disabled = true;
            }
        }

        // ==========================================
        // 規則 2：不可自選規則
        // ==========================================
        if (i === actual_current_actor_seat) {
            const cannot_select_self = [
                'witch', 'awaken_witch', 'seer', 'seer_A', 'seer_B', 'fool_seer', 'bear', 'psychic', 'pure_white', 'dreamwalker', 'awaken_dreamwalker', 'black_market', 'miracle_merchant', 'crow',
                'nightmare', 'gargoyle', 'machine_wolf', 'wolf_beauty', 'awaken_wolf_beauty', 'wolf_witch', 'gray_wolf_steal',
                'half_blood', 'awaken_lonely_girl', 'ghost_bride', 'ghost_bride_couple', 'snake_seer', 'jack_ripper'
            ];
            if (cannot_select_self.includes(s.current_stage)) is_disabled = true;
        }

        // ==========================================
        // 規則 3：特殊角色選擇目標限制
        // ==========================================
        // 覺醒狼王分槍：限選其他狼隊友
        if (s.current_stage === 'awaken_wolf_king_gun' && (!wolf_faction.includes(s.player_roles[i]) || i === actual_current_actor_seat)) is_disabled = true;

        // 鬼魅新娘選證婚人：不能是新郎或自己
        if (s.current_stage === 'ghost_bride_couple' && (i === parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'ghost_bride')) || i === s.ghost_bride_groom)) is_disabled = true;

        // 幸運兒用毒/查驗：不可自點
        if (s.current_stage === 'lucky_boy_action' && ['seer', 'poison'].includes(s.merchant_item) && i === actual_current_actor_seat) is_disabled = true;

        // 覺醒石像鬼轉化：必須選「狼隊隔壁」且不能是狼人自己
        if (['awaken_gargoyle', 'awaken_gargoyle_A', 'awaken_gargoyle_B'].includes(s.current_stage)) {
            // 規則：轉化目標必須在「狼隊隔壁」（即所有狼人座位的左右相鄰）
            let all_wolf_seats = Object.keys(s.player_roles).filter(k => wolf_faction.includes(s.player_roles[k]));
            let adjacent_seats = [];
            all_wolf_seats.forEach(w => {
                let ws = parseInt(w);
                adjacent_seats.push(ws - 1 < 1 ? s.total_players : ws - 1, ws + 1 > s.total_players ? 1 : ws + 1);
            });
            // 去除重複，且排除狼人自身座位
            let w_seats = all_wolf_seats.map(k => parseInt(k));
            let valid_seats = [...new Set(adjacent_seats)].filter(seat => !w_seats.includes(seat));
            if (!valid_seats.includes(i)) is_disabled = true;
        }

        // 邪惡商人：首晚只能選小狼 (role === 'wolf')
        if (s.current_stage === 'evil_merchant') {
            if (s.player_roles[i] !== 'wolf') is_disabled = true;
        }

        // 黑夜使者：只能選狼人陣營
        if (s.current_stage === 'dark_messenger') {
            if (!wolf_faction.includes(s.player_roles[i])) is_disabled = true;
        }

        // 傀儡選擇：只能選狼隊相鄰的非狼人
        if (s.current_stage === 'puppet_select') {
            let all_wolf_seats = Object.keys(s.player_roles).filter(k => wolf_faction.includes(s.player_roles[k]));
            let adj = [];
            all_wolf_seats.forEach(w => {
                let ws = parseInt(w);
                adj.push(ws - 1 < 1 ? s.total_players : ws - 1, ws + 1 > s.total_players ? 1 : ws + 1);
            });
            let w_nums = all_wolf_seats.map(k => parseInt(k));
            let valid = [...new Set(adj)].filter(seat => !w_nums.includes(seat));
            if (!valid.includes(i)) is_disabled = true;
        }

        if (is_disabled) {
            btn.disabled = true; btn.style.opacity = '0.3'; btn.style.cursor = 'not-allowed';
        }

        // 按鈕點擊綁定邏輯 (保持原本操作邏輯不變)
        btn.addEventListener('click', () => {
            if (s.is_current_role_feared || s.is_current_role_frozen || ['wolf_brother_meet', 'wolf_gun_confirm', 'lovers_meet', 'wolf_meet', 'hidden_wolf', 'eclipse_maid', 'curse_fox', 'awaken_dreamwalker_result', 'ghost_bride_witness'].includes(s.current_stage) || s.current_stage.startsWith('notify_')) return;
            vibrate(10);

            const btn_confirm_action = document.getElementById('btn-confirm-action');
            if (s.current_stage === 'awaken_witch' && s.awk_witch_step === 'poison_target') {
                resetSelections(); btn.classList.add('selected');
                s.selected_number = i;
                s.witch_poison_target = applyTimeWolfReflection(getActualTarget(parseInt(i)), s.current_actor_seat);
                btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "下一步";
                return;
            }
            if (s.current_stage === 'awaken_witch' && s.awk_witch_step === 'assistant_target') {
                resetSelections(); btn.classList.add('selected');
                s.awk_witch_assistant = parseInt(i);
                btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "確認";
                return;
            }
            if (['magician', 'trickster', 'wolf_sorcerer', 'phantom', 'snake_phantom', 'awaken_seer', 'cupid', 'alchemist', 'zombie', 'super_black_market'].includes(s.current_stage)) {
                let max_select = ['alchemist', 'super_black_market'].includes(s.current_stage) ? 3 : s.current_stage === 'zombie' ? 2 : 2;
                let min_select = s.current_stage === 'zombie' ? 1 : max_select; // 殭屍選1~2人即可確認
                if (s.selected_number === 'skip') { s.selected_number = null; document.getElementById('btn-optional-skip').classList.remove('action-selected'); }
                if (s.selected_numbers_arr.includes(i)) {
                    s.selected_numbers_arr = s.selected_numbers_arr.filter(n => n !== i); btn.classList.remove('selected');
                } else if (s.selected_numbers_arr.length < max_select) {
                    s.selected_numbers_arr.push(i); btn.classList.add('selected');
                }
                btn_confirm_action.classList.toggle('hidden', s.selected_numbers_arr.length < min_select);
                btn_confirm_action.textContent = "確認";
            } else {
                resetSelections(); btn.classList.add('selected'); s.selected_number = i;
                btn_confirm_action.classList.remove('hidden'); btn_confirm_action.textContent = "確認";
            }
        });
        number_pad.appendChild(btn);
    }
}
