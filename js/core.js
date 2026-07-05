// js/core.js
export const s = {
    totalPlayers: 12, currentBoard: null, playerRoles: {}, playerStatus: {},
    isRandomMode: false, currentViewingSeat: 1, nightQueue: [], currentStage: null, 
    currentActorSeat: null, currentSubLabel: null, selectedNumber: null, selectedNumbersArr: [], 
    isShowingResult: false, currentRoleFeared: false, isFakeWake: false, nightActionLog: [],
    magicianSwap: [], tricksterSwap: [], wolfSorcererSwap: [], nightmareTarget: null, gargoyleTarget: null, 
    beautyTarget: null, dreamTarget: null, guardTarget: null, wolfKillTarget: null, witchPoisonTarget: null, 
    witchSaved: false, seerTarget: null, bigBadWolfKillTarget: null, wolfCrowMark: null, machineWolfTarget: null, 
    phantomTargets: [], awakenSeerTargets: [], awakenBeautyTarget: null, phantomKnownWolf: null, 
    spareCards: [], discardedRoles: [], initialThiefSeat: null, thiefChosenRole: null, cupidLovers: [], 
    merchantTarget: null, merchantItem: null, merchantType: null, awakenWitchStep: null, awakenWitchAssistant: null, 
    alchemistFogTargets: [], alchemistSnakeUsed: false, vwkSeat: null, awakenWolfGunTarget: null,
    halfBloodTarget: null, wildChildTarget: null, lonelyGirlTarget: null, timeWolfTarget: null, 
    awakenIdiotTarget: null, crowTarget: null, seedWolfTarget: null, isSeedWolfInfecting: false, 
    awakenGargoyleTarget: null, awakenDreamwalkerTarget: null, ghostBrideGroom: null, ghostBrideWitness: null,
    whiteCatFlippedLastNight: false, pufferfishTriggered: false, rustSwordInfectedTarget: null, 
    primaryKilled: [], chainKilled: [], finalKilled: [], dayShootersQueue: [], ghostRiderReflected: false,
    ROLE_DICT: {}, BOARD_CONFIGS: {}
};

export const wolfFaction = ['wolf', 'wolf_king', 'white_wolf_king', 'ghost_rider', 'wolf_beauty', 'blood_moon', 'wolf_brother', 'wolf_brother_little', 'awaken_wolf_king', 'mask_wolf', 'wolf_witch', 'wolf_crow', 'awaken_wolf_beauty', 'night_mentor', 'eclipse_maid', 'night_noble', 'time_wolf', 'trickster', 'wolf_sorcerer', 'awaken_gargoyle', 'big_bad_wolf', 'seed_wolf', 'big_grey_wolf', 'hidden_wolf'];
export const evilRoles = [...wolfFaction, 'gargoyle', 'nightmare', 'machine_wolf'];

export function speak(text, callback) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    utterance.rate = 0.9;
    if (callback) utterance.onend = callback;
    window.speechSynthesis.speak(utterance);
}

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
    if (stage.startsWith('notify_')) return `${stage.split('_').pop()}號`;
    return s.ROLE_DICT[stage]?.name || stage;
}

export function getActualTarget(seat) {
    if (!seat) return null;
    let st = parseInt(seat);
    let magSwap = [...s.magicianSwap].sort().join(',');
    let triSwap = [...s.tricksterSwap].sort().join(',');
    let effectiveMagician = s.magicianSwap;
    if (s.magicianSwap.length && s.tricksterSwap.length && magSwap === triSwap) effectiveMagician = [];
    if (effectiveMagician.includes(st)) st = effectiveMagician[0] === st ? effectiveMagician[1] : effectiveMagician[0];
    if (s.wolfSorcererSwap.includes(st)) st = s.wolfSorcererSwap[0] === st ? s.wolfSorcererSwap[1] : s.wolfSorcererSwap[0];
    return st;
}

export function applyTimeWolfReflection(targetSeat, actorSeat) {
    if (!targetSeat || !s.timeWolfTarget || !actorSeat) return targetSeat;
    if (targetSeat === s.timeWolfTarget && !evilRoles.includes(s.playerRoles[actorSeat])) return parseInt(actorSeat);
    return targetSeat;
}

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