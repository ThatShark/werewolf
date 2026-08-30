// js/actions.js
import { s, getStageVoiceName, applyTimeWolfReflection, getNightTarget, addNightAction, insertNightStatusFlow, isPlayerEvil, logNightAction, setPersistentState, convertPlayerToWolf, isWolfRole } from './core.js';
import { buildNightQueue } from './main.js';

// ==========================================
// 策略生成輔助函式 (Strategy Factory)
// ==========================================
const createSingleTargetStrategy = (roleId, effect, actionText, fallbackText, useReflection = false, metadata = {}) => (ctx) => {
    let t = useReflection && ctx.targetNum ? applyTimeWolfReflection(ctx.targetNum, ctx.actorSeat) : ctx.targetNum;
    logNightAction(t ? `【${s.ROLE_DICT[roleId]?.name || roleId}】${actionText} ${t}號` : `【${s.ROLE_DICT[roleId]?.name || roleId}】${fallbackText}`);
    if (t) addNightAction(ctx.actorSeat, roleId, effect, [t], metadata);
};

const createMultiTargetStrategy = (roleId, effect, actionText, fallbackText, metadata = {}) => (ctx) => {
    logNightAction(ctx.targetsArr.length ? `【${s.ROLE_DICT[roleId]?.name || roleId}】${actionText} ${ctx.targetsArr.join('和')}號` : `【${s.ROLE_DICT[roleId]?.name || roleId}】${fallbackText}`);
    if (ctx.targetsArr.length) addNightAction(ctx.actorSeat, roleId, effect, ctx.targetsArr, metadata);
};

const targetSelectStrategy = (ctx) => {
    let roleName = s.ROLE_DICT[ctx.stage]?.name || (ctx.stage === 'puppet_select' ? '狼隊(選傀儡)' : ctx.stage);
    let stateKey = ctx.stage === 'half_blood' ? 'half_blood_target' :
        ctx.stage === 'wild_child' ? 'wild_child_target' :
            ctx.stage === 'awaken_lonely_girl' ? 'lonely_girl_target' :
                ctx.stage === 'puppet_select' ? 'puppet_target' : 'shadow_master_target';

    setPersistentState(stateKey, ctx.targetNum);
    logNightAction(ctx.targetNum ? `【${roleName}】選擇了 ${ctx.targetNum}號` : `【${roleName}】未選擇`);

    // 選傀儡算作 wolf 的動作，方便法官紀錄檢視
    let actorRole = ctx.stage === 'puppet_select' ? 'wolf' : ctx.stage;
    if (ctx.targetNum) addNightAction(ctx.actorSeat || 'wolves', actorRole, 'target_select', [ctx.targetNum]);
};

