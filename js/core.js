// js/core.js

export const s = {
    total_players: 12, current_board: null, is_random_mode: false, role_transition_delay: 1, ROLE_DICT: {}, BOARD_CONFIGS: {},
    player_roles: {}, player_second_roles: {}, player_genders: {}, player_status: {}, spare_cards: [], discarded_roles: [], initial_thief_seat: null, thief_chosen_role: null, vwk_seat: null, shadow_seer_seat: null,
    night_queue: [], current_stage: null, current_actor_seat: null, current_sub_label: null, current_viewing_seat: 1, selected_number: null, selected_numbers_arr: [],
    is_showing_result: false, is_fake_wake: false, is_current_role_feared: false, is_current_role_frozen: false, night_action_log: [], speech_order_text: null, defer_speech_order_until_shooting: false, sheriff_candidates: [],

    night_actions: [], death_events: [], final_killed: [],

    prev_dream_target: null, sp_grave_keeper_heir: null, puppet_target: null, half_blood_target: null, wild_child_target: null, lonely_girl_target: null,
    seed_wolf_target: null, awk_gargoyle_target: null, awk_gargoyle_target_a: null, awk_gargoyle_target_b: null, rust_sword_infected_target: null, awk_wolf_gun_target: null,
    ghost_bride_groom: null, ghost_bride_witness: null, shadow_master_target: null, phantom_targets: [], cupid_lovers: [], acted_players: [], zombie_infected: [],
    is_time_wolf_reflection_used: false, is_seed_wolf_infecting: false, has_ghost_rider_reflected: false, did_white_cat_flip_last_night: false, is_pufferfish_triggered: false,
    is_alchemist_snake_used: false, phantom_known_wolf: null, merchant_item: null, merchant_type: null, awk_witch_step: null, awk_witch_assistant: null, awk_witch_assistant_agreed: null,
    day_shooters_queue: [], is_snake_win: false, is_pandora_win: false, moon_wolf_roar: null,
    gray_wolf_stolen_player: null, gray_wolf_stolen_skill: null, gray_wolf_guess: null, machine_wolf_learn_target: null, evil_merchant_gun_target: null,
    pandora_target: null, pandora_pool: null, pandora_gift: null, sp_merchant_targets: [], sp_merchant_gifts: [], is_sp_merchant_turns_evil: false, treasure_hunter_choice: null, is_treasure_hunter_evil: false,
    night_status_flows: [],
    player_genders: {}, sleeping_beauty_seat: null, is_sleeping_beauty_active: true
};

Object.defineProperty(s, 'primary_killed', { get: function () { return this.death_events.filter(e => e.source !== 'chain' && e.source !== 'vote').map(e => e.seat); } });
Object.defineProperty(s, 'chain_killed', { get: function () { return this.death_events.filter(e => e.source === 'chain').map(e => e.seat); } });

// ==========================================
// 資料驅動型態判斷工具 (Data-Driven Helpers)
// ==========================================
export function isWolfRole(role) {
    return s.ROLE_DICT[role]?.faction === 'wolf' || s.ROLE_DICT[role]?.type === 'wolf';
}

// 判斷「實質狼人陣營」的函式
export function isPlayerWolfFaction(seat) {
    seat = parseInt(seat);
    let role = s.player_roles[seat];
    let rData = s.ROLE_DICT[role] || {};

    // 狀態轉換 (包含被感染、覺醒石像鬼轉化、百變狼王)
    if (s.player_status[seat]?.isConvertedWolf) return true;
    if (s.player_status[seat]?.isVWK) return true;
    if (seat === s.awk_gargoyle_target || seat === s.awk_gargoyle_target_a || seat === s.awk_gargoyle_target_b) return true;

    // 盜寶大師的動態陣營
    if (role === 'treasure_master') return s.is_treasure_hunter_evil;

    // 預設陣營判斷
    return rData.faction === 'wolf';
}

// 取得會跟著狼隊一起行動的角色
export function getWolfTeamRoles() {
    let roles = [];
    for (let rId in s.ROLE_DICT) {
        if (isWolfRole(rId)) {
            // 排除特定不跟狼隊伍一起刀人的獨立狼
            if (s.ROLE_DICT[rId].type !== "lone_wolf") roles.push(rId);
        }
    }
    return roles;
}

export function isPlayerEvil(seat, visited = new Set()) {
    if (visited.has(seat)) return true;
    visited.add(seat);
    seat = parseInt(seat);

    let role = s.player_roles[seat];
    let rData = s.ROLE_DICT[role] || {};

    if (seat === s.puppet_target) return true;
    if (s.player_status[seat]?.isVWK) return true;
    if (seat === s.awk_gargoyle_target || seat === s.awk_gargoyle_target_a || seat === s.awk_gargoyle_target_b) return true;

    if (role === 'treasure_master') return s.is_treasure_hunter_evil;
    if (role === 'machine_wolf' && s.machine_wolf_learn_target) return isPlayerEvil(s.machine_wolf_learn_target, visited);

    // 直接讀取 JSON 中設定的查驗結果
    return rData.seer_result === 'evil';
}

