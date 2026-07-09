import { s, wolfFaction, evilRoles, findNearestWolf } from './core.js';

export function calculateNightDeaths() {
    // 1. 初始化死亡判定與狀態清單
    s.primaryKilled = []; s.chainKilled = []; s.finalKilled = [];
    s.pufferfishTriggered = false; 
    s.whiteCatFlippedLastNight = false; 
    s.rustSwordInfectedTarget = null;

    // 定位關鍵角色
    let witchSeat = Object.keys(s.playerRoles).find(k => ['witch', 'awaken_witch'].includes(s.playerRoles[k]));
    let seerSeat = Object.keys(s.playerRoles).find(k => ['seer', 'shadow_seer', 'awaken_seer', 'psychic', 'pure_white', 'wolf_witch', 'diviner'].includes(s.playerRoles[k]));
    let guardSeat = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'guard');
    let dwSeat = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'dreamwalker');
    let awakenIdiotSeat = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'awaken_idiot');
    let grSeat = parseInt(Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'ghost_rider')) || null;

    // 2. 確認夢魘恐懼影響
    let isWolfFeared = s.nightmareTarget && wolfFaction.includes(s.playerRoles[s.nightmareTarget]);
    let actualWolfKill = isWolfFeared ? null : s.wolfKillTarget;
    
    let actualWitchPoison = s.witchPoisonTarget;
    if (witchSeat && parseInt(witchSeat) === s.nightmareTarget) { actualWitchPoison = null; s.witchSaved = false; }
    
    let actualSeerTarget = s.seerTarget;
    if (seerSeat && parseInt(seerSeat) === s.nightmareTarget) actualSeerTarget = null;

    let actualGuard = (guardSeat && parseInt(guardSeat) === s.nightmareTarget) ? null : s.guardTarget;
    let actualDream = (dwSeat && parseInt(dwSeat) === s.nightmareTarget) ? null : s.dreamTarget;

    // 3. 處理惡靈騎士反傷與咒狐暴斃
    if (actualSeerTarget && s.playerRoles[parseInt(actualSeerTarget)] === 'curse_fox') {
        if (!s.primaryKilled.includes(parseInt(actualSeerTarget))) s.primaryKilled.push(parseInt(actualSeerTarget));
    }
    if (grSeat && !s.ghostRiderReflected) {
        if (actualWitchPoison === grSeat && witchSeat) { s.primaryKilled.push(parseInt(witchSeat)); s.ghostRiderReflected = true; }
        else if (actualSeerTarget === grSeat && !s.ghostRiderReflected && seerSeat) { s.primaryKilled.push(parseInt(seerSeat)); s.ghostRiderReflected = true; }
    }

    // 4. 判斷覺醒白痴保護狀態
    let isIdiotProtected = false;
    if (s.awakenIdiotTarget && (actualWolfKill === s.awakenIdiotTarget || s.bigBadWolfKillTarget === s.awakenIdiotTarget)) isIdiotProtected = true;
    else if (awakenIdiotSeat && (actualWolfKill === parseInt(awakenIdiotSeat) || s.bigBadWolfKillTarget === parseInt(awakenIdiotSeat))) isIdiotProtected = true;

    // 5. 處理狼刀及大野狼刀的護盾/攝夢結算
    let immuneToNightDamageTargets = [s.awakenDreamwalkerTarget];
    let killList = [actualWolfKill, s.bigBadWolfKillTarget].filter(Boolean).map(x => parseInt(x));

    killList.forEach(target => {
        let isGuarded = (actualGuard === target);
        let isSaved = (target === parseInt(actualWolfKill) && s.witchSaved);
        let isDreamed = (actualDream === target);
        let targetRole = s.playerRoles[target];
        let diesToWolf = false;

        if (['ghost_rider', 'curse_fox'].includes(targetRole) || isDreamed || isIdiotProtected || immuneToNightDamageTargets.includes(target)) { 
            // 免疫致死
        } else if (isSaved && isGuarded) {
            s.primaryKilled.push(target);
            diesToWolf = true;
            s.playerStatus[target].deathReason = "奶穿";
        } else if (!isSaved && !isGuarded) {
            s.primaryKilled.push(target);
            diesToWolf = true;
            s.playerStatus[target].deathReason = (s.bigBadWolfKillTarget === target) ? "大野狼擊殺" : "狼刀";
        }

        // 特殊角色受刀連動
        if (diesToWolf && targetRole === 'pufferfish') s.pufferfishTriggered = true;
        if (diesToWolf && targetRole === 'rust_sword_knight') s.rustSwordInfectedTarget = findNearestWolf(target, -1);
    });

    // 6. 處理女巫毒藥結算
    if (actualWitchPoison) {
        let target = parseInt(actualWitchPoison);
        let targetRole = s.playerRoles[target];
        if (targetRole === 'dreamwalker' && s.playerStatus[target].isVWK) { /* 百變狼王攝夢免疫 */ }
        else if (['ghost_rider', 'demon_hunter', 'dancer', 'mask_wolf'].includes(targetRole) || actualDream === target || immuneToNightDamageTargets.includes(target)) { }
        else if (targetRole === 'old_hooligan') s.playerStatus[target].poisoned = true;
        else if (!s.primaryKilled.includes(target)) {
            s.primaryKilled.push(target);
            s.playerStatus[target].deathReason = "毒殺";
        }
    }

    // 7. 覺醒狼美人魅惑轉移邏輯
    let awbSeat = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'awaken_wolf_beauty');
    if (awbSeat && s.primaryKilled.includes(parseInt(awbSeat)) && s.awakenBeautyTarget) {
        s.primaryKilled = s.primaryKilled.filter(k => k !== parseInt(awbSeat)); // 自身免死
        if (!s.primaryKilled.includes(s.awakenBeautyTarget)) s.chainKilled.push(s.awakenBeautyTarget);
        s.awakenBeautyTarget = null;
    }

    // 更新最終死亡清單，並結算連帶死亡 (攝夢、情侶等)
    s.finalKilled = [...s.primaryKilled, ...s.chainKilled];
    handleChainDeaths();

    // 8. 結算狼美人魅惑死
    let beautySeat = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'wolf_beauty');
    let vwkBeautySeat = (s.vwkSeat && s.playerRoles[s.vwkSeat] === 'bear') ? s.vwkSeat : null;

    [beautySeat, vwkBeautySeat].forEach(seat => {
        if (seat && s.finalKilled.includes(parseInt(seat)) && actualWitchPoison !== parseInt(seat)) {
            if (s.beautyTarget && s.playerRoles[s.beautyTarget] !== 'old_hooligan' && !s.finalKilled.includes(s.beautyTarget) && !s.pufferfishTriggered) {
                s.chainKilled.push(s.beautyTarget); 
                s.finalKilled = [...s.primaryKilled, ...s.chainKilled]; 
                handleChainDeaths();
            }
        }
    });

    // 9. 結算白貓翻牌免死
    let wcSeat = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'white_cat');
    if (wcSeat && s.finalKilled.includes(parseInt(wcSeat)) && !s.playerStatus[wcSeat].isWhiteCatFlipped) {
        s.primaryKilled = s.primaryKilled.filter(k => k !== parseInt(wcSeat));
        s.chainKilled = s.chainKilled.filter(k => k !== parseInt(wcSeat));
        s.finalKilled = s.finalKilled.filter(k => k !== parseInt(wcSeat));
        s.playerStatus[wcSeat].isWhiteCatFlipped = true; 
        s.whiteCatFlippedLastNight = true;
    }

    // 10. 商人反噬機制
    if (s.merchantTarget && wolfFaction.includes(s.playerRoles[s.merchantTarget])) {
        let merchSeat = Object.keys(s.playerRoles).find(k => ['black_market', 'miracle_merchant'].includes(s.playerRoles[k]));
        if (merchSeat && !s.finalKilled.includes(parseInt(merchSeat))) {
            s.primaryKilled.push(parseInt(merchSeat)); s.finalKilled.push(parseInt(merchSeat));
            s.playerStatus[parseInt(merchSeat)].deathReason = "給狼技能反噬";
        }
    }
}

