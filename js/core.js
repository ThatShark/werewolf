// js/core.js

export const s = {
    total_players: 12, current_board: null, is_random_mode: false, role_transition_delay: 1, ROLE_DICT: {}, BOARD_CONFIGS: {},
    player_roles: {}, player_status: {}, spare_cards: [], discarded_roles: [], initial_thief_seat: null, thief_chosen_role: null, vwk_seat: null, shadow_seer_seat: null,
    night_queue: [], current_stage: null, current_actor_seat: null, current_sub_label: null, current_viewing_seat: 1, selected_number: null, selected_numbers_arr: [],
    is_showing_result: false, is_fake_wake: false, is_current_role_feared: false, is_current_role_frozen: false, night_action_log: [], speech_order_text: null, sheriff_candidates: [],

    // ==========================================
    // 新架構：統一夜間行動資料
    // ==========================================
    night_actions: [],

    // ==========================================
    // 跨夜持續狀態 (Persistent State) - 保留
    // ==========================================
    prev_dream_target: null, sp_grave_keeper_heir: null, puppet_target: null, half_blood_target: null, wild_child_target: null, lonely_girl_target: null,
    seed_wolf_target: null, awk_gargoyle_target: null, awk_gargoyle_target_a: null, awk_gargoyle_target_b: null, rust_sword_infected_target: null, awk_wolf_gun_target: null,
    ghost_bride_groom: null, ghost_bride_witness: null, shadow_master_target: null, phantom_targets: [], cupid_lovers: [], acted_players: [], zombie_infected: [],
    is_time_wolf_reflection_used: false, is_seed_wolf_infecting: false, has_ghost_rider_reflected: false, did_white_cat_flip_last_night: false, is_pufferfish_triggered: false,
    is_alchemist_snake_used: false, phantom_known_wolf: null, merchant_item: null, merchant_type: null, awk_witch_step: null, awk_witch_assistant: null, awk_witch_assistant_agreed: null,
    primary_killed: [], chain_killed: [], final_killed: [], day_shooters_queue: [], is_snake_win: false,
    gray_wolf_stolen_player: null, gray_wolf_stolen_skill: null, gray_wolf_guess: null, machine_wolf_learn_target: null, evil_merchant_gun_target: null,
    pandora_target: null, pandora_pool: null, pandora_gift: null, sp_merchant_targets: [], is_sp_merchant_turns_evil: false, treasure_hunter_choice: null, is_treasure_hunter_evil: false,
    player_genders: {}, sleeping_beauty_seat: null, is_sleeping_beauty_active: true
};

export const wolf_faction = ['wolf', 'wolf_king', 'white_wolf_king', 'ghost_rider', 'wolf_beauty', 'blood_moon', 'snow_wolf', 'wolf_brother', 'awaken_wolf_king', 'wolf_witch', 'nightmare', 'wolf_crow', 'awaken_wolf_beauty', 'night_noble', 'time_wolf', 'trickster', 'wolf_sorcerer', 'awaken_gargoyle', 'awaken_gargoyle_A', 'awaken_gargoyle_B', 'big_bad_wolf', 'seed_wolf', 'big_gray_wolf', 'little_gray_wolf', 'war_wolf', 'moon_wolf', 'assassin', 'warden', 'phantom_king', 'medusa', 'black_bat', 'pumpkin', 'evil_merchant', 'demon', 'dark_messenger'];
export const evil_roles = [...wolf_faction, 'hidden_wolf', 'gargoyle', 'machine_wolf', 'phantom', 'night_mentor', 'eclipse_maid', 'mask_wolf', 'gray_wolf', 'wolf_servant', 'snake_phantom', 'snake_seer', 'troublemaker', 'anubis', 'super_black_market', 'wolf_brother_little'];
export const wolf_team_roles = wolf_faction.filter(role => !['wolf_crow', 'awaken_gargoyle', 'awaken_gargoyle_A', 'awaken_gargoyle_B', 'big_gray_wolf'].includes(role));

export function resetGameState() {
    s.night_queue = []; s.current_stage = null; s.is_time_wolf_reflection_used = false; s.prev_dream_target = null; s.sp_grave_keeper_heir = null; s.puppet_target = null; s.phantom_targets = []; s.phantom_known_wolf = null; s.selected_number = null; s.current_editing_seat = null; s.final_killed = []; s.day_shooters_queue = []; s.has_ghost_rider_reflected = false; s.night_action_log = []; s.is_pufferfish_triggered = false; s.did_white_cat_flip_last_night = false; s.spare_cards = []; s.discarded_roles = []; s.initial_thief_seat = null; s.thief_chosen_role = null; s.cupid_lovers = []; s.merchant_target = null; s.merchant_item = null; s.merchant_type = null; s.awk_witch_step = null; s.awk_witch_assistant = null; s.awk_witch_assistant_agreed = null; s.acted_players = []; s.is_alchemist_snake_used = false; s.vwk_seat = null; s.awk_wolf_gun_target = null; s.half_blood_target = null; s.wild_child_target = null; s.lonely_girl_target = null; s.seed_wolf_target = null; s.is_seed_wolf_infecting = false; s.awk_gargoyle_target = null; s.awk_gargoyle_target_a = null; s.awk_gargoyle_target_b = null; s.ghost_bride_groom = null; s.ghost_bride_witness = null; s.shadow_master_target = null; s.primary_killed = []; s.chain_killed = []; s.current_sub_label = null; s.is_fake_wake = false; s.is_current_role_feared = false; s.is_current_role_frozen = false; s.rust_sword_infected_target = null; s.gray_wolf_stolen_player = null; s.gray_wolf_stolen_skill = null; s.gray_wolf_guess = null; s.zombie_infected = []; s.machine_wolf_learn_target = null; s.evil_merchant_gun_target = null; s.pandora_target = null; s.pandora_pool = null; s.pandora_gift = null; s.sp_merchant_targets = []; s.is_sp_merchant_turns_evil = false; s.treasure_hunter_choice = null; s.is_treasure_hunter_evil = false; s.player_genders = {}; s.sleeping_beauty_seat = null; s.is_sleeping_beauty_active = true; s.sheriff_candidates = []; s.speech_order_text = null; s.shadow_seer_seat = null; s.is_snake_win = false;
}

