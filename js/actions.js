// js/actions.js
import { s, getStageVoiceName, getActualTarget, applyTimeWolfReflection, wolf_faction, evil_roles, addNightAction, getNightTarget, getNightTargets } from './core.js';
import { buildNightQueue } from './main.js';

export function resolveInspectionResult() {
    let actor_seat = s.current_actor_seat || Object.keys(s.player_roles).find(k => s.player_roles[k] === s.current_stage || s.player_roles[k] === 'awaken_' + s.current_stage);
    let is_vwk_turn = actor_seat && s.player_status[actor_seat]?.isVWK;
    let label = "該名玩家的查驗結果為："; let text = ""; let color = "";
    let log_name = getStageVoiceName(s.current_stage, s.current_sub_label);
    if (s.current_board.id === '12_shadow' && parseInt(actor_seat) === s.shadow_seer_seat) log_name += ' (燈影)';

    if (s.current_stage === 'awaken_seer') {
        label = "兩名玩家的陣營為：";
        let targets = [applyTimeWolfReflection(getActualTarget(s.selected_numbers_arr[0]), actor_seat), applyTimeWolfReflection(getActualTarget(s.selected_numbers_arr[1]), actor_seat)];
        let is_evil = evil_roles.includes(s.player_roles[targets[0]]) || evil_roles.includes(s.player_roles[targets[1]]);
        if (is_evil && !['snow_wolf', 'hidden_wolf', 'wolf_brother_little'].includes(s.player_roles[targets[0]]) && !['snow_wolf', 'hidden_wolf', 'wolf_brother_little'].includes(s.player_roles[targets[1]])) {
            text = "🐺 疑似狼人"; color = "#e94560";
        } else { text = "🧑‍🌾 雙好人"; color = "#00ff88"; }
        s.night_action_log.push(`【${log_name}】查驗了 ${targets[0]}號 和 ${targets[1]}號`);
        addNightAction(actor_seat, 'awaken_seer', 'inspect', targets);
    } else if (s.current_stage === 'snake_seer') {
        let actual_target = applyTimeWolfReflection(getActualTarget(parseInt(s.selected_number)), actor_seat);
        s.night_action_log.push(`【白蛇預言家】查驗了 ${actual_target}號`);
        if (s.player_roles[actual_target] === 'snake_phantom') { text = "✅ 是許仙尋香魅影"; color = "#00ff88"; } else { text = "❌ 不是許仙尋香魅影"; color = "#e94560"; }
        addNightAction(actor_seat, 'snake_seer', 'inspect', [actual_target]);
    } else if (s.current_stage === 'real_fox') {
        label = "查驗範圍的陣營為："; let t = parseInt(s.selected_number);
        let p1 = t - 1 < 1 ? s.total_players : t - 1; let p2 = t + 1 > s.total_players ? 1 : t + 1;
        let has_wolf = wolf_faction.includes(s.player_roles[t]) || wolf_faction.includes(s.player_roles[p1]) || wolf_faction.includes(s.player_roles[p2]) || t === s.seed_wolf_target || p1 === s.seed_wolf_target || p2 === s.seed_wolf_target;
        if (has_wolf) { text = "🐺 有狼人"; color = "#e94560"; } else { text = "🧑‍🌾 無狼人"; color = "#00ff88"; }
        s.night_action_log.push(`【${log_name}】查驗了 ${t}號 範圍`);
        addNightAction(actor_seat, 'real_fox', 'inspect', [p1, t, p2]);
    } else if (s.current_stage === 'lucky_boy_action' || s.current_stage === 'gray_wolf_action') {
        let actual_target = applyTimeWolfReflection(getActualTarget(parseInt(s.selected_number)), actor_seat);
        let logPrefix = s.current_stage === 'lucky_boy_action' ? `【幸運兒(${s.merchant_target}號)】` : `【灰太狼(偷取預言家)】`;
        s.night_action_log.push(`${logPrefix}查驗了 ${actual_target}號`);
        let is_evil = evil_roles.includes(s.player_roles[actual_target]) || s.player_status[actual_target]?.isVWK;
        if (['snow_wolf', 'hidden_wolf', 'wolf_brother_little'].includes(s.player_roles[actual_target])) is_evil = false;
        if (s.player_roles[actual_target] === 'pumpkin') { let gs = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'gargoyle'); if (gs && !s.final_killed.includes(parseInt(gs))) is_evil = false; }
        if (s.player_roles[actual_target] === 'treasure_master' && s.is_treasure_hunter_evil) is_evil = true;
        if (is_evil) { text = "🐺 狼人 (壞人)"; color = "#e94560"; } else { text = "🧑‍🌾 好人"; color = "#00ff88"; }
        addNightAction(s.current_stage === 'lucky_boy_action' ? s.merchant_target : actor_seat, s.current_stage, 'inspect', [actual_target]);
    } else {
        let actual_target = applyTimeWolfReflection(getActualTarget(parseInt(s.selected_number)), actor_seat);
        s.night_action_log.push(`【${log_name}】查驗了 ${actual_target}號`);
        if (['seer'].includes(s.current_stage)) {
            let target_role = s.player_roles[actual_target];
            if (is_vwk_turn) { text = `${s.ROLE_DICT[target_role].icon} ${s.ROLE_DICT[target_role].name}`; color = "#fca311"; } else {
                let is_evil = evil_roles.includes(target_role) || s.player_status[actual_target]?.isVWK;
                if (['snow_wolf', 'hidden_wolf', 'wolf_brother_little'].includes(target_role)) is_evil = false;
                if (actual_target === s.puppet_target) is_evil = true;
                if (target_role === 'pumpkin') { let gs = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'gargoyle'); if (gs && !s.final_killed.includes(parseInt(gs))) is_evil = false; }
                if (target_role === 'treasure_master' && s.is_treasure_hunter_evil) is_evil = true;
                if (target_role === 'machine_wolf' && s.machine_wolf_learn_target) { if (!evil_roles.includes(s.player_roles[s.machine_wolf_learn_target])) is_evil = false; }
                if (s.current_board.id === '12_shadow' && parseInt(actor_seat) === s.shadow_seer_seat) is_evil = !is_evil;
                if (parseInt(actor_seat) === s.puppet_target) is_evil = !is_evil;
                if (is_evil) { text = "🐺 狼人 (壞人)"; color = "#e94560"; } else { text = "🧑‍🌾 好人"; color = "#00ff88"; }
            }
            addNightAction(actor_seat, 'seer', 'inspect', [actual_target]);
        } else if (s.current_stage === 'machine_wolf') {
            s.machine_wolf_learn_target = actual_target;
            text = `${s.ROLE_DICT[s.player_roles[actual_target]].icon} ${s.ROLE_DICT[s.player_roles[actual_target]].name}`; color = "#fca311";
            addNightAction(actor_seat, 'machine_wolf', 'learn', [actual_target]);
        } else if (s.current_stage === 'demon') {
            let is_god = !['villager', 'alpaca', 'old_hooligan', 'high_villager', 'very_good', 'rabbit', 'twins'].includes(s.player_roles[actual_target]) && !evil_roles.includes(s.player_roles[actual_target]) && !wolf_faction.includes(s.player_roles[actual_target]);
            text = is_god ? "⚡ 神牌" : "🧑‍🌾 民牌"; color = is_god ? "#fca311" : "#00ff88";
            s.night_action_log.push(`【惡魔】查驗了 ${actual_target}號 → ${is_god ? '神牌' : '民牌'}`);
            addNightAction(actor_seat, 'demon', 'inspect', [actual_target]);
        } else {
            let display_role = s.player_roles[actual_target];
            if (s.current_stage === 'psychic' && display_role === 'machine_wolf' && s.machine_wolf_learn_target) display_role = s.player_roles[s.machine_wolf_learn_target];
            text = `${s.ROLE_DICT[display_role].icon} ${s.ROLE_DICT[display_role].name}`; color = "#fca311";
            addNightAction(actor_seat, s.current_stage, 'inspect', [actual_target]);
        }
    }
    return { label, text, color };
}