/**
 * 遞迴處理連帶死亡鏈 (Chain Deaths)
 * 當有任何連帶關係人死亡時，觸發相關鏈結者殉情或死亡，並持續遞迴檢查直到沒有新死亡為止
 */
export function handleChainDeaths() {
    let changed = false;
    
    // 取得原生攝夢人與百變狼王(攝夢人)的座位
    let dwSeat = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'dreamwalker');
    let vwkDreamSeat = (s.vwkSeat && s.playerRoles[s.vwkSeat] === 'dreamwalker') ? s.vwkSeat : null;

    // 1. 檢查 攝夢人/夢語者 連帶死亡
    [dwSeat, vwkDreamSeat].forEach(seat => {
        if (seat && s.finalKilled.includes(parseInt(seat)) && s.dreamTarget && !s.finalKilled.includes(s.dreamTarget)) {
            s.chainKilled.push(s.dreamTarget); 
            s.finalKilled.push(s.dreamTarget); 
            changed = true;
            s.playerStatus[s.dreamTarget].deathReason = "連帶死亡(被攝夢)";
        }
    });

    // 2. 檢查 尋香魅影 綁定連帶死亡 (雙生結算)
    if (s.phantomTargets.length === 2) {
        let [p1, p2] = s.phantomTargets;
        if (s.finalKilled.includes(p1) && !s.finalKilled.includes(p2)) { 
            s.chainKilled.push(p2); s.finalKilled.push(p2); s.phantomTargets = []; 
            s.playerStatus[p2].deathReason = "連帶死亡(尋香綁定)"; changed = true; 
        }
        else if (s.finalKilled.includes(p2) && !s.finalKilled.includes(p1)) { 
            s.chainKilled.push(p1); s.finalKilled.push(p1); s.phantomTargets = []; 
            s.playerStatus[p1].deathReason = "連帶死亡(尋香綁定)"; changed = true; 
        }
    }

    // 3. 檢查 邱比特 情侶連帶死亡 (殉情)
    if (s.cupidLovers.length === 2) {
        let [p1, p2] = s.cupidLovers;
        if (s.finalKilled.includes(p1) && !s.finalKilled.includes(p2)) { 
            s.chainKilled.push(p2); s.finalKilled.push(p2); s.cupidLovers = []; 
            s.playerStatus[p2].deathReason = "連帶死亡(情侶殉情)"; changed = true; 
        }
        else if (s.finalKilled.includes(p2) && !s.finalKilled.includes(p1)) { 
            s.chainKilled.push(p1); s.finalKilled.push(p1); s.cupidLovers = []; 
            s.playerStatus[p1].deathReason = "連帶死亡(情侶殉情)"; changed = true; 
        }
    }

    // 4. 檢查 鬼魅新娘 夫妻連帶死亡
    if (s.ghostBrideGroom && s.ghostBrideWitness) {
        let gSeat = parseInt(Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'ghost_bride'));
        if (s.finalKilled.includes(gSeat) && !s.finalKilled.includes(s.ghostBrideGroom)) { 
            s.chainKilled.push(s.ghostBrideGroom); s.finalKilled.push(s.ghostBrideGroom); 
            s.playerStatus[s.ghostBrideGroom].deathReason = "連帶死亡(新郎殉情)"; changed = true; 
        }
        else if (s.finalKilled.includes(s.ghostBrideGroom) && !s.finalKilled.includes(gSeat)) { 
            s.chainKilled.push(gSeat); s.finalKilled.push(gSeat); 
            s.playerStatus[gSeat].deathReason = "連帶死亡(新郎死亡)"; changed = true; 
        }
    }

    // 5. 檢查 覺醒攝夢人 (夢語者) 連帶死亡
    let adSeat = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'awaken_dreamwalker');
    if (adSeat && s.finalKilled.includes(parseInt(adSeat)) && s.awakenDreamwalkerTarget && !s.finalKilled.includes(s.awakenDreamwalkerTarget)) {
        s.chainKilled.push(s.awakenDreamwalkerTarget); 
        s.finalKilled.push(s.awakenDreamwalkerTarget); 
        s.playerStatus[s.awakenDreamwalkerTarget].deathReason = "連帶死亡(夢語者)"; 
        changed = true;
    }

    // 如果本輪有新的連帶死亡者，則繼續遞迴檢查，直到狀態完全穩定
    if (changed) handleChainDeaths();
}

