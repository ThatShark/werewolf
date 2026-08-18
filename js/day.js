import { s, wolf_faction, wolf_team_roles, evil_roles, findNearestWolf } from './core.js';
import { triggerTricksterVoteSection } from './vote.js';

// 判斷是否觸發千年之戀雙死獲勝條件
function checkSnakeWin(dead1, dead2) {
    let r1 = s.player_roles[dead1];
    let r2 = s.player_roles[dead2];
    if ((r1 === 'snake_phantom' && r2 === 'snake_seer') || (r1 === 'snake_seer' && r2 === 'snake_phantom')) {
        s.is_snake_win = true;
    }
}

export function calculateNightDeaths() {
    // ======================================================================
    // 夜間死亡結算主函式
    // 結算順序：恐懼判定 → 反傷/咒狐 → 狼刀(含護盾) → 毒藥 → 覺醒狼美人 → 灰太狼 → 連帶死亡 → 狼美人殉情 → 白貓免死 → 商人反噬
    // ======================================================================

    // 1. 初始化死亡判定與狀態清單
    s.primary_killed = []; s.chain_killed = []; s.final_killed = [];
    s.is_pufferfish_triggered = false;
    s.did_white_cat_flip_last_night = false;
    s.rust_sword_infected_target = null;

    // 定位關鍵角色座位
    let witchSeat = Object.keys(s.player_roles).find(k => ['witch', 'awaken_witch'].includes(s.player_roles[k]));
    let seerSeat = Object.keys(s.player_roles).find(k => ['seer', 'shadow_seer', 'awaken_seer', 'psychic', 'pure_white', 'wolf_witch', 'fool_seer', 'snake_seer'].includes(s.player_roles[k]));
    let guardSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'guard');
    let dwSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'dreamwalker');
    let awakenIdiotSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'awaken_idiot');
    let grSeat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'ghost_rider')) || null;

    // -------------------------------------------------------
    // 1.5 搗蛋鬼耍寶效果
    // 規則：被耍寶的人使用技能時，視為對自己使用
    //   - 守衛被耍寶 → 守護自己（若連續兩晚自守則出局）
    //   - 預言家被耍寶 → 查驗自己
    //   - 女巫毒被耍寶 → 毒自己
    //   - 獵人被耍寶 → 開槍帶走自己
    //   - 狼人被耍寶 → 被耍寶的狼自刀
    // -------------------------------------------------------
    if (s.troublemaker_target) {
        let tSeat = s.troublemaker_target;
        // 若被耍寶的是守衛 → guardTarget 改為守衛自己
        if (s.guard_target && parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'guard')) === tSeat) {
            s.guard_target = tSeat;
        }
        // 若被耍寶的是預言家相關 → seerTarget 改為自己
        let seerRoles = ['seer', 'psychic', 'pure_white', 'awaken_seer'];
        let seerKey = Object.keys(s.player_roles).find(k => seerRoles.includes(s.player_roles[k]));
        if (seerKey && parseInt(seerKey) === tSeat && s.seer_target) {
            s.seer_target = tSeat;
        }
        // 若被耍寶的是女巫 → witchPoisonTarget 改為自己（若有毒）
        let witchKey = Object.keys(s.player_roles).find(k => ['witch', 'awaken_witch'].includes(s.player_roles[k]));
        if (witchKey && parseInt(witchKey) === tSeat && s.witch_poison_target) {
            s.witch_poison_target = tSeat;
        }
        // 若被耍寶的是狼人 → wolfKillTarget 改為該狼自己
        if (wolf_team_roles.includes(s.player_roles[tSeat]) && s.wolf_kill_target) {
            s.wolf_kill_target = tSeat;
        }
    }

    // -------------------------------------------------------
    // 1.6 梅杜莎石化效果
    // 規則：被石化的玩家當晚技能失效（與夢魘恐懼類似但不完全相同）
    //   - 被石化的女巫兩瓶藥都不能用
    //   - 被石化的狼人僅該名無法行動
    // -------------------------------------------------------
    if (s.medusa_target) {
        let mTarget = s.medusa_target;
        let mRole = s.player_roles[mTarget];
        // 被石化者的查驗無效
        if (s.seer_target && parseInt(Object.keys(s.player_roles).find(k => ['seer', 'psychic', 'pure_white', 'fool_seer'].includes(s.player_roles[k]))) === mTarget) {
            s.seer_target = null;
        }
        // 被石化者的守衛無效
        if (s.guard_target && parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'guard')) === mTarget) {
            s.guard_target = null;
        }
        // 被石化者的女巫兩瓶藥都無效（毒藥+解藥）
        if (parseInt(Object.keys(s.player_roles).find(k => ['witch', 'awaken_witch'].includes(s.player_roles[k])) || 0) === mTarget) {
            s.witch_poison_target = null;
            s.is_witch_saved = false;
        }
    }

    // -------------------------------------------------------
    // 2. 夢魘恐懼影響 + 企鵝冰凍影響
    // 規則（夢魘）：被恐懼的玩家當晚不能使用技能
    // 規則（企鵝）：被冰凍的狼人 → 全隊無法刀人
    // 規則（名媛）：被寵幸且被刀的玩家，若名媛存活 → 狼刀無效（空刀）
    // -------------------------------------------------------
    let isWolfFeared = s.nightmare_target && wolf_team_roles.includes(s.player_roles[s.nightmare_target]);
    // 企鵝冰凍狼人 → 全隊無法刀人
    let isWolfFrozen = s.penguin_target && wolf_team_roles.includes(s.player_roles[s.penguin_target]);
    let actualWolfKill = (isWolfFeared || isWolfFrozen) ? null : s.wolf_kill_target;

    // 企鵝冰凍非狼人 → 被冰凍者技能失效（清除該人的技能效果）
    if (s.penguin_target && !wolf_team_roles.includes(s.player_roles[s.penguin_target])) {
        let frozenSeat = s.penguin_target;
        // 若被冰凍的是守衛 → 守護無效
        if (guardSeat && parseInt(guardSeat) === frozenSeat) s.guard_target = null;
        // 若被冰凍的是女巫 → 毒藥和解藥都無效
        if (witchSeat && parseInt(witchSeat) === frozenSeat) { s.witch_poison_target = null; s.is_witch_saved = false; }
        // 若被冰凍的是預言家 → 查驗無效
        if (seerSeat && parseInt(seerSeat) === frozenSeat) s.seer_target = null;
        // 若被冰凍的是攝夢人 → 攝夢無效
        if (dwSeat && parseInt(dwSeat) === frozenSeat) s.dream_target = null;
        // 若被冰凍的是禁言長老 → 禁言無效
        if (s.silence_target && Object.keys(s.player_roles).find(k => s.player_roles[k] === 'silence_elder' && parseInt(k) === frozenSeat)) s.silence_target = null;
    }

    // 名媛寵幸效果：被寵幸的人如果被狼刀，且名媛存活 → 狼刀無效
    if (s.celebrity_target && actualWolfKill === s.celebrity_target) {
        let celebSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'celebrity');
        if (celebSeat && !s.primary_killed.includes(parseInt(celebSeat))) {
            actualWolfKill = null; // 寵幸保護成功，視為空刀
        }
    }

    let actualWitchPoison = s.witch_poison_target;
    if (witchSeat && parseInt(witchSeat) === s.nightmare_target) { actualWitchPoison = null; s.is_witch_saved = false; }

    let actualSeerTarget = s.seer_target;
    if (seerSeat && parseInt(seerSeat) === s.nightmare_target) actualSeerTarget = null;

    let actualGuard = (guardSeat && parseInt(guardSeat) === s.nightmare_target) ? null : s.guard_target;
    let actualDream = (dwSeat && parseInt(dwSeat) === s.nightmare_target) ? null : s.dream_target;

    // -------------------------------------------------------
    // 2.5 睡美人影響（睡美人板子）
    // 規則：首晚進入睡眠的只有睡美人本人，此時影響尚未擴散（第二晚起才向外擴散）
    //   但第一晚睡美人本身已在睡眠狀態中：
    //   - 若睡美人是熊 → 熊不咆哮（熊咆哮在白天處理，此處記錄即可）
    //   - 若睡美人是女巫 → 毒藥使用失敗
    //   - 若睡美人是獵人 → 始終無法開槍
    //   - 若睡美人是禁言長老 → 禁言無效
    //   - 若所有狼人都在睡眠中 → 空刀（第一晚只有睡美人自己睡，所以只有睡美人本人是狼時才會空刀）
    // -------------------------------------------------------
    if (s.sleeping_beauty_seat && s.is_sleeping_beauty_active) {
        let sb = s.sleeping_beauty_seat;
        let sbRole = s.player_roles[sb];
        // 若睡美人是女巫 → 毒藥失效
        if (['witch', 'awaken_witch'].includes(sbRole)) { actualWitchPoison = null; }
        // 若睡美人是獵人 → 標記無法開槍（在白天開槍佇列中判斷）
        // 若睡美人是狼人 → 第一晚只有它自己睡，所以若此狼唯一存活則空刀
        if (wolf_team_roles.includes(sbRole)) {
            let alive_wolves = Object.keys(s.player_roles).filter(k => wolf_team_roles.includes(s.player_roles[k]));
            let all_wolves_sleeping = alive_wolves.every(k => parseInt(k) === sb);
            if (all_wolves_sleeping) actualWolfKill = null;
        }
        // 若睡美人是禁言長老 → 禁言無效
        if (sbRole === 'silence_elder') { s.silence_target = null; }
    }

    // -------------------------------------------------------
    // 3. 惡靈騎士反傷與咒狐暴斃
    // 規則（惡靈騎士）：
    //   - 免疫夜間傷害（狼刀、女巫毒、獵人夜槍均無效）
    //   - 一次性反傷：女巫毒惡靈騎士 → 女巫死；預言家/通靈師查驗 → 查驗者死
    //   - 若同夜毒+驗同時命中，先行動者遭反傷（女巫先於預言家）
    // 規則（咒狐）：
    //   - 被預言家查驗 → 查驗顯示金水但咒狐暴斃
    //   - 免疫狼刀
    // -------------------------------------------------------
    // 規則：只有預言家/覺醒預言家查驗咒狐才致死；通靈師/純白之女查驗只顯示身分不致死
    if (actualSeerTarget && s.player_roles[parseInt(actualSeerTarget)] === 'curse_fox') {
        let seerRole = seerSeat ? s.player_roles[seerSeat] : null;
        let killFoxRoles = ['seer', 'awaken_seer', 'shadow_seer'];
        if (killFoxRoles.includes(seerRole)) {
            if (!s.primary_killed.includes(parseInt(actualSeerTarget))) s.primary_killed.push(parseInt(actualSeerTarget));
        }
    }
    if (grSeat && !s.has_ghost_rider_reflected) {
        if (actualWitchPoison && parseInt(actualWitchPoison) === grSeat && witchSeat) {
            s.primary_killed.push(parseInt(witchSeat));
            s.player_status[witchSeat].deathReason = "惡靈騎士反傷(毒)";
            s.has_ghost_rider_reflected = true;
        }
        else if (actualSeerTarget && parseInt(actualSeerTarget) === grSeat && seerSeat) {
            s.primary_killed.push(parseInt(seerSeat));
            s.player_status[seerSeat].deathReason = "惡靈騎士反傷(驗)";
            s.has_ghost_rider_reflected = true;
        }
    }

    // -------------------------------------------------------
    // 4. 覺醒白痴保護
    // 規則：覺醒白痴每晚可用秘密之身保護一名玩家，為其抵擋一次夜間傷害
    // -------------------------------------------------------
    let isIdiotProtected = false;
    if (s.awk_idiot_target && (actualWolfKill === s.awk_idiot_target || s.big_bad_wolf_kill_target === s.awk_idiot_target)) isIdiotProtected = true;
    else if (awakenIdiotSeat && (actualWolfKill === parseInt(awakenIdiotSeat) || s.big_bad_wolf_kill_target === parseInt(awakenIdiotSeat))) isIdiotProtected = true;

    // -------------------------------------------------------
    // 5. 狼刀結算（含大野狼額外刀）
    // 規則：
    //   - 惡靈騎士/咒狐免疫狼刀
    //   - 被攝夢的玩家免疫夜間傷害
    //   - 被覺醒攝夢人指定的夢語者免疫夜間傷害
    //   - 守衛守護的目標免疫狼刀
    //   - 女巫解藥可救活被狼刀的玩家
    //   - 「奶穿」規則：同時被守衛守護且被女巫解藥救 → 反而死亡
    //   - 河豚被狼刀殺死 → 觸發河豚效果（當天狼美人魅惑失效）
    //   - 鏽劍騎士被狼刀殺死 → 左邊最近的狼人將在天亮出局
    // -------------------------------------------------------
    let immuneToNightDamageTargets = [s.awk_dreamwalker_target, s.light_count_target, s.dark_messenger_target].filter(Boolean);
    let killList = [actualWolfKill, s.big_bad_wolf_kill_target].filter(Boolean).map(x => parseInt(x));

    killList.forEach(target => {
        let isGuarded = (actualGuard === target) || (s.pleasant_goat_guard === target);
        let isSaved = (target === parseInt(actualWolfKill) && s.is_witch_saved);
        let isDreamed = (actualDream === target);
        let targetRole = s.player_roles[target];
        let diesToWolf = false;

        if (['ghost_rider', 'curse_fox'].includes(targetRole) || isDreamed || isIdiotProtected || immuneToNightDamageTargets.includes(target)) {
            // 免疫致死（惡靈騎士/咒狐/攝夢保護/覺醒白痴保護/夢語者免疫）
        } else if (targetRole === 'war_wolf') {
            // 規則：戰狼免疫所有神職技能傷害（含白天決鬥），只能投票出局
        } else if (targetRole === 'demon') {
            // 規則：惡魔免疫夜間傷害（毒、夜槍），但白天可被騎士決鬥殺死
        } else if (s.is_phantom_thief_invincible && targetRole === 'phantom_king') {
            // 規則：怪盜狼王發動無敵 → 免疫一切死亡直到下次入夜
        } else if (isSaved && isGuarded) {
            // 規則：奶穿 — 女巫救+守衛守同一人 → 死亡
            s.primary_killed.push(target);
            diesToWolf = true;
            s.player_status[target].deathReason = "奶穿";
        } else if (!isSaved && !isGuarded) {
            // 無保護 → 正常死亡
            s.primary_killed.push(target);
            diesToWolf = true;
            s.player_status[target].deathReason = (s.big_bad_wolf_kill_target === target) ? "大野狼擊殺" : "狼刀";
        }
        // else: 被守衛守住或被解藥救活 → 存活

        // 特殊角色受刀連動
        if (diesToWolf && targetRole === 'pufferfish') s.is_pufferfish_triggered = true;
        if (diesToWolf && targetRole === 'rust_sword_knight') s.rust_sword_infected_target = findNearestWolf(target, -1);
    });

    // -------------------------------------------------------
    // 6. 女巫毒藥結算
    // 規則：
    //   - 惡靈騎士免疫毒藥（且會觸發反傷，已在步驟3處理）
    //   - 獵魔人免疫毒藥
    //   - 舞者免疫毒藥
    //   - 假面免疫毒藥
    //   - 被攝夢的玩家免疫毒藥
    //   - 老流氓被毒 → 進入中毒狀態，隔天發言結束後才死
    //   - 被毒殺的玩家死後不能發動技能（獵人不能開槍）
    // -------------------------------------------------------
    if (actualWitchPoison) {
        let target = parseInt(actualWitchPoison);
        let targetRole = s.player_roles[target];
        if (targetRole === 'dreamwalker' && s.player_status[target].isVWK) { /* 百變狼王攝夢免疫毒藥 */ }
        else if (['ghost_rider', 'demon_hunter', 'dancer', 'mask_wolf'].includes(targetRole) || actualDream === target || immuneToNightDamageTargets.includes(target) || (s.is_phantom_thief_invincible && targetRole === 'phantom_king')) { /* 免疫毒藥 */ }
        else if (targetRole === 'war_wolf') { /* 戰狼：免疫所有神職技能傷害 */ }
        else if (targetRole === 'demon') { /* 惡魔：免疫夜間傷害（毒藥屬夜間傷害） */ }
        else if (targetRole === 'old_hooligan') s.player_status[target].poisoned = true;
        else if (!s.primary_killed.includes(target)) {
            s.primary_killed.push(target);
            s.player_status[target].deathReason = "毒殺";
        }
    }

    // -------------------------------------------------------
    // 6.4 開膛手傑克結算
    // 規則：每晚擊殺一人，此刀無法被女巫解藥救，但守衛可以擋住
    //   被預言家查驗顯示為好人（在 actions.js 查驗邏輯中處理）
    // -------------------------------------------------------
    if (s.jack_ripper_target) {
        let jrTarget = parseInt(s.jack_ripper_target);
        let isJRGuarded = (actualGuard === jrTarget) || (s.pleasant_goat_guard === jrTarget);
        let isJRDreamed = (actualDream === jrTarget);
        if (!isJRGuarded && !isJRDreamed && !immuneToNightDamageTargets.includes(jrTarget) && !s.primary_killed.includes(jrTarget)) {
            s.primary_killed.push(jrTarget);
            s.player_status[jrTarget].deathReason = "開膛手傑克擊殺";
        }
    }

    // -------------------------------------------------------
    // 6.45 潘朵拉魔盒結算
    // 規則：魔盒開出「毒」→ 開啟者立即死亡（潘朵拉自己免疫）
    //       魔盒開出「刀/日槍/希望之光」→ 第一夜不結算（需後續夜晚/白天使用）
    // -------------------------------------------------------
    if (s.pandora_gift === 'poison' && s.pandora_target) {
        let pandoraRecipient = parseInt(s.pandora_target);
        // 確認獲贈者不是潘朵拉自己（潘朵拉免疫此毒）
        let pandoraSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'pandora');
        if (pandoraSeat && parseInt(pandoraSeat) !== pandoraRecipient) {
            if (!s.primary_killed.includes(pandoraRecipient)) {
                s.primary_killed.push(pandoraRecipient);
                s.player_status[pandoraRecipient].deathReason = "潘朵拉魔盒(毒)";
                // 被潘朵拉毒殺的玩家不能發動技能
                s.player_status[pandoraRecipient].is_pandora_poisoned = true;
            }
        }
    }

    // -------------------------------------------------------
    // 6.5 黑蝙蝠庇護反彈
    // 規則：被庇護的玩家被施放技能（守衛守護、女巫撒毒、預言家查驗），
    //       只能反彈一次（按行動順序：守衛→女巫→預言家）。
    //       第一個命中的技能觸發反彈（釋放者死亡），後續技能正常生效。
    //       狼刀不觸發反彈，解藥不觸發反彈。
    // -------------------------------------------------------
    if (s.black_bat_target) {
        let batTarget = s.black_bat_target;
        let did_bat_reflect = false; // 是否已消耗反彈

        // 按行動順序檢查：守衛 → 女巫 → 預言家
        // 1. 守衛守護了被庇護者 → 守衛死亡（反彈消耗）
        if (!did_bat_reflect && s.guard_target && parseInt(s.guard_target) === batTarget) {
            let guardKey = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'guard');
            if (guardKey && !s.primary_killed.includes(parseInt(guardKey))) {
                s.primary_killed.push(parseInt(guardKey));
                s.player_status[guardKey].deathReason = "黑蝙蝠庇護反彈";
                did_bat_reflect = true;
            }
        }
        // 2. 女巫撒毒被庇護者 → 若反彈未消耗：女巫死亡，被庇護者免毒
        //                       → 若反彈已消耗：被庇護者正常吃毒死亡
        if (s.witch_poison_target && parseInt(s.witch_poison_target) === batTarget) {
            if (!did_bat_reflect) {
                let witchKey = Object.keys(s.player_roles).find(k => ['witch', 'awaken_witch'].includes(s.player_roles[k]));
                if (witchKey && !s.primary_killed.includes(parseInt(witchKey))) {
                    s.primary_killed.push(parseInt(witchKey));
                    s.player_status[witchKey].deathReason = "黑蝙蝠庇護反彈";
                    did_bat_reflect = true;
                }
                // 反彈成功 → 被庇護者免毒
                s.primary_killed = s.primary_killed.filter(k => k !== batTarget);
            }
            // 若反彈已消耗 → 被庇護者正常吃毒（不做額外處理，毒殺已在步驟6加入）
        }
        // 3. 預言家查驗被庇護者 → 若反彈未消耗：查驗者死亡
        //                       → 若反彈已消耗：正常查驗不反彈
        if (!did_bat_reflect && s.seer_target && parseInt(s.seer_target) === batTarget) {
            let seerRoles = ['seer', 'psychic', 'pure_white', 'fool_seer', 'awaken_seer'];
            let seerKey = Object.keys(s.player_roles).find(k => seerRoles.includes(s.player_roles[k]));
            if (seerKey && !s.primary_killed.includes(parseInt(seerKey))) {
                s.primary_killed.push(parseInt(seerKey));
                s.player_status[seerKey].deathReason = "黑蝙蝠庇護反彈";
                did_bat_reflect = true;
            }
        }
        if (did_bat_reflect) {
            s.night_action_log.push(`【黑蝙蝠】庇護反彈生效`);
        }
    }

    // -------------------------------------------------------
    // 6.6 黑夜使者絕對反殺
    // 規則：被庇護的狼人當晚被查驗/毒/攝夢雙攝 → 施放者死亡
    // -------------------------------------------------------
    if (s.dark_messenger_target) {
        let dmTarget = s.dark_messenger_target;
        let dmReflectVictims = [];
        // 預言家查驗被庇護狼人 → 預言家死亡
        if (s.seer_target && parseInt(s.seer_target) === dmTarget) {
            let seerRoles = ['seer', 'psychic', 'pure_white', 'fool_seer', 'awaken_seer'];
            let seerSeat = Object.keys(s.player_roles).find(k => seerRoles.includes(s.player_roles[k]));
            if (seerSeat) dmReflectVictims.push(parseInt(seerSeat));
        }
        // 女巫毒被庇護狼人 → 女巫死亡
        if (s.witch_poison_target && parseInt(s.witch_poison_target) === dmTarget) {
            let witchSeat = Object.keys(s.player_roles).find(k => ['witch', 'awaken_witch'].includes(s.player_roles[k]));
            if (witchSeat) dmReflectVictims.push(parseInt(witchSeat));
            s.primary_killed = s.primary_killed.filter(k => k !== dmTarget);
        }
        // 攝夢人對被庇護狼人雙攝 → 攝夢人死亡
        // 規則：必須是「連續兩晚」對同一人攝夢才算雙攝（第一夜不可能觸發）
        if (s.dream_target && parseInt(s.dream_target) === dmTarget && s.prev_dream_target === dmTarget) {
            let dreamSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'dreamwalker');
            if (dreamSeat) dmReflectVictims.push(parseInt(dreamSeat));
        }
        dmReflectVictims.forEach(v => {
            if (!s.primary_killed.includes(v)) {
                s.primary_killed.push(v);
                s.player_status[v].deathReason = "黑夜使者絕對反殺";
            }
        });
        if (dmReflectVictims.length > 0) {
            s.night_action_log.push(`【黑夜使者】絕對反殺生效，${dmReflectVictims.join(',')}號死亡`);
        }
    }

    // -------------------------------------------------------
    // 7. 覺醒狼美人魅惑轉移
    // 規則：覺醒狼美人第一次面臨出局時，被她魅惑的玩家代替她出局
    // -------------------------------------------------------
    let awbSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'awaken_wolf_beauty');
    if (awbSeat && s.primary_killed.includes(parseInt(awbSeat)) && s.awk_beauty_target) {
        s.primary_killed = s.primary_killed.filter(k => k !== parseInt(awbSeat)); // 自身免死
        if (!s.primary_killed.includes(s.awk_beauty_target)) s.chain_killed.push(s.awk_beauty_target);
        s.awk_beauty_target = null;
    }

    // -------------------------------------------------------
    // 8. 灰太狼猜測喜羊羊錯誤 → 灰太狼出局
    // 規則：灰太狼偷喜羊羊時需猜測其使用的技能，猜錯則灰太狼出局
    // -------------------------------------------------------
    let grayWolfSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'gray_wolf');
    if (grayWolfSeat && s.gray_wolf_stolen_player) {
        let tSeat = s.gray_wolf_stolen_player;
        if (s.player_roles[tSeat] === 'pleasant_goat') {
            let pgSelfProtected = (s.pleasant_goat_guard === tSeat && s.pleasant_goat_anti_theft === tSeat);
            if (!pgSelfProtected) {
                let actualPGSkill = null;
                if (s.pleasant_goat_guard) actualPGSkill = 'guard';
                if (s.pleasant_goat_anti_theft) actualPGSkill = 'anti_theft';

                if (actualPGSkill !== null && s.gray_wolf_guess !== actualPGSkill) {
                    if (!s.primary_killed.includes(parseInt(grayWolfSeat))) {
                        s.primary_killed.push(parseInt(grayWolfSeat));
                        s.player_status[grayWolfSeat].deathReason = "猜測喜羊羊錯誤";
                    }
                }
            }
        }
    }

    // 統合死亡清單並進入連帶死亡遞迴
    s.final_killed = [...s.primary_killed, ...s.chain_killed];
    handleChainDeaths();

    // -------------------------------------------------------
    // 8.5 獵魔人狩獵結算
    // 規則：狩獵狼人→次日對方出局；狩獵好人→次日獵魔人出局
    //   獵魔人免疫女巫毒藥（已在步驟6處理）
    // -------------------------------------------------------
    if (s.demon_hunter_target) {
        let dhSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'demon_hunter');
        let targetRole = s.player_roles[s.demon_hunter_target];
        let isTargetEvil = wolf_faction.includes(targetRole);
        // 戰狼免疫獵魔人
        if (targetRole === 'war_wolf') isTargetEvil = false;
        
        if (isTargetEvil) {
            // 狩獵到狼人 → 對方出局
            if (!s.final_killed.includes(s.demon_hunter_target)) {
                s.primary_killed.push(s.demon_hunter_target);
                s.final_killed.push(s.demon_hunter_target);
                s.player_status[s.demon_hunter_target].deathReason = "獵魔人狩獵";
            }
        } else if (dhSeat) {
            // 狩獵到好人 → 獵魔人自己出局
            if (!s.final_killed.includes(parseInt(dhSeat))) {
                s.primary_killed.push(parseInt(dhSeat));
                s.final_killed.push(parseInt(dhSeat));
                s.player_status[dhSeat].deathReason = "狩獵好人反噬";
            }
        }
    }

    // -------------------------------------------------------
    // 8.6 蠱惑師死亡替代
    // 規則：蠱惑師死亡時，被蠱惑者代替出局（蠱惑師存活）
    // -------------------------------------------------------
    let charmerSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'charmer');
    if (charmerSeat && s.final_killed.includes(parseInt(charmerSeat)) && s.charmer_target) {
        // 蠱惑師死亡 → 被蠱惑者代替
        s.primary_killed = s.primary_killed.filter(k => k !== parseInt(charmerSeat));
        s.final_killed = s.final_killed.filter(k => k !== parseInt(charmerSeat));
        if (!s.final_killed.includes(s.charmer_target)) {
            s.chain_killed.push(s.charmer_target);
            s.final_killed.push(s.charmer_target);
            s.player_status[s.charmer_target].deathReason = "蠱惑師死亡替代";
        }
        handleChainDeaths();
    }

    // -------------------------------------------------------
    // 9. 狼美人殉情結算
    // 規則：狼美人以任何方式被淘汰（包括最後一狼），
    //   前一晚被魅惑的玩家跟著殉情且不能發動技能。
    //   例外：被騎士決鬥殺死時不觸發、被毒殺時不觸發殉情、河豚觸發時失效。
    // -------------------------------------------------------
    let beautySeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'wolf_beauty');
    let vwkBeautySeat = (s.vwk_seat && s.player_roles[s.vwk_seat] === 'bear') ? s.vwk_seat : null;

    [beautySeat, vwkBeautySeat].forEach(seat => {
        if (seat && s.final_killed.includes(parseInt(seat)) && actualWitchPoison !== parseInt(seat)) {
            if (s.beauty_target && s.player_roles[s.beauty_target] !== 'old_hooligan' && !s.final_killed.includes(s.beauty_target) && !s.is_pufferfish_triggered) {
                s.chain_killed.push(s.beauty_target);
                s.final_killed = [...s.primary_killed, ...s.chain_killed];
                handleChainDeaths();
            }
        }
    });

    // -------------------------------------------------------
    // 10. 白貓翻牌免死
    // 規則：白貓任何原因死亡都能翻牌免疫本次死亡（僅一次）
    // -------------------------------------------------------
    let wcSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'white_cat');
    if (wcSeat && s.final_killed.includes(parseInt(wcSeat)) && !s.player_status[wcSeat].isWhiteCatFlipped) {
        s.primary_killed = s.primary_killed.filter(k => k !== parseInt(wcSeat));
        s.chain_killed = s.chain_killed.filter(k => k !== parseInt(wcSeat));
        s.final_killed = s.final_killed.filter(k => k !== parseInt(wcSeat));
        s.player_status[wcSeat].isWhiteCatFlipped = true;
        s.did_white_cat_flip_last_night = true;
    }

    // -------------------------------------------------------
    // 11. 商人反噬
    // 規則：黑市商人/奇蹟商人若將技能給了狼人陣營的幸運兒，次日商人死亡
    // -------------------------------------------------------
    if (s.merchant_target && evil_roles.includes(s.player_roles[s.merchant_target])) {
        let merchSeat = Object.keys(s.player_roles).find(k => ['black_market', 'miracle_merchant'].includes(s.player_roles[k]));
        if (merchSeat && !s.final_killed.includes(parseInt(merchSeat))) {
            s.primary_killed.push(parseInt(merchSeat)); s.final_killed.push(parseInt(merchSeat));
            s.player_status[parseInt(merchSeat)].deathReason = "給狼技能反噬";
        }
    }
}

