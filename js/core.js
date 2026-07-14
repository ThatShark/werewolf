/**
 * 遊戲全局狀態物件 (State)
 * 依照功能屬性進行分類，方便統一管理與追蹤
 */
export const s = {
    // ==========================================================================
    // 1. 遊戲基礎設定與配置
    // ==========================================================================
    totalPlayers: 12,
    currentBoard: null,
    isRandomMode: false,
    ROLE_DICT: {},
    BOARD_CONFIGS: {},

    // ==========================================================================
    // 2. 玩家狀態與角色配置
    // ==========================================================================
    playerRoles: {},                  // 各座位的角色對應
    playerStatus: {},                 // 各座位的狀態 (中毒、受傷、是否為百變狼王等)
    spareCards: [],                   // 盜賊底牌
    discardedRoles: [],               // 被棄用的角色 (盜賊未選)
    initialThiefSeat: null,           // 初始盜賊座位
    thiefChosenRole: null,            // 盜賊選擇的角色
    vwkSeat: null,                    // 百變狼王的座位
    shadowSeerSeat: null,             // 燈影預言家的座位

    // ==========================================================================
    // 3. 流程控制與 UI 狀態
    // ==========================================================================
    nightQueue: [],                   // 夜晚行動隊列
    currentStage: null,               // 當前執行的階段
    currentActorSeat: null,           // 當前行動者的座位
    currentSubLabel: null,            // 當前行動的子標籤 (如 A/B)
    currentViewingSeat: 1,            // 隨機模式下當前查看的座位
    selectedNumber: null,             // 單選目標
    selectedNumbersArr: [],           // 多選目標
    isShowingResult: false,           // 是否正在顯示查驗結果
    isFakeWake: false,                // 是否為偽裝睜眼 (如底牌未選的角色)
    currentRoleFeared: false,         // 當前行動角色是否被恐懼
    nightActionLog: [],               // 夜間行動法官紀錄日誌
    speechOrderText: null,            // 白天發言順序文本
    sheriffCandidates: [],            // 上警名單

    // ==========================================================================
    // 4. 單一目標追蹤 (Target Tracking)
    // ==========================================================================
    wolfKillTarget: null,             // 狼刀目標
    bigBadWolfKillTarget: null,       // 大野狼刀目標
    witchPoisonTarget: null,          // 女巫毒藥目標
    seerTarget: null,                 // 預言家查驗目標
    guardTarget: null,                // 守衛守護目標
    dreamTarget: null,                // 攝夢人目標
    nightmareTarget: null,            // 夢魘恐懼目標
    gargoyleTarget: null,             // 石像鬼查驗目標
    beautyTarget: null,               // 狼美人魅惑目標
    awakenBeautyTarget: null,         // 覺醒狼美人魅惑目標
    machineWolfTarget: null,          // 機械狼學習目標
    divinerMark: null,                // 占卜師標記目標
    merchantTarget: null,             // 商人給予技能目標
    vwkCharmTarget: null,             // 百變狼王(熊)魅惑目標
    halfBloodTarget: null,            // 混血兒支持目標
    wildChildTarget: null,            // 野孩子榜樣目標
    lonelyGirlTarget: null,           // 孤獨少女偶像目標
    timeWolfTarget: null,             // 蝕時狼妃封鎖目標
    awakenIdiotTarget: null,          // 覺醒白痴保護目標
    crowTarget: null,                 // 烏鴉詛咒目標
    seedWolfTarget: null,             // 種狼感染目標
    awakenGargoyleTarget: null,       // 覺醒石像鬼目標
    awakenGargoyleTargetA: null,      // 覺醒石像鬼A目標
    awakenGargoyleTargetB: null,      // 覺醒石像鬼B目標
    awakenDreamwalkerTarget: null,    // 覺醒攝夢人指定的夢語者
    rustSwordInfectedTarget: null,    // 鏽劍騎士感染的狼人目標
    awakenWolfGunTarget: null,        // 覺醒狼王分槍目標
    ghostBrideGroom: null,            // 鬼魅新娘-新郎
    ghostBrideWitness: null,          // 鬼魅新娘-證婚人

    // ==========================================================================
    // 5. 陣列目標與特殊群體狀態
    // ==========================================================================
    magicianSwap: [],                 // 魔術師交換目標
    tricksterSwap: [],                // 詭術師交換目標
    wolfSorcererSwap: [],             // 狼術師交換目標
    phantomTargets: [],               // 尋香魅影綁定目標
    awakenSeerTargets: [],            // 覺醒預言家查驗目標
    alchemistFogTargets: [],          // 煉金魔女迷霧目標
    cupidLovers: [],                  // 邱比特情侶
    actedPlayers: [],                 // 當晚有行動的玩家列表

    // ==========================================================================
    // 6. 特殊技能旗標與變數
    // ==========================================================================
    witchSaved: false,                // 女巫是否用解藥
    isSeedWolfInfecting: false,       // 種狼是否正在發動感染
    ghostRiderReflected: false,       // 惡靈騎士是否已反傷
    whiteCatFlippedLastNight: false,  // 白貓昨晚是否翻牌免死
    pufferfishTriggered: false,       // 河豚是否被觸發
    alchemistSnakeUsed: false,        // 煉金魔女是否使用法老之蛇
    phantomKnownWolf: null,           // 尋香魅影已知的一名狼人
    merchantItem: null,               // 商人給出的技能種類
    merchantType: null,               // 商人類型 (黑市/奇蹟)
    awakenWitchStep: null,            // 覺醒女巫操作步驟
    awakenWitchAssistant: null,       // 覺醒女巫指派的協助者
    awakenWitchAssistantAgreed: null, // 協助者是否同意

    // ==========================================================================
    // 7. 結算與死亡清單
    // ==========================================================================
    primaryKilled: [],                // 初始死亡名單 (刀、毒、反傷等直死)
    chainKilled: [],                  // 連帶死亡名單 (殉情、連線)
    finalKilled: [],                  // 最終總和死亡名單
    dayShootersQueue: [],             // 白天開槍/發動技能隊列

    // ==========================================================================
    // 8. 其他擴展板子專用變數
    // ==========================================================================
    pleasantGoatGuard: null,          // 喜羊羊守護的目標
    pleasantGoatAntiTheft: null,      // 喜羊羊防盜的目標
    grayWolfStolenPlayer: null,       // 灰太狼偷取的玩家對象
    grayWolfStolenSkill: null,        // 灰太狼偷取到的技能
    grayWolfGuess: null,              // 灰太狼偷取喜羊羊時的猜測 (guard / anti_theft)
};

