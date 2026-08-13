/**
 * 遊戲全局狀態物件 (State)
 * 依照功能屬性進行分類，方便統一管理與追蹤
 */
export const s = {
    // ==========================================================================
    // 1. 遊戲基礎設定與配置
    // ==========================================================================
    total_players: 12,
    current_board: null,
    is_random_mode: false,
    role_transition_delay: 1,           // 閉眼→睜眼間隔秒數（可在設定頁調整）
    ROLE_DICT: {},
    BOARD_CONFIGS: {},

    // ==========================================================================
    // 2. 玩家狀態與角色配置
    // ==========================================================================
    player_roles: {},                  // 各座位的角色對應
    player_status: {},                 // 各座位的狀態 (中毒、受傷、是否為百變狼王等)
    spare_cards: [],                   // 盜賊底牌
    discarded_roles: [],               // 被棄用的角色 (盜賊未選)
    initial_thief_seat: null,          // 初始盜賊座位
    thief_chosen_role: null,           // 盜賊選擇的角色
    vwk_seat: null,                    // 百變狼王的座位
    shadow_seer_seat: null,            // 燈影預言家的座位

    // ==========================================================================
    // 3. 流程控制與 UI 狀態
    // ==========================================================================
    night_queue: [],                   // 夜晚行動隊列
    current_stage: null,               // 當前執行的階段
    current_actor_seat: null,          // 當前行動者的座位
    current_sub_label: null,           // 當前行動的子標籤 (如 A/B)
    current_viewing_seat: 1,           // 隨機模式下當前查看的座位
    selected_number: null,             // 單選目標
    selected_numbers_arr: [],          // 多選目標
    is_showing_result: false,          // 是否正在顯示查驗結果
    is_fake_wake: false,               // 是否為偽裝睜眼 (如底牌未選的角色)
    is_current_role_feared: false,     // 當前行動角色是否被恐懼
    night_action_log: [],              // 夜間行動法官紀錄日誌
    speech_order_text: null,           // 白天發言順序文本
    sheriff_candidates: [],            // 上警名單

    // ==========================================================================
    // 4. 單一目標追蹤 (Target Tracking)
    // ==========================================================================
    wolf_kill_target: null,            // 狼刀目標
    big_bad_wolf_kill_target: null,    // 大野狼刀目標
    witch_poison_target: null,         // 女巫毒藥目標
    seer_target: null,                 // 預言家查驗目標
    guard_target: null,                // 守衛守護目標
    dream_target: null,                // 攝夢人目標
    nightmare_target: null,            // 夢魘恐懼目標
    gargoyle_target: null,             // 石像鬼查驗目標
    beauty_target: null,               // 狼美人魅惑目標
    awk_beauty_target: null,           // 覺醒狼美人魅惑目標
    machine_wolf_target: null,         // 機械狼學習目標
    diviner_mark: null,                // 占卜師標記目標
    merchant_target: null,             // 商人給予技能目標
    vwk_charm_target: null,            // 百變狼王(熊)魅惑目標
    half_blood_target: null,           // 混血兒支持目標
    wild_child_target: null,           // 野孩子榜樣目標
    lonely_girl_target: null,          // 孤獨少女偶像目標
    time_wolf_target: null,            // 蝕時狼妃封鎖目標
    awk_idiot_target: null,            // 覺醒白痴保護目標
    crow_target: null,                 // 烏鴉詛咒目標
    seed_wolf_target: null,            // 種狼感染目標
    awk_gargoyle_target: null,         // 覺醒石像鬼目標
    awk_gargoyle_target_a: null,       // 覺醒石像鬼A目標
    awk_gargoyle_target_b: null,       // 覺醒石像鬼B目標
    awk_dreamwalker_target: null,      // 覺醒攝夢人指定的夢語者
    rust_sword_infected_target: null,  // 鏽劍騎士感染的狼人目標
    awk_wolf_gun_target: null,         // 覺醒狼王分槍目標
    ghost_bride_groom: null,           // 鬼魅新娘-新郎
    ghost_bride_witness: null,         // 鬼魅新娘-證婚人

    // ==========================================================================
    // 5. 陣列目標與特殊群體狀態
    // ==========================================================================
    magician_swap: [],                 // 魔術師交換目標
    trickster_swap: [],                // 詭術師交換目標
    wolf_sorcerer_swap: [],            // 狼術師交換目標
    phantom_targets: [],               // 尋香魅影綁定目標
    awk_seer_targets: [],              // 覺醒預言家查驗目標
    alchemist_fog_targets: [],         // 煉金魔女迷霧目標
    cupid_lovers: [],                  // 邱比特情侶
    acted_players: [],                 // 當晚有行動的玩家列表

    // ==========================================================================
    // 6. 特殊技能旗標與變數
    // ==========================================================================
    is_witch_saved: false,             // 女巫是否用解藥
    is_seed_wolf_infecting: false,     // 種狼是否正在發動感染
    has_ghost_rider_reflected: false,  // 惡靈騎士是否已反傷
    did_white_cat_flip_last_night: false, // 白貓昨晚是否翻牌免死
    is_pufferfish_triggered: false,    // 河豚是否被觸發
    is_alchemist_snake_used: false,    // 煉金魔女是否使用法老之蛇
    phantom_known_wolf: null,          // 尋香魅影已知的一名狼人
    merchant_item: null,               // 商人給出的技能種類
    merchant_type: null,               // 商人類型 (黑市/奇蹟)
    awk_witch_step: null,              // 覺醒女巫操作步驟
    awk_witch_assistant: null,         // 覺醒女巫指派的協助者
    awk_witch_assistant_agreed: null,  // 協助者是否同意

    // ==========================================================================
    // 7. 結算與死亡清單
    // ==========================================================================
    primary_killed: [],                // 初始死亡名單 (刀、毒、反傷等直死)
    chain_killed: [],                  // 連帶死亡名單 (殉情、連線)
    final_killed: [],                  // 最終總和死亡名單
    day_shooters_queue: [],            // 白天開槍/發動技能隊列
    is_snake_win: false,               // 白蛇與許仙是否觸發雙死獲勝

    // ==========================================================================
    // 8. 其他擴展板子專用變數
    // ==========================================================================
    pleasant_goat_guard: null,         // 喜羊羊守護的目標
    pleasant_goat_anti_theft: null,    // 喜羊羊防盜的目標
    gray_wolf_stolen_player: null,     // 灰太狼偷取的玩家對象
    gray_wolf_stolen_skill: null,      // 灰太狼偷取到的技能
    gray_wolf_guess: null,             // 灰太狼偷取喜羊羊時的猜測 (guard / anti_theft)
    penguin_target: null,              // 企鵝冰凍的目標
    celebrity_target: null,            // 名媛寵幸的目標
    charmer_target: null,              // 蠱惑師蠱惑的目標
    demon_hunter_target: null,         // 獵魔人狩獵的目標
    black_bat_target: null,            // 黑蝙蝠庇護的目標
    troublemaker_target: null,         // 搗蛋鬼耍寶的目標
    light_count_target: null,          // 流光伯爵庇護的目標
    zombie_infected: [],               // 殭屍已感染的玩家列表
    silence_target: null,              // 禁言長老禁言的目標
    medusa_target: null,               // 梅杜莎石化的目標
    machine_wolf_learn_target: null,   // 機械狼學習的對象
    evil_merchant_gun_target: null,    // 邪惡商人分槍的對象
    dark_messenger_target: null,       // 黑夜使者庇護的狼人
    is_phantom_thief_invincible: false, // 怪盜狼王是否發動無敵
    pandora_target: null,              // 潘朵拉贈魔盒的對象
    pandora_pool: null,                // 潘朵拉魔盒技能池
    pandora_gift: null,                // 當晚贈出的技能
    sp_merchant_targets: [],           // 超級黑市商人的三位幸運兒
    is_sp_merchant_turns_evil: false,  // 超級黑市商人是否變狼
    treasure_hunter_choice: null,      // 盜寶大師選擇的底牌身分
    is_treasure_hunter_evil: false,    // 盜寶大師是否為狼陣營
};