export function logNightAction(msg) { s.night_action_log.push(msg); }
export function setPersistentState(key, value) { s[key] = value; }
export function updatePlayerStatus(seat, updates) { if (!s.player_status[seat]) s.player_status[seat] = {}; Object.assign(s.player_status[seat], updates); }

export function convertPlayerToWolf(seat) {
    seat = parseInt(seat);
    if (!seat || !s.player_roles[seat] || s.player_roles[seat] === 'wolf') return;
    updatePlayerStatus(seat, { isConvertedWolf: true, convertedFromRole: s.player_roles[seat] });
    s.player_roles[seat] = 'wolf';
}

export function resetGameState() {
    s.current_editing_seat = null; s.spare_cards = []; s.discarded_roles = []; s.initial_thief_seat = null; s.thief_chosen_role = null; s.vwk_seat = null; s.shadow_seer_seat = null;
    s.current_stage = null; s.current_actor_seat = null; s.current_sub_label = null; s.current_viewing_seat = 1; s.selected_number = null; s.selected_numbers_arr = [];
    s.is_showing_result = false; s.is_fake_wake = false; s.is_current_role_feared = false; s.is_current_role_frozen = false; s.speech_order_text = null; s.defer_speech_order_until_shooting = false; s.sheriff_candidates = [];
    s.sp_grave_keeper_heir = null; s.puppet_target = null; s.half_blood_target = null; s.wild_child_target = null; s.lonely_girl_target = null;
    s.seed_wolf_target = null; s.awk_gargoyle_target = null; s.awk_gargoyle_target_a = null; s.awk_gargoyle_target_b = null; s.rust_sword_infected_target = null; s.awk_wolf_gun_target = null;
    s.ghost_bride_groom = null; s.ghost_bride_witness = null; s.shadow_master_target = null; s.phantom_targets = []; s.cupid_lovers = []; s.acted_players = []; s.zombie_infected = [];
    s.is_time_wolf_reflection_used = false; s.is_seed_wolf_infecting = false; s.has_ghost_rider_reflected = false; s.did_white_cat_flip_last_night = false; s.is_pufferfish_triggered = false;
    s.is_alchemist_snake_used = false; s.phantom_known_wolf = null; s.merchant_item = null; s.merchant_type = null; s.awk_witch_step = null; s.awk_witch_assistant = null; s.awk_witch_assistant_agreed = null; s.is_snake_win = false; s.is_pandora_win = false;
    s.gray_wolf_stolen_player = null; s.gray_wolf_stolen_skill = null; s.gray_wolf_guess = null; s.machine_wolf_learn_target = null; s.evil_merchant_gun_target = null;
    s.pandora_target = null; s.pandora_pool = null; s.pandora_gift = null; s.sp_merchant_targets = []; s.sp_merchant_gifts = []; s.is_sp_merchant_turns_evil = false; s.treasure_hunter_choice = null; s.is_treasure_hunter_evil = false;
    s.night_status_flows = [];
    s.player_genders = {}; s.player_second_roles = {}; s.player_genders = {}; s.sleeping_beauty_seat = null; s.is_sleeping_beauty_active = true;
    s.final_killed = [];
    resetNightState();
}

export function resetNightState() {
    s.death_events = [];
    s.night_queue = [];
    s.night_actions = [];
    s.night_action_log = [];
    s.day_shooters_queue = [];
    s.moon_wolf_roar = null;
    s.is_seed_wolf_infecting = false;
    s.night_status_flows = [];
}

export function vibrate(pattern = 15) { if (navigator.vibrate) navigator.vibrate(pattern); }

export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
export function speak(text, callback) {
    return new Promise(resolve => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-TW';
        utterance.rate = 0.9;
        utterance.onend = () => {
            if (callback) callback();
            resolve();
        };
        window.speechSynthesis.speak(utterance);
    });
}

export function getStageVoiceName(stage, sub_label) {
    if (stage === 'seer') return sub_label ? `預言家${sub_label}` : '預言家'; if (stage === 'zombie_infected') return '感染者';
    if (stage === 'awaken_witch') return '覺醒女巫'; if (stage === 'awaken_wolf_king_gun') return '覺醒狼王'; if (stage === 'wolf_gun_confirm') return '三小狼';
    if (stage === 'wolf' || stage === 'wolf_meet') return '狼人'; if (stage === 'lovers_meet') return '情侶'; if (stage === 'wolf_brother_meet') return '狼兄狼弟';
    if (stage === 'lucky_boy_action') return '幸運兒'; if (stage === 'awaken_witch_assistant_action') return '協助者'; if (stage === 'variable_wolf_king') return '百變狼王';
    if (stage === 'ghost_bride_couple') return '鬼魅新娘與新郎'; if (stage === 'ghost_bride_witness') return '證婚人'; if (stage === 'awaken_dreamwalker_result') return '覺醒攝夢人';
    if (stage === 'gray_wolf_steal' || stage === 'gray_wolf_action') return '灰太狼'; if (stage === 'zombie_infected') return '感染者'; if (stage === 'jack_ripper_select_fanatic') return '開膛手傑克'; 
    if (stage === 'fanatic_action') return '開膛手傑克與狂熱粉';

    // 處理 1號、2號 輪流請閉眼的名稱配對
    if (stage.startsWith('status_check_group_')) {
        const group_match = stage.match(/^status_check_group_(\d+)$/);
        if (group_match) return `${group_match[1]}號`;
    }

    if (stage.startsWith('notify_')) return `${stage.split('_').pop()}號`;
    return s.ROLE_DICT[stage]?.name || stage;
}

