// js/day.js
import { s, wolf_faction, wolf_team_roles, evil_roles, findNearestWolf, getActionsByEffect, cancelAction, resolveAllTargets, getNightTarget, getNightTargets } from './core.js';
import { triggerTricksterVoteSection } from './vote.js';

function checkSnakeWin(dead1, dead2) {
    let r1 = s.player_roles[dead1]; let r2 = s.player_roles[dead2];
    if ((r1 === 'snake_phantom' && r2 === 'snake_seer') || (r1 === 'snake_seer' && r2 === 'snake_phantom')) s.is_snake_win = true;
}

export function calculateNightDeaths() {
    resolveAllTargets();
    s.primary_killed = []; s.chain_killed = []; s.final_killed = [];
    s.is_pufferfish_triggered = false; s.did_white_cat_flip_last_night = false; s.rust_sword_infected_target = null;

    let witchSeat = Object.keys(s.player_roles).find(k => ['witch', 'awaken_witch'].includes(s.player_roles[k]));
    let seerSeat = Object.keys(s.player_roles).find(k => ['seer', 'shadow_seer', 'awaken_seer', 'psychic', 'pure_white', 'wolf_witch', 'fool_seer', 'snake_seer'].includes(s.player_roles[k]));
    let guardSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'guard');
    let dwSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'dreamwalker');
    let awakenIdiotSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'awaken_idiot');
    let grSeat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'ghost_rider')) || null;

    // 1.5 搗蛋鬼耍寶
    let troubleActions = getActionsByEffect('trouble');
    if (troubleActions.length > 0) {
        let tSeat = troubleActions[0].resolved_targets[0];
        s.night_actions.forEach(a => { if (a.actor === tSeat || (a.actor === 'wolves' && wolf_team_roles.includes(s.player_roles[tSeat]))) { if (['protect', 'poison', 'inspect', 'kill'].includes(a.effect)) { a.resolved_targets = [tSeat]; } } });
    }

    // 1.6 梅杜莎石化
    let medusaActions = getActionsByEffect('disable').filter(a => a.metadata?.mode === 'petrify');
    if (medusaActions.length > 0) {
        let mTarget = medusaActions[0].resolved_targets[0];
        s.night_actions.filter(a => a.actor === mTarget).forEach(a => cancelAction(a.id, "被梅杜莎石化"));
    }

    // 2. 恐懼與冰凍
    let fearActions = getActionsByEffect('disable').filter(a => a.metadata?.mode === 'fear');
    if (fearActions.length > 0) {
        let fTarget = fearActions[0].resolved_targets[0];
        if (wolf_team_roles.includes(s.player_roles[fTarget])) s.night_actions.filter(a => a.effect === 'kill' && a.actor === 'wolves').forEach(a => cancelAction(a.id, "狼隊因恐懼無法刀人"));
        else s.night_actions.filter(a => a.actor === fTarget).forEach(a => cancelAction(a.id, "被夢魘恐懼"));
    }
    let freezeActions = getActionsByEffect('disable').filter(a => a.metadata?.mode === 'freeze');
    if (freezeActions.length > 0) {
        let fTarget = freezeActions[0].resolved_targets[0];
        if (wolf_team_roles.includes(s.player_roles[fTarget])) s.night_actions.filter(a => a.effect === 'kill' && a.actor === 'wolves').forEach(a => cancelAction(a.id, "狼隊因冰凍無法刀人"));
        else s.night_actions.filter(a => a.actor === fTarget).forEach(a => cancelAction(a.id, "被企鵝冰凍"));
    }

    // 2.5 睡美人
    if (s.sleeping_beauty_seat && s.is_sleeping_beauty_active) {
        let sb = s.sleeping_beauty_seat; let sbRole = s.player_roles[sb];
        if (['witch', 'awaken_witch'].includes(sbRole)) s.night_actions.filter(a => a.actor === sb && a.effect === 'poison').forEach(a => cancelAction(a.id, "睡美人女巫無法用毒"));
        if (wolf_team_roles.includes(sbRole)) {
            let alive_wolves = Object.keys(s.player_roles).filter(k => wolf_team_roles.includes(s.player_roles[k]));
            if (alive_wolves.every(k => parseInt(k) === sb)) s.night_actions.filter(a => a.effect === 'kill' && a.actor === 'wolves').forEach(a => cancelAction(a.id, "狼隊全體沉睡"));
        }
        if (sbRole === 'silence_elder') s.night_actions.filter(a => a.effect === 'silence').forEach(a => cancelAction(a.id, "睡美人禁言長老無效"));
    }

    // 名媛保護
    let celebActions = getActionsByEffect('protect').filter(a => a.metadata?.mode === 'celebrity');
    if (celebActions.length > 0) {
        let celebTarget = celebActions[0].resolved_targets[0];
        let celebSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'celebrity');
        if (celebSeat && !s.primary_killed.includes(parseInt(celebSeat))) s.night_actions.filter(a => a.effect === 'kill' && a.resolved_targets.includes(celebTarget)).forEach(a => cancelAction(a.id, "名媛保護"));
    }

    let validKills = getActionsByEffect('kill');
    let validPoisons = getActionsByEffect('poison');
    let validSaves = getActionsByEffect('save');
    let validProtects = getActionsByEffect('protect').filter(a => a.role === 'guard' || a.role === 'lucky_boy');
    let pgGuards = getActionsByEffect('guard').concat(getActionsByEffect('guard_and_anti_theft'));
    let validInspects = getActionsByEffect('inspect');
    let validDreams = getActionsByEffect('dream');

    // 3. 惡靈騎士與咒狐
    let foxInspects = validInspects.filter(a => ['seer', 'awaken_seer', 'shadow_seer'].includes(a.role) && s.player_roles[a.resolved_targets[0]] === 'curse_fox');
    foxInspects.forEach(a => { if (!s.primary_killed.includes(a.resolved_targets[0])) s.primary_killed.push(a.resolved_targets[0]); });

    if (grSeat && !s.has_ghost_rider_reflected) {
        let poisonOnGr = validPoisons.find(a => a.resolved_targets.includes(grSeat));
        if (poisonOnGr) { s.primary_killed.push(poisonOnGr.actor); s.player_status[poisonOnGr.actor].deathReason = "惡靈騎士反傷(毒)"; s.has_ghost_rider_reflected = true; } 
        else { let inspectOnGr = validInspects.find(a => a.resolved_targets.includes(grSeat)); if (inspectOnGr) { s.primary_killed.push(inspectOnGr.actor); s.player_status[inspectOnGr.actor].deathReason = "惡靈騎士反傷(驗)"; s.has_ghost_rider_reflected = true; } }
    }

    // 4. 覺醒白痴
    let idiotProtects = getActionsByEffect('protect').filter(a => a.role === 'awaken_idiot');
    let immuneToNightDamageTargets = [getNightTarget('dream', 'awaken_dreamwalker'), getNightTarget('protect', 'light_count')].filter(Boolean); // dark_messenger immune checked separately

    // 5. 狼刀結算
    validKills.forEach(killAction => {
        if (killAction.metadata?.source === 'jack_ripper') return;
        killAction.resolved_targets.forEach(target => {
            let isGuarded = validProtects.some(a => a.resolved_targets.includes(target)) || pgGuards.some(a => a.resolved_targets.includes(target));
            let isSaved = validSaves.some(a => a.resolved_targets.includes(target));
            let isDreamed = validDreams.some(a => a.resolved_targets.includes(target));
            let isIdiotProtected = idiotProtects.some(a => a.resolved_targets.includes(target)) || (awakenIdiotSeat && parseInt(awakenIdiotSeat) === target);
            let targetRole = s.player_roles[target]; let diesToWolf = false;

            if (['ghost_rider', 'curse_fox'].includes(targetRole) || isDreamed || isIdiotProtected || immuneToNightDamageTargets.includes(target)) { } 
            else if (targetRole === 'war_wolf' || targetRole === 'demon') { } 
            else if (getActionsByEffect('invincible').find(a => a.role === 'phantom_king') && targetRole === 'phantom_king') { } 
            else if (isSaved && isGuarded) { s.primary_killed.push(target); diesToWolf = true; s.player_status[target].deathReason = "奶穿"; } 
            else if (!isSaved && !isGuarded) { s.primary_killed.push(target); diesToWolf = true; s.player_status[target].deathReason = killAction.metadata?.source === 'big_bad_wolf' ? "大野狼擊殺" : "狼刀"; }

            if (diesToWolf && targetRole === 'pufferfish') s.is_pufferfish_triggered = true;
            if (diesToWolf && targetRole === 'rust_sword_knight') s.rust_sword_infected_target = findNearestWolf(target, -1);
        });
    });

    // 6. 女巫毒藥結算
    validPoisons.forEach(poisonAction => {
        let target = poisonAction.resolved_targets[0]; let targetRole = s.player_roles[target];
        let isDreamed = validDreams.some(a => a.resolved_targets.includes(target));

        if (targetRole === 'dreamwalker' && s.player_status[target]?.isVWK) {}
        else if (['ghost_rider', 'demon_hunter', 'dancer', 'mask_wolf'].includes(targetRole) || isDreamed || immuneToNightDamageTargets.includes(target) || (getActionsByEffect('invincible').find(a=>a.role==='phantom_king') && targetRole === 'phantom_king')) {}
        else if (['war_wolf', 'demon'].includes(targetRole)) {}
        else if (targetRole === 'old_hooligan') s.player_status[target].poisoned = true;
        else if (!s.primary_killed.includes(target)) { s.primary_killed.push(target); s.player_status[target].deathReason = "毒殺"; }
    });

    // 6.4 開膛手傑克
    let jrKills = validKills.filter(a => a.metadata?.source === 'jack_ripper');
    jrKills.forEach(killAction => {
        let jrTarget = killAction.resolved_targets[0];
        let isJRGuarded = validProtects.some(a => a.resolved_targets.includes(jrTarget)) || pgGuards.some(a => a.resolved_targets.includes(jrTarget));
        let isJRDreamed = validDreams.some(a => a.resolved_targets.includes(jrTarget));
        if (!isJRGuarded && !isJRDreamed && !immuneToNightDamageTargets.includes(jrTarget) && !s.primary_killed.includes(jrTarget)) { s.primary_killed.push(jrTarget); s.player_status[jrTarget].deathReason = "開膛手傑克擊$2$"; }
    });

    // 6.45 潘朵拉(毒)
    if (s.pandora_gift === 'poison' && s.pandora_target) {
        let pandoraRecipient = parseInt(s.pandora_target);
        let pandoraSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'pandora');
        if (pandoraSeat && parseInt(pandoraSeat) !== pandoraRecipient) {
            if (!s.primary_killed.includes(pandoraRecipient)) { s.primary_killed.push(pandoraRecipient); s.player_status[pandoraRecipient].deathReason = "潘朵拉魔盒(毒)"; s.player_status[pandoraRecipient].is_pandora_poisoned = true; }
        }
    }

    // 6.5 黑蝙蝠
    let batActions = getActionsByEffect('protect').filter(a => a.metadata?.mode === 'reflect');
    if (batActions.length > 0) {
        let batTarget = batActions[0].resolved_targets[0]; let did_bat_reflect = false;
        let batGuard = validProtects.find(a => a.resolved_targets.includes(batTarget));
        if (batGuard) { if (!s.primary_killed.includes(batGuard.actor)) { s.primary_killed.push(batGuard.actor); s.player_status[batGuard.actor].deathReason = "黑蝙蝠庇護反彈"; did_bat_reflect = true; } }
        let batPoison = validPoisons.find(a => a.resolved_targets.includes(batTarget));
        if (batPoison && !did_bat_reflect) { if (!s.primary_killed.includes(batPoison.actor)) { s.primary_killed.push(batPoison.actor); s.player_status[batPoison.actor].deathReason = "黑蝙蝠庇護反彈"; did_bat_reflect = true; } s.primary_killed = s.primary_killed.filter(k => k !== batTarget); }
        let batInspect = validInspects.find(a => a.resolved_targets.includes(batTarget));
        if (batInspect && !did_bat_reflect) { if (!s.primary_killed.includes(batInspect.actor)) { s.primary_killed.push(batInspect.actor); s.player_status[batInspect.actor].deathReason = "黑蝙蝠庇護反彈"; did_bat_reflect = true; } }
    }

    // 6.6 黑夜使者
    let dmActions = getActionsByEffect('protect').filter(a => a.metadata?.mode === 'absolute_reflect');
    if (dmActions.length > 0) {
        let dmTarget = dmActions[0].resolved_targets[0]; let dmReflectVictims = [];
        let dmInspect = validInspects.find(a => a.resolved_targets.includes(dmTarget)); if (dmInspect) dmReflectVictims.push(dmInspect.actor);
        let dmPoison = validPoisons.find(a => a.resolved_targets.includes(dmTarget)); if (dmPoison) { dmReflectVictims.push(dmPoison.actor); s.primary_killed = s.primary_killed.filter(k => k !== dmTarget); }
        let dmDream = validDreams.find(a => a.resolved_targets.includes(dmTarget)); if (dmDream && s.prev_dream_target === dmTarget) { dmReflectVictims.push(dmDream.actor); }
        dmReflectVictims.forEach(v => { if (!s.primary_killed.includes(v)) { s.primary_killed.push(v); s.player_status[v].deathReason = "黑夜使者絕對反殺"; } });
    }

    // 7. 覺醒狼美人轉移
    let awbSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'awaken_wolf_beauty');
    let awkBeautyTarget = getNightTarget('charm', 'awaken_wolf_beauty');
    if (awbSeat && s.primary_killed.includes(parseInt(awbSeat)) && awkBeautyTarget) {
        s.primary_killed = s.primary_killed.filter(k => k !== parseInt(awbSeat));
        if (!s.primary_killed.includes(awkBeautyTarget)) s.chain_killed.push(awkBeautyTarget);
        // (在下個夜晚會把 action 清除所以不需要手動設 null)
    }

    // 8. 灰太狼猜錯
    let grayWolfSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'gray_wolf');
    if (grayWolfSeat && s.gray_wolf_stolen_player && s.player_roles[s.gray_wolf_stolen_player] === 'pleasant_goat') {
        let pgSelfProtected = getActionsByEffect('guard_and_anti_theft').some(a => a.role === 'pleasant_goat');
        if (!pgSelfProtected) {
            let actualPGSkill = getNightTarget('guard', 'pleasant_goat') ? 'guard' : (getNightTarget('anti_theft', 'pleasant_goat') ? 'anti_theft' : null);
            if (actualPGSkill !== null && s.gray_wolf_guess !== actualPGSkill) { if (!s.primary_killed.includes(parseInt(grayWolfSeat))) { s.primary_killed.push(parseInt(grayWolfSeat)); s.player_status[grayWolfSeat].deathReason = "猜測喜羊羊錯誤"; } }
        }
    }

    s.final_killed = [...s.primary_killed, ...s.chain_killed]; handleChainDeaths();

    // 8.5 獵魔人
    let demonHunterTarget = getNightTarget('hunt', 'demon_hunter');
    if (demonHunterTarget) {
        let dhSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'demon_hunter');
        let targetRole = s.player_roles[demonHunterTarget];
        let isTargetEvil = wolf_faction.includes(targetRole); if (targetRole === 'war_wolf') isTargetEvil = false;
        if (isTargetEvil) { if (!s.final_killed.includes(demonHunterTarget)) { s.primary_killed.push(demonHunterTarget); s.final_killed.push(demonHunterTarget); s.player_status[demonHunterTarget].deathReason = "獵魔人狩獵"; } } 
        else if (dhSeat) { if (!s.final_killed.includes(parseInt(dhSeat))) { s.primary_killed.push(parseInt(dhSeat)); s.final_killed.push(parseInt(dhSeat)); s.player_status[dhSeat].deathReason = "狩獵好人反噬"; } }
    }

    // 8.6 蠱惑師
    let charmerSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'charmer');
    let charmerTarget = getNightTarget('charm', 'charmer');
    if (charmerSeat && s.final_killed.includes(parseInt(charmerSeat)) && charmerTarget) {
        s.primary_killed = s.primary_killed.filter(k => k !== parseInt(charmerSeat)); s.final_killed = s.final_killed.filter(k => k !== parseInt(charmerSeat));
        if (!s.final_killed.includes(charmerTarget)) { s.chain_killed.push(charmerTarget); s.final_killed.push(charmerTarget); s.player_status[charmerTarget].deathReason = "蠱惑師死亡替代"; }
        handleChainDeaths();
    }

    // 9. 狼美人殉情
    let beautySeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'wolf_beauty');
    let vwkBeautySeat = (s.vwk_seat && s.player_roles[s.vwk_seat] === 'bear') ? s.vwk_seat : null;
    [beautySeat, vwkBeautySeat].forEach(seat => {
        let wasBeautyPoisoned = validPoisons.some(a => a.resolved_targets.includes(parseInt(seat)));
        let bTarget = (seat === vwkBeautySeat) ? getActionsByEffect('charm').find(a=>a.metadata?.is_vwk)?.resolved_targets[0] : getNightTarget('charm', 'wolf_beauty');
        if (seat && s.final_killed.includes(parseInt(seat)) && !wasBeautyPoisoned) {
            if (bTarget && s.player_roles[bTarget] !== 'old_hooligan' && !s.final_killed.includes(bTarget) && !s.is_pufferfish_triggered) {
                s.chain_killed.push(bTarget); s.final_killed = [...s.primary_killed, ...s.chain_killed]; handleChainDeaths();
            }
        }
    });

    // 10. 白貓
    let wcSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'white_cat');
    if (wcSeat && s.final_killed.includes(parseInt(wcSeat)) && !s.player_status[wcSeat].isWhiteCatFlipped) {
        s.primary_killed = s.primary_killed.filter(k => k !== parseInt(wcSeat)); s.chain_killed = s.chain_killed.filter(k => k !== parseInt(wcSeat)); s.final_killed = s.final_killed.filter(k => k !== parseInt(wcSeat));
        s.player_status[wcSeat].isWhiteCatFlipped = true; s.did_white_cat_flip_last_night = true;
    }

    // 11. 商人反噬
    if (s.merchant_target && evil_roles.includes(s.player_roles[s.merchant_target])) {
        let merchSeat = Object.keys(s.player_roles).find(k => ['black_market', 'miracle_merchant'].includes(s.player_roles[k]));
        if (merchSeat && !s.final_killed.includes(parseInt(merchSeat))) {
            s.primary_killed.push(parseInt(merchSeat)); s.final_killed.push(parseInt(merchSeat));
            s.player_status[parseInt(merchSeat)].deathReason = "給狼技能反噬";
        }
    }
}