/**
 * 渲染與計算天亮後的白天資訊 (包含熊咆哮、特殊免死、死亡名單、開槍佇列)
 */
export function proceedDayResultRender() {
    if (s.crowTarget) document.getElementById('btn-show-crow').classList.remove('hidden');
    
    let bearRoarText = "";
    let bearSeat = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'bear');
    let mwSeat = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'machine_wolf');

    // 內部輔助函式：判定某座位在熊眼中是否算作狼人 (學到好人技能的機械狼不視為狼)
    const isSeatWolfForBear = (seatId) => {
        if (!seatId || s.finalKilled.includes(seatId)) return false;
        let role = s.playerRoles[seatId];
        if (role === 'machine_wolf' && s.machineWolfTarget) {
            let learnedRole = s.playerRoles[s.machineWolfTarget];
            if (!evilRoles.includes(learnedRole)) return false; 
        }
        return wolfFaction.includes(role);
    };

    // 內部輔助函式：獲取某玩家在活人環形隊伍中的左右鄰居
    const getAdjacent = (seat) => {
        let left = seat - 1; 
        while (left !== seat) { 
            if (left < 1) left = s.totalPlayers; 
            if (!s.finalKilled.includes(left)) break; 
            left--; 
        }
        let right = seat + 1; 
        while (right !== seat) { 
            if (right > s.totalPlayers) right = 1; 
            if (!s.finalKilled.includes(right)) break; 
            right++; 
        }
        return { left, right };
    };

    let bearDidRoar = false;

    // 1. 檢查原生熊是否咆哮 (若被種狼感染則不咆哮)
    if (bearSeat && !s.finalKilled.includes(parseInt(bearSeat))) {
        if (s.seedWolfTarget !== parseInt(bearSeat)) {
            let { left, right } = getAdjacent(parseInt(bearSeat));
            let hasWolf = isSeatWolfForBear(left) || isSeatWolfForBear(right);
            
            // 如果這隻熊其實是「百變狼王」假冒的，且發動了魅惑，咆哮結果顛倒
            if (s.playerStatus[bearSeat]?.isVWK) {
                if (s.vwkCharmTarget) hasWolf = isSeatWolfForBear(s.vwkCharmTarget);
                hasWolf = !hasWolf;
            }
            if (hasWolf) bearDidRoar = true;
        }
    }

    // 2. 檢查學了熊技能的機械狼是否引發咆哮
    if (mwSeat && !s.finalKilled.includes(parseInt(mwSeat)) && s.machineWolfTarget && s.playerRoles[s.machineWolfTarget] === 'bear') {
        let { left, right } = getAdjacent(parseInt(mwSeat));
        if (isSeatWolfForBear(left) || isSeatWolfForBear(right)) bearDidRoar = true;
    }

    // 組裝熊咆哮文字
    if (bearSeat || (mwSeat && s.machineWolfTarget && s.playerRoles[s.machineWolfTarget] === 'bear')) {
        bearRoarText = bearDidRoar ? "🐻 熊咆哮了！<br><br>" : "🐻 熊沒有咆哮。<br><br>";
    }

    // 3. 處理其餘特殊白天提示文字 (白貓、河豚、高級平民)
    let extraText = "";
    if (s.whiteCatFlippedLastNight) {
        let wcSeat = Object.keys(s.playerRoles).find(k => k === 'white_cat');
        extraText += `<span style="color:#00ff88;">🐱 ${wcSeat} 號玩家是白貓，發動技能免死一次！</span><br><br>`;
    }
    if (s.pufferfishTriggered) {
        let pfSeat = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'pufferfish');
        let hasWolfBeauty = Object.values(s.playerRoles).includes('wolf_beauty') || Object.values(s.playerRoles).includes('awaken_wolf_beauty');
        if (hasWolfBeauty) {
            extraText += `<span style="color:#fca311;">🐡 ${pfSeat} 號 (河豚) 死亡！狼美人技能今日失效！</span><br><br>`;
        } else {
            extraText += `<span style="color:#fca311;">🐡 ${pfSeat} 號 (河豚) 死亡！</span><br><br>`;
        }
        s.beautyTarget = null; 
    }
    let hvSeat = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'high_villager');
    if (hvSeat && s.seedWolfTarget !== parseInt(hvSeat)) {
        extraText += `<span style="color:#fca311;">👑 高級平民是 ${hvSeat} 號玩家！</span><br><br>`;
    }

    let htmlOutput = bearRoarText + extraText;
    
    // 4. 輸出昨晚死訊
    if (s.finalKilled.length === 0) {
        htmlOutput += "<span style='color:#00ff88;'>🎉 昨晚是平安夜，沒有人死亡！</span>";
    } else {
        s.finalKilled.sort((a, b) => a - b);
        htmlOutput += `<span style='color:#e94560;'>💀 昨晚死亡的是：${s.finalKilled.join(' 號、')} 號</span>`;

        // 5. 建立夜晚死者的白天技能/開槍佇列 (排查毒殺、恐懼等無法開槍之狀態)
        s.dayShootersQueue = [];
        s.finalKilled.forEach(seat => {
            let role = s.playerRoles[seat];
            if (s.primaryKilled.includes(seat)) {
                if (role === 'awaken_hunter' || (role === 'hunter' && s.playerStatus[seat].isVWK)) {
                    if (s.nightmareTarget !== seat) s.dayShootersQueue.push({ seat, role });
                } else if (['hunter', 'wolf_king', 'awaken_wolf_king'].includes(role) || s.awakenWolfGunTarget === seat) {
                    if (s.witchPoisonTarget !== seat && s.nightmareTarget !== seat) {
                        s.dayShootersQueue.push({ seat, role });
                        // 覺醒狼王若自己保留雙槍，會塞入兩次開槍機會
                        if (role === 'awaken_wolf_king' && s.awakenWolfGunTarget === null) s.dayShootersQueue.push({ seat, role });
                    }
                }
            }
        });
    }

    // 附加發言順序
    if (s.speechOrderText) {
        htmlOutput += `<br><br><span style="color:#51c9c1; font-size: 20px;">🗣️ 發言順序：<br>${s.speechOrderText}</span>`;
    }

    document.getElementById('day-result').innerHTML = htmlOutput;

    // 觸發後續流程：有槍先開槍，沒槍進詭術師換票或結束
    if (s.dayShootersQueue.length > 0) processNextShooter();
    else triggerTricksterVoteSection();
}

