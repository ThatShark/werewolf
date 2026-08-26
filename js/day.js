// js/day.js
import { s, findNearestWolf, getActionsByEffect, cancelAction, resolveAllTargets, getNightTarget, removeDeathEvent, addDeathEvent, isWolfRole, isPlayerWolfFaction, getWolfTeamRoles, isPlayerEvil } from './core.js';

function checkSnakeWin(dead1, dead2) {
    let r1 = s.player_roles[dead1]; let r2 = s.player_roles[dead2];
    let is_snake_pair = (r1 === 'snake_phantom' && r2 === 'snake_seer') || (r1 === 'snake_seer' && r2 === 'snake_phantom');
    let linked_death = s.death_events.some(e => (e.seat === dead1 || e.seat === dead2) && e.source === 'chain' && e.reason.includes('連帶死亡'));
    if (is_snake_pair && linked_death) s.is_snake_win = true;
}

export function canPlayerShoot(seat, role = s.player_roles[seat]) {
    let deathEvent = s.death_events.find(e => e.seat === parseInt(seat));
    if (!deathEvent || deathEvent.source === 'chain' || deathEvent.source === 'vote') return false;

    let rules = s.ROLE_DICT[role] || {};
    let nightmareTarget = getNightTarget('disable', 'nightmare');
    let witchPoisonTarget = getActionsByEffect('poison').find(a => ['witch', 'awaken_witch'].includes(a.role))?.resolved_targets[0];
    let pgAntiTheft = getActionsByEffect('anti_theft').find(a => a.role === 'pleasant_goat')?.resolved_targets[0] || getActionsByEffect('guard_and_anti_theft').find(a => a.role === 'pleasant_goat')?.resolved_targets[0];
    let isStolen = s.gray_wolf_stolen_player === parseInt(seat) && s.gray_wolf_stolen_player !== pgAntiTheft;
    let isSleeping = s.sleeping_beauty_seat && s.is_sleeping_beauty_active && parseInt(seat) === s.sleeping_beauty_seat;
    let isCharmed = getNightTarget('charm', 'wolf_beauty') === parseInt(seat);
    let isConverted = s.player_status[seat]?.isConvertedWolf;

    if (nightmareTarget === parseInt(seat) || witchPoisonTarget === parseInt(seat) || isStolen || isSleeping || isCharmed || isConverted) return false;

    // 【標籤驅動】：取代硬編碼的獵人與狼王陣列
    return rules.tags?.includes('shoot_on_death')
        || (role === 'hunter' && s.player_status[seat]?.isVWK)
        || s.awk_wolf_gun_target === parseInt(seat)
        || s.evil_merchant_gun_target === parseInt(seat)
        || s.player_status[seat]?.hasPandoraDayGun
        || s.player_status[seat]?.hasSuperBlackMarketGun;
}

function resolveFlipToSurviveImmunity() {
    // 【標籤驅動】：尋找所有擁有免死翻牌標籤的角色（如白貓）
    let flipSeats = Object.keys(s.player_roles).filter(k => s.ROLE_DICT[s.player_roles[k]]?.tags?.includes('flip_to_survive'));
    flipSeats.forEach(seat => {
        if (!s.player_status[seat]?.isWhiteCatFlipped && s.death_events.some(e => e.seat === parseInt(seat))) {
            removeDeathEvent(parseInt(seat));
            s.player_status[seat].isWhiteCatFlipped = true;
            s.did_white_cat_flip_last_night = true;
        }
    });
}