export function handleChainDeaths() {
    let changed = false;
    let dwSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'dreamwalker');
    let vwkDreamSeat = (s.vwk_seat && s.player_roles[s.vwk_seat] === 'dreamwalker') ? s.vwk_seat : null;
    let dreamTarget = getNightTarget('dream', 'dreamwalker');

    [dwSeat, vwkDreamSeat].forEach(seat => {
        if (seat && s.final_killed.includes(parseInt(seat)) && dreamTarget && !s.final_killed.includes(dreamTarget)) {
            s.chain_killed.push(dreamTarget); s.final_killed.push(dreamTarget); changed = true; s.player_status[dreamTarget].deathReason = "連帶死亡(被攝夢)";
        }
    });

    const normalizedTargets = (s.phantom_targets || []).map(Number);
    if (normalizedTargets.length === 2) {
        const [p1, p2] = normalizedTargets;
        if (s.final_killed.includes(p1) && !s.final_killed.includes(p2)) { s.chain_killed.push(p2); s.final_killed.push(p2); s.phantom_targets = []; s.player_status[p2].deathReason = "連帶死亡(尋香綁定)"; changed = true; checkSnakeWin(p1, p2); } 
        else if (s.final_killed.includes(p2) && !s.final_killed.includes(p1)) { s.chain_killed.push(p1); s.final_killed.push(p1); s.phantom_targets = []; s.player_status[p1].deathReason = "連帶死亡(尋香綁定)"; changed = true; checkSnakeWin(p1, p2); }
    }

    if (s.cupid_lovers.length === 2) {
        let [p1, p2] = s.cupid_lovers;
        if (s.final_killed.includes(p1) && !s.final_killed.includes(p2)) { s.chain_killed.push(p2); s.final_killed.push(p2); s.cupid_lovers = []; s.player_status[p2].deathReason = "連帶死亡(情侶殉情)"; changed = true; } 
        else if (s.final_killed.includes(p2) && !s.final_killed.includes(p1)) { s.chain_killed.push(p1); s.final_killed.push(p1); s.cupid_lovers = []; s.player_status[p1].deathReason = "連帶死亡(情侶殉情)"; changed = true; }
    }

    if (s.ghost_bride_groom && s.ghost_bride_witness) {
        let gSeat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'ghost_bride'));
        if (s.final_killed.includes(gSeat) && !s.final_killed.includes(s.ghost_bride_groom)) { s.chain_killed.push(s.ghost_bride_groom); s.final_killed.push(s.ghost_bride_groom); s.player_status[s.ghost_bride_groom].deathReason = "連帶死亡(新郎殉情)"; changed = true; } 
        else if (s.final_killed.includes(s.ghost_bride_groom) && !s.final_killed.includes(gSeat)) { s.chain_killed.push(gSeat); s.final_killed.push(gSeat); s.player_status[gSeat].deathReason = "連帶死亡(新郎死亡)"; changed = true; }
    }

    let adSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'awaken_dreamwalker');
    let awkDreamwalkerTarget = getNightTarget('dream', 'awaken_dreamwalker');
    if (adSeat && s.final_killed.includes(parseInt(adSeat)) && awkDreamwalkerTarget && !s.final_killed.includes(awkDreamwalkerTarget)) {
        s.chain_killed.push(awkDreamwalkerTarget); s.final_killed.push(awkDreamwalkerTarget); s.player_status[awkDreamwalkerTarget].deathReason = "連帶死亡(夢語者)"; changed = true;
    }

    let celebSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'celebrity');
    let celebTarget = getActionsByEffect('protect').find(a=>a.metadata?.mode==='celebrity')?.resolved_targets[0];
    if (celebSeat && s.final_killed.includes(parseInt(celebSeat)) && celebTarget && !s.final_killed.includes(celebTarget)) {
        if (s.player_roles[celebTarget] !== 'war_wolf') { s.chain_killed.push(celebTarget); s.final_killed.push(celebTarget); s.player_status[celebTarget].deathReason = "連帶死亡(名媛殉情)"; changed = true; }
    }

    let medusaSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'medusa');
    let medusaTarget = getActionsByEffect('disable').find(a=>a.metadata?.mode==='petrify')?.resolved_targets[0];
    if (medusaSeat && s.final_killed.includes(parseInt(medusaSeat)) && medusaTarget && !s.final_killed.includes(medusaTarget)) {
        s.chain_killed.push(medusaTarget); s.final_killed.push(medusaTarget); s.player_status[medusaTarget].deathReason = "連帶死亡(梅杜莎石化)"; changed = true;
    }

    if (changed) handleChainDeaths();
}