// ==========================================
// 策略註冊表 (Strategy Registry)
// ==========================================
export const inspectionStrategies = {
    'awaken_seer': (ctx) => {
        ctx.label = "兩名玩家的陣營為：";
        let targets = [applyTimeWolfReflection(ctx.targetsArr[0], ctx.actorSeat), applyTimeWolfReflection(ctx.targetsArr[1], ctx.actorSeat)];
        let is_evil = isPlayerEvil(targets[0]) || isPlayerEvil(targets[1]);
        if (is_evil && !['snow_wolf', 'hidden_wolf', 'wolf_brother_little'].includes(s.player_roles[targets[0]]) && !['snow_wolf', 'hidden_wolf', 'wolf_brother_little'].includes(s.player_roles[targets[1]])) {
            ctx.text = "🐺 疑似狼人"; ctx.color = "#e94560";
        } else { ctx.text = "🧑‍🌾 雙好人"; ctx.color = "#00ff88"; }
        logNightAction(`【${ctx.logName}】查驗了 ${targets[0]}號 和 ${targets[1]}號`);
        addNightAction(ctx.actorSeat, 'awaken_seer', 'inspect', targets);
    },
    'snake_seer': (ctx) => {
        let t = applyTimeWolfReflection(ctx.targetNum, ctx.actorSeat);
        logNightAction(`【白蛇預言家】查驗了 ${t}號`);
        if (s.player_roles[t] === 'snake_phantom') { ctx.text = "✅ 是許仙尋香魅影"; ctx.color = "#00ff88"; } else { ctx.text = "❌ 不是許仙尋香魅影"; ctx.color = "#e94560"; }
        addNightAction(ctx.actorSeat, 'snake_seer', 'inspect', [t]);
    },
    'real_fox': (ctx) => {
        ctx.label = "查驗範圍的陣營為："; let t = ctx.targetNum;
        let p1 = t - 1 < 1 ? s.total_players : t - 1; let p2 = t + 1 > s.total_players ? 1 : t + 1;
        const isWolf = (seat) => isWolfRole(s.player_roles[seat]) || seat === s.seed_wolf_target;
        let has_wolf = isWolf(t) || isWolf(p1) || isWolf(p2);

        if (has_wolf) { ctx.text = "🐺 有狼人"; ctx.color = "#e94560"; } else { ctx.text = "🧑‍🌾 無狼人"; ctx.color = "#00ff88"; }
        logNightAction(`【${ctx.logName}】查驗了 ${t}號 範圍`);
        addNightAction(ctx.actorSeat, 'real_fox', 'inspect', [p1, t, p2]);
    },
    'lucky_boy_action': (ctx) => {
        if ((s.merchant_item === 'check' || s.merchant_item === 'seer') && ctx.targetNum) {
            let t = applyTimeWolfReflection(ctx.targetNum, ctx.actorSeat);
            let isEvil = isPlayerEvil(t);
            ctx.text = isEvil ? "🐺 狼人 (壞人)" : "🧑‍🌾 好人";
            ctx.color = isEvil ? "#e94560" : "#00ff88";
            logNightAction(`【幸運兒(${s.merchant_target || ctx.actorSeat}號)】查驗了 ${t}號`);
            addNightAction(ctx.actorSeat, 'lucky_boy', 'check', [t]);
            return true;
        }
        return false;
    },
    'gray_wolf_action': (ctx) => {
        let t = applyTimeWolfReflection(ctx.targetNum, ctx.actorSeat);
        logNightAction(`【灰太狼(偷取預言家)】查驗了 ${t}號`);
        if (isPlayerEvil(t)) { ctx.text = "🐺 狼人 (壞人)"; ctx.color = "#e94560"; } else { ctx.text = "🧑‍🌾 好人"; ctx.color = "#00ff88"; }
        addNightAction(ctx.actorSeat, ctx.stage, 'inspect', [t]);
    },
    'machine_wolf': (ctx) => {
        let t = applyTimeWolfReflection(ctx.targetNum, ctx.actorSeat);
        if (!s.machine_wolf_learn_target) {
            setPersistentState('machine_wolf_learn_target', t);
            ctx.text = `${s.ROLE_DICT[s.player_roles[t]].icon} ${s.ROLE_DICT[s.player_roles[t]].name}`; ctx.color = "#fca311";
            addNightAction(ctx.actorSeat, 'machine_wolf', 'learn', [t]);
        } else {
            let lr = s.player_roles[s.machine_wolf_learn_target];
            ctx.text = `${s.ROLE_DICT[lr]?.icon || '🎭'} ${s.ROLE_DICT[lr]?.name || lr}`;
            ctx.color = "#fca311";
            logNightAction(`【機械狼】確認學習到的身分：${s.ROLE_DICT[lr]?.name || lr}`);
        }
    },
    'demon': (ctx) => {
        let t = ctx.targetNum;
        let is_god = s.ROLE_DICT[s.player_roles[t]]?.type === 'god';
        ctx.text = is_god ? "⚡ 神牌" : "🧑‍🌾 民牌"; ctx.color = is_god ? "#fca311" : "#00ff88";
        logNightAction(`【惡魔】查驗了 ${t}號 → ${is_god ? '神牌' : '民牌'}`);
        addNightAction(ctx.actorSeat, 'demon', 'inspect', [t]);
    },
    'drunk_seer': (ctx) => {
        let t = ctx.targetNum;
        let is_evil = isPlayerEvil(t);
        let shows_evil = Math.random() < 1 / 3;
        ctx.text = shows_evil ? "🐺 狼人 (壞人)" : "🧑‍🌾 好人";
        ctx.color = shows_evil ? "#e94560" : "#00ff88";
        logNightAction(`【酒鬼預言家】查驗了 ${t}號 → ${shows_evil ? '查殺' : '金水'}${is_evil ? '' : ' (實際為好人)'}`);
        addNightAction(ctx.actorSeat, 'drunk_seer', 'inspect', [t], { shows_evil });
    },
    'default': (ctx) => {
        let t = applyTimeWolfReflection(ctx.targetNum, ctx.actorSeat);
        logNightAction(`【${ctx.logName}】查驗了 ${t}號`);
        if (['seer', 'seer_A', 'seer_B', 'shadow_seer'].includes(ctx.stage)) {
            if (ctx.isVWKTurn) { ctx.text = `${s.ROLE_DICT[s.player_roles[t]].icon} ${s.ROLE_DICT[s.player_roles[t]].name}`; ctx.color = "#fca311"; } else {
                let is_evil = isPlayerEvil(t);
                if (s.current_board.id === '12_shadow' && parseInt(ctx.actorSeat) === s.shadow_seer_seat) is_evil = !is_evil;
                if (is_evil) { ctx.text = "🐺 狼人 (壞人)"; ctx.color = "#e94560"; } else { ctx.text = "🧑‍🌾 好人"; ctx.color = "#00ff88"; }
            }
            addNightAction(ctx.actorSeat, 'seer', 'inspect', [t]);
        } else {
            let display_role = s.player_roles[t];
            if (ctx.stage === 'psychic' && display_role === 'machine_wolf' && s.machine_wolf_learn_target) display_role = s.player_roles[s.machine_wolf_learn_target];
            ctx.text = `${s.ROLE_DICT[display_role].icon} ${s.ROLE_DICT[display_role].name}`; ctx.color = "#fca311";
            addNightAction(ctx.actorSeat, ctx.stage, 'inspect', [t]);
        }
    }
};