/**
 * 遞迴處理連帶死亡鏈 (Chain Deaths)
 * 規則：當某人死亡觸發連帶效應時，被連帶的人可能再觸發其他連帶，形成鏈式反應。
 * 以遞迴方式處理直到沒有新增死亡為止。
 */
export function handleChainDeaths() {
    let changed = false;

    // 取得原生攝夢人與百變狼王(攝夢人)的座位
    let dwSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'dreamwalker');
    let vwkDreamSeat = (s.vwk_seat && s.player_roles[s.vwk_seat] === 'dreamwalker') ? s.vwk_seat : null;

    // -------------------------------------------------------
    // 1. 攝夢人連帶死亡
    // 規則：攝夢人在夜晚出局 → 夢遊者一併出局（且不能發動技能）
    // -------------------------------------------------------
    [dwSeat, vwkDreamSeat].forEach(seat => {
        if (seat && s.final_killed.includes(parseInt(seat)) && s.dream_target && !s.final_killed.includes(s.dream_target)) {
            s.chain_killed.push(s.dream_target);
            s.final_killed.push(s.dream_target);
            changed = true;
            s.player_status[s.dream_target].deathReason = "連帶死亡(被攝夢)";
        }
    });

    // -------------------------------------------------------
    // 2. 尋香魅影/許仙尋香魅影 綁定殉情
    // 規則：被綁定的兩人其中一方死亡 → 另一方跟著殉情
    //   觸發後鍊子技能失效（phantomTargets 清空）
    // -------------------------------------------------------
    const normalizedTargets = (s.phantom_targets || []).map(Number);
    if (normalizedTargets.length === 2) {
        const [p1, p2] = normalizedTargets;
        if (s.final_killed.includes(p1) && !s.final_killed.includes(p2)) {
            s.chain_killed.push(p2);
            s.final_killed.push(p2);
            s.phantom_targets = [];
            s.player_status[p2].deathReason = "連帶死亡(尋香綁定)";
            changed = true;
            checkSnakeWin(p1, p2);
        }
        else if (s.final_killed.includes(p2) && !s.final_killed.includes(p1)) {
            s.chain_killed.push(p1);
            s.final_killed.push(p1);
            s.phantom_targets = [];
            s.player_status[p1].deathReason = "連帶死亡(尋香綁定)";
            changed = true;
            checkSnakeWin(p1, p2);
        }
    }

    // -------------------------------------------------------
    // 3. 邱比特情侶殉情
    // 規則：情侶為生命共同體，一方死亡 → 另一方跟著殉情
    //   因殉情而死的狼王/獵人不能發動開槍技能
    // -------------------------------------------------------
    if (s.cupid_lovers.length === 2) {
        let [p1, p2] = s.cupid_lovers;
        if (s.final_killed.includes(p1) && !s.final_killed.includes(p2)) {
            s.chain_killed.push(p2); s.final_killed.push(p2); s.cupid_lovers = [];
            s.player_status[p2].deathReason = "連帶死亡(情侶殉情)"; changed = true;
        }
        else if (s.final_killed.includes(p2) && !s.final_killed.includes(p1)) {
            s.chain_killed.push(p1); s.final_killed.push(p1); s.cupid_lovers = [];
            s.player_status[p1].deathReason = "連帶死亡(情侶殉情)"; changed = true;
        }
    }

    // -------------------------------------------------------
    // 4. 鬼魅新娘夫妻連帶死亡
    // 規則：新娘與新郎為生命共同體，一方死亡 → 另一方殉情
    // -------------------------------------------------------
    if (s.ghost_bride_groom && s.ghost_bride_witness) {
        let gSeat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'ghost_bride'));
        if (s.final_killed.includes(gSeat) && !s.final_killed.includes(s.ghost_bride_groom)) {
            s.chain_killed.push(s.ghost_bride_groom); s.final_killed.push(s.ghost_bride_groom);
            s.player_status[s.ghost_bride_groom].deathReason = "連帶死亡(新郎殉情)"; changed = true;
        }
        else if (s.final_killed.includes(s.ghost_bride_groom) && !s.final_killed.includes(gSeat)) {
            s.chain_killed.push(gSeat); s.final_killed.push(gSeat);
            s.player_status[gSeat].deathReason = "連帶死亡(新郎死亡)"; changed = true;
        }
    }

    // -------------------------------------------------------
    // 5. 覺醒攝夢人（夢語者）連帶死亡
    // 規則：覺醒攝夢人在夜晚出局 → 夢語者一併出局（不能發動技能）
    // -------------------------------------------------------
    let adSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'awaken_dreamwalker');
    if (adSeat && s.final_killed.includes(parseInt(adSeat)) && s.awk_dreamwalker_target && !s.final_killed.includes(s.awk_dreamwalker_target)) {
        s.chain_killed.push(s.awk_dreamwalker_target);
        s.final_killed.push(s.awk_dreamwalker_target);
        s.player_status[s.awk_dreamwalker_target].deathReason = "連帶死亡(夢語者)";
        changed = true;
    }

    // -------------------------------------------------------
    // 6. 名媛殉情
    // 規則：名媛死亡 → 被寵幸者跟著殉情（戰狼除外）
    // -------------------------------------------------------
    let celebSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'celebrity');
    if (celebSeat && s.final_killed.includes(parseInt(celebSeat)) && s.celebrity_target && !s.final_killed.includes(s.celebrity_target)) {
        if (s.player_roles[s.celebrity_target] !== 'war_wolf') {
            s.chain_killed.push(s.celebrity_target);
            s.final_killed.push(s.celebrity_target);
            s.player_status[s.celebrity_target].deathReason = "連帶死亡(名媛殉情)";
            changed = true;
        }
    }

    // -------------------------------------------------------
    // 7. 梅杜莎連帶死亡
    // 規則：梅杜莎以非自爆方式出局 → 被石化的玩家跟隨出局
    // -------------------------------------------------------
    let medusaSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'medusa');
    if (medusaSeat && s.final_killed.includes(parseInt(medusaSeat)) && s.medusa_target && !s.final_killed.includes(s.medusa_target)) {
        s.chain_killed.push(s.medusa_target);
        s.final_killed.push(s.medusa_target);
        s.player_status[s.medusa_target].deathReason = "連帶死亡(梅杜莎石化)";
        changed = true;
    }

    // 若有新增死亡則遞迴再次檢查（可能觸發新的連帶鏈）
    if (changed) handleChainDeaths();
}