// 狼人陣營與邪惡陣營定義
export const wolfFaction = [
    'wolf', 'wolf_king', 'white_wolf_king', 'ghost_rider', 'wolf_beauty', 'blood_moon',
    'wolf_brother', 'wolf_brother_little', 'awaken_wolf_king', 'wolf_witch',
    'wolf_crow', 'awaken_wolf_beauty', 'night_noble', 'time_wolf', 'trickster', 'wolf_sorcerer',
    'awaken_gargoyle', 'awaken_gargoyle_A', 'awaken_gargoyle_B',
    'big_bad_wolf', 'seed_wolf', 'big_gray_wolf', 'little_gray_wolf'
];
export const evilRoles = [...wolfFaction, 'nightmare', 'hidden_wolf', 'gargoyle', 'machine_wolf',
    'phantom', 'night_mentor', 'eclipse_maid', 'mask_wolf', 'gray_wolf', 'wolf_servant'
];

/** 法官語音播報 */
export function speak(text, callback) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    utterance.rate = 0.9;
    if (callback) utterance.onend = callback;
    window.speechSynthesis.speak(utterance);
}

/** 取得對應階段的語音名稱 */
export function getStageVoiceName(stage, subLabel) {
    if (stage === 'seer') return subLabel ? `預言家${subLabel}` : '預言家';
    if (stage === 'awaken_witch') return '覺醒女巫';
    if (stage === 'awaken_wolf_king_gun') return '覺醒狼王';
    if (stage === 'wolf_gun_confirm') return '三小狼';
    if (stage === 'wolf_meet') return '狼人';
    if (stage === 'lovers_meet') return '情侶';
    if (stage === 'wolf_brother_meet') return '狼兄狼弟';
    if (stage === 'lucky_boy_action') return '幸運兒';
    if (stage === 'awaken_witch_assistant_action') return '協助者';
    if (stage === 'variable_wolf_king') return '百變狼王';
    if (stage === 'ghost_bride_couple') return '鬼魅新娘與新郎';
    if (stage === 'ghost_bride_witness') return '證婚人';
    if (stage === 'awaken_dreamwalker_result') return '覺醒攝夢人';
    if (stage === 'pleasant_goat') return '喜羊羊';
    if (stage === 'gray_wolf_steal' || stage === 'gray_wolf_action') return '灰太狼';
    if (stage.startsWith('notify_')) return `${stage.split('_').pop()}號`;
    return s.ROLE_DICT[stage]?.name || stage;
}

/** 獲取魔術師/詭術師/狼術師換位後的實際目標 */
export function getActualTarget(seat) {
    if (!seat) return null;
    let st = parseInt(seat);
    let magSwap = [...s.magicianSwap].sort().join(',');
    let triSwap = [...s.tricksterSwap].sort().join(',');
    let effectiveMagician = s.magicianSwap;
    
    // 魔術師與詭術師換到相同目標時抵銷
    if (s.magicianSwap.length && s.tricksterSwap.length && magSwap === triSwap) effectiveMagician = [];
    if (effectiveMagician.includes(st)) st = effectiveMagician[0] === st ? effectiveMagician[1] : effectiveMagician[0];
    if (s.wolfSorcererSwap.includes(st)) st = s.wolfSorcererSwap[0] === st ? s.wolfSorcererSwap[1] : s.wolfSorcererSwap[0];
    return st;
}

/** 處理蝕時狼妃的反彈邏輯 */
export function applyTimeWolfReflection(targetSeat, actorSeat) {
    if (!targetSeat || !s.timeWolfTarget || !actorSeat) return targetSeat;
    // 如果非邪惡陣營對蝕時目標使用技能，則反彈回自己
    if (targetSeat === s.timeWolfTarget && !evilRoles.includes(s.playerRoles[actorSeat])) return parseInt(actorSeat);
    return targetSeat;
}

/** 尋找鄰近的狼人 (用於覺醒獵人、鏽劍騎士等) */
export function findNearestWolf(startSeat, dir) {
    let curr = startSeat;
    for (let i = 0; i < s.totalPlayers; i++) {
        curr += dir;
        if (curr > s.totalPlayers) curr = 1;
        if (curr < 1) curr = s.totalPlayers;
        if (!s.finalKilled.includes(curr) && evilRoles.includes(s.playerRoles[curr])) return curr;
    }
    return null;
}