function applyDisableRules() {
    let troubleActions = getActionsByEffect('trouble');
    if (troubleActions.length > 0) {
        let tSeat = troubleActions[0].resolved_targets[0];
        s.night_actions.forEach(a => { if (a.actor === tSeat || (a.actor === 'wolves' && getWolfTeamRoles().includes(s.player_roles[tSeat]))) { if (['protect', 'poison', 'inspect', 'kill'].includes(a.effect)) { a.resolved_targets = [tSeat]; } } });
    }

    let medusaActions = getActionsByEffect('disable').filter(a => a.metadata?.mode === 'petrify');
    if (medusaActions.length > 0) {
        let mTarget = medusaActions[0].resolved_targets[0];
        s.night_actions.filter(a => a.actor === mTarget).forEach(a => cancelAction(a.id, "被梅杜莎石化"));
    }

    let fearActions = getActionsByEffect('disable').filter(a => a.metadata?.mode === 'fear');
    if (fearActions.length > 0) {
        let fTarget = fearActions[0].resolved_targets[0];
        if (getWolfTeamRoles().includes(s.player_roles[fTarget])) s.night_actions.filter(a => a.effect === 'kill' && a.actor === 'wolves').forEach(a => cancelAction(a.id, "狼隊因恐懼無法刀人"));
        else s.night_actions.filter(a => a.actor === fTarget).forEach(a => cancelAction(a.id, "被夢魘恐懼"));
    }

    let freezeActions = getActionsByEffect('disable').filter(a => a.metadata?.mode === 'freeze');
    if (freezeActions.length > 0) {
        let fTarget = freezeActions[0].resolved_targets[0];
        if (getWolfTeamRoles().includes(s.player_roles[fTarget])) {
            // 加入 'convert'，讓狼隊也不能感染
            s.night_actions.filter(a => ['kill', 'convert'].includes(a.effect) && a.actor === 'wolves').forEach(a => cancelAction(a.id, "狼隊因冰凍無法刀人與感染"));
        } else {
            s.night_actions.filter(a => a.actor === fTarget).forEach(a => cancelAction(a.id, "被企鵝冰凍"));
        }
    }

    let foxCharmActions = getActionsByEffect('charm').filter(a => a.role === 'fox');
    if (foxCharmActions.length > 0) {
        let fcTarget = foxCharmActions[0].resolved_targets[0];
        if (isWolfRole(s.player_roles[fcTarget])) {
            s.night_actions.filter(a => a.effect === 'kill' && a.actor === 'wolves').forEach(a => cancelAction(a.id, "狼隊因被子狐魅惑空刀"));
        }
    }
}

function applyGlobalProtections() {
    if (s.sleeping_beauty_seat && s.is_sleeping_beauty_active) {
        let sb = s.sleeping_beauty_seat; let sbRole = s.player_roles[sb];
        if (['witch', 'awaken_witch'].includes(sbRole)) s.night_actions.filter(a => a.actor === sb && a.effect === 'poison').forEach(a => cancelAction(a.id, "睡美人女巫無法用毒"));
        if (getWolfTeamRoles().includes(sbRole)) {
            let alive_wolves = Object.keys(s.player_roles).filter(k => getWolfTeamRoles().includes(s.player_roles[k]));
            if (alive_wolves.every(k => parseInt(k) === sb)) s.night_actions.filter(a => a.effect === 'kill' && a.actor === 'wolves').forEach(a => cancelAction(a.id, "狼隊全體沉睡"));
        }
        if (sbRole === 'silence_elder') s.night_actions.filter(a => a.effect === 'silence').forEach(a => cancelAction(a.id, "睡美人禁言長老無效"));
    }

    let celebActions = getActionsByEffect('protect').filter(a => a.metadata?.mode === 'celebrity');
    if (celebActions.length > 0) {
        let celebTarget = celebActions[0].resolved_targets[0];
        let celebSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'celebrity');
        if (celebSeat && !s.final_killed.includes(parseInt(celebSeat))) {
            s.night_actions.filter(a => ['kill', 'convert'].includes(a.effect) && a.resolved_targets.includes(celebTarget)).forEach(a => cancelAction(a.id, "名媛保護"));
        }
    }
}

function resolveInspectionDeaths() {
    let validInspects = getActionsByEffect('inspect');

    // 【標籤驅動】：被驗到會致死（如：咒狐）
    let foxInspects = validInspects.filter(a => ['seer', 'awaken_seer', 'shadow_seer'].includes(a.role));
    foxInspects.forEach(a => {
        let target = a.resolved_targets[0];
        if (s.ROLE_DICT[s.player_roles[target]]?.tags?.includes('die_when_checked')) {
            addDeathEvent(target, s.player_roles[target], `查驗致死(${s.ROLE_DICT[s.player_roles[target]].name})`);
        }
    });

    // 【標籤驅動】：反彈查驗與毒藥（如：惡靈騎士）
    let grSeats = Object.keys(s.player_roles).filter(k => s.ROLE_DICT[s.player_roles[k]]?.tags?.includes('reflect_inspection_and_poison'));
    grSeats.forEach(grSeatStr => {
        let grSeat = parseInt(grSeatStr);
        if (!s.has_ghost_rider_reflected) {
            let poisonOnGr = getActionsByEffect('poison').find(a => a.resolved_targets.includes(grSeat));
            let inspectOnGr = validInspects.find(a => a.resolved_targets.includes(grSeat));
            if (poisonOnGr || inspectOnGr) {
                let reflectedAction = [poisonOnGr, inspectOnGr].filter(Boolean).sort((a, b) => s.night_actions.indexOf(a) - s.night_actions.indexOf(b))[0];
                addDeathEvent(reflectedAction.actor, s.player_roles[grSeat], `${s.ROLE_DICT[s.player_roles[grSeat]].name}反傷`);
                s.has_ghost_rider_reflected = true;
            }
        }
    });
}