/**
 * 處理玩家在白天期間的死亡 (如因開槍擊殺、投票放逐或因連帶關係暴斃)
 */
export function killPlayerDuringDay(seat, isShot = false, canShoot = true) {
    if (s.finalKilled.includes(seat)) return;
    let role = s.playerRoles[seat];
    
    // 特殊防禦機制
    if (isShot && role === 'old_hooligan') { s.playerStatus[seat].injured = true; return; } // 老流氓中槍負傷不死
    if (isShot && role === 'ghost_rider') return; // 惡靈騎士白天中槍不死
    if (role === 'white_cat' && !s.playerStatus[seat].isWhiteCatFlipped) { s.playerStatus[seat].isWhiteCatFlipped = true; return; } // 白貓翻牌免死

    // 覺醒狼美人白天死亡時，若有魅惑目標，轉移死亡並令自己免死
    if (role === 'awaken_wolf_beauty' && s.awakenBeautyTarget && !s.finalKilled.includes(s.awakenBeautyTarget)) {
        let subTarget = s.awakenBeautyTarget; s.awakenBeautyTarget = null;
        killPlayerDuringDay(subTarget, false, false); 
        return;
    }

    s.finalKilled.push(seat);
    s.playerStatus[seat].deathReason = isShot ? "白天開槍/技能擊殺" : "連帶死亡(情侶/魅惑/尋香/夢語者)";

    // 如果允許開槍，且死亡者具備翻牌開槍技能，塞入開槍佇列
    if (canShoot) {
        if (role === 'awaken_hunter' || (role === 'hunter' && s.playerStatus[seat].isVWK) || ['hunter', 'wolf_king', 'awaken_wolf_king'].includes(role) || s.awakenWolfGunTarget === seat) {
            s.dayShootersQueue.push({ seat, role });
            if (role === 'awaken_wolf_king' && s.awakenWolfGunTarget === null) s.dayShootersQueue.push({ seat, role });
        }
    }

    // 白天連帶死亡即時觸發 (狼美人、攝夢人、尋香、情侶、新郎、覺醒攝夢)
    let vwkBeautySeat = (s.vwkSeat && s.playerRoles[s.vwkSeat] === 'bear') ? s.vwkSeat : null;
    if ((role === 'wolf_beauty' || seat === vwkBeautySeat) && s.beautyTarget && s.playerRoles[s.beautyTarget] !== 'old_hooligan' && !s.finalKilled.includes(s.beautyTarget) && !s.pufferfishTriggered) {
        killPlayerDuringDay(s.beautyTarget, false, false);
    }
    let vwkDreamSeat = (s.vwkSeat && s.playerRoles[s.vwkSeat] === 'dreamwalker') ? s.vwkSeat : null;
    if ((role === 'dreamwalker' || seat === vwkDreamSeat) && s.dreamTarget && !s.finalKilled.includes(s.dreamTarget)) {
        killPlayerDuringDay(s.dreamTarget, false, false);
    }
    if (s.phantomTargets.includes(seat)) {
        let other = s.phantomTargets[0] === seat ? s.phantomTargets[1] : s.phantomTargets[0];
        if (!s.finalKilled.includes(other)) { s.phantomTargets = []; killPlayerDuringDay(other, false, false); }
    }
    if (s.cupidLovers.includes(seat)) {
        let other = s.cupidLovers[0] === seat ? s.cupidLovers[1] : s.cupidLovers[0];
        if (!s.finalKilled.includes(other)) { s.cupidLovers = []; killPlayerDuringDay(other, false, false); }
    }
    if (s.ghostBrideGroom && s.ghostBrideWitness) {
        let gSeat = parseInt(Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'ghost_bride'));
        if (seat === gSeat && !s.finalKilled.includes(s.ghostBrideGroom)) killPlayerDuringDay(s.ghostBrideGroom, false, false);
        else if (seat === s.ghostBrideGroom && !s.finalKilled.includes(gSeat)) killPlayerDuringDay(gSeat, false, false);
    }
    let adSeat = parseInt(Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'awaken_dreamwalker'));
    if (seat === adSeat && s.awakenDreamwalkerTarget && !s.finalKilled.includes(s.awakenDreamwalkerTarget)) {
        killPlayerDuringDay(s.awakenDreamwalkerTarget, false, false);
    }
}