/**
 * 渲染與計算天亮後的白天資訊 (包含熊咆哮、特殊免死、死亡名單、開槍佇列)
 */
export function proceedDayResultRender() {
    // 鏽劍騎士：傷口感染的狼人加入死亡名單（與死訊一起公布）
    if (s.rust_sword_infected_target && !s.final_killed.includes(s.rust_sword_infected_target)) {
        s.final_killed.push(s.rust_sword_infected_target);
        s.player_status[s.rust_sword_infected_target].deathReason = "鏽劍感染死亡";
    }

    if (s.crow_target) document.getElementById('btn-show-crow').classList.remove('hidden');

    let bearRoarText = "";
    let bearSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'bear');
    let mwSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'machine_wolf');

    const isSeatWolfForBear = (seatId) => {
        if (!seatId || s.final_killed.includes(seatId)) return false;
        let role = s.player_roles[seatId];
        if (role === 'machine_wolf' && s.machine_wolf_target) {
            let learnedRole = s.player_roles[s.machine_wolf_target];
            if (!evil_roles.includes(learnedRole)) return false;
        }
        // 盜寶大師：底牌有狼則為狼人陣營
        if (role === 'treasure_master' && s.is_treasure_hunter_evil) return true;
        return evil_roles.includes(role);
    };

    const getAdjacent = (seat) => {
        let left = seat - 1;
        while (left !== seat) {
            if (left < 1) left = s.total_players;
            if (!s.final_killed.includes(left)) break;
            left--;
        }
        let right = seat + 1;
        while (right !== seat) {
            if (right > s.total_players) right = 1;
            if (!s.final_killed.includes(right)) break;
            right++;
        }
        return { left, right };
    };

    let bearDidRoar = false;

    if (bearSeat && !s.final_killed.includes(parseInt(bearSeat))) {
        if (s.seed_wolf_target !== parseInt(bearSeat)) {
            let { left, right } = getAdjacent(parseInt(bearSeat));
            let hasWolf = isSeatWolfForBear(left) || isSeatWolfForBear(right);

            if (s.player_status[bearSeat]?.isVWK) {
                if (s.vwk_charm_target) hasWolf = isSeatWolfForBear(s.vwk_charm_target);
                hasWolf = !hasWolf;
            }
            if (hasWolf) bearDidRoar = true;
        }
    }

    if (mwSeat && !s.final_killed.includes(parseInt(mwSeat)) && s.machine_wolf_target && s.player_roles[s.machine_wolf_target] === 'bear') {
        let { left, right } = getAdjacent(parseInt(mwSeat));
        if (isSeatWolfForBear(left) || isSeatWolfForBear(right)) bearDidRoar = true;
    }

    if (bearSeat || (mwSeat && s.machine_wolf_target && s.player_roles[s.machine_wolf_target] === 'bear')) {
        // 規則：睡美人影響 — 若熊在睡眠中，永遠不咆哮
        if (s.sleeping_beauty_seat && s.is_sleeping_beauty_active && bearSeat && parseInt(bearSeat) === s.sleeping_beauty_seat) {
            bearDidRoar = false;
        }
        bearRoarText = bearDidRoar ? "🐻 熊咆哮了！<br><br>" : "🐻 熊沒有咆哮。<br><br>";
    }

    // 月靈狼嗥叫判定（類似熊，判斷兩側是否有神職）
    let moonWolfSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'moon_wolf');
    if (moonWolfSeat && !s.final_killed.includes(parseInt(moonWolfSeat))) {
        let { left, right } = getAdjacent(parseInt(moonWolfSeat));
        // 神職列表（好人有技能的角色）
        const godRoles = ['seer','witch','hunter','guard','dreamwalker','awaken_dreamwalker','awaken_idiot','crow','knight','demon_hunter','magician','alchemist','psychic','pure_white','awaken_seer','awaken_witch','awaken_hunter','bear','pufferfish','white_cat','celebrity','penguin','charmer'];
        let hasGod = godRoles.includes(s.player_roles[left]) || godRoles.includes(s.player_roles[right]);
        bearRoarText += hasGod ? "🐺🌙 月靈狼嗥叫了！<br><br>" : "🐺🌙 月靈狼沒有嗥叫。<br><br>";
    }

    let extraText = "";
    if (s.did_white_cat_flip_last_night) {
        let wcSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'white_cat');
        extraText += `<span style="color:#00ff88;">🐱 ${wcSeat} 號玩家是白貓，發動技能免死一次！</span><br><br>`;
    }
    if (s.is_pufferfish_triggered) {
        let pfSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'pufferfish');
        let hasWolfBeauty = Object.values(s.player_roles).includes('wolf_beauty') || Object.values(s.player_roles).includes('awaken_wolf_beauty');
        if (hasWolfBeauty) {
            extraText += `<span style="color:#fca311;">🐡 ${pfSeat} 號 (河豚) 死亡！狼美人技能今日失效！</span><br><br>`;
        } else {
            extraText += `<span style="color:#fca311;">🐡 ${pfSeat} 號 (河豚) 死亡！</span><br><br>`;
        }
        s.beauty_target = null;
    }
    let hvSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'high_villager');
    if (hvSeat && s.seed_wolf_target !== parseInt(hvSeat)) {
        extraText += `<span style="color:#fca311;">👑 高級平民是 ${hvSeat} 號玩家！</span><br><br>`;
    }

    let htmlOutput = bearRoarText + extraText;

    if (s.final_killed.length === 0) {
        htmlOutput += "<span style='color:#00ff88;'>🎉 昨晚是平安夜，沒有人死亡！</span>";
    } else {
        s.final_killed.sort((a, b) => a - b);
        htmlOutput += `<span style='color:#e94560;'>💀 昨晚死亡的是：${s.final_killed.join(' 號、')} 號</span>`;

        if (s.is_snake_win) {
            htmlOutput += `<br><br><span style="color:#ff00ff; font-size:28px;">🎉 千年之戀達成！<br>許仙與白蛇雙雙殉情，直接獲勝！</span>`;
        }

        // 5. 建立夜晚死者的白天技能/開槍佇列
        s.day_shooters_queue = [];
        s.final_killed.forEach(seat => {
            let role = s.player_roles[seat];
            if (s.primary_killed.includes(seat)) {
                let isStolen = (s.gray_wolf_stolen_player === seat && s.gray_wolf_stolen_player !== s.pleasant_goat_anti_theft);

                if (role === 'awaken_hunter' || (role === 'hunter' && s.player_status[seat].isVWK)) {
                    if (s.nightmare_target !== seat && !isStolen) s.day_shooters_queue.push({ seat, role });
                } else if (['hunter', 'wolf_king', 'awaken_wolf_king'].includes(role) || s.awk_wolf_gun_target === seat || s.evil_merchant_gun_target === seat) {
                    // 規則：睡美人是獵人 → 始終無法開槍
                    let is_sleeping = s.sleeping_beauty_seat && s.is_sleeping_beauty_active && seat === s.sleeping_beauty_seat;
                    if (s.witch_poison_target !== seat && s.nightmare_target !== seat && !(role === 'hunter' && isStolen) && !is_sleeping) {
                        s.day_shooters_queue.push({ seat, role });
                        if (role === 'awaken_wolf_king' && s.awk_wolf_gun_target === null) s.day_shooters_queue.push({ seat, role });
                    }
                }

                // 灰太狼若偷到獵槍且未被毒殺/恐懼，也能開槍
                if (role === 'gray_wolf' && s.gray_wolf_stolen_skill === 'hunter') {
                    if (s.witch_poison_target !== seat && s.nightmare_target !== seat) {
                        s.day_shooters_queue.push({ seat, role: 'hunter' });
                    }
                }
            }
        });
    }

    if (s.speech_order_text) {
        htmlOutput += `<br><br><span style="color:#51c9c1; font-size: 20px;">🗣️ 發言順序：<br>${s.speech_order_text}</span>`;
    }

    document.getElementById('day-result').innerHTML = htmlOutput;

    if (s.day_shooters_queue.length > 0) processNextShooter();
    else triggerTricksterVoteSection();
}