function resolveWolfKills(validProtects, pgGuards, validSaves, validDreams, idiotProtects, immuneToNightDamageTargets) {
    let awakenIdiotSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'awaken_idiot');
    getActionsByEffect('kill').forEach(killAction => {
        if (killAction.metadata?.source === 'jack_ripper') return;
        killAction.resolved_targets.forEach(target => {
            let isGuarded = validProtects.some(a => a.resolved_targets.includes(target)) || pgGuards.some(a => a.resolved_targets.includes(target));
            let isSaved = validSaves.some(a => a.resolved_targets.includes(target));
            let isDreamed = validDreams.some(a => a.resolved_targets.includes(target));
            let isIdiotProtected = idiotProtects.some(a => a.resolved_targets.includes(target)) || (awakenIdiotSeat && parseInt(awakenIdiotSeat) === target);
            let targetRole = s.player_roles[target];
            let diesToWolf = false;

            let rules = s.ROLE_DICT[targetRole] || {};

            if (isDreamed || isIdiotProtected || immuneToNightDamageTargets.includes(target)) { }
            // 【標籤驅動】：免疫狼刀
            else if (rules.tags?.includes('immune_wolf_kill') || rules.tags?.includes('immune_night_kill')) { }
            else if (getActionsByEffect('invincible').find(a => a.role === 'phantom_king') && targetRole === 'phantom_king') { }
            else if (isSaved && isGuarded) { addDeathEvent(target, 'wolf', '奶穿'); diesToWolf = true; }
            else if (!isSaved && !isGuarded) { addDeathEvent(target, killAction.metadata?.source === 'big_bad_wolf' ? 'big_bad_wolf' : 'wolf', killAction.metadata?.source === 'big_bad_wolf' ? '大野狼擊殺' : '狼刀'); diesToWolf = true; }

            // 【標籤驅動】：死亡觸發效應
            if (diesToWolf && rules.tags?.includes('trigger_pufferfish_flip')) s.is_pufferfish_triggered = true;
            if (diesToWolf && rules.tags?.includes('trigger_rust_sword_infect')) s.rust_sword_infected_target = findNearestWolf(target, -1);
        });
    });
}

function resolvePoisons(validDreams, immuneToNightDamageTargets) {
    getActionsByEffect('poison').forEach(poisonAction => {
        let target = poisonAction.resolved_targets[0];
        let targetRole = s.player_roles[target];
        let isDreamed = validDreams.some(a => a.resolved_targets.includes(target));
        let rules = s.ROLE_DICT[targetRole] || {};

        if (targetRole === 'dreamwalker' && s.player_status[target]?.isVWK) { }
        // 【標籤驅動】：免疫毒藥或夜間傷害
        else if (rules.tags?.includes('immune_poison') || rules.tags?.includes('immune_night_kill') || isDreamed || immuneToNightDamageTargets.includes(target) || (getActionsByEffect('invincible').find(a => a.role === 'phantom_king') && targetRole === 'phantom_king')) { }
        // 【標籤驅動】：以受傷代替死亡
        else if (rules.tags?.includes('injured_instead_of_death')) s.player_status[target].poisoned = true;
        else addDeathEvent(target, 'witch', '毒殺');
    });

    if (s.pandora_gift === 'poison' && s.pandora_target) {
        let pandoraRecipient = parseInt(s.pandora_target);
        let pandoraSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'pandora');
        if (pandoraSeat && parseInt(pandoraSeat) !== pandoraRecipient) {
            addDeathEvent(pandoraRecipient, 'pandora', '潘朵拉魔盒(毒)'); s.player_status[pandoraRecipient].is_pandora_poisoned = true;
        }
    }
}