// 狼人陣營與邪惡陣營定義
export const wolf_faction = [
    'wolf', 'wolf_king', 'white_wolf_king', 'ghost_rider', 'wolf_beauty', 'blood_moon', 'snow_wolf',
    'wolf_brother', 'wolf_brother_little', 'awaken_wolf_king', 'wolf_witch',
    'wolf_crow', 'awaken_wolf_beauty', 'night_noble', 'time_wolf', 'trickster', 'wolf_sorcerer',
    'awaken_gargoyle', 'awaken_gargoyle_A', 'awaken_gargoyle_B',
    'big_bad_wolf', 'seed_wolf', 'big_gray_wolf', 'little_gray_wolf', 'war_wolf',
    'moon_wolf', 'assassin', 'warden', 'phantom_king', 'medusa', 'black_bat', 'pumpkin', 'evil_merchant', 'demon', 'dark_messenger'
];
export const evil_roles = [...wolf_faction, 'nightmare', 'hidden_wolf', 'gargoyle', 'machine_wolf',
    'phantom', 'night_mentor', 'eclipse_maid', 'mask_wolf', 'gray_wolf', 'wolf_servant',
    'snake_phantom', 'snake_seer', 'troublemaker', 'anubis', 'super_black_market'
];

/** 重置所有遊戲狀態（開始新局時呼叫） */
export function resetGameState() {
    s.night_queue = []; s.current_stage = null; s.wolf_kill_target = null; s.witch_poison_target = null; s.is_witch_saved = false;
    s.guard_target = null; s.dream_target = null; s.magician_swap = []; s.trickster_swap = []; s.wolf_sorcerer_swap = []; s.nightmare_target = null; s.gargoyle_target = null;
    s.beauty_target = null; s.machine_wolf_target = null; s.phantom_targets = []; s.awk_seer_targets = []; s.awk_beauty_target = null; s.diviner_mark = null;
    s.phantom_known_wolf = null; s.selected_number = null; s.current_editing_seat = null; s.final_killed = []; s.day_shooters_queue = [];
    s.has_ghost_rider_reflected = false; s.night_action_log = []; s.is_pufferfish_triggered = false; s.did_white_cat_flip_last_night = false;
    s.spare_cards = []; s.discarded_roles = []; s.initial_thief_seat = null; s.thief_chosen_role = null; s.cupid_lovers = [];
    s.merchant_target = null; s.merchant_item = null; s.merchant_type = null;
    s.awk_witch_step = null; s.awk_witch_assistant = null; s.awk_witch_assistant_agreed = null; s.vwk_charm_target = null; s.acted_players = [];
    s.alchemist_fog_targets = []; s.is_alchemist_snake_used = false; s.vwk_seat = null; s.awk_wolf_gun_target = null;
    s.half_blood_target = null; s.wild_child_target = null; s.lonely_girl_target = null; s.time_wolf_target = null; s.awk_idiot_target = null; s.crow_target = null;
    s.seed_wolf_target = null; s.is_seed_wolf_infecting = false; s.awk_gargoyle_target = null; s.awk_gargoyle_target_a = null; s.awk_gargoyle_target_b = null;
    s.awk_dreamwalker_target = null; s.ghost_bride_groom = null; s.ghost_bride_witness = null;
    s.primary_killed = []; s.chain_killed = []; s.current_sub_label = null; s.is_fake_wake = false; s.is_current_role_feared = false; s.rust_sword_infected_target = null; s.big_bad_wolf_kill_target = null;
    s.pleasant_goat_guard = null; s.pleasant_goat_anti_theft = null; s.gray_wolf_stolen_player = null; s.gray_wolf_stolen_skill = null; s.gray_wolf_guess = null;
    s.penguin_target = null; s.celebrity_target = null;
    s.charmer_target = null; s.demon_hunter_target = null;
    s.black_bat_target = null; s.troublemaker_target = null; s.light_count_target = null;
    s.zombie_infected = []; s.silence_target = null;
    s.medusa_target = null; s.machine_wolf_learn_target = null;
    s.evil_merchant_gun_target = null; s.dark_messenger_target = null;
    s.is_phantom_thief_invincible = false;
    s.pandora_target = null; s.pandora_pool = null; s.pandora_gift = null;
    s.sp_merchant_targets = []; s.is_sp_merchant_turns_evil = false;
    s.treasure_hunter_choice = null; s.is_treasure_hunter_evil = false;
    s.sheriff_candidates = []; s.speech_order_text = null; s.shadow_seer_seat = null;
    s.is_snake_win = false;
}