/**
 * 處理玩家在白天期間的死亡 (如因開槍擊殺、投票放逐或因連帶關係暴斃)
 */
export function killPlayerDuringDay(seat, isShot = false, canShoot = true) {
    if (s.final_killed.includes(seat)) return;
    let role = s.player_roles[seat];

    // 特殊防禦機制
    if (isShot && role === 'old_hooligan') { s.player_status[seat].injured = true; return; }
    if (isShot && role === 'ghost_rider') return;
    if (role === 'white_cat' && !s.player_status[seat].isWhiteCatFlipped) { s.player_status[seat].isWhiteCatFlipped = true; return; }

    if (role === 'awaken_wolf_beauty' && s.awk_beauty_target && !s.final_killed.includes(s.awk_beauty_target)) {
        let subTarget = s.awk_beauty_target; s.awk_beauty_target = null;
        killPlayerDuringDay(subTarget, false, false);
        return;
    }

    s.final_killed.push(seat);
    s.player_status[seat].deathReason = isShot ? "被開槍帶走" : "連帶死亡";

    if (canShoot) {
        let isStolen = (s.gray_wolf_stolen_player === seat && s.gray_wolf_stolen_player !== s.pleasant_goat_anti_theft);

        if (role === 'awaken_hunter' || (role === 'hunter' && s.player_status[seat].isVWK) || ['hunter', 'wolf_king', 'awaken_wolf_king'].includes(role) || s.awk_wolf_gun_target === seat || s.evil_merchant_gun_target === seat) {
            if (!(role === 'hunter' && isStolen)) {
                s.day_shooters_queue.push({ seat, role });
                if (role === 'awaken_wolf_king' && s.awk_wolf_gun_target === null) s.day_shooters_queue.push({ seat, role });
            }
        }

        if (role === 'gray_wolf' && s.gray_wolf_stolen_skill === 'hunter') {
            s.day_shooters_queue.push({ seat, role: 'hunter' });
        }
    }

    let vwkBeautySeat = (s.vwk_seat && s.player_roles[s.vwk_seat] === 'bear') ? s.vwk_seat : null;
    if ((role === 'wolf_beauty' || seat === vwkBeautySeat) && s.beauty_target && s.player_roles[s.beauty_target] !== 'old_hooligan' && !s.final_killed.includes(s.beauty_target) && !s.is_pufferfish_triggered) {
        killPlayerDuringDay(s.beauty_target, false, false);
    }
    let vwkDreamSeat = (s.vwk_seat && s.player_roles[s.vwk_seat] === 'dreamwalker') ? s.vwk_seat : null;
    if ((role === 'dreamwalker' || seat === vwkDreamSeat) && s.dream_target && !s.final_killed.includes(s.dream_target)) {
        killPlayerDuringDay(s.dream_target, false, false);
    }
    if ((s.phantom_targets || []).map(Number).length === 2) {
        const normalizedTargets = (s.phantom_targets || []).map(Number);
        const currentSeat = Number(seat);

        if (normalizedTargets.includes(currentSeat)) {
            const [t1, t2] = normalizedTargets;
            const other = t1 === currentSeat ? t2 : t1;

            if (!s.final_killed.includes(other)) {
                s.phantom_targets = [];
                killPlayerDuringDay(other, false, false);
                checkSnakeWin(currentSeat, other);
            }
        }
    }
    if (s.cupid_lovers.includes(seat)) {
        let other = s.cupid_lovers[0] === seat ? s.cupid_lovers[1] : s.cupid_lovers[0];
        if (!s.final_killed.includes(other)) { s.cupid_lovers = []; killPlayerDuringDay(other, false, false); }
    }
    if (s.ghost_bride_groom && s.ghost_bride_witness) {
        let gSeat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'ghost_bride'));
        if (seat === gSeat && !s.final_killed.includes(s.ghost_bride_groom)) killPlayerDuringDay(s.ghost_bride_groom, false, false);
        else if (seat === s.ghost_bride_groom && !s.final_killed.includes(gSeat)) killPlayerDuringDay(gSeat, false, false);
    }
    let adSeat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'awaken_dreamwalker'));
    if (seat === adSeat && s.awk_dreamwalker_target && !s.final_killed.includes(s.awk_dreamwalker_target)) {
        killPlayerDuringDay(s.awk_dreamwalker_target, false, false);
    }
}