function resolveReflections() {
    let medusaAction = getActionsByEffect('disable').find(a => a.metadata?.mode === 'petrify');
    if (medusaAction) {
        let medusaTarget = medusaAction.resolved_targets[0];
        let poisonAction = getActionsByEffect('poison').find(a => a.resolved_targets.includes(medusaTarget));
        if (poisonAction) {
            s.death_events = s.death_events.filter(e => !(e.seat === medusaTarget && e.reason === '毒殺'));
            addDeathEvent(poisonAction.actor, 'medusa', '梅杜莎石化反彈毒藥');
        }
    }

    let batActions = getActionsByEffect('protect').filter(a => a.metadata?.mode === 'reflect');
    if (batActions.length > 0) {
        let batTarget = batActions[0].resolved_targets[0]; let did_bat_reflect = false;
        let batGuard = getActionsByEffect('protect').find(a => a.resolved_targets.includes(batTarget) && a.role === 'guard');
        let batPoison = getActionsByEffect('poison').find(a => a.resolved_targets.includes(batTarget));
        let batInspect = getActionsByEffect('inspect').find(a => a.resolved_targets.includes(batTarget));
        let reflectedAction = [batGuard, batPoison, batInspect].filter(Boolean).sort((a, b) => s.night_actions.indexOf(a) - s.night_actions.indexOf(b))[0];
        if (reflectedAction) {
            addDeathEvent(reflectedAction.actor, 'black_bat', '黑蝙蝠庇護反彈');
            if (reflectedAction === batPoison) removeDeathEvent(batTarget);
            did_bat_reflect = true;
        }
    }

    let dmActions = getActionsByEffect('protect').filter(a => a.metadata?.mode === 'absolute_reflect');
    if (dmActions.length > 0) {
        let dmTarget = dmActions[0].resolved_targets[0]; let dmReflectVictims = [];
        let dmInspect = getActionsByEffect('inspect').find(a => a.resolved_targets.includes(dmTarget)); if (dmInspect) dmReflectVictims.push(dmInspect.actor);
        let dmPoison = getActionsByEffect('poison').find(a => a.resolved_targets.includes(dmTarget)); if (dmPoison) { dmReflectVictims.push(dmPoison.actor); removeDeathEvent(dmTarget); }
        let dmDream = getActionsByEffect('dream').find(a => a.resolved_targets.includes(dmTarget)); if (dmDream && s.prev_dream_target === dmTarget) { dmReflectVictims.push(dmDream.actor); }
        dmReflectVictims.forEach(v => { addDeathEvent(v, 'dark_messenger', '黑夜使者絕對反殺'); });
    }
}

function resolveSpecialKills(validProtects, pgGuards, validDreams, immuneToNightDamageTargets) {
    let pandoraKills = getActionsByEffect('kill').filter(a => a.metadata?.source === 'pandora');
    pandoraKills.forEach(killAction => {
        let target = killAction.resolved_targets[0];
        let isGuarded = validProtects.some(a => a.resolved_targets.includes(target)) || pgGuards.some(a => a.resolved_targets.includes(target));
        let isDreamed = validDreams.some(a => a.resolved_targets.includes(target));
        if (!isGuarded && !isDreamed && !immuneToNightDamageTargets.includes(target)) addDeathEvent(target, 'pandora', '潘朵拉魔盒(刀)');
    });

    let jrKills = getActionsByEffect('kill').filter(a => a.metadata?.source === 'jack_ripper');
    jrKills.forEach(killAction => {
        let jrTarget = killAction.resolved_targets[0];
        let isJRGuarded = validProtects.some(a => a.resolved_targets.includes(jrTarget)) || pgGuards.some(a => a.resolved_targets.includes(jrTarget));
        let isJRDreamed = validDreams.some(a => a.resolved_targets.includes(jrTarget));
        if (!isJRGuarded && !isJRDreamed && !immuneToNightDamageTargets.includes(jrTarget)) { addDeathEvent(jrTarget, 'jack_ripper', '開膛手傑克擊殺'); }
    });
}