export function proceedDayResultRender() {
    if (s.rust_sword_infected_target && !s.final_killed.includes(s.rust_sword_infected_target)) { s.final_killed.push(s.rust_sword_infected_target); s.player_status[s.rust_sword_infected_target].deathReason = "鏽劍感染死亡"; }

    let crowTarget = getNightTarget('curse_vote', 'crow');
    if (crowTarget) document.getElementById('btn-show-crow').classList.remove('hidden');

    let bearRoarText = ""; let bearSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'bear'); let mwSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'machine_wolf');

    const isSeatWolfForBear = (seatId) => {
        if (!seatId || s.final_killed.includes(seatId)) return false; let role = s.player_roles[seatId];
        if (role === 'machine_wolf' && s.machine_wolf_learn_target) { let learnedRole = s.player_roles[s.machine_wolf_learn_target]; if (!evil_roles.includes(learnedRole)) return false; }
        if (role === 'treasure_master' && s.is_treasure_hunter_evil) return true;
        return evil_roles.includes(role);
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
            if (s.player_status[bearSeat]?.isVWK) { let vwkCharm = getActionsByEffect('charm').find(a=>a.metadata?.is_vwk)?.resolved_targets[0]; if (vwkCharm) hasWolf = isSeatWolfForBear(vwkCharm); hasWolf = !hasWolf; }
            if (hasWolf) bearDidRoar = true;
        }
    }
    if (mwSeat && !s.final_killed.includes(parseInt(mwSeat)) && s.machine_wolf_learn_target && s.player_roles[s.machine_wolf_learn_target] === 'bear') {
        let { left, right } = getAdjacent(parseInt(mwSeat)); if (isSeatWolfForBear(left) || isSeatWolfForBear(right)) bearDidRoar = true;
    }
    if (bearSeat || (mwSeat && s.machine_wolf_learn_target && s.player_roles[s.machine_wolf_learn_target] === 'bear')) {
        if (s.sleeping_beauty_seat && s.is_sleeping_beauty_active && bearSeat && parseInt(bearSeat) === s.sleeping_beauty_seat) bearDidRoar = false;
        bearRoarText = bearDidRoar ? "🐻 熊咆哮了！<br><br>" : "🐻 熊沒有咆哮。<br><br>";
    }

    let moonWolfSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'moon_wolf');
    if (moonWolfSeat && !s.final_killed.includes(parseInt(moonWolfSeat))) {
        let { left, right } = getAdjacent(parseInt(moonWolfSeat));
        const godRoles = ['seer','witch','hunter','guard','dreamwalker','awaken_dreamwalker','awaken_idiot','crow','knight','demon_hunter','magician','alchemist','psychic','pure_white','awaken_seer','awaken_witch','awaken_hunter','bear','pufferfish','white_cat','celebrity','penguin','charmer'];
        let hasGod = godRoles.includes(s.player_roles[left]) || godRoles.includes(s.player_roles[right]);
        bearRoarText += hasGod ? "🐺🌙 月靈狼嗥叫了！<br><br>" : "🐺🌙 月靈狼沒有嗥叫。<br><br>";
    }

    let extraText = "";
    if (s.did_white_cat_flip_last_night) {
        let wcSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'white_cat'); extraText += `<span style="color:#00ff88;">🐱 ${wcSeat} 號玩家是白貓，發動技能免死一次！</span><br><br>`;
    }
    if (s.is_pufferfish_triggered) {
        let pfSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'pufferfish');
        let hasWolfBeauty = Object.values(s.player_roles).includes('wolf_beauty') || Object.values(s.player_roles).includes('awaken_wolf_beauty');
        if (hasWolfBeauty) extraText += `<span style="color:#fca311;">🐡 ${pfSeat} 號 (河豚) 死亡！狼美人技能今日失效！</span><br><br>`;
        else extraText += `<span style="color:#fca311;">🐡 ${pfSeat} 號 (河豚) 死亡！</span><br><br>`;
    }
    let hvSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'high_villager');
    if (hvSeat && s.seed_wolf_target !== parseInt(hvSeat)) extraText += `<span style="color:#fca311;">👑 高級平民是 ${hvSeat} 號玩家！</span><br><br>`;

    let htmlOutput = bearRoarText + extraText;
    if (s.final_killed.length === 0) { htmlOutput += "<span style='color:#00ff88;'>🎉 昨晚是平安夜，沒有人死亡！</span>"; } 
    else {
        s.final_killed.sort((a, b) => a - b);
        htmlOutput += `<span style='color:#e94560;'>💀 昨晚死亡的是：${s.final_killed.join(' 號、')} 號</span>`;
        if (s.is_snake_win) htmlOutput += `<br><br><span style="color:#ff00ff; font-size:28px;">🎉 千年之戀達成！<br>許仙與白蛇雙雙殉情，直接獲勝！</span>`;

        s.day_shooters_queue = [];
        let nightmareTarget = getNightTarget('disable', 'nightmare');
        let witchPoisonTarget = getActionsByEffect('poison').find(a=>['witch','awaken_witch'].includes(a.role))?.resolved_targets[0];
        
        s.final_killed.forEach(seat => {
            let role = s.player_roles[seat];
            if (s.primary_killed.includes(seat)) {
                let pgAntiTheft = getActionsByEffect('anti_theft').find(a=>a.role==='pleasant_goat')?.resolved_targets[0] || getActionsByEffect('guard_and_anti_theft').find(a=>a.role==='pleasant_goat')?.resolved_targets[0];
                let isStolen = (s.gray_wolf_stolen_player === seat && s.gray_wolf_stolen_player !== pgAntiTheft);

                if (role === 'awaken_hunter' || (role === 'hunter' && s.player_status[seat].isVWK)) {
                    if (nightmareTarget !== seat && !isStolen) s.day_shooters_queue.push({ seat, role });
                } else if (['hunter', 'wolf_king', 'awaken_wolf_king'].includes(role) || s.awk_wolf_gun_target === seat || s.evil_merchant_gun_target === seat) {
                    let is_sleeping = s.sleeping_beauty_seat && s.is_sleeping_beauty_active && seat === s.sleeping_beauty_seat;
                    if (witchPoisonTarget !== seat && nightmareTarget !== seat && !(role === 'hunter' && isStolen) && !is_sleeping) {
                        s.day_shooters_queue.push({ seat, role });
                        if (role === 'awaken_wolf_king' && s.awk_wolf_gun_target === null) s.day_shooters_queue.push({ seat, role });
                    }
                }

                if (role === 'gray_wolf' && s.gray_wolf_stolen_skill === 'hunter') {
                    if (witchPoisonTarget !== seat && nightmareTarget !== seat) s.day_shooters_queue.push({ seat, role: 'hunter' });
                }
            }
        });
    }

    if (s.speech_order_text) htmlOutput += `<br><br><span style="color:#51c9c1; font-size: 20px;">🗣️ 發言順序：<br>${s.speech_order_text}</span>`;
    document.getElementById('day-result').innerHTML = htmlOutput;
    if (s.day_shooters_queue.length > 0) processNextShooter(); else triggerTricksterVoteSection();
}