/**
 * 處理開槍/技能發動隊列 (處理白天多個角色同時開槍或技能排隊)
 */
export function processNextShooter() {
    if (s.dayShootersQueue.length === 0) {
        document.getElementById('day-skill-section').classList.add('hidden');
        triggerTricksterVoteSection(); 
        return;
    }
    
    document.getElementById('btn-reset').classList.add('hidden');
    const currentShooter = s.dayShootersQueue[0];
    const section = document.getElementById('day-skill-section');
    section.classList.remove('hidden');
    document.getElementById('day-skill-notice').textContent = `🎯 【 ${currentShooter.seat} 號 】玩家，請問是否發動技能？`;

    let pad = document.getElementById('day-skill-pad'); 
    pad.innerHTML = '';

    // 白天技能結算完畢後的共用回調
    const finishShooterTurn = () => {
        s.finalKilled.sort((a, b) => a - b);
        let dayResultStr = `<span style='color:#e94560;'>💀 本局目前死亡名單：${s.finalKilled.join(' 號、')} 號</span>` + (s.speechOrderText ? `<br><br><span style="color:#51c9c1;">🗣️ ${s.speechOrderText}</span>` : "");
        document.getElementById('day-result').innerHTML = dayResultStr;
        s.dayShootersQueue.shift(); 
        processNextShooter(); // 遞迴呼叫下一位
    };

    // 針對「覺醒獵人」特殊開槍規則 (自動追蹤擊殺最近的狼人，分為順序與逆序)
    if (currentShooter.role === 'awaken_hunter') {
        pad.innerHTML = `
            <button class="num-btn" id="btn-hunter-asc" style="grid-column: span 2; font-size: 18px;">順序 (號碼遞增)</button>
            <button class="num-btn" id="btn-hunter-desc" style="grid-column: span 2; font-size: 18px;">逆序 (號碼遞減)</button>
        `;
        document.getElementById('btn-hunter-asc').onclick = () => { let t = findNearestWolf(currentShooter.seat, 1); if (t) killPlayerDuringDay(t, true); finishShooterTurn(); };
        document.getElementById('btn-hunter-desc').onclick = () => { let t = findNearestWolf(currentShooter.seat, -1); if (t) killPlayerDuringDay(t, true); finishShooterTurn(); };
        document.getElementById('btn-day-skill-skip').onclick = finishShooterTurn;
        document.getElementById('btn-day-skill-confirm').classList.add('hidden');
        return;
    }

    // 一般獵人/狼王/獲槍者的開槍目標盤
    let selectedDayTarget = null;
    for (let i = 1; i <= s.totalPlayers; i++) {
        const btn = document.createElement('button');
        btn.classList.add('num-btn'); btn.textContent = i;
        if (s.finalKilled.includes(i)) { 
            btn.disabled = true; btn.style.opacity = '0.3'; btn.style.cursor = 'not-allowed'; 
        } else {
            btn.onclick = () => {
                document.querySelectorAll('#day-skill-pad .num-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected'); 
                selectedDayTarget = i; 
                document.getElementById('btn-day-skill-confirm').classList.remove('hidden');
            };
        }
        pad.appendChild(btn);
    }
    document.getElementById('btn-day-skill-skip').onclick = finishShooterTurn;
    document.getElementById('btn-day-skill-confirm').onclick = () => {
        document.getElementById('btn-day-skill-confirm').classList.add('hidden'); 
        killPlayerDuringDay(selectedDayTarget, true); 
        finishShooterTurn();
    };
}