export function addNightAction(actor, role, effect, targets, metadata = {}) { s.night_actions.push({ id: `night-${s.night_actions.length + 1}-${role}-${effect}`, actor, role, effect, selected_targets: [...targets], resolved_targets: [...targets], phase: 'night', status: 'active', metadata }); }
export function insertNightStatusFlow(type, targets = [], metadata = {}) {
    const flow_id = `${type}-${s.night_status_flows.length + 1}`;
    const target_seats = [...targets].map(Number).filter(Boolean);
    s.night_status_flows.push({ id: flow_id, type, targets: target_seats, metadata, processed: false });

    if (metadata.immediate_notify) {
        const stages = [];
        const reveal_targets = metadata.reveal_targets ? [...metadata.reveal_targets].map(Number).filter(Boolean) : target_seats;
        reveal_targets.forEach((seat, index) => stages.push({ stage: `status_notify_${flow_id}_${seat}`, order: -1, seat: null, subLabel: index, isFake: false }));
        s.night_queue.unshift(...stages);
    }
}
export function getActionsByEffect(effect) { return s.night_actions.filter(a => a.effect === effect && a.status === 'active'); }
export function getActiveEffectsOn(seat) { return s.night_actions.filter(a => a.status === 'active' && a.resolved_targets.includes(seat)); }
export function getNightTarget(effect, role) { return getActionsByEffect(effect).find(a => a.role === role)?.resolved_targets[0] || null; }
export function getNightTargets(effect, role) { return getActionsByEffect(effect).find(a => a.role === role)?.resolved_targets || []; }
export function cancelAction(actionId, reason = '') { const action = s.night_actions.find(a => a.id === actionId); if (action) { action.status = 'cancelled'; action.metadata.cancelReason = reason; } }

export function addDeathEvent(seat, source, reason) {
    seat = parseInt(seat);
    if (!seat || s.final_killed.includes(seat) || s.death_events.some(e => e.seat === seat)) return;
    s.final_killed.push(seat);
    s.death_events.push({ seat, source, reason });
    if (!s.player_status[seat]) s.player_status[seat] = {};
    s.player_status[seat].deathReason = reason;
}

export function removeDeathEvent(seat) {
    seat = parseInt(seat);
    s.death_events = s.death_events.filter(e => e.seat !== seat);
    s.final_killed = s.final_killed.filter(deadSeat => deadSeat !== seat);
    if (s.player_status[seat]) s.player_status[seat].deathReason = null;
}

export function applyTimeWolfReflection(target_seat, actor_seat) {
    let twTarget = getNightTarget('mark', 'time_wolf');
    if (!target_seat || !twTarget || !actor_seat) return target_seat;
    if (target_seat === twTarget && !s.is_time_wolf_reflection_used && !isPlayerWolfFaction(actor_seat)) {
        setPersistentState('is_time_wolf_reflection_used', true); return parseInt(actor_seat);
    }
    return target_seat;
}

export function resolveAllTargets() {
    s.night_actions.forEach(action => { action.resolved_targets = [...action.selected_targets]; });

    let swaps = getActionsByEffect('swap');
    if (swaps.length === 0) return;

    const swapOrder = ['magician', 'trickster', 'wolf_sorcerer'];
    swaps.sort((a, b) => swapOrder.indexOf(a.role) - swapOrder.indexOf(b.role));

    s.night_actions.forEach(action => {
        if (action.effect === 'swap') return;
        action.resolved_targets = action.resolved_targets.map(target => {
            let currentTarget = target;
            swaps.forEach(swapAction => {
                let [t1, t2] = swapAction.selected_targets;
                if (currentTarget === t1) currentTarget = t2;
                else if (currentTarget === t2) currentTarget = t1;
            });
            return currentTarget;
        });
    });
}

export function findNearestWolf(start_seat, dir) {
    let curr = start_seat;
    for (let i = 0; i < s.total_players; i++) {
        curr += dir;
        if (curr > s.total_players) curr = 1; if (curr < 1) curr = s.total_players;
        if (!s.final_killed.includes(curr) && isWolfRole(s.player_roles[curr])) return curr;
    }
    return null;
}