import { s, getStageVoiceName, getActualTarget, applyTimeWolfReflection, wolf_faction, evil_roles } from './core.js';
import { buildNightQueue } from './main.js';

// ==========================================
// 角色行動結果處理 — 將玩家選擇寫入遊戲狀態
// ==========================================

/**
 * 處理查驗類角色的結果顯示邏輯
 * @returns {{ label: string, text: string, color: string }} 結果物件
 */
export function resolveInspectionResult() {
    let actor_seat = s.current_actor_seat || Object.keys(s.player_roles).find(k => s.player_roles[k] === s.current_stage || s.player_roles[k] === 'awaken_' + s.current_stage);
    let is_vwk_turn = actor_seat && s.player_status[actor_seat]?.isVWK;

    let label = "該名玩家的查驗結果為：";
    let text = "";
    let color = "";

    let log_name = getStageVoiceName(s.current_stage, s.current_sub_label);
    if (s.current_board.id === '12_shadow' && parseInt(actor_seat) === s.shadow_seer_seat) {
        log_name += ' (燈影)';
    }

    if (s.current_stage === 'awaken_seer') {
        label = "兩名玩家的陣營為：";
        s.awk_seer_targets = [applyTimeWolfReflection(getActualTarget(s.selected_numbers_arr[0]), s.current_actor_seat), applyTimeWolfReflection(getActualTarget(s.selected_numbers_arr[1]), s.current_actor_seat)];
        let is_evil = evil_roles.includes(s.player_roles[s.awk_seer_targets[0]]) || evil_roles.includes(s.player_roles[s.awk_seer_targets[1]]);
        if (is_evil && !['snow_wolf', 'hidden_wolf', 'wolf_brother_little'].includes(s.player_roles[s.awk_seer_targets[0]]) && !['snow_wolf', 'hidden_wolf', 'wolf_brother_little'].includes(s.player_roles[s.awk_seer_targets[1]])) {
            text = "🐺 疑似狼人"; color = "#e94560";
        } else {
            text = "🧑‍🌾 雙好人"; color = "#00ff88";
        }
        s.night_action_log.push(`【${log_name}】查驗了 ${s.awk_seer_targets[0]}號 和 ${s.awk_seer_targets[1]}號`);
    } else if (s.current_stage === 'snake_seer') {
        let actual_target = applyTimeWolfReflection(getActualTarget(parseInt(s.selected_number)), s.current_actor_seat);
        s.night_action_log.push(`【白蛇預言家】查驗了 ${actual_target}號`);
        let target_role = s.player_roles[actual_target];
        if (target_role === 'snake_phantom') {
            text = "✅ 是許仙尋香魅影"; color = "#00ff88";
        } else {
            text = "❌ 不是許仙尋香魅影"; color = "#e94560";
        }
    } else if (s.current_stage === 'real_fox') {
        label = "查驗範圍的陣營為：";
        let t = parseInt(s.selected_number);
        let p1 = t - 1 < 1 ? s.total_players : t - 1;
        let p2 = t + 1 > s.total_players ? 1 : t + 1;
        let is_t_infected = (t === s.seed_wolf_target);
        let is_p1_infected = (p1 === s.seed_wolf_target);
        let is_p2_infected = (p2 === s.seed_wolf_target);
        let has_wolf = wolf_faction.includes(s.player_roles[t]) || wolf_faction.includes(s.player_roles[p1]) || wolf_faction.includes(s.player_roles[p2]) || is_t_infected || is_p1_infected || is_p2_infected;
        if (has_wolf) { text = "🐺 有狼人"; color = "#e94560"; }
        else { text = "🧑‍🌾 無狼人"; color = "#00ff88"; }
        s.night_action_log.push(`【${log_name}】查驗了 ${t}號 範圍`);
    } else if (s.current_stage === 'lucky_boy_action') {
        let actual_target = applyTimeWolfReflection(getActualTarget(parseInt(s.selected_number)), s.current_actor_seat);
        s.night_action_log.push(`【幸運兒(${s.merchant_target}號)】查驗了 ${actual_target}號`);
        let target_role = s.player_roles[actual_target];
        let is_evil = evil_roles.includes(target_role) || s.player_status[actual_target]?.isVWK;
        if (['snow_wolf', 'hidden_wolf', 'wolf_brother_little'].includes(target_role)) is_evil = false;
        if (target_role === 'pumpkin') { let gs = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'gargoyle'); if (gs && !s.final_killed.includes(parseInt(gs))) is_evil = false; }
        if (target_role === 'treasure_master' && s.is_treasure_hunter_evil) is_evil = true;
        if (is_evil) { text = "🐺 狼人 (壞人)"; color = "#e94560"; }
        else { text = "🧑‍🌾 好人"; color = "#00ff88"; }
    } else if (s.current_stage === 'gray_wolf_action') {
        let actual_target = applyTimeWolfReflection(getActualTarget(parseInt(s.selected_number)), s.current_actor_seat);
        s.night_action_log.push(`【灰太狼(偷取預言家)】查驗了 ${actual_target}號`);
        let target_role = s.player_roles[actual_target];
        let is_evil = evil_roles.includes(target_role) || s.player_status[actual_target]?.isVWK;
        if (['snow_wolf', 'hidden_wolf', 'wolf_brother_little'].includes(target_role)) is_evil = false;
        if (target_role === 'pumpkin') { let gs = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'gargoyle'); if (gs && !s.final_killed.includes(parseInt(gs))) is_evil = false; }
        if (target_role === 'treasure_master' && s.is_treasure_hunter_evil) is_evil = true;
        if (is_evil) { text = "🐺 狼人 (壞人)"; color = "#e94560"; }
        else { text = "🧑‍🌾 好人"; color = "#00ff88"; }
    } else {
        let actual_target = applyTimeWolfReflection(getActualTarget(parseInt(s.selected_number)), s.current_actor_seat);
        s.night_action_log.push(`【${log_name}】查驗了 ${actual_target}號`);

        // 能觸發惡靈騎士反傷的好人查驗角色
        const seer_like_roles = ['seer', 'psychic', 'pure_white', 'fool_seer'];

        if (['seer'].includes(s.current_stage)) {
            s.seer_target = actual_target;
            let target_role = s.player_roles[actual_target];
            if (is_vwk_turn) {
                text = `${s.ROLE_DICT[target_role].icon} ${s.ROLE_DICT[target_role].name}`;
                color = "#fca311";
            } else {
                let is_evil = evil_roles.includes(target_role) || s.player_status[actual_target]?.isVWK;
                if (['snow_wolf', 'hidden_wolf', 'wolf_brother_little'].includes(target_role)) is_evil = false;
                // 規則：南瓜鬼在石像鬼死前被查驗皆為金水（第一夜石像鬼必定存活）
                if (target_role === 'pumpkin') {
                    let gargoyleSeat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'gargoyle');
                    if (gargoyleSeat && !s.final_killed.includes(parseInt(gargoyleSeat))) is_evil = false;
                }
                // 規則：盜寶大師底牌有狼 → 為狼人陣營（查殺）
                if (target_role === 'treasure_master' && s.is_treasure_hunter_evil) is_evil = true;
                if (target_role === 'machine_wolf' && s.machine_wolf_target) {
                    let learned_role = s.player_roles[s.machine_wolf_target];
                    if (!evil_roles.includes(learned_role)) is_evil = false;
                }
                if (s.current_board.id === '12_shadow' && parseInt(actor_seat) === s.shadow_seer_seat) is_evil = !is_evil;
                if (is_evil) { text = "🐺 狼人 (壞人)"; color = "#e94560"; }
                else { text = "🧑‍🌾 好人"; color = "#00ff88"; }
            }
        } else if (s.current_stage === 'machine_wolf') {
            s.machine_wolf_target = actual_target;
            let r = s.player_roles[actual_target];
            text = `${s.ROLE_DICT[r].icon} ${s.ROLE_DICT[r].name}`;
            color = "#fca311";
        } else if (s.current_stage === 'demon') {
            // 惡魔查驗：顯示目標是「神牌」還是「民牌」
            let target_role = s.player_roles[actual_target];
            let civilian_roles = ['villager', 'alpaca', 'old_hooligan', 'high_villager', 'very_good', 'rabbit', 'twin'];
            let is_god = !civilian_roles.includes(target_role) && !evil_roles.includes(target_role) && !wolf_faction.includes(target_role);
            text = is_god ? "⚡ 神牌" : "🧑‍🌾 民牌";
            color = is_god ? "#fca311" : "#00ff88";
            s.night_action_log.push(`【惡魔】查驗了 ${actual_target}號 → ${is_god ? '神牌' : '民牌'}`);
        } else {
            // 通靈師、純白之女等好人查驗角色也能觸發惡靈騎士反傷
            if (seer_like_roles.includes(s.current_stage)) s.seer_target = actual_target;
            if (s.current_stage === 'gargoyle') s.gargoyle_target = actual_target;
            let display_role = s.player_roles[actual_target];
            if (s.current_stage === 'psychic' && display_role === 'machine_wolf' && s.machine_wolf_target) display_role = s.player_roles[s.machine_wolf_target];
            text = `${s.ROLE_DICT[display_role].icon} ${s.ROLE_DICT[display_role].name}`;
            color = "#fca311";
        }
    }

    return { label, text, color };
}