// 結算主運算器 (Pure Logic)
export function calculateNightDeaths() {
    resolveAllTargets();
    s.is_pufferfish_triggered = false; s.did_white_cat_flip_last_night = false; s.rust_sword_infected_target = null;

    applyDisableRules();
    applyGlobalProtections();
    resolveInspectionDeaths();

    let validProtects = getActionsByEffect('protect').filter(a => a.role === 'guard' || a.role === 'lucky_boy');
    let pgGuards = getActionsByEffect('guard').concat(getActionsByEffect('guard_and_anti_theft'));
    let validSaves = getActionsByEffect('save');
    let validDreams = getActionsByEffect('dream');
    let idiotProtects = getActionsByEffect('protect').filter(a => a.role === 'awaken_idiot');
    let immuneToNightDamageTargets = [getNightTarget('dream', 'awaken_dreamwalker'), getNightTarget('protect', 'light_count'), getNightTarget('protect', 'dark_messenger')].filter(Boolean);

    resolveWolfKills(validProtects, pgGuards, validSaves, validDreams, idiotProtects, immuneToNightDamageTargets);
    resolvePoisons(validProtects, validDreams, immuneToNightDamageTargets);
    resolveSpecialKills(validProtects, pgGuards, validDreams, immuneToNightDamageTargets);
    resolveReflections();

    // 【標籤驅動】：轉移死亡 (如覺醒狼美人、蠱惑師)
    let subDeathSeats = Object.keys(s.player_roles).filter(k => s.ROLE_DICT[s.player_roles[k]]?.tags?.includes('substitute_death'));
    subDeathSeats.forEach(seat => {
        let target = getNightTarget('charm', s.player_roles[seat]);
        if (s.primary_killed.includes(parseInt(seat)) && target) {
            removeDeathEvent(parseInt(seat));
            addDeathEvent(target, 'chain', `${s.ROLE_DICT[s.player_roles[seat]].name}轉移/替代死亡`);
        }
    });

    let grayWolfSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'gray_wolf');
    if (grayWolfSeat && s.gray_wolf_stolen_player && s.player_roles[s.gray_wolf_stolen_player] === 'pleasant_goat') {
        let pgSelfProtected = getActionsByEffect('guard_and_anti_theft').some(a => a.role === 'pleasant_goat');
        if (!pgSelfProtected) {
            let actualPGSkill = getNightTarget('guard', 'pleasant_goat') ? 'guard' : (getNightTarget('anti_theft', 'pleasant_goat') ? 'anti_theft' : null);
            if (actualPGSkill !== null && s.gray_wolf_guess !== actualPGSkill) { addDeathEvent(parseInt(grayWolfSeat), 'system', '猜測喜羊羊錯誤'); }
        }
    }

    let beautySeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'wolf_beauty');
    let vwkBeautySeat = (s.vwk_seat && s.player_roles[s.vwk_seat] === 'bear') ? s.vwk_seat : null;
    [beautySeat, vwkBeautySeat].forEach(seat => {
        let bTarget = (seat === vwkBeautySeat) ? getActionsByEffect('charm').find(a => a.metadata?.is_vwk)?.resolved_targets[0] : getNightTarget('charm', 'wolf_beauty');
        if (seat && s.primary_killed.includes(parseInt(seat))) {
            let isTargetHooligan = s.ROLE_DICT[s.player_roles[bTarget]]?.tags?.includes('injured_instead_of_death');
            if (bTarget && !isTargetHooligan && !s.is_pufferfish_triggered) {
                addDeathEvent(bTarget, 'chain', '狼美人殉情');
            }
        }
    });

    if (s.merchant_target && isPlayerWolfFaction(s.player_roles[s.merchant_target])) {
        let merchSeat = Object.keys(s.player_roles).find(k => ['black_market', 'miracle_merchant'].includes(s.player_roles[k]));
        if (merchSeat && !s.primary_killed.includes(parseInt(merchSeat))) {
            addDeathEvent(parseInt(merchSeat), 'system', '給狼技能反噬');
        }
    }

    resolveFlipToSurviveImmunity();
    handleChainDeaths();
    resolveFlipToSurviveImmunity();
}