/** 觸發震動回饋（行動裝置） */
export function vibrate(pattern = 15) {
    if (navigator.vibrate) navigator.vibrate(pattern);
}

/** 法官語音播報 */
export function speak(text, callback) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    utterance.rate = 0.9;
    if (callback) utterance.onend = callback;
    window.speechSynthesis.speak(utterance);
}

/** 取得對應階段的語音名稱 */
export function getStageVoiceName(stage, sub_label) {
    if (stage === 'seer') return sub_label ? `預言家${sub_label}` : '預言家';
    if (stage === 'awaken_witch') return '覺醒女巫';
    if (stage === 'awaken_wolf_king_gun') return '覺醒狼王';
    if (stage === 'wolf_gun_confirm') return '三小狼';
    if (stage === 'wolf') return '狼人';
    if (stage === 'wolf_meet') return '狼人';
    if (stage === 'lovers_meet') return '情侶';
    if (stage === 'wolf_brother_meet') return '狼兄狼弟';
    if (stage === 'lucky_boy_action') return '幸運兒';
    if (stage === 'awaken_witch_assistant_action') return '協助者';
    if (stage === 'variable_wolf_king') return '百變狼王';
    if (stage === 'ghost_bride_couple') return '鬼魅新娘與新郎';
    if (stage === 'ghost_bride_witness') return '證婚人';
    if (stage === 'awaken_dreamwalker_result') return '覺醒攝夢人';
    if (stage === 'gray_wolf_steal' || stage === 'gray_wolf_action') return '灰太狼';
    if (stage.startsWith('notify_')) return `${stage.split('_').pop()}號`;
    return s.ROLE_DICT[stage]?.name || stage;
}