export function vibrate(pattern = 15) { if (navigator.vibrate) navigator.vibrate(pattern); }
export function speak(text, callback) { const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'zh-TW'; utterance.rate = 0.9; if (callback) utterance.onend = callback; window.speechSynthesis.speak(utterance); }

export function getStageVoiceName(stage, sub_label) {
    if (stage === 'seer') return sub_label ? `預言家${sub_label}` : '預言家';
    if (stage === 'awaken_witch') return '覺醒女巫'; if (stage === 'awaken_wolf_king_gun') return '覺醒狼王'; if (stage === 'wolf_gun_confirm') return '三小狼'; if (stage === 'wolf' || stage === 'wolf_meet') return '狼人'; if (stage === 'lovers_meet') return '情侶'; if (stage === 'wolf_brother_meet') return '狼兄狼弟'; if (stage === 'lucky_boy_action') return '幸運兒'; if (stage === 'awaken_witch_assistant_action') return '協助者'; if (stage === 'variable_wolf_king') return '百變狼王'; if (stage === 'ghost_bride_couple') return '鬼魅新娘與新郎'; if (stage === 'ghost_bride_witness') return '證婚人'; if (stage === 'awaken_dreamwalker_result') return '覺醒攝夢人'; if (stage === 'gray_wolf_steal' || stage === 'gray_wolf_action') return '灰太狼';
    if (stage.startsWith('notify_')) return `${stage.split('_').pop()}號`;
    return s.ROLE_DICT[stage]?.name || stage;
}

// 統一行動管理 API
export function addNightAction(actor, role, effect, targets, metadata = {}) {
    s.night_actions.push({ id: `night-${s.night_actions.length + 1}-${role}-${effect}`, actor, role, effect, selected_targets: [...targets], resolved_targets: [...targets], phase: 'night', status: 'active', metadata });
}
export function getActionsByEffect(effect) { return s.night_actions.filter(a => a.effect === effect && a.status === 'active'); }
export function getActiveEffectsOn(seat) { return s.night_actions.filter(a => a.status === 'active' && a.resolved_targets.includes(seat)); }
export function getNightTarget(effect, role) { return getActionsByEffect(effect).find(a => a.role === role)?.resolved_targets[0] || null; }
export function getNightTargets(effect, role) { return getActionsByEffect(effect).find(a => a.role === role)?.resolved_targets || []; }
export function cancelAction(actionId, reason = '') { const action = s.night_actions.find(a => a.id === actionId); if (action) { action.status = 'cancelled'; action.metadata.cancelReason = reason; } }

export function getActualTarget(seat) {
    if (!seat) return null; let st = parseInt(seat);
    let mag_swap = getNightTargets('swap', 'magician'); let tri_swap = getNightTargets('swap', 'trickster'); let ws_swap = getNightTargets('swap', 'wolf_sorcerer');
    let effective_magician = mag_swap;
    if (mag_swap.length && tri_swap.length && mag_swap.slice().sort().join(',') === tri_swap.slice().sort().join(',')) effective_magician = [];
    if (effective_magician.includes(st)) st = effective_magician[0] === st ? effective_magician[1] : effective_magician[0];
    if (ws_swap.includes(st)) st = ws_swap[0] === st ? ws_swap[1] : ws_swap[0];
    return st;
}

export function applyTimeWolfReflection(target_seat, actor_seat) {
    let twTarget = getNightTarget('mark', 'time_wolf');
    if (!target_seat || !twTarget || !actor_seat) return target_seat;
    if (target_seat === twTarget && !s.is_time_wolf_reflection_used && !evil_roles.includes(s.player_roles[actor_seat])) {
        s.is_time_wolf_reflection_used = true; return parseInt(actor_seat);
    }
    return target_seat;
}

export function resolveAllTargets() {
    s.night_actions.forEach(action => { action.resolved_targets = [...action.selected_targets]; });
    const swapMap = {};
    getActionsByEffect('swap').forEach(swapAction => {
        if (swapAction.resolved_targets.length === 2) {
            const [target1, target2] = swapAction.resolved_targets;
            swapMap[target1] = target2; swapMap[target2] = target1;
        }
    });
    s.night_actions.forEach(action => {
        if (action.effect === 'swap') return;
        action.resolved_targets = action.resolved_targets.map(target => swapMap[target] ? swapMap[target] : target);
    });
}

export function findNearestWolf(start_seat, dir) {
    let curr = start_seat;
    for (let i = 0; i < s.total_players; i++) {
        curr += dir;
        if (curr > s.total_players) curr = 1; if (curr < 1) curr = s.total_players;
        if (!s.final_killed.includes(curr) && evil_roles.includes(s.player_roles[curr])) return curr;
    }
    return null;
}