export function handleChainDeaths() {
    let initialLength = s.final_killed.length;

    let dwSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'dreamwalker');
    let vwkDreamSeat = (s.vwk_seat && s.player_roles[s.vwk_seat] === 'dreamwalker') ? s.vwk_seat : null;

    [dwSeat, vwkDreamSeat].forEach(seat => {
        let dreamTarget = null;
        if (seat == dwSeat) dreamTarget = getNightTarget('dream', 'dreamwalker');
        else if (seat == vwkDreamSeat) dreamTarget = getActionsByEffect('dream').find(a => a.metadata?.is_vwk)?.resolved_targets[0];

        if (seat && s.final_killed.includes(parseInt(seat)) && dreamTarget && !s.final_killed.includes(dreamTarget)) {
            addDeathEvent(dreamTarget, 'chain', '連帶死亡(被攝夢)');
        }
    });

    const normalizedTargets = (s.phantom_targets || []).map(Number);
    if (normalizedTargets.length === 2) {
        const [p1, p2] = normalizedTargets;
        if (s.final_killed.includes(p1) && !s.final_killed.includes(p2)) { addDeathEvent(p2, 'chain', '連帶死亡(尋香綁定)'); s.phantom_targets = []; checkSnakeWin(p1, p2); }
        else if (s.final_killed.includes(p2) && !s.final_killed.includes(p1)) { addDeathEvent(p1, 'chain', '連帶死亡(尋香綁定)'); s.phantom_targets = []; checkSnakeWin(p1, p2); }
    }

    if (s.cupid_lovers.length === 2) {
        let [p1, p2] = s.cupid_lovers;
        if (s.final_killed.includes(p1) && !s.final_killed.includes(p2)) { addDeathEvent(p2, 'chain', '連帶死亡(情侶殉情)'); s.cupid_lovers = []; }
        else if (s.final_killed.includes(p2) && !s.final_killed.includes(p1)) { addDeathEvent(p1, 'chain', '連帶死亡(情侶殉情)'); s.cupid_lovers = []; }
    }

    if (s.ghost_bride_groom && s.ghost_bride_witness) {
        let gbKey = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'ghost_bride');
        if (gbKey) {
            let gSeat = parseInt(gbKey);
            if (s.final_killed.includes(gSeat) && !s.final_killed.includes(s.ghost_bride_groom)) { addDeathEvent(s.ghost_bride_groom, 'chain', '連帶死亡(新郎殉情)'); }
            else if (s.final_killed.includes(s.ghost_bride_groom) && !s.final_killed.includes(gSeat)) { addDeathEvent(gSeat, 'chain', '連帶死亡(新郎死亡)'); }
        }
    }

    let adSeat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'awaken_dreamwalker'));
    let awkDreamwalkerTarget = getNightTarget('dream', 'awaken_dreamwalker');
    if (adSeat && s.final_killed.includes(adSeat) && awkDreamwalkerTarget && !s.final_killed.includes(awkDreamwalkerTarget)) {
        addDeathEvent(awkDreamwalkerTarget, 'chain', '連帶死亡(被覺醒攝夢)');
    }

    let celebKey = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'celebrity');
    let celebTarget = getActionsByEffect('protect').find(a => a.metadata?.mode === 'celebrity')?.resolved_targets[0];
    let isCelebInfected = celebKey ? s.player_status[celebKey]?.isConvertedWolf : false;
    if (celebKey && (s.final_killed.includes(parseInt(celebKey)) || isCelebInfected) && celebTarget && !s.final_killed.includes(celebTarget)) {
        if (!s.ROLE_DICT[s.player_roles[celebTarget]]?.tags?.includes('immune_wolf_kill')) {
            addDeathEvent(celebTarget, 'chain', '連帶死亡(名媛殉情)');
        }
    }

    let medusaKey = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'medusa');
    let medusaTarget = getActionsByEffect('disable').find(a => a.metadata?.mode === 'petrify')?.resolved_targets[0];
    if (medusaKey && s.final_killed.includes(parseInt(medusaKey)) && medusaTarget && !s.final_killed.includes(medusaTarget)) {
        addDeathEvent(medusaTarget, 'chain', '連帶死亡(梅杜莎石化)');
    }

    if (s.final_killed.length > initialLength) {
        handleChainDeaths();
    }
}