export function killPlayerDuringDay(seat, isShot = false, canShoot = true) {
    if (s.final_killed.includes(seat)) return; let role = s.player_roles[seat];

    if (isShot && role === 'old_hooligan') { s.player_status[seat].injured = true; return; }
    if (isShot && role === 'ghost_rider') return;
    if (role === 'white_cat' && !s.player_status[seat].isWhiteCatFlipped) { s.player_status[seat].isWhiteCatFlipped = true; return; }

    let awkBeautyTarget = getNightTarget('charm', 'awaken_wolf_beauty');
    if (role === 'awaken_wolf_beauty' && awkBeautyTarget && !s.final_killed.includes(awkBeautyTarget)) {
        killPlayerDuringDay(awkBeautyTarget, false, false);
        return; // 注意：原邏輯中這裡不會讓自己死，但需確認是否真的不自死
    }

    s.final_killed.push(seat); s.player_status[seat].deathReason = isShot ? "被開槍帶走" : "連帶死亡";

    if (canShoot) {
        let pgAntiTheft = getNightTarget('anti_theft', 'pleasant_goat') || getNightTarget('guard_and_anti_theft', 'pleasant_goat');
        let isStolen = (s.gray_wolf_stolen_player === seat && s.gray_wolf_stolen_player !== pgAntiTheft);

        if (role === 'awaken_hunter' || (role === 'hunter' && s.player_status[seat].isVWK) || ['hunter', 'wolf_king', 'awaken_wolf_king'].includes(role) || s.awk_wolf_gun_target === seat || s.evil_merchant_gun_target === seat) {
            if (!(role === 'hunter' && isStolen)) { s.day_shooters_queue.push({ seat, role }); if (role === 'awaken_wolf_king' && s.awk_wolf_gun_target === null) s.day_shooters_queue.push({ seat, role }); }
        }
        if (role === 'gray_wolf' && s.gray_wolf_stolen_skill === 'hunter') s.day_shooters_queue.push({ seat, role: 'hunter' });
    }

    let vwkBeautySeat = (s.vwk_seat && s.player_roles[s.vwk_seat] === 'bear') ? s.vwk_seat : null;
    let bTarget = getNightTarget('charm', 'wolf_beauty');
    if ((role === 'wolf_beauty' || seat === vwkBeautySeat) && bTarget && s.player_roles[bTarget] !== 'old_hooligan' && !s.final_killed.includes(bTarget) && !s.is_pufferfish_triggered) {
        killPlayerDuringDay(bTarget, false, false);
    }
    let vwkDreamSeat = (s.vwk_seat && s.player_roles[s.vwk_seat] === 'dreamwalker') ? s.vwk_seat : null;
    let dreamTarget = getNightTarget('dream', 'dreamwalker');
    if ((role === 'dreamwalker' || seat === vwkDreamSeat) && dreamTarget && !s.final_killed.includes(dreamTarget)) killPlayerDuringDay(dreamTarget, false, false);
    
    if ((s.phantom_targets || []).map(Number).length === 2) {
        const normalizedTargets = (s.phantom_targets || []).map(Number); const currentSeat = Number(seat);
        if (normalizedTargets.includes(currentSeat)) {
            const [t1, t2] = normalizedTargets; const other = t1 === currentSeat ? t2 : t1;
            if (!s.final_killed.includes(other)) { s.phantom_targets = []; killPlayerDuringDay(other, false, false); checkSnakeWin(currentSeat, other); }
        }
    }
    if (s.cupid_lovers.includes(seat)) { let other = s.cupid_lovers[0] === seat ? s.cupid_lovers[1] : s.cupid_lovers[0]; if (!s.final_killed.includes(other)) { s.cupid_lovers = []; killPlayerDuringDay(other, false, false); } }
    if (s.ghost_bride_groom && s.ghost_bride_witness) {
        let gSeat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'ghost_bride'));
        if (seat === gSeat && !s.final_killed.includes(s.ghost_bride_groom)) killPlayerDuringDay(s.ghost_bride_groom, false, false);
        else if (seat === s.ghost_bride_groom && !s.final_killed.includes(gSeat)) killPlayerDuringDay(gSeat, false, false);
    }
    let adSeat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'awaken_dreamwalker'));
    let awkDreamwalkerTarget = getNightTarget('dream', 'awaken_dreamwalker');
    if (seat === adSeat && awkDreamwalkerTarget && !s.final_killed.includes(awkDreamwalkerTarget)) killPlayerDuringDay(awkDreamwalkerTarget, false, false);
}