/** 獲取魔術師/詭術師/狼術師換位後的實際目標 */
export function getActualTarget(seat) {
    if (!seat) return null;
    let st = parseInt(seat);
    let mag_swap = [...s.magician_swap].sort().join(',');
    let tri_swap = [...s.trickster_swap].sort().join(',');
    let effective_magician = s.magician_swap;

    // 魔術師與詭術師換到相同目標時抵銷
    if (s.magician_swap.length && s.trickster_swap.length && mag_swap === tri_swap) effective_magician = [];
    if (effective_magician.includes(st)) st = effective_magician[0] === st ? effective_magician[1] : effective_magician[0];
    if (s.wolf_sorcerer_swap.includes(st)) st = s.wolf_sorcerer_swap[0] === st ? s.wolf_sorcerer_swap[1] : s.wolf_sorcerer_swap[0];
    return st;
}

/** 處理蝕時狼妃的反彈邏輯 */
export function applyTimeWolfReflection(target_seat, actor_seat) {
    if (!target_seat || !s.time_wolf_target || !actor_seat) return target_seat;
    // 如果非邪惡陣營對蝕時目標使用技能，則反彈回自己
    if (target_seat === s.time_wolf_target && !evil_roles.includes(s.player_roles[actor_seat])) return parseInt(actor_seat);
    return target_seat;
}

/** 尋找鄰近的狼人 (用於覺醒獵人、鏽劍騎士等) */
export function findNearestWolf(start_seat, dir) {
    let curr = start_seat;
    for (let i = 0; i < s.total_players; i++) {
        curr += dir;
        if (curr > s.total_players) curr = 1;
        if (curr < 1) curr = s.total_players;
        if (!s.final_killed.includes(curr) && evil_roles.includes(s.player_roles[curr])) return curr;
    }
    return null;
}