export function processNextShooter() {
    if (s.day_shooters_queue.length === 0) {
        document.getElementById('day-skill-section').classList.add('hidden');
        triggerTricksterVoteSection();
        return;
    }

    document.getElementById('btn-reset').classList.add('hidden');
    const currentShooter = s.day_shooters_queue[0];
    const section = document.getElementById('day-skill-section');
    section.classList.remove('hidden');
    document.getElementById('day-skill-notice').textContent = `🎯 【 ${currentShooter.seat} 號 】玩家，請問是否發動技能？`;

    let pad = document.getElementById('day-skill-pad');
    pad.innerHTML = '';

    const finishShooterTurn = () => {
        s.final_killed.sort((a, b) => a - b);
        let dayResultStr = `<span style='color:#e94560;'>💀 本局目前死亡名單：${s.final_killed.join(' 號、')} 號</span>` + (s.speech_order_text ? `<br><br><span style="color:#51c9c1;">🗣️ ${s.speech_order_text}</span>` : "");
        if (s.is_snake_win) {
            dayResultStr += `<br><br><span style="color:#ff00ff; font-size:28px;">🎉 千年之戀達成！<br>許仙與白蛇雙雙殉情，直接獲勝！</span>`;
        }
        document.getElementById('day-result').innerHTML = dayResultStr;
        s.day_shooters_queue.shift();
        processNextShooter();
    };

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

    let selectedDayTarget = null;
    for (let i = 1; i <= s.total_players; i++) {
        const btn = document.createElement('button');
        btn.classList.add('num-btn'); btn.textContent = i;
        if (s.final_killed.includes(i)) {
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