export function processNextShooter() {
    if (s.day_shooters_queue.length === 0) { document.getElementById('day-skill-section').classList.add('hidden'); triggerTricksterVoteSection(); return; }

    document.getElementById('btn-reset').classList.add('hidden');
    const currentShooter = s.day_shooters_queue[0];
    const section = document.getElementById('day-skill-section');
    section.classList.remove('hidden');
    document.getElementById('day-skill-notice').textContent = `🎯 【 ${currentShooter.seat} 號 】玩家，請問是否發動技能？`;
    let pad = document.getElementById('day-skill-pad'); pad.innerHTML = '';

    const finishShooterTurn = () => {
        s.final_killed.sort((a, b) => a - b);
        let dayResultStr = `<span style='color:#e94560;'>💀 本局目前死亡名單：${s.final_killed.join(' 號、')} 號</span>` + (s.speech_order_text ? `<br><br><span style="color:#51c9c1;">🗣️ ${s.speech_order_text}</span>` : "");
        if (s.is_snake_win) dayResultStr += `<br><br><span style="color:#ff00ff; font-size:28px;">🎉 千年之戀達成！<br>許仙與白蛇雙雙殉情，直接獲勝！</span>`;
        document.getElementById('day-result').innerHTML = dayResultStr;
        s.day_shooters_queue.shift(); processNextShooter();
    };

    if (currentShooter.role === 'awaken_hunter') {
        pad.innerHTML = `<button class="num-btn" id="btn-hunter-asc" style="grid-column: span 2; font-size: 18px;">順序 (號碼遞增)</button><button class="num-btn" id="btn-hunter-desc" style="grid-column: span 2; font-size: 18px;">逆序 (號碼遞減)</button>`;
        document.getElementById('btn-hunter-asc').onclick = () => { let t = findNearestWolf(currentShooter.seat, 1); if (t) killPlayerDuringDay(t, true); finishShooterTurn(); };
        document.getElementById('btn-hunter-desc').onclick = () => { let t = findNearestWolf(currentShooter.seat, -1); if (t) killPlayerDuringDay(t, true); finishShooterTurn(); };
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
    document.getElementById('btn-day-skill-confirm').onclick = () => { document.getElementById('btn-day-skill-confirm').classList.add('hidden'); killPlayerDuringDay(selectedDayTarget, true); finishShooterTurn(); };
}