export function killPlayerDuringDay(seat, isShot = false, canShoot = true, source = 'day', isVote = false) {
    seat = parseInt(seat);
    if (!seat || s.final_killed.includes(seat)) return;
    let role = s.player_roles[seat];
    let rules = s.ROLE_DICT[role] || {};

    // 【標籤驅動】：受傷代替死亡
    if (isShot && rules.tags?.includes('injured_instead_of_death')) {
        if (!s.player_status[seat]) s.player_status[seat] = {};
        s.player_status[seat].injured = true;
        return;
    }

    // 【標籤驅動】：免疫白天槍殺
    if (isShot && rules.tags?.includes('immune_gun')) return;

    // 【標籤驅動】：翻牌免死
    if (rules.tags?.includes('flip_to_survive') && !s.player_status[seat]?.isWhiteCatFlipped) {
        if (!s.player_status[seat]) s.player_status[seat] = {};
        s.player_status[seat].isWhiteCatFlipped = true;
        return;
    }

    // 【標籤驅動】：替代死亡
    let awkBeautyTarget = getNightTarget('charm', 'awaken_wolf_beauty');
    if (rules.tags?.includes('substitute_death') && awkBeautyTarget && !s.final_killed.includes(awkBeautyTarget)) {
        killPlayerDuringDay(awkBeautyTarget, false, false, 'chain');
        return;
    }

    addDeathEvent(seat, source, isShot ? "被開槍帶走" : (isVote ? "放逐投票出局" : "連帶死亡"));

    if (canShoot) {
        let pgAntiTheft = getNightTarget('anti_theft', 'pleasant_goat') || getNightTarget('guard_and_anti_theft', 'pleasant_goat');
        let isStolen = (s.gray_wolf_stolen_player === seat && s.gray_wolf_stolen_player !== pgAntiTheft);

        if ((isShot && (rules.tags?.includes('shoot_on_death') || (role === 'hunter' && s.player_status[seat]?.isVWK) || s.awk_wolf_gun_target === seat || s.evil_merchant_gun_target === seat)) || (!isShot && source === 'vote' && (s.player_status[seat]?.hasPandoraDayGun || s.player_status[seat]?.hasSuperBlackMarketGun))) {
            if (!(role === 'hunter' && isStolen)) {
                s.day_shooters_queue.push({ seat, role: !isShot && source === 'vote' ? 'pandora_day_gun' : role });
                if (role === 'awaken_wolf_king' && s.awk_wolf_gun_target === null) s.day_shooters_queue.push({ seat, role });
            }
        }
    }

    let vwkBeautySeat = (s.vwk_seat && s.player_roles[s.vwk_seat] === 'bear') ? s.vwk_seat : null;
    let bTarget = getNightTarget('charm', 'wolf_beauty');
    if ((role === 'wolf_beauty' || seat === vwkBeautySeat) && bTarget && !s.ROLE_DICT[s.player_roles[bTarget]]?.tags?.includes('injured_instead_of_death') && !s.final_killed.includes(bTarget) && !s.is_pufferfish_triggered) {
        killPlayerDuringDay(bTarget, false, false, 'chain');
    }

    let vwkDreamSeat = (s.vwk_seat && s.player_roles[s.vwk_seat] === 'dreamwalker') ? s.vwk_seat : null;
    let dreamTarget = getNightTarget('dream', 'dreamwalker');
    if ((role === 'dreamwalker' || seat === vwkDreamSeat) && dreamTarget && !s.final_killed.includes(dreamTarget)) {
        killPlayerDuringDay(dreamTarget, false, false, 'chain');
    }

    if ((s.phantom_targets || []).map(Number).length === 2) {
        const normalizedTargets = (s.phantom_targets || []).map(Number);
        const currentSeat = Number(seat);
        if (normalizedTargets.includes(currentSeat)) {
            const [t1, t2] = normalizedTargets;
            const other = t1 === currentSeat ? t2 : t1;
            if (!s.final_killed.includes(other)) {
                s.phantom_targets = [];
                killPlayerDuringDay(other, false, false, 'chain');
                checkSnakeWin(currentSeat, other);
            }
        }
    }

    if (s.cupid_lovers.includes(seat)) {
        let other = s.cupid_lovers[0] === seat ? s.cupid_lovers[1] : s.cupid_lovers[0];
        if (!s.final_killed.includes(other)) {
            s.cupid_lovers = [];
            killPlayerDuringDay(other, false, false, 'chain');
        }
    }

    if (s.ghost_bride_groom && s.ghost_bride_witness) {
        let gSeat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'ghost_bride'));
        if (seat === gSeat && !s.final_killed.includes(s.ghost_bride_groom)) killPlayerDuringDay(s.ghost_bride_groom, false, false, 'chain');
        else if (seat === s.ghost_bride_groom && !s.final_killed.includes(gSeat)) killPlayerDuringDay(gSeat, false, false, 'chain');
    }

    let adSeat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'awaken_dreamwalker'));
    let awkDreamwalkerTarget = getNightTarget('dream', 'awaken_dreamwalker');
    if (seat === adSeat && awkDreamwalkerTarget && !s.final_killed.includes(awkDreamwalkerTarget)) {
        killPlayerDuringDay(awkDreamwalkerTarget, false, false, 'chain');
    }
}