/**
 * 處理確認按鈕按下後的狀態寫入（非查驗類角色）
 * 將玩家選擇結果寫入 s 狀態物件並記錄到 night_action_log
 */
export function resolveNonInspectionAction() {
    // 取得需要查驗結果的角色列表（用於跳過判定）
    let needs_result_roles = ['seer', 'real_fox', 'awaken_seer', 'gargoyle', 'psychic', 'pure_white', 'fool_seer', 'wolf_witch', 'machine_wolf', 'snake_seer', 'demon'];
    if (s.current_stage === 'lucky_boy_action' && s.merchant_item === 'seer' && s.merchant_type !== 'black_market') needs_result_roles.push('lucky_boy_action');
    if (s.current_stage === 'gray_wolf_action' && s.gray_wolf_stolen_skill === 'seer') needs_result_roles.push('gray_wolf_action');

    // 查驗類角色跳過時的紀錄
    if (needs_result_roles.includes(s.current_stage) && s.selected_number === 'skip') {
        s.night_action_log.push(`【${getStageVoiceName(s.current_stage, s.current_sub_label)}】跳過技能`);
        return;
    }

    // === 各角色結果處理 ===

    // --- 喜羊羊 ---
    if (s.current_stage === 'pleasant_goat') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        let pg_seat = parseInt(s.current_actor_seat || Object.keys(s.player_roles).find(k => s.player_roles[k] === 'pleasant_goat'));
        if (t) {
            if (t === pg_seat) { s.pleasant_goat_guard = t; s.pleasant_goat_anti_theft = t; }
            else { if (s.current_sub_label === 'guard') s.pleasant_goat_guard = t; if (s.current_sub_label === 'anti_theft') s.pleasant_goat_anti_theft = t; }
            s.night_action_log.push(`【喜羊羊】對 ${t}號 使用了 ${t === pg_seat ? '雙重防護' : (s.current_sub_label === 'guard' ? '守護' : '防盜')}`);
        } else { s.night_action_log.push(`【喜羊羊】未發動技能`); }
    }
    // --- 灰太狼偷取 ---
    else if (s.current_stage === 'gray_wolf_steal') {
        s.gray_wolf_stolen_player = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.gray_wolf_stolen_player ? `【灰太狼】嘗試偷取 ${s.gray_wolf_stolen_player}號` : `【灰太狼】未偷取`);
    }
    // --- 灰太狼發動技能 ---
    else if (s.current_stage === 'gray_wolf_action') {
        let target_role = s.gray_wolf_stolen_player ? s.player_roles[s.gray_wolf_stolen_player] : null;
        if (!s.gray_wolf_stolen_player || s.gray_wolf_stolen_player === s.pleasant_goat_anti_theft) {
            s.night_action_log.push(`【灰太狼】偷取失敗 (目標被防盜或未選擇)`);
        } else if (target_role === 'pleasant_goat') {
            s.night_action_log.push(`【灰太狼】發現目標是喜羊羊，猜測其使用了：${s.gray_wolf_guess === 'guard' ? '守護' : '防盜'}`);
        } else if (['wolf', 'little_gray_wolf'].includes(target_role)) {
            s.night_action_log.push(`【灰太狼】偷取失敗 (目標為狼人)`);
        } else if (s.gray_wolf_stolen_skill === 'witch' && s.selected_number && s.selected_number !== 'skip') {
            s.witch_poison_target = applyTimeWolfReflection(getActualTarget(parseInt(s.selected_number)), s.current_actor_seat);
            s.night_action_log.push(`【灰太狼(偷取女巫)】對 ${s.witch_poison_target}號 使用了毒藥`);
        } else if (s.gray_wolf_stolen_skill === 'guard' && s.selected_number && s.selected_number !== 'skip') {
            s.guard_target = applyTimeWolfReflection(getActualTarget(parseInt(s.selected_number)), s.current_actor_seat);
            s.night_action_log.push(`【灰太狼(偷取守衛)】守護了 ${s.guard_target}號`);
        } else if (s.gray_wolf_stolen_skill === 'dreamwalker' && s.selected_number && s.selected_number !== 'skip') {
            s.dream_target = applyTimeWolfReflection(getActualTarget(parseInt(s.selected_number)), s.current_actor_seat);
            s.night_action_log.push(`【灰太狼(偷取攝夢人)】攝夢了 ${s.dream_target}號`);
        } else if (s.selected_number === 'skip') {
            s.night_action_log.push(`【灰太狼(偷取技能)】跳過發動`);
        }
    }
    // --- 占卜師 ---
    else if (s.current_stage === 'diviner') {
        s.diviner_mark = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.diviner_mark ? `【占卜師】標記了 ${s.diviner_mark}號` : `【占卜師】未發動技能`);
    }
    // --- 盜賊 ---
    else if (s.current_stage === 'thief') {
        s.player_roles[Object.keys(s.player_roles).find(k => s.player_roles[k] === 'thief')] = s.thief_chosen_role;
        s.discarded_roles = s.spare_cards.filter(r => r !== s.thief_chosen_role);
        s.night_action_log.push(`【盜賊】選擇了 ${s.ROLE_DICT[s.thief_chosen_role].name}`);
        buildNightQueue();
    }
    // --- 邱比特 ---
    else if (s.current_stage === 'cupid') {
        s.cupid_lovers = [...s.selected_numbers_arr];
        s.night_action_log.push(`【邱比特】連接了 ${s.cupid_lovers.join('和')}號`);
    }
    // --- 混血兒 / 野孩子 / 覺醒孤獨少女 / 影子 ---
    else if (['half_blood', 'wild_child', 'awaken_lonely_girl', 'shadow'].includes(s.current_stage)) {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        if (s.current_stage === 'half_blood') s.half_blood_target = t;
        if (s.current_stage === 'wild_child') s.wild_child_target = t;
        if (s.current_stage === 'awaken_lonely_girl') s.lonely_girl_target = t;
        if (s.current_stage === 'shadow') s.shadow_master_target = t;
        s.night_action_log.push(t ? `【${s.ROLE_DICT[s.current_stage].name}】選擇了 ${t}號` : `【${s.ROLE_DICT[s.current_stage].name}】未選擇`);
    }
    // --- 鬼魅新娘選新郎 ---
    else if (s.current_stage === 'ghost_bride') {
        s.ghost_bride_groom = getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(`【鬼魅新娘】選擇了 ${s.ghost_bride_groom}號為新郎`);
    }
    // --- 鬼魅新娘選證婚人 ---
    else if (s.current_stage === 'ghost_bride_couple') {
        s.ghost_bride_witness = getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(`【鬼魅新娘與新郎】選擇了 ${s.ghost_bride_witness}號為證婚人`);
    }
    // --- 覺醒攝夢人 ---
    else if (s.current_stage === 'awaken_dreamwalker') {
        s.awk_dreamwalker_target = getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(`【覺醒攝夢人】指定了 ${s.awk_dreamwalker_target}號為夢語者`);
    }
    // --- 蝕時狼妃 ---
    else if (s.current_stage === 'time_wolf') {
        s.time_wolf_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.time_wolf_target ? `【蝕時狼妃】封鎖了 ${s.time_wolf_target}號` : `【蝕時狼妃】未封鎖`);
    }
    // --- 覺醒白痴 ---
    else if (s.current_stage === 'awaken_idiot') {
        s.awk_idiot_target = applyTimeWolfReflection((s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number)), s.current_actor_seat);
        s.night_action_log.push(s.awk_idiot_target ? `【覺醒白痴】守護了 ${s.awk_idiot_target}號` : `【覺醒白痴】未守護`);
    }
    // --- 烏鴉 ---
    else if (s.current_stage === 'crow') {
        s.crow_target = applyTimeWolfReflection((s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number)), s.current_actor_seat);
        s.night_action_log.push(s.crow_target ? `【烏鴉】詛咒了 ${s.crow_target}號` : `【烏鴉】未詛咒`);
    }
    // --- 魔術師 / 詭術師 / 狼術師（交換號碼）---
    else if (['magician', 'trickster', 'wolf_sorcerer'].includes(s.current_stage)) {
        let swap = (s.selected_number === 'skip') ? [] : [...s.selected_numbers_arr];
        if (s.current_stage === 'magician') s.magician_swap = swap;
        if (s.current_stage === 'trickster') s.trickster_swap = swap;
        if (s.current_stage === 'wolf_sorcerer') s.wolf_sorcerer_swap = swap;
        s.night_action_log.push(swap.length ? `【${s.ROLE_DICT[s.current_stage].name}】交換了 ${swap[0]}號 和 ${swap[1]}號` : `【${s.ROLE_DICT[s.current_stage].name}】未交換`);
    }
    // --- 尋香魅影 / 許仙尋香魅影（綁定）---
    else if (s.current_stage === 'phantom' || s.current_stage === 'snake_phantom') {
        s.phantom_targets = (s.selected_number === 'skip') ? [] : [getActualTarget(s.selected_numbers_arr[0]), getActualTarget(s.selected_numbers_arr[1])];
        s.night_action_log.push(s.phantom_targets.length ? `【${s.ROLE_DICT[s.current_stage].name}】綁定了 ${s.phantom_targets.join('和')}號` : `【${s.ROLE_DICT[s.current_stage].name}】未綁定`);
    }
    // --- 夢魘 ---
    else if (s.current_stage === 'nightmare') {
        s.nightmare_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.nightmare_target ? `【夢魘】恐懼了 ${s.nightmare_target}號` : `【夢魘】未恐懼`);
    }
    // --- 企鵝 ---
    else if (s.current_stage === 'penguin') {
        s.penguin_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.penguin_target ? `【企鵝】冰凍了 ${s.penguin_target}號` : `【企鵝】未冰凍`);
    }
    // --- 名媛 ---
    else if (s.current_stage === 'celebrity') {
        s.celebrity_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.celebrity_target ? `【名媛】寵幸了 ${s.celebrity_target}號` : `【名媛】未寵幸`);
    }
    // --- 蠱惑師 ---
    else if (s.current_stage === 'charmer') {
        s.charmer_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.charmer_target ? `【蠱惑師】蠱惑了 ${s.charmer_target}號` : `【蠱惑師】未蠱惑`);
    }
    // --- 獵魔人 ---
    else if (s.current_stage === 'demon_hunter') {
        s.demon_hunter_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.demon_hunter_target ? `【獵魔人】狩獵了 ${s.demon_hunter_target}號` : `【獵魔人】未狩獵`);
    }
    // --- 開膛手傑克 ---
    else if (s.current_stage === 'jack_ripper') {
        s.jack_ripper_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.jack_ripper_target ? `【開膛手傑克】擊殺了 ${s.jack_ripper_target}號` : `【開膛手傑克】未擊殺`);
    }
    // --- 禁言長老 ---
    else if (s.current_stage === 'silence_elder') {
        s.silence_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.silence_target ? `【禁言長老】禁言了 ${s.silence_target}號` : `【禁言長老】未禁言`);
    }
    // --- 黑蝙蝠（庇護）---
    else if (s.current_stage === 'black_bat') {
        s.black_bat_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.black_bat_target ? `【黑蝙蝠】庇護了 ${s.black_bat_target}號` : `【黑蝙蝠】未庇護`);
    }
    // --- 搗蛋鬼（耍寶）---
    else if (s.current_stage === 'troublemaker') {
        s.troublemaker_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.troublemaker_target ? `【搗蛋鬼】耍寶了 ${s.troublemaker_target}號` : `【搗蛋鬼】未耍寶`);
    }
    // --- 流光伯爵（庇護）---
    else if (s.current_stage === 'light_count') {
        s.light_count_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.light_count_target ? `【流光伯爵】庇護了 ${s.light_count_target}號` : `【流光伯爵】未庇護`);
    }
    // --- 守衛 ---
    else if (s.current_stage === 'guard') {
        s.guard_target = applyTimeWolfReflection((s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number)), s.current_actor_seat);
        s.night_action_log.push(s.guard_target ? `【守衛】守護了 ${s.guard_target}號` : `【守衛】空守`);
    }
    // --- 攝夢人 ---
    else if (s.current_stage === 'dreamwalker') {
        s.dream_target = applyTimeWolfReflection(getActualTarget(parseInt(s.selected_number)), s.current_actor_seat);
        s.night_action_log.push(`【攝夢人】攝夢了 ${s.dream_target}號`);
    }
    // --- 百變狼王(熊) 魅惑 ---
    else if (s.current_stage === 'bear') {
        s.vwk_charm_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.vwk_charm_target ? `【百變狼王(熊)】魅惑了 ${s.vwk_charm_target}號` : `【百變狼王(熊)】未魅惑`);
    }
    // --- 覺醒狼王分槍 ---
    else if (s.current_stage === 'awaken_wolf_king_gun') {
        s.awk_wolf_gun_target = (s.selected_number === 'skip') ? null : parseInt(s.selected_number);
        s.night_action_log.push(s.awk_wolf_gun_target ? `【覺醒狼王】把槍分給了 ${s.awk_wolf_gun_target}號` : `【覺醒狼王】未分槍，自己保留兩把槍`);
    }
    // --- 黑市商人 / 奇蹟商人 ---
    else if (['black_market', 'miracle_merchant'].includes(s.current_stage)) {
        s.merchant_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.merchant_type = s.merchant_target ? s.current_stage : null;
        let item_text = s.merchant_item === 'seer' ? '預言家查驗' : s.merchant_item === 'poison' ? '女巫毒藥' : '守衛護盾/獵人的槍';
        s.night_action_log.push(s.merchant_target ? `【${s.ROLE_DICT[s.current_stage].name}】將 ${item_text} 給了 ${s.merchant_target}號` : `【${s.ROLE_DICT[s.current_stage].name}】未發動技能`);
    }
    // --- 幸運兒 ---
    else if (s.current_stage === 'lucky_boy_action') {
        if (s.merchant_type === 'black_market') {
            s.night_action_log.push(`【幸運兒(${s.merchant_target}號)】獲得黑市商人技能，技能暫時還無法發動`);
        } else {
            let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
            if (t) {
                if (s.merchant_item === 'poison') s.witch_poison_target = t;
                if (s.merchant_item === 'guard') s.guard_target = t;
                if (s.merchant_item === 'seer') s.seer_target = t;
            }
            let item_text = s.merchant_item === 'seer' ? '預言家查驗' : s.merchant_item === 'poison' ? '女巫毒藥' : '守衛護盾';
            s.night_action_log.push(t ? `【幸運兒(${s.merchant_target}號)】使用了【${item_text}】對 ${t}號` : `【幸運兒(${s.merchant_target}號)】未使用技能`);
        }
    }
    // --- 狼人（含種狼感染）---
    else if (s.current_stage === 'wolf') {
        if (s.is_seed_wolf_infecting) {
            s.seed_wolf_target = getActualTarget(parseInt(s.selected_number));
            s.wolf_kill_target = null;
            s.night_action_log.push(s.seed_wolf_target ? `【種狼】感染了 ${s.seed_wolf_target}號` : `【種狼】空感染`);
        } else {
            s.wolf_kill_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
            let lg_log = Object.values(s.player_roles).includes('little_girl') ? '與小女孩' : '';
            s.night_action_log.push(s.wolf_kill_target ? `【狼人${lg_log}】擊殺了 ${s.wolf_kill_target}號` : `【狼人${lg_log}】空刀`);
        }
    }
    // --- 大野狼 ---
    else if (s.current_stage === 'big_bad_wolf') {
        s.big_bad_wolf_kill_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.big_bad_wolf_kill_target ? `【大野狼】擊殺了 ${s.big_bad_wolf_kill_target}號` : `【大野狼】空刀`);
    }
    // --- 狼美人（魅惑）---
    else if (s.current_stage === 'wolf_beauty') {
        s.beauty_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.beauty_target ? `【狼美人】魅惑了 ${s.beauty_target}號` : `【狼美人】未魅惑`);
    }
    // --- 覺醒狼美人（魅惑）---
    else if (s.current_stage === 'awaken_wolf_beauty') {
        s.awk_beauty_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.awk_beauty_target ? `【覺醒狼美人】魅惑了 ${s.awk_beauty_target}號` : `【覺醒狼美人】未魅惑`);
    }
    // --- 煉金魔女（未明之霧）---
    else if (s.current_stage === 'alchemist') {
        s.alchemist_fog_targets = (s.selected_number === 'skip') ? [] : [...s.selected_numbers_arr];
        s.night_action_log.push(s.alchemist_fog_targets.length ? `【煉金魔女】對 ${s.alchemist_fog_targets.join(', ')}號 施放未名之霧` : `【煉金魔女】未放霧`);
    }
    // --- 覺醒石像鬼（轉化）---
    else if (s.current_stage === 'awaken_gargoyle') {
        s.awk_gargoyle_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.awk_gargoyle_target ? `【覺醒石像鬼】轉化了 ${s.awk_gargoyle_target}號` : `【覺醒石像鬼】未轉化`);
    }
    // --- 覺醒石像鬼A ---
    else if (s.current_stage === 'awaken_gargoyle_A') {
        s.awk_gargoyle_target_a = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        if (s.awk_gargoyle_target_a && s.player_roles[s.awk_gargoyle_target_a] === 'machine_wolf') s.awk_gargoyle_target_a = null;
        s.night_action_log.push(s.awk_gargoyle_target_a ? `【覺醒石像鬼A】轉化了 ${s.awk_gargoyle_target_a}號` : `【覺醒石像鬼A】未轉化`);
    }
    // --- 覺醒石像鬼B ---
    else if (s.current_stage === 'awaken_gargoyle_B') {
        s.awk_gargoyle_target_b = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        if (s.awk_gargoyle_target_b && s.player_roles[s.awk_gargoyle_target_b] === 'machine_wolf') s.awk_gargoyle_target_b = null;
        s.night_action_log.push(s.awk_gargoyle_target_b ? `【覺醒石像鬼B】轉化了 ${s.awk_gargoyle_target_b}號` : `【覺醒石像鬼B】未轉化`);
    }
    // --- 女巫 / 覺醒女巫 ---
    else if (s.current_stage === 'witch' || s.current_stage === 'awaken_witch') {
        let log_name = s.current_stage === 'awaken_witch' ? '覺醒女巫' : '女巫';
        if (s.selected_number === 'skip') {
            s.witch_poison_target = null;
            s.night_action_log.push(`【${log_name}】未發動技能`);
        } else if (s.selected_number === 'witch_save') {
            s.is_witch_saved = true;
            s.night_action_log.push(`【${log_name}】使用了救藥`);
        } else if (s.selected_number && !isNaN(s.selected_number) && s.current_stage === 'witch') {
            s.witch_poison_target = applyTimeWolfReflection(getActualTarget(parseInt(s.selected_number)), s.current_actor_seat);
            s.night_action_log.push(`【女巫】對 ${s.witch_poison_target}號 使用了毒藥`);
        }
    }
    // --- 殭屍（感染 0~2 人，使用多選）---
    else if (s.current_stage === 'zombie') {
        if (s.selected_number === 'skip' || s.selected_numbers_arr.length === 0) {
            s.night_action_log.push(`【殭屍】未感染`);
        } else {
            if (!s.zombie_infected) s.zombie_infected = [];
            s.selected_numbers_arr.forEach(seat => {
                let target = getActualTarget(seat);
                if (target && !s.zombie_infected.includes(target)) s.zombie_infected.push(target);
            });
            s.night_action_log.push(`【殭屍】感染了 ${s.selected_numbers_arr.join(',')}號`);
        }
    }
    // --- 子狐（魅惑，一次性）---
    else if (s.current_stage === 'fox') {
        let target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.fox_charm_target = target;
        s.night_action_log.push(target ? `【子狐】魅惑了 ${target}號` : `【子狐】未魅惑`);
    }
    // --- 禁言長老 ---
    else if (s.current_stage === 'silence_elder') {
        s.silence_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.silence_target ? `【禁言長老】禁言了 ${s.silence_target}號` : `【禁言長老】未禁言`);
    }
    // --- 超級守墓人（選繼承者）---
    else if (s.current_stage === 'super_grave_keeper') {
        let target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.sp_grave_keeper_heir = target;
        s.night_action_log.push(target ? `【超級守墓人】選擇了 ${target}號 作為繼承者` : `【超級守墓人】未選擇繼承者`);
    }
    // --- 傀儡選擇（唯鄰是從）---
    else if (s.current_stage === 'puppet_select') {
        let target = getActualTarget(parseInt(s.selected_number));
        s.puppet_target = target;
        s.night_action_log.push(`【狼人】選擇了 ${target}號 作為傀儡`);
    }
    // --- 梅杜莎（石化）---
    else if (s.current_stage === 'medusa') {
        s.medusa_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.medusa_target ? `【梅杜莎】石化了 ${s.medusa_target}號` : `【梅杜莎】未石化`);
    }
    // --- 機械狼（學習）---
    else if (s.current_stage === 'machine_wolf') {
        let target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.machine_wolf_learn_target = target;
        if (target) {
            let learned_role = s.player_roles[target];
            s.night_action_log.push(`【機械狼】學習了 ${target}號 的技能（${s.ROLE_DICT[learned_role]?.name || learned_role}）`);
        } else {
            s.night_action_log.push(`【機械狼】未學習`);
        }
    }
    // --- 邪惡商人（分槍）---
    else if (s.current_stage === 'evil_merchant') {
        let target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.evil_merchant_gun_target = target;
        s.night_action_log.push(target ? `【邪惡商人】把獵槍給了 ${target}號` : `【邪惡商人】未分槍`);
    }
    // --- 黑夜使者（庇護狼人）---
    else if (s.current_stage === 'dark_messenger') {
        let target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.dark_messenger_target = target;
        s.night_action_log.push(target ? `【黑夜使者】庇護了 ${target}號` : `【黑夜使者】未庇護`);
    }
    // --- 潘朵拉（贈魔盒）---
    else if (s.current_stage === 'pandora') {
        let target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        if (target) {
            s.pandora_target = target;
            // 隨機從魔盒池抽取一個技能：刀、毒、希望之光、日槍A、日槍B
            if (!s.pandora_pool) s.pandora_pool = ['knife', 'poison', 'hope_light', 'day_gun', 'day_gun'];
            let random_idx = Math.floor(Math.random() * s.pandora_pool.length);
            s.pandora_gift = s.pandora_pool.splice(random_idx, 1)[0];
            let gift_names = { knife: '一把刀', poison: '一滴毒', hope_light: '希望之光', day_gun: '日槍' };
            s.night_action_log.push(`【潘朵拉】贈送魔盒給了 ${target}號 → 開出：${gift_names[s.pandora_gift]}`);
        } else {
            s.pandora_target = null;
            s.night_action_log.push(`【潘朵拉】未贈送`);
        }
    }
    // --- 怪盜狼王（發動無敵）---
    else if (s.current_stage === 'phantom_king') {
        if (s.selected_number === 'skip') {
            // skip 按鈕文字是「發動無敵」
            s.is_phantom_thief_invincible = true;
            s.night_action_log.push(`【怪盜狼王】發動了無敵技能`);
        } else {
            s.is_phantom_thief_invincible = false;
            s.night_action_log.push(`【怪盜狼王】未發動無敵`);
        }
    }
    // --- 超級黑市商人（選三人分配禮物）---
    else if (s.current_stage === 'super_black_market') {
        if (s.selected_number === 'skip' || s.selected_numbers_arr.length === 0) {
            s.night_action_log.push(`【超級黑市商人】未發動技能`);
        } else {
            let targets = s.selected_numbers_arr.map(n => getActualTarget(n));
            s.sp_merchant_targets = targets; // [查驗, 毒藥, 獵槍]
            let gifts = ['查驗', '毒藥', '獵槍'];
            targets.forEach((t, i) => {
                s.night_action_log.push(`【超級黑市商人】給了 ${t}號 → ${gifts[i]}`);
            });
            // 判斷是否三人皆為好人 → 商人變狼
            let is_all_good = targets.every(t => !wolf_faction.includes(s.player_roles[t]));
            if (is_all_good) {
                s.is_sp_merchant_turns_evil = true;
                s.night_action_log.push(`【超級黑市商人】三位幸運兒皆好人，商人將於天亮後變為狼人陣營`);
            }
            // 獵槍幸運兒立即獲得開槍權
            s.evil_merchant_gun_target = targets[2]; // 復用邪惡商人的槍位判定
        }
    }
    // --- 盜寶大師（選底牌身分）---
    else if (s.current_stage === 'treasure_master') {
        if (s.treasure_hunter_choice) {
            // 判斷陣營：有狼陣營底牌 → 盜寶大師為狼人陣營
            let has_wolf_in_spare = s.spare_cards.some(r => wolf_faction.includes(r));
            s.is_treasure_hunter_evil = has_wolf_in_spare;
            s.night_action_log.push(`【盜寶大師】選擇了 ${s.ROLE_DICT[s.treasure_hunter_choice]?.name || s.treasure_hunter_choice}${has_wolf_in_spare ? '（底牌有狼，為狼人陣營）' : '（底牌無狼，為好人陣營）'}`);
        } else {
            s.night_action_log.push(`【盜寶大師】未選擇`);
        }
    }
}