export function resolveNonInspectionAction() {
    let actor_seat = s.current_actor_seat || Object.keys(s.player_roles).find(k => s.player_roles[k] === s.current_stage || s.player_roles[k] === 'awaken_' + s.current_stage);
    let needs_result_roles = ['seer', 'real_fox', 'awaken_seer', 'gargoyle', 'psychic', 'pure_white', 'fool_seer', 'wolf_witch', 'machine_wolf', 'snake_seer', 'demon'];
    if (s.current_stage === 'lucky_boy_action' && s.merchant_item === 'seer' && s.merchant_type !== 'black_market') needs_result_roles.push('lucky_boy_action');
    if (s.current_stage === 'gray_wolf_action' && s.gray_wolf_stolen_skill === 'seer') needs_result_roles.push('gray_wolf_action');

    if (needs_result_roles.includes(s.current_stage) && s.selected_number === 'skip') {
        s.night_action_log.push(`【${getStageVoiceName(s.current_stage, s.current_sub_label)}】跳過技能`); return;
    }

    if (s.current_stage === 'pleasant_goat') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        let pg_seat = parseInt(s.current_actor_seat || Object.keys(s.player_roles).find(k => s.player_roles[k] === 'pleasant_goat'));
        if (t) {
            s.night_action_log.push(`【喜羊羊】對 ${t}號 使用了 ${t === pg_seat ? '雙重防護' : (s.current_sub_label === 'guard' ? '守護' : '防盜')}`);
            addNightAction(pg_seat, 'pleasant_goat', t === pg_seat ? 'guard_and_anti_theft' : s.current_sub_label, [t]);
        } else { s.night_action_log.push(`【喜羊羊】未發動技能`); }
    } else if (s.current_stage === 'gray_wolf_steal') {
        s.gray_wolf_stolen_player = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.gray_wolf_stolen_player ? `【灰太狼】嘗試偷取 ${s.gray_wolf_stolen_player}號` : `【灰太狼】未偷取`);
        if (s.gray_wolf_stolen_player) addNightAction(actor_seat, 'gray_wolf', 'steal', [s.gray_wolf_stolen_player]);
    } else if (s.current_stage === 'gray_wolf_action') {
        let target_role = s.gray_wolf_stolen_player ? s.player_roles[s.gray_wolf_stolen_player] : null;
        let pgAntiTheft = getNightTarget('anti_theft', 'pleasant_goat') || getNightTarget('guard_and_anti_theft', 'pleasant_goat');
        if (!s.gray_wolf_stolen_player || s.gray_wolf_stolen_player === pgAntiTheft) {
            s.night_action_log.push(`【灰太狼】偷取失敗 (目標被防盜或未選擇)`);
        } else if (target_role === 'pleasant_goat') {
            s.night_action_log.push(`【灰太狼】發現目標是喜羊羊，猜測其使用了：${s.gray_wolf_guess === 'guard' ? '守護' : '防盜'}`);
            addNightAction(actor_seat, 'gray_wolf', 'guess', [s.gray_wolf_stolen_player], { guess: s.gray_wolf_guess });
        } else if (['wolf', 'little_gray_wolf'].includes(target_role)) {
            s.night_action_log.push(`【灰太狼】偷取失敗 (目標為狼人)`);
        } else if (s.gray_wolf_stolen_skill === 'witch' && s.selected_number && s.selected_number !== 'skip') {
            let wt = applyTimeWolfReflection(getActualTarget(parseInt(s.selected_number)), actor_seat);
            s.night_action_log.push(`【灰太狼(偷取女巫)】對 ${wt}號 使用了毒藥`);
            addNightAction(actor_seat, 'gray_wolf', 'poison', [wt]);
        } else if (s.gray_wolf_stolen_skill === 'guard' && s.selected_number && s.selected_number !== 'skip') {
            let gt = applyTimeWolfReflection(getActualTarget(parseInt(s.selected_number)), actor_seat);
            s.night_action_log.push(`【灰太狼(偷取守衛)】守護了 ${gt}號`);
            addNightAction(actor_seat, 'gray_wolf', 'protect', [gt]);
        } else if (s.gray_wolf_stolen_skill === 'dreamwalker' && s.selected_number && s.selected_number !== 'skip') {
            let dt = applyTimeWolfReflection(getActualTarget(parseInt(s.selected_number)), actor_seat);
            s.night_action_log.push(`【灰太狼(偷取攝夢人)】攝夢了 ${dt}號`);
            addNightAction(actor_seat, 'gray_wolf', 'dream', [dt]);
        } else if (s.selected_number === 'skip') { s.night_action_log.push(`【灰太狼(偷取技能)】跳過發動`); }
    } else if (s.current_stage === 'diviner') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(t ? `【占卜師】標記了 ${t}號` : `【占卜師】未發動技能`);
        if (t) addNightAction(actor_seat, 'diviner', 'mark', [t]);
    } else if (s.current_stage === 'thief') {
        s.player_roles[Object.keys(s.player_roles).find(k => s.player_roles[k] === 'thief')] = s.thief_chosen_role;
        s.discarded_roles = s.spare_cards.filter(r => r !== s.thief_chosen_role);
        s.night_action_log.push(`【盜賊】選擇了 ${s.ROLE_DICT[s.thief_chosen_role].name}`);
        addNightAction(actor_seat, 'thief', 'choose_role', [], { chosen_role: s.thief_chosen_role });
        buildNightQueue();
    } else if (s.current_stage === 'cupid') {
        s.cupid_lovers = [...s.selected_numbers_arr];
        s.night_action_log.push(`【邱比特】連接了 ${s.cupid_lovers.join('和')}號`);
        addNightAction(actor_seat, 'cupid', 'link', [...s.cupid_lovers], { link_type: 'lovers' });
    } else if (['half_blood', 'wild_child', 'awaken_lonely_girl', 'shadow'].includes(s.current_stage)) {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        if (s.current_stage === 'half_blood') s.half_blood_target = t;
        if (s.current_stage === 'wild_child') s.wild_child_target = t;
        if (s.current_stage === 'awaken_lonely_girl') s.lonely_girl_target = t;
        if (s.current_stage === 'shadow') s.shadow_master_target = t;
        s.night_action_log.push(t ? `【${s.ROLE_DICT[s.current_stage].name}】選擇了 ${t}號` : `【${s.ROLE_DICT[s.current_stage].name}】未選擇`);
        if (t) addNightAction(actor_seat, s.current_stage, 'target_select', [t]);
    } else if (s.current_stage === 'ghost_bride') {
        s.ghost_bride_groom = getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(`【鬼魅新娘】選擇了 ${s.ghost_bride_groom}號為新郎`);
        addNightAction(actor_seat, 'ghost_bride', 'choose_groom', [s.ghost_bride_groom]);
    } else if (s.current_stage === 'ghost_bride_couple') {
        s.ghost_bride_witness = getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(`【鬼魅新娘與新郎】選擇了 ${s.ghost_bride_witness}號為證婚人`);
        addNightAction(actor_seat, 'ghost_bride_couple', 'choose_witness', [s.ghost_bride_witness]);
    } else if (s.current_stage === 'awaken_dreamwalker') {
        let t = getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(`【覺醒攝夢人】指定了 ${t}號為夢語者`);
        addNightAction(actor_seat, 'awaken_dreamwalker', 'dream', [t], { type: 'awaken' });
    } else if (s.current_stage === 'time_wolf') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(t ? `【蝕時狼妃】封鎖了 ${t}號` : `【蝕時狼妃】未封鎖`);
        if (t) addNightAction(actor_seat, 'time_wolf', 'mark', [t], { type: 'time_block' });
    } else if (s.current_stage === 'awaken_idiot') {
        let t = applyTimeWolfReflection((s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number)), actor_seat);
        s.night_action_log.push(t ? `【覺醒白痴】守護了 ${t}號` : `【覺醒白痴】未守護`);
        if (t) addNightAction(actor_seat, 'awaken_idiot', 'protect', [t]);
    } else if (s.current_stage === 'crow') {
        let t = applyTimeWolfReflection((s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number)), actor_seat);
        s.night_action_log.push(t ? `【烏鴉】詛咒了 ${t}號` : `【烏鴉】未詛咒`);
        if (t) addNightAction(actor_seat, 'crow', 'curse_vote', [t]);
    } else if (['magician', 'trickster', 'wolf_sorcerer'].includes(s.current_stage)) {
        let swap = (s.selected_number === 'skip') ? [] : [...s.selected_numbers_arr];
        s.night_action_log.push(swap.length ? `【${s.ROLE_DICT[s.current_stage].name}】交換了 ${swap[0]}號 和 ${swap[1]}號` : `【${s.ROLE_DICT[s.current_stage].name}】未交換`);
        if (swap.length) addNightAction(actor_seat, s.current_stage, 'swap', [...swap]);
    } else if (s.current_stage === 'phantom' || s.current_stage === 'snake_phantom') {
        s.phantom_targets = (s.selected_number === 'skip') ? [] : [getActualTarget(s.selected_numbers_arr[0]), getActualTarget(s.selected_numbers_arr[1])];
        s.night_action_log.push(s.phantom_targets.length ? `【${s.ROLE_DICT[s.current_stage].name}】綁定了 ${s.phantom_targets.join('和')}號` : `【${s.ROLE_DICT[s.current_stage].name}】未綁定`);
        if (s.phantom_targets.length) addNightAction(actor_seat, s.current_stage, 'link', [...s.phantom_targets], { link_type: 'phantom' });
    } else if (s.current_stage === 'nightmare') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(t ? `【夢魘】恐懼了 ${t}號` : `【夢魘】未恐懼`);
        if (t) addNightAction(actor_seat, 'nightmare', 'disable', [t], { mode: 'fear' });
    } else if (s.current_stage === 'penguin') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(t ? `【企鵝】冰凍了 ${t}號` : `【企鵝】未冰凍`);
        if (t) addNightAction(actor_seat, 'penguin', 'disable', [t], { mode: 'freeze' });
    } else if (s.current_stage === 'celebrity') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(t ? `【名媛】寵幸了 ${t}號` : `【名媛】未寵幸`);
        if (t) addNightAction(actor_seat, 'celebrity', 'protect', [t], { mode: 'celebrity' });
    } else if (s.current_stage === 'charmer') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(t ? `【蠱惑師】蠱惑了 ${t}號` : `【蠱惑師】未蠱惑`);
        if (t) addNightAction(actor_seat, 'charmer', 'charm', [t]);
    } else if (s.current_stage === 'demon_hunter') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(t ? `【獵魔人】狩獵了 ${t}號` : `【獵魔人】未狩獵`);
        if (t) addNightAction(actor_seat, 'demon_hunter', 'hunt', [t]);
    } else if (s.current_stage === 'jack_ripper') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(t ? `【開膛手傑克】擊殺了 ${t}號` : `【開膛手傑克】未擊殺`);
        if (t) addNightAction(actor_seat, 'jack_ripper', 'kill', [t], { source: 'jack_ripper' });
    } else if (s.current_stage === 'silence_elder') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(t ? `【禁言長老】禁言了 ${t}號` : `【禁言長老】未禁言`);
        if (t) addNightAction(actor_seat, 'silence_elder', 'silence', [t]);
    } else if (s.current_stage === 'black_bat') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(t ? `【黑蝙蝠】庇護了 ${t}號` : `【黑蝙蝠】未庇護`);
        if (t) addNightAction(actor_seat, 'black_bat', 'protect', [t], { mode: 'reflect' });
    } else if (s.current_stage === 'troublemaker') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(t ? `【搗蛋鬼】耍寶了 ${t}號` : `【搗蛋鬼】未耍寶`);
        if (t) addNightAction(actor_seat, 'troublemaker', 'trouble', [t]);
    } else if (s.current_stage === 'light_count') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(t ? `【流光伯爵】庇護了 ${t}號` : `【流光伯爵】未庇護`);
        if (t) addNightAction(actor_seat, 'light_count', 'protect', [t], { mode: 'light_count' });
    } else if (s.current_stage === 'guard') {
        let t = applyTimeWolfReflection((s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number)), actor_seat);
        s.night_action_log.push(t ? `【守衛】守護了 ${t}號` : `【守衛】空守`);
        if (t) addNightAction(actor_seat, 'guard', 'protect', [t]);
    } else if (s.current_stage === 'dreamwalker') {
        let t = applyTimeWolfReflection(getActualTarget(parseInt(s.selected_number)), actor_seat);
        s.night_action_log.push(`【攝夢人】攝夢了 ${t}號`);
        addNightAction(actor_seat, 'dreamwalker', 'dream', [t]);
    } else if (s.current_stage === 'bear') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(t ? `【百變狼王(熊)】魅惑了 ${t}號` : `【百變狼王(熊)】未魅惑`);
        if (t) addNightAction(actor_seat, 'bear', 'charm', [t], { is_vwk: true });
    } else if (s.current_stage === 'awaken_wolf_king_gun') {
        s.awk_wolf_gun_target = (s.selected_number === 'skip') ? null : parseInt(s.selected_number);
        s.night_action_log.push(s.awk_wolf_gun_target ? `【覺醒狼王】把槍分給了 ${s.awk_wolf_gun_target}號` : `【覺醒狼王】未分槍，自己保留兩把槍`);
        if (s.awk_wolf_gun_target) addNightAction(actor_seat, 'awaken_wolf_king', 'grant_gun', [s.awk_wolf_gun_target]);
    } else if (['black_market', 'miracle_merchant'].includes(s.current_stage)) {
        s.merchant_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.merchant_type = s.merchant_target ? s.current_stage : null;
        let item_text = s.merchant_item === 'seer' ? '預言家查驗' : s.merchant_item === 'poison' ? '女巫毒藥' : '守衛護盾/獵人的槍';
        s.night_action_log.push(s.merchant_target ? `【${s.ROLE_DICT[s.current_stage].name}】將 ${item_text} 給了 ${s.merchant_target}號` : `【${s.ROLE_DICT[s.current_stage].name}】未發動技能`);
        if (s.merchant_target) addNightAction(actor_seat, s.current_stage, 'grant', [s.merchant_target], { item: s.merchant_item });
    } else if (s.current_stage === 'lucky_boy_action') {
        if (s.merchant_type === 'black_market') { s.night_action_log.push(`【幸運兒(${s.merchant_target}號)】獲得黑市商人技能，技能暫時還無法發動`); } else {
            let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
            if (t) {
                if (s.merchant_item === 'poison') { addNightAction(actor_seat, 'lucky_boy', 'poison', [t]); }
                if (s.merchant_item === 'guard') { addNightAction(actor_seat, 'lucky_boy', 'protect', [t]); }
                if (s.merchant_item === 'seer') { addNightAction(actor_seat, 'lucky_boy', 'inspect', [t]); }
            }
            let item_text = s.merchant_item === 'seer' ? '預言家查驗' : s.merchant_item === 'poison' ? '女巫毒藥' : '守衛護盾';
            s.night_action_log.push(t ? `【幸運兒(${s.merchant_target}號)】使用了【${item_text}】對 ${t}號` : `【幸運兒(${s.merchant_target}號)】未使用技能`);
        }
    } else if (s.current_stage === 'wolf') {
        if (s.is_seed_wolf_infecting) {
            s.seed_wolf_target = getActualTarget(parseInt(s.selected_number));
            s.night_action_log.push(s.seed_wolf_target ? `【種狼】感染了 ${s.seed_wolf_target}號` : `【種狼】空感染`);
            if (s.seed_wolf_target) addNightAction('wolves', 'seed_wolf', 'convert', [s.seed_wolf_target]);
        } else {
            let w_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
            let lg_log = Object.values(s.player_roles).includes('little_girl') ? '與小女孩' : '';
            s.night_action_log.push(w_target ? `【狼人${lg_log}】擊殺了 ${w_target}號` : `【狼人${lg_log}】空刀`);
            if (w_target) addNightAction('wolves', 'wolf', 'kill', [w_target], { source: 'wolf_kill' });
        }
    } else if (s.current_stage === 'big_bad_wolf') {
        let bbw_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(bbw_target ? `【大野狼】擊殺了 ${bbw_target}號` : `【大野狼】空刀`);
        if (bbw_target) addNightAction(actor_seat, 'big_bad_wolf', 'kill', [bbw_target], { source: 'big_bad_wolf' });
    } else if (s.current_stage === 'wolf_beauty') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(t ? `【狼美人】魅惑了 ${t}號` : `【狼美人】未魅惑`);
        if (t) addNightAction(actor_seat, 'wolf_beauty', 'charm', [t]);
    } else if (s.current_stage === 'awaken_wolf_beauty') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(t ? `【覺醒狼美人】魅惑了 ${t}號` : `【覺醒狼美人】未魅惑`);
        if (t) addNightAction(actor_seat, 'awaken_wolf_beauty', 'charm', [t], { type: 'awaken' });
    } else if (s.current_stage === 'alchemist') {
        let fogs = (s.selected_number === 'skip') ? [] : [...s.selected_numbers_arr];
        s.night_action_log.push(fogs.length ? `【煉金魔女】對 ${fogs.join(', ')}號 施放未名之霧` : `【煉金魔女】未放霧`);
        if (fogs.length) addNightAction(actor_seat, 'alchemist', 'mark', [...fogs], { type: 'fog' });
    } else if (s.current_stage === 'awaken_gargoyle') {
        s.awk_gargoyle_target = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(s.awk_gargoyle_target ? `【覺醒石像鬼】轉化了 ${s.awk_gargoyle_target}號` : `【覺醒石像鬼】未轉化`);
        if (s.awk_gargoyle_target) addNightAction(actor_seat, 'awaken_gargoyle', 'convert', [s.awk_gargoyle_target]);
    } else if (s.current_stage === 'awaken_gargoyle_A') {
        s.awk_gargoyle_target_a = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        if (s.awk_gargoyle_target_a && s.player_roles[s.awk_gargoyle_target_a] === 'machine_wolf') s.awk_gargoyle_target_a = null;
        s.night_action_log.push(s.awk_gargoyle_target_a ? `【覺醒石像鬼A】轉化了 ${s.awk_gargoyle_target_a}號` : `【覺醒石像鬼A】未轉化`);
        if (s.awk_gargoyle_target_a) addNightAction(actor_seat, 'awaken_gargoyle_A', 'convert', [s.awk_gargoyle_target_a]);
    } else if (s.current_stage === 'awaken_gargoyle_B') {
        s.awk_gargoyle_target_b = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        if (s.awk_gargoyle_target_b && s.player_roles[s.awk_gargoyle_target_b] === 'machine_wolf') s.awk_gargoyle_target_b = null;
        s.night_action_log.push(s.awk_gargoyle_target_b ? `【覺醒石像鬼B】轉化了 ${s.awk_gargoyle_target_b}號` : `【覺醒石像鬼B】未轉化`);
        if (s.awk_gargoyle_target_b) addNightAction(actor_seat, 'awaken_gargoyle_B', 'convert', [s.awk_gargoyle_target_b]);
    } else if (s.current_stage === 'witch' || s.current_stage === 'awaken_witch') {
        let log_name = s.current_stage === 'awaken_witch' ? '覺醒女巫' : '女巫';
        if (s.selected_number === 'skip') { s.night_action_log.push(`【${log_name}】未發動技能`); } 
        else if (s.selected_number === 'witch_save') {
            s.night_action_log.push(`【${log_name}】使用了解藥`);
            let w_target = getNightTarget('kill', 'wolf') || getNightTarget('kill', 'war_wolf');
            addNightAction(actor_seat, s.current_stage, 'save', [w_target]);
        } else if (s.selected_number && !isNaN(s.selected_number) && s.current_stage === 'witch') {
            let wpTarget = applyTimeWolfReflection(getActualTarget(parseInt(s.selected_number)), actor_seat);
            s.night_action_log.push(`【女巫】對 ${wpTarget}號 使用了毒藥`);
            addNightAction(actor_seat, 'witch', 'poison', [wpTarget]);
        }
    } else if (s.current_stage === 'zombie') {
        if (s.selected_number === 'skip' || s.selected_numbers_arr.length === 0) { s.night_action_log.push(`【殭屍】未感染`); } 
        else {
            if (!s.zombie_infected) s.zombie_infected = [];
            let infected_now = [];
            s.selected_numbers_arr.forEach(seat => { let t = getActualTarget(seat); if (t && !s.zombie_infected.includes(t)) { s.zombie_infected.push(t); infected_now.push(t); } });
            s.night_action_log.push(`【殭屍】感染了 ${s.selected_numbers_arr.join(',')}號`);
            if (infected_now.length) addNightAction(actor_seat, 'zombie', 'infect', [...infected_now]);
        }
    } else if (s.current_stage === 'super_grave_keeper') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.sp_grave_keeper_heir = t;
        s.night_action_log.push(t ? `【超級守墓人】選擇了 ${t}號 作為繼承者` : `【超級守墓人】未選擇繼承者`);
        if (t) addNightAction(actor_seat, 'super_grave_keeper', 'choose_heir', [t]);
    } else if (s.current_stage === 'medusa') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(t ? `【梅杜莎】石化了 ${t}號` : `【梅杜莎】未石化`);
        if (t) addNightAction(actor_seat, 'medusa', 'disable', [t], { mode: 'petrify' });
    } else if (s.current_stage === 'machine_wolf') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.machine_wolf_learn_target = t;
        if (t) { let lr = s.player_roles[t]; s.night_action_log.push(`【機械狼】學習了 ${t}號 的技能（${s.ROLE_DICT[lr]?.name || lr}）`); addNightAction(actor_seat, 'machine_wolf', 'learn', [t]); } else { s.night_action_log.push(`【機械狼】未學習`); }
    } else if (s.current_stage === 'evil_merchant') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.evil_merchant_gun_target = t;
        s.night_action_log.push(t ? `【邪惡商人】把獵槍給了 ${t}號` : `【邪惡商人】未分槍`);
        if (t) addNightAction(actor_seat, 'evil_merchant', 'grant_gun', [t]);
    } else if (s.current_stage === 'dark_messenger') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        s.night_action_log.push(t ? `【黑夜使者】庇護了 ${t}號` : `【黑夜使者】未庇護`);
        if (t) addNightAction(actor_seat, 'dark_messenger', 'protect', [t], { mode: 'absolute_reflect' });
    } else if (s.current_stage === 'pandora') {
        let t = (s.selected_number === 'skip') ? null : getActualTarget(parseInt(s.selected_number));
        if (t) {
            s.pandora_target = t;
            if (!s.pandora_pool) s.pandora_pool = ['knife', 'poison', 'hope_light', 'day_gun', 'day_gun'];
            s.pandora_gift = s.pandora_pool.splice(Math.floor(Math.random() * s.pandora_pool.length), 1)[0];
            let gift_names = { knife: '一把刀', poison: '一滴毒', hope_light: '希望之光', day_gun: '日槍' };
            s.night_action_log.push(`【潘朵拉】贈送魔盒給了 ${t}號 → 開出：${gift_names[s.pandora_gift]}`);
            addNightAction(actor_seat, 'pandora', 'grant_random', [t], { gift: s.pandora_gift });
        } else { s.pandora_target = null; s.night_action_log.push(`【潘朵拉】未贈送`); }
    } else if (s.current_stage === 'phantom_king') {
        if (s.selected_number === 'skip') { s.night_action_log.push(`【怪盜狼王】發動了無敵技能`); addNightAction(actor_seat, 'phantom_king', 'invincible', [actor_seat]); } else { s.night_action_log.push(`【怪盜狼王】未發動無敵`); }
    } else if (s.current_stage === 'super_black_market') {
        if (s.selected_number === 'skip' || s.selected_numbers_arr.length === 0) { s.night_action_log.push(`【超級黑市商人】未發動技能`); } else {
            let targets = s.selected_numbers_arr.map(n => getActualTarget(n)); s.sp_merchant_targets = targets;
            let gifts = ['查驗', '毒藥', '獵槍']; targets.forEach((t, i) => { s.night_action_log.push(`【超級黑市商人】給了 ${t}號 → ${gifts[i]}`); });
            if (targets.every(t => !wolf_faction.includes(s.player_roles[t]))) { s.is_sp_merchant_turns_evil = true; s.night_action_log.push(`【超級黑市商人】三位幸運兒皆好人，商人將於天亮後變為狼人陣營`); }
            addNightAction(actor_seat, 'super_black_market', 'grant_multiple', [...targets], { gifts: ['seer', 'poison', 'gun'] });
        }
    } else if (s.current_stage === 'treasure_master') {
        if (s.treasure_hunter_choice) {
            let has_wolf_in_spare = s.spare_cards.some(r => wolf_faction.includes(r)); s.is_treasure_hunter_evil = has_wolf_in_spare;
            s.night_action_log.push(`【盜寶大師】選擇了 ${s.ROLE_DICT[s.treasure_hunter_choice]?.name || s.treasure_hunter_choice}${has_wolf_in_spare ? '（底牌有狼，為狼人陣營）' : '（底牌無狼，為好人陣營）'}`);
            addNightAction(actor_seat, 'treasure_master', 'choose_role', [], { chosen_role: s.treasure_hunter_choice });
        } else { s.night_action_log.push(`【盜寶大師】未選擇`); }
    }
}