export function generateDayReport() {
    if (s.rust_sword_infected_target && !s.final_killed.includes(s.rust_sword_infected_target)) { addDeathEvent(s.rust_sword_infected_target, 'system', '鏽劍感染死亡'); }

    let tonight_deaths = s.death_events.filter(e => e.source !== 'vote').map(e => e.seat);
    let report = { bearRoarText: "", extraText: "", isPeaceful: tonight_deaths.length === 0, killedSeats: [], shootersQueue: [], isSnakeWin: s.is_snake_win };

    // 【標籤驅動】：熊的咆哮
    let bearSeat = Object.keys(s.player_roles).find(k => s.ROLE_DICT[s.player_roles[k]]?.tags?.includes('has_roar_mechanic') || s.player_status[k]?.convertedFromRole === 'bear');
    const isSeatWolfForBear = (seatId) => {
        if (!seatId || s.final_killed.includes(seatId)) return false;
        return isPlayerEvil(seatId);
    };
    const getAdjacent = (seat) => {
        let left = seat - 1; while (left !== seat) { if (left < 1) left = s.total_players; if (!s.final_killed.includes(left)) break; left--; }
        let right = seat + 1; while (right !== seat) { if (right > s.total_players) right = 1; if (!s.final_killed.includes(right)) break; right++; }
        return { left, right };
    };

    let bearDidRoar = false;
    if (bearSeat && !s.final_killed.includes(parseInt(bearSeat))) {
        if (s.seed_wolf_target !== parseInt(bearSeat)) {
            let { left, right } = getAdjacent(parseInt(bearSeat)); let hasWolf = isSeatWolfForBear(left) || isSeatWolfForBear(right);
            if (s.player_status[bearSeat]?.isVWK) { let vwkCharm = getActionsByEffect('charm').find(a => a.metadata?.is_vwk)?.resolved_targets[0]; if (vwkCharm) hasWolf = isSeatWolfForBear(vwkCharm); hasWolf = !hasWolf; }
            if (hasWolf) bearDidRoar = true;
        }
    }
    if (bearSeat) {
        if (s.sleeping_beauty_seat && s.is_sleeping_beauty_active && bearSeat && parseInt(bearSeat) === s.sleeping_beauty_seat) bearDidRoar = false;
        report.bearRoarText = bearDidRoar ? "🐻 熊咆哮了！<br><br>" : "🐻 熊沒有咆哮。<br><br>";
    }

    // 【標籤驅動】：月靈狼
    let moonWolfSeat = Object.keys(s.player_roles).find(k => s.ROLE_DICT[s.player_roles[k]]?.tags?.includes('has_moon_roar_mechanic'));
    if (moonWolfSeat && !s.final_killed.includes(parseInt(moonWolfSeat))) {
        report.bearRoarText += s.moon_wolf_roar ? "🐺🌙 月靈狼嗥叫了！<br><br>" : "🐺🌙 月靈狼沒有嗥叫。<br><br>";
    }

    // 【標籤驅動】：翻牌免死公告
    if (s.did_white_cat_flip_last_night) {
        let flipSeats = Object.keys(s.player_roles).filter(k => s.ROLE_DICT[s.player_roles[k]]?.tags?.includes('flip_to_survive'));
        flipSeats.forEach(wcSeat => {
            report.extraText += `<span style="color:#00ff88;">🐱 ${wcSeat} 號玩家 (${s.ROLE_DICT[s.player_roles[wcSeat]].name}) 發動技能免死一次！</span><br><br>`;
        });
    }

    if (s.is_pufferfish_triggered) {
        let pfSeat = Object.keys(s.player_roles).find(k => s.ROLE_DICT[s.player_roles[k]]?.tags?.includes('trigger_pufferfish_flip'));
        let hasWolfBeauty = Object.values(s.player_roles).includes('wolf_beauty') || Object.values(s.player_roles).includes('awaken_wolf_beauty');
        if (hasWolfBeauty) report.extraText += `<span style="color:#fca311;">🐡 ${pfSeat} 號 (河豚) 死亡！狼美人技能今日失效！</span><br><br>`;
        else report.extraText += `<span style="color:#fca311;">🐡 ${pfSeat} 號 (河豚) 死亡！</span><br><br>`;
        s.beauty_target = null;
    }

    // 【標籤驅動】：首日白天公開身份
    let hvSeat = Object.keys(s.player_roles).find(k => s.ROLE_DICT[s.player_roles[k]]?.tags?.includes('announce_role_on_day_one'));
    if (hvSeat && s.seed_wolf_target !== parseInt(hvSeat)) report.extraText += `<span style="color:#fca311;">👑 高級平民是 ${hvSeat} 號玩家！</span><br><br>`;

    if (!report.isPeaceful) {
        report.killedSeats = [...tonight_deaths].sort((a, b) => a - b);
        s.death_events.forEach(e => {
            let seat = e.seat;
            let role = s.player_roles[seat];
            if (['狼刀', '被開槍帶走', '奶穿', '大野狼擊殺'].includes(e.reason) && canPlayerShoot(seat, role)) {
                s.day_shooters_queue.push({ seat, role });
                if (role === 'awaken_wolf_king' && s.awk_wolf_gun_target === null) s.day_shooters_queue.push({ seat, role });
            }
        });
    }
    report.shootersQueue = s.day_shooters_queue;
    return report;
}

export { proceedDayResultRender, processNextShooter, showDayResult } from './main.js';