export const nonInspectionStrategies = {
    'pleasant_goat': (ctx) => {
        let pg_seat = parseInt(s.current_actor_seat || Object.keys(s.player_roles).find(k => s.player_roles[k] === 'pleasant_goat'));
        if (ctx.targetNum) {
            logNightAction(`【喜羊羊】對 ${ctx.targetNum}號 使用了 ${ctx.targetNum === pg_seat ? '雙重防護' : (ctx.subLabel === 'guard' ? '守護' : '防盜')}`);
            addNightAction(pg_seat, 'pleasant_goat', ctx.targetNum === pg_seat ? 'guard_and_anti_theft' : ctx.subLabel, [ctx.targetNum]);
        } else { logNightAction(`【喜羊羊】未發動技能`); }
    },
    'gray_wolf_steal': (ctx) => {
        setPersistentState('gray_wolf_stolen_player', ctx.targetNum);
        logNightAction(ctx.targetNum ? `【灰太狼】嘗試偷取 ${ctx.targetNum}號` : `【灰太狼】未偷取`);
        if (ctx.targetNum) addNightAction(ctx.actorSeat, 'gray_wolf', 'steal', [ctx.targetNum]);
    },
    'gray_wolf_action': (ctx) => {
        let tr = s.gray_wolf_stolen_player ? s.player_roles[s.gray_wolf_stolen_player] : null;
        let pgAntiTheft = getNightTarget('anti_theft', 'pleasant_goat') || getNightTarget('guard_and_anti_theft', 'pleasant_goat');
        if (!s.gray_wolf_stolen_player || s.gray_wolf_stolen_player === pgAntiTheft) { logNightAction(`【灰太狼】偷取失敗 (目標被防盜或未選擇)`); }
        else if (tr === 'pleasant_goat') { logNightAction(`【灰太狼】發現目標是喜羊羊，猜測其使用了：${s.gray_wolf_guess === 'guard' ? '守護' : '防盜'}`); addNightAction(ctx.actorSeat, 'gray_wolf', 'guess', [s.gray_wolf_stolen_player], { guess: s.gray_wolf_guess }); }
        else if (isWolfRole(tr)) { logNightAction(`【灰太狼】偷取失敗 (目標為狼人)`); }
        else if (s.gray_wolf_stolen_skill === 'witch' && ctx.targetNum) { let wt = applyTimeWolfReflection(ctx.targetNum, ctx.actorSeat); logNightAction(`【灰太狼(偷取女巫)】對 ${wt}號 使用了毒藥`); addNightAction(ctx.actorSeat, 'gray_wolf', 'poison', [wt]); }
        else if (s.gray_wolf_stolen_skill === 'guard' && ctx.targetNum) { let gt = applyTimeWolfReflection(ctx.targetNum, ctx.actorSeat); logNightAction(`【灰太狼(偷取守衛)】守護了 ${gt}號`); addNightAction(ctx.actorSeat, 'gray_wolf', 'protect', [gt]); }
        else if (s.gray_wolf_stolen_skill === 'dreamwalker' && ctx.targetNum) { let dt = applyTimeWolfReflection(ctx.targetNum, ctx.actorSeat); logNightAction(`【灰太狼(偷取攝夢人)】攝夢了 ${dt}號`); addNightAction(ctx.actorSeat, 'gray_wolf', 'dream', [dt]); }
        else if (s.selected_number === 'skip') { logNightAction(`【灰太狼(偷取技能)】跳過發動`); }
    },
    'thief': (ctx) => {
        s.player_roles[Object.keys(s.player_roles).find(k => s.player_roles[k] === 'thief')] = s.thief_chosen_role;
        setPersistentState('discarded_roles', s.spare_cards.filter(r => r !== s.thief_chosen_role));
        logNightAction(`【盜賊】選擇了 ${s.ROLE_DICT[s.thief_chosen_role].name}`);
        addNightAction(ctx.actorSeat, 'thief', 'choose_role', [], { chosen_role: s.thief_chosen_role });
        buildNightQueue();
    },
    'half_blood': targetSelectStrategy, 'wild_child': targetSelectStrategy, 'awaken_lonely_girl': targetSelectStrategy, 'shadow': targetSelectStrategy,
    'ghost_bride': (ctx) => { setPersistentState('ghost_bride_groom', ctx.targetNum); logNightAction(`【鬼魅新娘】選擇了 ${ctx.targetNum}號為新郎`); addNightAction(ctx.actorSeat, 'ghost_bride', 'choose_groom', [ctx.targetNum]); },
    'ghost_bride_couple': (ctx) => { setPersistentState('ghost_bride_witness', ctx.targetNum); logNightAction(`【鬼魅新娘與新郎】選擇了 ${ctx.targetNum}號為證婚人`); addNightAction(ctx.actorSeat, 'ghost_bride_couple', 'choose_witness', [ctx.targetNum]); },
    'black_market': (ctx) => { setPersistentState('merchant_target', ctx.targetNum); setPersistentState('merchant_type', ctx.targetNum ? ctx.stage : null); logNightAction(ctx.targetNum ? `【黑市商人】給了 ${ctx.targetNum}號` : `【黑市商人】未發動`); if (ctx.targetNum) addNightAction(ctx.actorSeat, ctx.stage, 'grant', [ctx.targetNum], { item: s.merchant_item }); },
    'miracle_merchant': (ctx) => { setPersistentState('merchant_target', ctx.targetNum); setPersistentState('merchant_type', ctx.targetNum ? ctx.stage : null); logNightAction(ctx.targetNum ? `【奇蹟商人】給了 ${ctx.targetNum}號` : `【奇蹟商人】未發動`); if (ctx.targetNum) addNightAction(ctx.actorSeat, ctx.stage, 'grant', [ctx.targetNum], { item: s.merchant_item }); },
    'lucky_boy_action': (ctx) => {
        if (!ctx.targetNum) {
            logNightAction(`【幸運兒(${s.merchant_target || ctx.actorSeat}號)】選擇不使用技能`);
            return;
        }
        if (s.merchant_type === 'black_market') {
            logNightAction(`【幸運兒(${s.merchant_target || ctx.actorSeat}號)】獲得黑市商人技能，暫時無法發動`);
        } else {
            if (s.merchant_item === 'poison') {
                logNightAction(`【幸運兒(${s.merchant_target || ctx.actorSeat}號)】對 ${ctx.targetNum} 號使用了毒藥`);
                addNightAction(ctx.actorSeat, 'lucky_boy', 'poison', [ctx.targetNum]);
            } else if (s.merchant_item === 'guard' || s.merchant_item === 'shield') {
                logNightAction(`【幸運兒(${s.merchant_target || ctx.actorSeat}號)】守護了 ${ctx.targetNum} 號`);
                addNightAction(ctx.actorSeat, 'lucky_boy', 'guard', [ctx.targetNum]);
            }
        }
    },
    'wolf': (ctx) => {
        if (s.is_seed_wolf_infecting) {
            setPersistentState('seed_wolf_target', ctx.targetNum); logNightAction(ctx.targetNum ? `【種狼】感染了 ${ctx.targetNum}號` : `【種狼】空感染`);
            if (ctx.targetNum) { convertPlayerToWolf(ctx.targetNum); addNightAction('wolves', 'seed_wolf', 'convert', [ctx.targetNum]); }
        } else {
            let lg_log = Object.values(s.player_roles).includes('little_girl') ? '與小女孩' : '';
            logNightAction(ctx.targetNum ? `【狼人${lg_log}】擊殺了 ${ctx.targetNum}號` : `【狼人${lg_log}】空刀`);
            if (ctx.targetNum) addNightAction('wolves', 'wolf', 'kill', [ctx.targetNum], { source: 'wolf_kill' });
        }
    },
    'witch': (ctx) => {
        if (s.selected_number === 'skip') { logNightAction(`【女巫】未發動技能`); }
        else if (s.selected_number === 'witch_save') { logNightAction(`【女巫】使用了解藥`); let w_target = getNightTarget('kill', 'wolf') || getNightTarget('kill', 'war_wolf'); addNightAction(ctx.actorSeat, 'witch', 'save', [w_target]); }
        else if (ctx.targetNum) { let wpTarget = applyTimeWolfReflection(ctx.targetNum, ctx.actorSeat); logNightAction(`【女巫】對 ${wpTarget}號 使用了毒藥`); addNightAction(ctx.actorSeat, 'witch', 'poison', [wpTarget]); }
    },
    'awaken_witch': (ctx) => {
        if (s.selected_number === 'skip') { logNightAction(`【覺醒女巫】未發動技能`); }
        else if (s.selected_number === 'witch_save') { logNightAction(`【覺醒女巫】使用了解藥`); let w_target = getNightTarget('kill', 'wolf') || getNightTarget('kill', 'war_wolf'); addNightAction(ctx.actorSeat, 'awaken_witch', 'save', [w_target]); }
        else if (ctx.targetNum) { let wpTarget = applyTimeWolfReflection(ctx.targetNum, ctx.actorSeat); logNightAction(`【覺醒女巫】對 ${wpTarget}號 使用了毒藥`); addNightAction(ctx.actorSeat, 'awaken_witch', 'poison', [wpTarget]); }
    },
    'zombie': (ctx) => {
        if (ctx.targetsArr.length === 0) { logNightAction(`【殭屍】未感染`); } else {
            let infected = s.zombie_infected || []; let infected_now = [];
            ctx.targetsArr.forEach(t => { if (!infected.includes(t)) { infected.push(t); infected_now.push(t); } });
            setPersistentState('zombie_infected', infected); logNightAction(`【殭屍】感染了 ${ctx.targetsArr.join(',')}號`);
            if (infected_now.length) addNightAction(ctx.actorSeat, 'zombie', 'infect', [...infected_now]);
        }
    },
    'puppet_select': targetSelectStrategy,
    'super_black_market': (ctx) => {
        if (ctx.targetsArr.length === 0) { logNightAction(`【超級黑市商人】未發動技能`); } else {
            const sp_gifts = ['seer', 'poison', 'gun'];
            setPersistentState('sp_merchant_targets', ctx.targetsArr);
            setPersistentState('sp_merchant_gifts', ctx.targetsArr.map((seat, index) => ({ seat, label: String.fromCharCode(65 + index), gift: sp_gifts[index] })));
            let gifts = ['查驗', '毒藥', '獵槍'];
            ctx.targetsArr.forEach((t, i) => {
                logNightAction(`【超級黑市商人】給了 ${t}號 → ${gifts[i]}`);
                if (gifts[i] === '獵槍') {
                    if (!s.player_status[t]) s.player_status[t] = {};
                    s.player_status[t].hasSuperBlackMarketGun = true;
                }
            });
            if (ctx.targetsArr.every(t => !isWolfRole(s.player_roles[t]))) { setPersistentState('is_sp_merchant_turns_evil', true); logNightAction(`【超級黑市商人】三位幸運兒皆好人，商人將於天亮後變為狼人陣營`); }
            addNightAction(ctx.actorSeat, 'super_black_market', 'grant_multiple', ctx.targetsArr, { gifts: sp_gifts });
        }
    },
    'treasure_master': (ctx) => {
        if (s.treasure_hunter_choice) {
            let has_wolf = s.spare_cards.some(r => isWolfRole(r));
            setPersistentState('is_treasure_hunter_evil', has_wolf);
            logNightAction(`【盜寶大師】選擇了 ${s.ROLE_DICT[s.treasure_hunter_choice]?.name || s.treasure_hunter_choice}`);
            addNightAction(ctx.actorSeat, 'treasure_master', 'choose_role', [], { chosen_role: s.treasure_hunter_choice });
            let chosen_order = s.ROLE_DICT[s.treasure_hunter_choice]?.wakeOrder?.[0] || 9999;
            s.night_queue.push({ stage: s.treasure_hunter_choice, order: chosen_order, seat: ctx.actorSeat, subLabel: null, isFake: false });
            s.night_queue.sort((a, b) => a.order - b.order);
        } else { logNightAction(`【盜寶大師】未選擇`); }
    },
    'pandora': (ctx) => {
        if (ctx.targetNum) {
            setPersistentState('pandora_target', ctx.targetNum);
            let pool = s.pandora_pool || ['knife', 'poison', 'hope_light', 'day_gun', 'day_gun'];
            let gift = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
            setPersistentState('pandora_pool', pool); setPersistentState('pandora_gift', gift);
            let gift_names = { knife: '一把刀', poison: '一滴毒', hope_light: '希望之光', day_gun: '日槍' };
            logNightAction(`【潘朵拉】贈送魔盒給了 ${ctx.targetNum}號 → 開出：${gift_names[gift]}`);
            addNightAction(ctx.actorSeat, 'pandora', 'grant_random', [ctx.targetNum], { gift: gift });
            if (gift === 'poison') {
                if (!s.player_status[ctx.targetNum]) s.player_status[ctx.targetNum] = {};
                s.player_status[ctx.targetNum].isPandoraPoisoned = true;
                s.night_actions.filter(a => a.actor === ctx.targetNum).forEach(a => a.status = 'cancelled');
            } else if (gift === 'day_gun') {
                if (!s.player_status[ctx.targetNum]) s.player_status[ctx.targetNum] = {};
                s.player_status[ctx.targetNum].hasPandoraDayGun = true;
            } else if (gift === 'hope_light' && ctx.targetNum === ctx.actorSeat) {
                setPersistentState('is_pandora_win', true);
            }
        } else { setPersistentState('pandora_target', null); logNightAction(`【潘朵拉】未贈送`); }
    },
    'phantom_king': (ctx) => {
        if (s.selected_number === 'skip') { logNightAction(`【怪盜狼王】發動了無敵技能`); addNightAction(ctx.actorSeat, 'phantom_king', 'invincible', [ctx.actorSeat]); }
        else { logNightAction(`【怪盜狼王】未發動無敵`); }
    },

    'diviner': createSingleTargetStrategy('diviner', 'mark', '標記了', '未發動技能'),
    'time_wolf': createSingleTargetStrategy('time_wolf', 'mark', '封鎖了', '未封鎖', false, { type: 'time_block' }),
    'awaken_idiot': createSingleTargetStrategy('awaken_idiot', 'protect', '守護了', '未守護', true),
    'crow': createSingleTargetStrategy('crow', 'curse_vote', '詛咒了', '未詛咒', true),
    'nightmare': createSingleTargetStrategy('nightmare', 'disable', '恐懼了', '未恐懼', false, { mode: 'fear' }),
    'penguin': createSingleTargetStrategy('penguin', 'disable', '冰凍了', '未冰凍', false, { mode: 'freeze' }),
    'celebrity': createSingleTargetStrategy('celebrity', 'protect', '寵幸了', '未寵幸', false, { mode: 'celebrity' }),
    'charmer': createSingleTargetStrategy('charmer', 'charm', '蠱惑了', '未蠱惑'),
    'demon_hunter': createSingleTargetStrategy('demon_hunter', 'hunt', '狩獵了', '未狩獵'),
    'jack_ripper': createSingleTargetStrategy('jack_ripper', 'kill', '擊殺了', '未擊殺', false, { source: 'jack_ripper' }),
    'silence_elder': createSingleTargetStrategy('silence_elder', 'silence', '禁言了', '未禁言'),
    'black_bat': createSingleTargetStrategy('black_bat', 'protect', '庇護了', '未庇護', false, { mode: 'reflect' }),
    'troublemaker': createSingleTargetStrategy('troublemaker', 'trouble', '耍寶了', '未耍寶'),
    'light_count': createSingleTargetStrategy('light_count', 'protect', '庇護了', '未庇護', false, { mode: 'light_count' }),
    'guard': createSingleTargetStrategy('guard', 'protect', '守護了', '空守', true),
    'dreamwalker': createSingleTargetStrategy('dreamwalker', 'dream', '攝夢了', '未攝夢', true),
    'bear': createSingleTargetStrategy('bear', 'charm', '魅惑了', '未魅惑', false, { is_vwk: true }),
    'awaken_wolf_king_gun': (ctx) => { setPersistentState('awk_wolf_gun_target', ctx.targetNum || null); createSingleTargetStrategy('awaken_wolf_king', 'grant_gun', '把槍分給了', '未分槍，自己保留兩把槍')(ctx); },
    'big_bad_wolf': createSingleTargetStrategy('big_bad_wolf', 'kill', '擊殺了', '空刀', false, { source: 'big_bad_wolf' }),
    'pandora_knife': createSingleTargetStrategy('pandora', 'kill', '用魔盒之刀擊殺了', '未使用魔盒之刀', false, { source: 'pandora' }),
    'wolf_beauty': createSingleTargetStrategy('wolf_beauty', 'charm', '魅惑了', '未魅惑'),
    'awaken_wolf_beauty': createSingleTargetStrategy('awaken_wolf_beauty', 'charm', '魅惑了', '未魅惑', false, { type: 'awaken' }),
    'awaken_gargoyle': (ctx) => { if (ctx.targetNum) { setPersistentState('awk_gargoyle_target', ctx.targetNum); } createSingleTargetStrategy('awaken_gargoyle', 'convert', '轉化了', '未轉化')(ctx); },
    'awaken_gargoyle_A': (ctx) => { if (ctx.targetNum) { setPersistentState('awk_gargoyle_target_a', ctx.targetNum); } createSingleTargetStrategy('awaken_gargoyle_A', 'convert', '轉化了', '未轉化')(ctx); },
    'awaken_gargoyle_B': (ctx) => { if (ctx.targetNum) { setPersistentState('awk_gargoyle_target_b', ctx.targetNum); } createSingleTargetStrategy('awaken_gargoyle_B', 'convert', '轉化了', '未轉化')(ctx); },
    'awaken_dreamwalker': createSingleTargetStrategy('awaken_dreamwalker', 'dream', '指定了', '未發動', false, { type: 'awaken' }),
    'medusa': createSingleTargetStrategy('medusa', 'disable', '石化了', '未石化', false, { mode: 'petrify' }),
    'evil_merchant': (ctx) => { setPersistentState('evil_merchant_gun_target', ctx.targetNum || null); createSingleTargetStrategy('evil_merchant', 'grant_gun', '把獵槍給了', '未分槍')(ctx); },
    'dark_messenger': createSingleTargetStrategy('dark_messenger', 'protect', '庇護了', '未庇護', false, { mode: 'absolute_reflect' }),
    'super_grave_keeper': createSingleTargetStrategy('super_grave_keeper', 'choose_heir', '選擇了', '未選擇', false, {}, true),
    'jack_ripper_select_fanatic': (ctx) => {
        if (ctx.targetNum) {
            logNightAction(`【開膛手傑克】選擇了 ${ctx.targetNum}號 作為狂熱粉`);
            s.player_second_roles[ctx.targetNum] = 'fanatic';
            // 讓狂熱粉只在 1~12 號輪流通知時得知身分，不觸發獨立的睜眼階段
            insertNightStatusFlow('fanatic', [ctx.targetNum], { reveal_targets: [] });
        } else {
            logNightAction(`【開膛手傑克】未選擇狂熱粉`);
        }
    },
    'magician': createMultiTargetStrategy('magician', 'swap', '交換了', '未交換'),
    'trickster': createMultiTargetStrategy('trickster', 'swap', '交換了', '未交換'),
    'wolf_sorcerer': createMultiTargetStrategy('wolf_sorcerer', 'swap', '交換了', '未交換'),
    'cupid': createMultiTargetStrategy('cupid', 'link', '連接了', '未連接', { link_type: 'lovers' }),
    'phantom': createMultiTargetStrategy('phantom', 'link', '綁定了', '未綁定', { link_type: 'phantom' }),
    'snake_phantom': createMultiTargetStrategy('snake_phantom', 'link', '綁定了', '未綁定', { link_type: 'phantom' }),
    'alchemist': (ctx) => { logNightAction(ctx.targetsArr.length ? `【煉金魔女】對 ${ctx.targetsArr.join(', ')}號 施放未名之霧` : `【煉金魔女】未放霧`); if (ctx.targetsArr.length) addNightAction(ctx.actorSeat, 'alchemist', 'mark', ctx.targetsArr, { type: 'fog' }); },
};