/**
 * 觸發並注入白天投票階段的「詭術師換票結算控制面板」
 */
export function triggerTricksterVoteSection() {
    const dayResultContent = document.getElementById('day-result-content');
    const btnReset = document.getElementById('btn-reset');
    
    // 如果本局有詭術師，且面板尚未建立，則建立換票結果計算器
    if (Object.values(s.playerRoles).includes('trickster') && document.getElementById('trickster-calc') === null) {
        let tricksterDiv = document.createElement('div'); tricksterDiv.id = 'trickster-calc';
        tricksterDiv.style = "background:#24345e; padding:15px; border-radius:8px; margin-bottom:20px;";
        tricksterDiv.innerHTML = `
            <h3 style="color:#fca311; margin-top:0;">🃏 詭術師換票結算</h3>
            <p style="color:#a2a8d3;">請輸入實際得票最高的玩家編號：</p>
            <div id="trickster-numpad" class="grid-container"></div>
            <div id="trickster-result" class="hidden" style="margin-top:15px; font-size:24px; font-weight:bold; color:#00ff88;"></div>
        `;
        dayResultContent.insertBefore(tricksterDiv, btnReset);
        
        let tPad = document.getElementById('trickster-numpad');
        for (let i = 1; i <= s.totalPlayers; i++) {
            if (s.finalKilled.includes(i)) continue;
            let b = document.createElement('button'); b.className = 'num-btn'; b.textContent = i;
            b.onclick = () => {
                let magSwap = [...s.magicianSwap].sort().join(','); 
                let triSwap = [...s.tricksterSwap].sort().join(',');
                let effectiveTrickster = s.tricksterSwap;
                
                // 魔術師與詭術師若對相同組合發動換人，則效果抵銷
                if (s.magicianSwap.length && s.tricksterSwap.length && magSwap === triSwap) effectiveTrickster = [];
                
                let exiled = i; 
                if (effectiveTrickster.includes(i)) exiled = effectiveTrickster[0] === i ? effectiveTrickster[1] : effectiveTrickster[0];
                
                document.getElementById('trickster-result').textContent = `實際被放逐出局的是：【 ${exiled} 號 】`;
                document.getElementById('trickster-result').classList.remove('hidden');
                document.querySelectorAll('#trickster-numpad .num-btn').forEach(btn => btn.classList.remove('selected'));
                b.classList.add('selected');
            };
            tPad.appendChild(b);
        }
    }
    btnReset.classList.remove('hidden');
}