// ==========================================
// 主控台 (Main Controller)
// ==========================================
export function resolveInspectionResult() {
    let actor_seat = s.current_actor_seat || Object.keys(s.player_roles).find(k => s.player_roles[k] === s.current_stage || s.player_roles[k] === 'awaken_' + s.current_stage);
    let log_name = getStageVoiceName(s.current_stage, s.current_sub_label);
    if (s.current_board.id === '12_shadow' && parseInt(actor_seat) === s.shadow_seer_seat) log_name += ' (燈影)';

    const ctx = {
        actorSeat: actor_seat,
        targetNum: s.selected_number === 'skip' ? null : parseInt(s.selected_number),
        targetsArr: s.selected_number === 'skip' ? [] : [...s.selected_numbers_arr].map(n => parseInt(n)),
        subLabel: s.current_sub_label,
        stage: s.current_stage,
        logName: log_name,
        isVWKTurn: actor_seat && s.player_status[actor_seat]?.isVWK,
        label: "該名玩家的查驗結果為：", text: "", color: ""
    };

    let strategy = inspectionStrategies[s.current_stage] || inspectionStrategies['default'];
    strategy(ctx);

    return { label: ctx.label, text: ctx.text, color: ctx.color };
}

export function resolveNonInspectionAction() {
    let actor_seat = s.current_actor_seat || Object.keys(s.player_roles).find(k => s.player_roles[k] === s.current_stage || s.player_roles[k] === 'awaken_' + s.current_stage);

    let baseRole = s.current_stage.replace(/_[AB]$/, '');
    let isInspection = s.ROLE_DICT[baseRole]?.ui_type === 'inspection';

    if (s.current_stage === 'lucky_boy_action' && (s.merchant_item === 'seer' || s.merchant_item === 'check') && s.merchant_type !== 'black_market') isInspection = true;
    if (s.current_stage === 'gray_wolf_action' && s.gray_wolf_stolen_skill === 'seer') isInspection = true;

    if (isInspection && s.selected_number === 'skip') {
        logNightAction(`【${getStageVoiceName(s.current_stage, s.current_sub_label)}】跳過技能`); return;
    }

    const ctx = {
        actorSeat: actor_seat,
        targetNum: s.selected_number === 'skip' ? null : parseInt(s.selected_number),
        targetsArr: s.selected_number === 'skip' ? [] : [...s.selected_numbers_arr].map(n => parseInt(n)),
        subLabel: s.current_sub_label,
        stage: s.current_stage
    };

    const strategy = nonInspectionStrategies[s.current_stage];
    if (strategy) strategy(ctx);
    else if (!isInspection && s.ROLE_DICT[baseRole]?.ui_type !== 'info_only' && !s.current_stage.startsWith('status_') && !s.current_stage.startsWith('notify_')) {
        console.warn(`[Action] No non-inspection strategy found for stage: ${s.current_stage}`);
    }

    // 商人系列：原本就已經有傳入 reveal_targets: []
    if (s.current_stage === 'black_market' || s.current_stage === 'miracle_merchant') {
        let targets = ctx.targetNum ? [ctx.targetNum] : [];
        insertNightStatusFlow('merchant', targets, { merchant_type: s.merchant_type, gift: s.merchant_item, reveal_targets: [] });
    }

    // 超級黑市商人：補上 reveal_targets: []
    if (s.current_stage === 'super_black_market') {
        insertNightStatusFlow('super_black_market', ctx.targetsArr, { gifts: s.sp_merchant_gifts, reveal_targets: [] });
    }

    // 💡 邱比特：補上 reveal_targets: [] (後續有專屬的情侶睜眼階段)
    if (s.current_stage === 'cupid') {
        if (ctx.targetsArr.length === 2) setPersistentState('cupid_lovers', ctx.targetsArr);
        insertNightStatusFlow('lovers', ctx.targetsArr.length === 2 ? ctx.targetsArr : [], { reveal_targets: [] });
    }

    // 覺醒石像鬼 (這個保留通知，因為它沒有 take_turns)
    if (['awaken_gargoyle', 'awaken_gargoyle_A', 'awaken_gargoyle_B'].includes(s.current_stage)) {
        insertNightStatusFlow('gargoyle_conversion', ctx.targetNum ? [ctx.targetNum] : []);
    }

    // 💡 鬼魅新娘系列：補上 reveal_targets: [] (後續有專屬的睜眼階段)
    if (s.current_stage === 'ghost_bride') {
        insertNightStatusFlow('ghost_groom', ctx.targetNum ? [ctx.targetNum] : [], { reveal_targets: [] });
    }
    if (s.current_stage === 'ghost_bride_couple') {
        insertNightStatusFlow('ghost_witness', ctx.targetNum ? [ctx.targetNum] : [], { reveal_targets: [] });
    }

    // 💡 種狼：補上 reveal_targets: [] (這樣輪流睜眼完就會直接進入下一個身分！)
    if (s.current_stage === 'wolf' && Object.values(s.player_roles).includes('seed_wolf')) {
        let targets = (s.is_seed_wolf_infecting && ctx.targetNum) ? [ctx.targetNum] : [];
        insertNightStatusFlow('seed_wolf', targets, { reveal_targets: [] });
    }

    // 潘朵拉與殭屍：原本就已經有傳入 reveal_targets: []
    if (s.current_stage === 'pandora') {
        let targets = ctx.targetNum ? [ctx.targetNum] : [];
        insertNightStatusFlow('pandora', targets, { reveal_targets: [] });
    }

    if (s.current_stage === 'zombie') {
        insertNightStatusFlow('zombie', ctx.targetsArr, { reveal_targets: [] });
    }
}