import { s, getStageVoiceName, getActualTarget, wolf_faction, wolf_team_roles, evil_roles, speak } from './core.js';
import { createNumberPad } from './night.js';

// ==========================================
// 角色夜晚面板渲染 — Dispatch Pattern
// 新增角色只需在 roleHandlers 中註冊 handler 函式
// handler 接收 ctx 物件：{ btnConfirmAction, btnOptionalSkip, numberPad, actionPad, nightRoleTitle, nightInstruction, isStolen, isVWKTurn, actorSeat }
// ==========================================

export const roleHandlers = {};

/**
 * 渲染當前角色的夜晚操作面板（dispatch 入口）
 */
export function renderRolePanel(isStolen, isVWKTurn, actorSeat) {
    const btnConfirmAction = document.getElementById('btn-confirm-action');
    const btnOptionalSkip = document.getElementById('btn-optional-skip');
    const numberPad = document.getElementById('number-pad');
    const actionPad = document.getElementById('action-pad');
    const nightRoleTitle = document.getElementById('night-role-title');
    const nightInstruction = document.getElementById('night-instruction');

    const ctx = { btnConfirmAction, btnOptionalSkip, numberPad, actionPad, nightRoleTitle, nightInstruction, isStolen, isVWKTurn, actorSeat };

    createNumberPad();
    numberPad.classList.remove('hidden');

    // 查詢 dispatch table
    let handler = roleHandlers[s.current_stage];

    // notify_ 開頭的階段統一走 notify handler
    if (!handler && s.current_stage.startsWith('notify_')) handler = roleHandlers['_notify'];

    // 查驗類角色批量匹配
    if (!handler && ['seer', 'shadow_seer', 'seer_A', 'seer_B', 'pure_white', 'real_fox', 'psychic', 'wolf_witch', 'gargoyle', 'machine_wolf', 'awaken_seer', 'fool_seer', 'snake_seer'].includes(s.current_stage)) {
        handler = roleHandlers['_inspection'];
    }

    // 覺醒石像鬼批量匹配
    if (!handler && ['awaken_gargoyle', 'awaken_gargoyle_A', 'awaken_gargoyle_B'].includes(s.current_stage)) {
        handler = roleHandlers['_awaken_gargoyle'];
    }

    // 目標選擇類角色批量匹配
    if (!handler && ['half_blood', 'wild_child', 'awaken_lonely_girl', 'awaken_idiot', 'crow', 'ghost_bride', 'ghost_bride_couple', 'awaken_dreamwalker', 'dreamwalker'].includes(s.current_stage)) {
        handler = roleHandlers['_target_select'];
    }

    if (handler) {
        handler(ctx);
    } else {
        // 通用 fallback：顯示號碼鍵盤 + 跳過按鈕
        btnOptionalSkip.textContent = "跳過";
        btnOptionalSkip.classList.remove('hidden');
        let name = getStageVoiceName(s.current_stage, s.current_sub_label);
        nightRoleTitle.textContent = `${s.ROLE_DICT[s.current_stage]?.icon || '🎭'} ${name}行動`;
    }
}

// ==========================================
// Handler 註冊區
// ==========================================

// --- 女巫 / 覺醒女巫 ---
roleHandlers['witch'] = roleHandlers['awaken_witch'] = (ctx) => {
    const { btnConfirmAction, numberPad, nightRoleTitle, nightInstruction, isStolen, isVWKTurn } = ctx;
    let title_name = s.current_stage === 'awaken_witch' ? '覺醒女巫' : '女巫';
    nightRoleTitle.textContent = `🧪 ${title_name}行動`;
    nightInstruction.innerHTML += (isVWKTurn ? "" : "請選擇你要使用的藥水：");
    numberPad.classList.add('hidden');

    let target = s.is_seed_wolf_infecting ? null : (s.wolf_kill_target ? getActualTarget(parseInt(s.wolf_kill_target)) : null);

    let customPanel = document.createElement('div');
    customPanel.id = 'custom-action-panel';
    customPanel.style = "display: flex; flex-direction: column; align-items: center; width: 100%; margin-bottom: 15px;";

    let infoP = document.createElement('p');
    infoP.style = "color: #ff7b93; font-size: 20px; font-weight: bold; margin-bottom: 15px;";
    infoP.textContent = target ? `昨晚倒牌的是：【 ${target} 號 】` : `昨晚倒牌的是：【 無 】`;
    customPanel.appendChild(infoP);

    let btnGroup = document.createElement('div');
    btnGroup.style = "display: flex; gap: 10px; width: 100%; justify-content: center;";

    let btnSave = document.createElement('button');
    btnSave.className = 'secondary-btn'; btnSave.textContent = "解藥 (救)";
    let witch_seat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'witch' || s.player_roles[k] === 'awaken_witch');
    let rule = document.getElementById('setting-witch-rule').checked ? 'can_save' : 'cannot_save';
    if (isVWKTurn) { btnSave.disabled = true; btnSave.textContent = "解藥 (狼王不可用)"; btnSave.style.opacity = "0.5"; }
    else {
        if (target && target === getActualTarget(parseInt(witch_seat)) && rule === 'cannot_save') { btnSave.disabled = true; btnSave.textContent = "解藥 (不可自救)"; btnSave.style.opacity = "0.5"; }
        if (!target) { btnSave.disabled = true; btnSave.style.opacity = "0.5"; }
    }

    let btnPoison = document.createElement('button');
    btnPoison.className = 'special-btn'; btnPoison.textContent = "毒藥 (毒)";
    if (isStolen) { btnPoison.disabled = true; btnPoison.textContent = "毒藥 (被偷取)"; btnPoison.style.opacity = "0.5"; btnPoison.style.cursor = "not-allowed"; }

    let btnSkip = document.createElement('button');
    btnSkip.className = 'text-btn'; btnSkip.textContent = "不使用";

    btnGroup.appendChild(btnSave); btnGroup.appendChild(btnPoison); btnGroup.appendChild(btnSkip);
    customPanel.appendChild(btnGroup);
    numberPad.parentNode.insertBefore(customPanel, numberPad);

    btnSave.onclick = () => {
        document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
        s.selected_number = 'witch_save'; s.selected_numbersArr = [];
        btnSave.classList.add('action-selected'); btnPoison.classList.remove('action-selected'); btnSkip.classList.remove('action-selected');
        numberPad.classList.add('hidden');
        btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認";
        nightInstruction.textContent = "請選擇你要使用的藥水：";
    };
    if (!isStolen) {
        btnPoison.onclick = () => {
            document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
            s.selected_number = null; s.selected_numbersArr = [];
            btnPoison.classList.add('action-selected'); btnSave.classList.remove('action-selected'); btnSkip.classList.remove('action-selected');
            numberPad.classList.remove('hidden'); btnConfirmAction.classList.add('hidden');
            if (s.current_stage === 'awaken_witch') { s.awk_witch_step = 'poison_target'; }
            nightInstruction.textContent = "請選擇你要毒殺的號碼：";
        };
    }
    btnSkip.onclick = () => {
        document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
        s.selected_number = 'skip'; s.selected_numbersArr = [];
        btnSkip.classList.add('action-selected'); btnSave.classList.remove('action-selected'); btnPoison.classList.remove('action-selected');
        numberPad.classList.add('hidden');
        btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認";
        nightInstruction.textContent = "請選擇你要使用的藥水：";
    };
};

// --- 黑市商人 / 奇蹟商人 ---
roleHandlers['black_market'] = roleHandlers['miracle_merchant'] = (ctx) => {
    const { btnConfirmAction, btnOptionalSkip, numberPad, nightRoleTitle, nightInstruction } = ctx;
    nightRoleTitle.textContent = `🎁 ${s.ROLE_DICT[s.current_stage].name}行動`;
    nightInstruction.innerHTML += "請選擇你要給予的技能：";
    numberPad.classList.add('hidden');

    let customPanel = document.createElement('div'); customPanel.id = 'custom-action-panel';
    customPanel.style = "display: flex; gap: 10px; width: 100%; justify-content: center; margin-bottom: 15px;";
    let btnSeer = document.createElement('button'); btnSeer.className = 'secondary-btn'; btnSeer.textContent = "預言家查驗";
    let btnPoison = document.createElement('button'); btnPoison.className = 'special-btn'; btnPoison.textContent = "女巫毒藥";
    let btnGuard = document.createElement('button'); btnGuard.className = 'primary-btn';
    let g_skill = s.current_stage === 'black_market' ? 'gun' : 'guard';
    let g_name = s.current_stage === 'black_market' ? '獵人的槍' : '守衛護盾';
    btnGuard.textContent = g_name;
    let btnSkip = document.createElement('button'); btnSkip.className = 'text-btn'; btnSkip.textContent = "不發動";
    customPanel.appendChild(btnSeer); customPanel.appendChild(btnPoison); customPanel.appendChild(btnGuard); customPanel.appendChild(btnSkip);
    numberPad.parentNode.insertBefore(customPanel, numberPad);

    const setup = (skill, name, btn) => {
        [btnSeer, btnPoison, btnGuard, btnSkip].forEach(b => b.classList.remove('action-selected'));
        btn.classList.add('action-selected');
        s.merchant_item = skill; s.selected_number = null;
        document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
        if (skill) { numberPad.classList.remove('hidden'); btnConfirmAction.classList.add('hidden'); nightInstruction.textContent = `請選擇你要給予【${name}】的對象：`; }
        else { numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認"; s.selected_number = 'skip'; nightInstruction.textContent = "請確認不發動技能："; }
    };
    btnSeer.onclick = () => setup('seer', '查驗', btnSeer);
    btnPoison.onclick = () => setup('poison', '毒藥', btnPoison);
    btnGuard.onclick = () => setup(g_skill, g_name.replace('獵人的', ''), btnGuard);
    btnSkip.onclick = () => setup(null, null, btnSkip);
};

// --- 喜羊羊 ---
roleHandlers['pleasant_goat'] = (ctx) => {
    const { btnConfirmAction, numberPad, nightRoleTitle, nightInstruction } = ctx;
    nightRoleTitle.textContent = "🐏 喜羊羊行動";
    nightInstruction.innerHTML += "請選擇目標並決定要使用的技能 (對自己使用視為雙重防護)：";
    numberPad.classList.add('hidden');

    let customPanel = document.createElement('div'); customPanel.id = 'custom-action-panel';
    customPanel.style = "display: flex; gap: 10px; width: 100%; justify-content: center; margin-bottom: 15px;";
    let btnGuard = document.createElement('button'); btnGuard.className = 'primary-btn'; btnGuard.textContent = "守護";
    let btnAntiTheft = document.createElement('button'); btnAntiTheft.className = 'special-btn'; btnAntiTheft.textContent = "防盜";
    let btnSkip = document.createElement('button'); btnSkip.className = 'text-btn'; btnSkip.textContent = "跳過";
    customPanel.appendChild(btnGuard); customPanel.appendChild(btnAntiTheft); customPanel.appendChild(btnSkip);
    numberPad.parentNode.insertBefore(customPanel, numberPad);

    const setup = (skillType, btn) => {
        [btnGuard, btnAntiTheft, btnSkip].forEach(b => b.classList.remove('action-selected'));
        btn.classList.add('action-selected'); s.selected_number = null;
        document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
        if (skillType) { s.current_sub_label = skillType; numberPad.classList.remove('hidden'); btnConfirmAction.classList.add('hidden'); }
        else { numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認"; s.selected_number = 'skip'; }
    };
    btnGuard.onclick = () => setup('guard', btnGuard);
    btnAntiTheft.onclick = () => setup('anti_theft', btnAntiTheft);
    btnSkip.onclick = () => setup(null, btnSkip);
};

// --- 灰太狼偷取 ---
roleHandlers['gray_wolf_steal'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🐺🎩 灰太狼行動 (偷取)";
    ctx.nightInstruction.innerHTML += "請選擇你要偷取技能的目標：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 灰太狼發動技能 ---
roleHandlers['gray_wolf_action'] = (ctx) => {
    const { btnConfirmAction, btnOptionalSkip, numberPad, nightRoleTitle, nightInstruction } = ctx;
    nightRoleTitle.textContent = "🐺🎩 灰太狼行動 (發動技能)";
    let targetRole = s.gray_wolf_stolen_player ? s.player_roles[s.gray_wolf_stolen_player] : null;

    if (!s.gray_wolf_stolen_player || s.gray_wolf_stolen_player === s.pleasant_goat_anti_theft) {
        nightInstruction.innerHTML = `<span style="color:#e94560; font-size:20px; font-weight:bold;">偷取失敗</span><br>(對方被防盜或未選擇目標)`;
        numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
    } else if (targetRole === 'pleasant_goat') {
        nightInstruction.innerHTML = `偷取到 <span style="color:#00ff88; font-size:24px; font-weight:bold;">🐏 喜羊羊</span>！<br>請猜測對方昨晚使用的技能 (猜錯將出局)：`;
        numberPad.classList.add('hidden');
        let customPanel = document.createElement('div'); customPanel.id = 'custom-action-panel';
        customPanel.style = "display: flex; gap: 10px; width: 100%; justify-content: center; margin-bottom: 15px;";
        let btnG = document.createElement('button'); btnG.className = 'primary-btn'; btnG.textContent = "猜測：守護";
        let btnA = document.createElement('button'); btnA.className = 'special-btn'; btnA.textContent = "猜測：防盜";
        customPanel.appendChild(btnG); customPanel.appendChild(btnA);
        numberPad.parentNode.insertBefore(customPanel, numberPad);
        const guess = (g, b) => { [btnG, btnA].forEach(x => x.classList.remove('action-selected')); b.classList.add('action-selected'); s.gray_wolf_guess = g; btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼"; };
        btnG.onclick = () => guess('guard', btnG); btnA.onclick = () => guess('anti_theft', btnA);
    } else if (['wolf', 'little_gray_wolf'].includes(targetRole)) {
        nightInstruction.innerHTML = `偷取失敗！但得知對方是 <span style="color:#e94560; font-size:24px; font-weight:bold;">🐺 狼人</span>`;
        numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
    } else if (targetRole === 'hunter') {
        s.gray_wolf_stolen_skill = 'hunter'; nightInstruction.innerHTML = `偷取成功！獲得【獵人】技能，若今晚死亡可以開槍。`;
        numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
    } else if (['seer', 'seer_A', 'seer_B'].includes(targetRole)) {
        s.gray_wolf_stolen_skill = 'seer'; nightInstruction.innerHTML = `偷取成功！獲得【預言家】技能，請選擇查驗對象：`;
        btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
    } else if (targetRole === 'witch') {
        s.gray_wolf_stolen_skill = 'witch'; nightInstruction.innerHTML = `偷取成功！獲得【女巫】技能，只能使用毒藥，請選擇毒殺對象：`;
        btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
    } else if (targetRole === 'guard') {
        s.gray_wolf_stolen_skill = 'guard'; nightInstruction.innerHTML = `偷取成功！獲得【守衛】技能，請選擇守護對象：`;
        btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
    } else if (targetRole === 'dreamwalker') {
        s.gray_wolf_stolen_skill = 'dreamwalker'; nightInstruction.innerHTML = `偷取成功！獲得【攝夢人】技能，請選擇攝夢對象：`;
        btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
    } else {
        nightInstruction.innerHTML = `偷取成功！對方是 <span style="color:#a2a8d3;">【${s.ROLE_DICT[targetRole].name}】</span>，但該職業夜晚無可用技能或不適用於偷取。`;
        numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
    }
};

// --- 幸運兒 ---
roleHandlers['lucky_boy_action'] = (ctx) => {
    const { btnConfirmAction, btnOptionalSkip, numberPad, nightRoleTitle, nightInstruction } = ctx;
    nightRoleTitle.textContent = "🎁 幸運兒行動";
    let item_text = s.merchant_item === 'seer' ? '預言家查驗' : s.merchant_item === 'poison' ? '女巫毒藥' : (s.merchant_item === 'gun' ? '獵人的槍' : '守衛護盾');
    if (s.merchant_type === 'black_market') {
        nightInstruction.innerHTML += `你獲得了黑市商人的【${item_text}】<br><span style="color:#e94560;">(此為技能今晚無法發動)</span>`;
        numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
    } else {
        nightInstruction.textContent = `你獲得了奇蹟商人的【${item_text}】，請選擇目標：`;
        btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
    }
};

// --- 獵人 ---
roleHandlers['hunter'] = (ctx) => {
    const { btnConfirmAction, numberPad, actionPad, nightRoleTitle, nightInstruction, isStolen, isVWKTurn } = ctx;
    nightRoleTitle.textContent = "🎯 獵人行動";
    nightInstruction.innerHTML += "請確認你今晚的開槍狀態：";
    numberPad.classList.add('hidden'); actionPad.classList.remove('hidden');

    const hSeat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'hunter'));
    let canShoot = isVWKTurn ? true : !(s.witch_poison_target === hSeat || isStolen);
    let statusBox = document.createElement('div');
    statusBox.style = `padding: 20px; background-color: var(--bg-card); border-radius: 8px; width: 100%; text-align: center; border: 2px solid ${canShoot ? 'var(--color-success)' : 'var(--color-primary)'}; margin: 20px 0;`;
    let statusP = document.createElement('p'); statusP.style = "font-size: 18px; margin: 0; color: var(--color-text);"; statusP.textContent = "若今晚倒牌，你的狀態為：";
    statusBox.appendChild(statusP);
    let valP = document.createElement('p'); valP.style = "font-size: 32px; font-weight: bold; margin: 10px 0 0 0;";
    if (!canShoot) { valP.textContent = "🚫 不能開槍"; valP.style.color = "#e94560"; }
    else { valP.textContent = "🔫 可以開槍"; valP.style.color = "#00ff88"; }
    statusBox.appendChild(valP); actionPad.appendChild(statusBox);
    btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "了解並閉眼";
};

// --- 查驗類角色（預言家、通靈師、石像鬼等）---
roleHandlers['_inspection'] = (ctx) => {
    const { btnOptionalSkip, nightRoleTitle, nightInstruction } = ctx;
    let name = getStageVoiceName(s.current_stage, s.current_sub_label);
    let base_role = s.current_stage.replace('_A', '').replace('_B', '');
    nightRoleTitle.textContent = `${s.ROLE_DICT[base_role]?.icon || '🎭'} ${name}行動`;
    let inst_text = s.current_stage === 'machine_wolf' ? "請選擇你要學習的對象：" : "請選擇你要查驗的對象：";
    nightInstruction.innerHTML += inst_text;
    btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
};

// --- 尋香魅影 / 許仙尋香魅影 ---
roleHandlers['phantom'] = roleHandlers['snake_phantom'] = (ctx) => {
    const { btnOptionalSkip, nightRoleTitle, nightInstruction } = ctx;
    nightRoleTitle.textContent = `${s.ROLE_DICT[s.current_stage].icon} ${s.ROLE_DICT[s.current_stage].name}行動`;
    nightInstruction.innerHTML += "請選擇任意兩名玩家綁定 (或跳過)：";
    btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
};

// --- 占卜師 ---
roleHandlers['diviner'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🔮 占卜師行動";
    ctx.nightInstruction.innerHTML += "請選擇你要標記的號碼 (當晚狼隊只能刀此號及其左右兩位)：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 盜賊 ---
roleHandlers['thief'] = (ctx) => {
    const { btnConfirmAction, btnOptionalSkip, numberPad, actionPad, nightRoleTitle, nightInstruction } = ctx;
    nightRoleTitle.textContent = "🦹 盜賊行動";
    nightInstruction.innerHTML += "請從兩張底牌中選擇一張 (若有狼陣營必須選狼)：";
    numberPad.classList.add('hidden'); actionPad.innerHTML = '';
    let cardContainer = document.createElement('div');
    cardContainer.style = 'display:flex; justify-content:center; gap:20px; width:100%;';
    let has_wolf = s.spare_cards.some(r => wolf_faction.includes(r));
    s.spare_cards.forEach(role => {
        const b = document.createElement('button'); b.className = 'num-btn'; b.innerHTML = `${s.ROLE_DICT[role].icon} <br> ${s.ROLE_DICT[role].name}`;
        b.style.width = '140px'; b.style.height = '140px'; b.style.fontSize = '20px';
        if (has_wolf && !wolf_faction.includes(role)) { b.disabled = true; b.style.opacity = '0.3'; }
        else { b.onclick = () => { cardContainer.querySelectorAll('.num-btn').forEach(btn => btn.classList.remove('selected')); b.classList.add('selected'); s.thief_chosen_role = role; btnConfirmAction.classList.remove('hidden'); }; }
        cardContainer.appendChild(b);
    });
    actionPad.appendChild(cardContainer); actionPad.classList.remove('hidden'); btnOptionalSkip.classList.add('hidden');
};

// --- 邱比特 ---
roleHandlers['cupid'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "👼 邱比特行動";
    ctx.nightInstruction.innerHTML += "請選擇兩名玩家成為情侶 (可選自己)：";
};

// --- 覺醒狼王分槍 ---
roleHandlers['awaken_wolf_king_gun'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "👑✨ 覺醒狼王行動";
    ctx.nightInstruction.innerHTML += "請選擇你要分槍的對象 (限狼隊友)：";
    ctx.btnOptionalSkip.textContent = "跳過 (自己保留兩把槍)"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 覺醒石像鬼（轉化）---
roleHandlers['_awaken_gargoyle'] = (ctx) => {
    let base_role = s.current_stage.replace('_A', '').replace('_B', '');
    ctx.nightRoleTitle.textContent = `${s.ROLE_DICT[base_role]?.icon || '🦇✨'} ${s.ROLE_DICT[s.current_stage]?.name || '覺醒石像鬼'}行動`;
    ctx.nightInstruction.innerHTML += "請選擇要轉化的對象：";
    ctx.btnOptionalSkip.classList.add('hidden');
};

// --- 百變狼王(熊) 魅惑 ---
roleHandlers['bear'] = (ctx) => {
    // 只有在 isVWKTurn 時才會走到這（普通熊在 main.js 的前置攔截中已處理）
    ctx.nightRoleTitle.textContent = "🐻 熊行動";
    ctx.nightInstruction.innerHTML += "請選擇你要魅惑的對象：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 目標選擇類（混血兒、野孩子、覺醒孤獨少女、覺醒白痴、烏鴉、鬼魅新娘、攝夢人等）---
roleHandlers['_target_select'] = (ctx) => {
    const { btnOptionalSkip, nightRoleTitle, nightInstruction } = ctx;
    let base_key = s.current_stage.replace('_couple', '');
    nightRoleTitle.textContent = `${s.ROLE_DICT[base_key].icon} ${s.ROLE_DICT[base_key].name}行動`;
    if (['ghost_bride', 'ghost_bride_couple', 'awaken_dreamwalker', 'dreamwalker', 'half_blood', 'awaken_lonely_girl', 'wild_child'].includes(s.current_stage)) {
        nightInstruction.innerHTML += "請選擇你的目標對象 (必須選擇)：";
        if (s.current_stage === 'ghost_bride_couple') nightInstruction.innerHTML += "請選擇你們的證婚人 (必須選擇)：";
    } else {
        nightInstruction.innerHTML += "請選擇你的目標對象 (或跳過)：";
        btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
    }
};

// --- 煉金魔女 ---
roleHandlers['alchemist'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "⚗️ 煉金魔女行動";
    ctx.nightInstruction.innerHTML += "請選擇要使用未明之霧的目標 (請選擇 3 名不同玩家，或跳過)：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 狼人（含種狼感染模式）---
roleHandlers['wolf'] = (ctx) => {
    const { btnConfirmAction, btnOptionalSkip, numberPad, nightRoleTitle, nightInstruction } = ctx;
    let w_seats = Object.keys(s.player_roles).filter(k => wolf_team_roles.includes(s.player_roles[k]));
    let has_lg = Object.values(s.player_roles).includes('little_girl');
    if (has_lg) w_seats.push(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'little_girl'));
    w_seats.sort((a, b) => a - b);
    let w_text = w_seats.map(id => {
        let tag = '';
        if (id === s.initial_thief_seat?.toString()) tag = (s.player_roles[id] === 'wolf_king' || s.player_roles[id] === 'awaken_wolf_king') ? '(盜賊狼王)' : '(盜賊)';
        else if (s.player_roles[id] !== 'wolf' && s.player_roles[id] !== 'little_girl') tag = `(${s.ROLE_DICT[s.player_roles[id]].name})`;
        return `${id}號${tag}`;
    }).join(', ');
    let dm_text = s.diviner_mark ? `<br><span style="color:#fca311;">⚠️ 占卜師已發動技能，只能刀 ${s.diviner_mark}號 及左右兩號</span>` : '';
    let alch_text = s.alchemist_fog_targets.length > 0 ? `<br><span style="color:#fca311;">⚠️ 煉金魔女已施放迷霧，只能從 ${s.alchemist_fog_targets.sort().join(', ')} 號中擊殺</span>` : '';
    nightRoleTitle.textContent = has_lg ? "🐺 狼隊與小女孩行動" : "🐺 狼人行動";

    if (Object.values(s.player_roles).includes('seed_wolf')) {
        nightInstruction.innerHTML += "請選擇行動模式：";
        numberPad.classList.add('hidden');
        let customPanel = document.createElement('div'); customPanel.id = 'custom-action-panel';
        customPanel.style = "display: flex; gap: 10px; width: 100%; justify-content: center; margin-bottom: 15px;";
        let btnKill = document.createElement('button'); btnKill.className = 'primary-btn'; btnKill.textContent = "一般刀人";
        let btnInfect = document.createElement('button'); btnInfect.className = 'special-btn'; btnInfect.textContent = "發動感染";
        let btnSkip = document.createElement('button'); btnSkip.className = 'secondary-btn'; btnSkip.textContent = "空刀 (不擊殺)";
        customPanel.appendChild(btnKill); customPanel.appendChild(btnInfect); customPanel.appendChild(btnSkip);
        numberPad.parentNode.insertBefore(customPanel, numberPad);

        btnKill.onclick = () => {
            s.is_seed_wolf_infecting = false; createNumberPad(); document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected')); s.selected_number = null;
            btnKill.classList.add('action-selected'); btnInfect.classList.remove('action-selected'); btnSkip.classList.remove('action-selected');
            numberPad.classList.remove('hidden'); btnConfirmAction.classList.add('hidden');
            nightInstruction.innerHTML = `請選擇擊殺目標：<br><span style="color:#e94560; font-size:16px;">🐺 睜眼名單：${has_lg ? '【隱藏】' : w_text}</span>${dm_text}${alch_text}`;
        };
        btnInfect.onclick = () => {
            s.is_seed_wolf_infecting = true; createNumberPad(); document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected')); s.selected_number = null;
            document.querySelectorAll('#number-pad .num-btn').forEach(b => { let seat_id = parseInt(b.textContent); if (seat_id && wolf_faction.includes(s.player_roles[seat_id])) { b.disabled = true; b.style.opacity = '0.3'; b.style.cursor = 'not-allowed'; } });
            btnInfect.classList.add('action-selected'); btnKill.classList.remove('action-selected'); btnSkip.classList.remove('action-selected');
            numberPad.classList.remove('hidden'); btnConfirmAction.classList.add('hidden');
            nightInstruction.innerHTML = `請選擇要感染的目標：<br><span style="color:#e94560; font-size:16px;">🐺 睜眼名單：${has_lg ? '【隱藏】' : w_text}</span>${dm_text}${alch_text}`;
        };
        btnSkip.onclick = () => {
            s.is_seed_wolf_infecting = false; createNumberPad(); document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected')); s.selected_number = 'skip';
            btnSkip.classList.add('action-selected'); btnKill.classList.remove('action-selected'); btnInfect.classList.remove('action-selected');
            numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認";
            nightInstruction.innerHTML = "請選擇行動模式：";
        };
        // 規則：煉金魔女迷霧啟動時，狼人不能空刀
        if (s.alchemist_fog_targets.length > 0) btnSkip.classList.add('hidden');
    } else {
        nightInstruction.innerHTML += `請點擊擊殺目標號碼 (或空刀)：<br><span style="color:#e94560; font-size:16px;">🐺 睜眼名單：${has_lg ? '【隱藏】' : w_text}</span>${dm_text}${alch_text}`;
        btnOptionalSkip.textContent = "空刀 (不擊殺)"; btnOptionalSkip.classList.remove('hidden');
        // 規則：煉金魔女迷霧啟動時，狼人不能空刀
        if (s.alchemist_fog_targets.length > 0) btnOptionalSkip.classList.add('hidden');
    }
};

// --- 狼美人 ---
roleHandlers['wolf_beauty'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "💋 狼美人行動";
    ctx.nightInstruction.innerHTML = "請選擇你要魅惑的對象 (不可自選)：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 覺醒狼美人 ---
roleHandlers['awaken_wolf_beauty'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "💋✨ 覺醒狼美人行動";
    ctx.nightInstruction.innerHTML = "請選擇你要魅惑的對象 (不可自選，每隔一晚可使用)：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 大野狼 ---
roleHandlers['big_bad_wolf'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🐺 大野狼行動";
    ctx.nightInstruction.innerHTML = "請選擇你要額外擊殺的目標：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 夢魘 ---
roleHandlers['nightmare'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🌑 夢魘行動";
    ctx.nightInstruction.innerHTML = "請選擇你要恐懼的對象 (不可自選)：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 守衛 ---
roleHandlers['guard'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🛡️ 守衛行動";
    ctx.nightInstruction.innerHTML = "請選擇你要守護的對象：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 蝕時狼妃 ---
roleHandlers['time_wolf'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "⏳ 蝕時狼妃行動";
    ctx.nightInstruction.innerHTML = "請選擇你要封鎖的對象：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 通知類（notify_ 開頭）---
roleHandlers['_notify'] = (ctx) => {
    const { btnConfirmAction, numberPad, actionPad, nightRoleTitle, nightInstruction } = ctx;
    let seat = parseInt(s.current_stage.split('_').pop());
    let notify_type = s.current_stage.substring(0, s.current_stage.lastIndexOf('_'));
    nightRoleTitle.textContent = `${seat}號確認狀態`;
    nightInstruction.textContent = "請點擊下方按鈕確認狀態：";
    numberPad.classList.add('hidden'); actionPad.classList.remove('hidden');

    let btnView = document.createElement('button');
    btnView.className = 'primary-btn'; btnView.style.width = '200px'; btnView.textContent = "查看狀態";
    actionPad.appendChild(btnView);

    btnView.onclick = () => {
        actionPad.innerHTML = '';
        let msgs = [];
        if (notify_type === 'notify_groom' && s.ghost_bride_groom === seat) msgs.push(`你是鬼魅新娘的新郎 🤵`);
        if (notify_type === 'notify_witness' && s.ghost_bride_witness === seat) msgs.push(`你是證婚人 🕊️`);
        if (notify_type === 'notify_luckyboy' && s.merchant_target === seat && !evil_roles.includes(s.player_roles[seat])) msgs.push(`你是幸運兒 🎁`);
        if (notify_type === 'notify_assistant' && s.awk_witch_assistant === seat) msgs.push(`你是女巫的協助者`);
        if (notify_type === 'notify_general') {
            if (s.cupid_lovers.includes(seat)) msgs.push("你是情侶 💕");
            if (s.seed_wolf_target === seat) msgs.push(`你被種狼感染成了狼人！🐺`);
        }
        if (notify_type === 'notify_end') {
            if (s.awk_gargoyle_target === seat || s.awk_gargoyle_target_a === seat || s.awk_gargoyle_target_b === seat) msgs.push(`你被覺醒石像鬼轉化了！🦇`);
        }
        let resBox = document.createElement('div');
        resBox.style = "padding: 20px; background-color: var(--bg-card); border-radius: 8px; width: 100%; text-align: center; border: 2px solid var(--color-success); margin: 20px 0;";
        let txt = document.createElement('p'); txt.style = "font-size: 24px; font-weight: bold; margin: 0;";
        txt.innerHTML = msgs.length ? msgs.join('<br>') : "無特殊狀態";
        txt.style.color = msgs.length ? "#fca311" : "#00ff88";
        resBox.appendChild(txt); actionPad.appendChild(resBox);
        btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "了解並閉眼";
    };
};


// --- 企鵝 ---
roleHandlers['penguin'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🐧 企鵝行動";
    ctx.nightInstruction.innerHTML = "請選擇你要冰凍的對象 (不可自選)：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 名媛 ---
roleHandlers['celebrity'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "👸 名媛行動";
    ctx.nightInstruction.innerHTML = "請選擇你要寵幸的對象 (不可自選)：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};


// --- 蠱惑師 ---
roleHandlers['charmer'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🪄 蠱惑師行動";
    ctx.nightInstruction.innerHTML = "請選擇你要蠱惑的對象：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 獵魔人 ---
roleHandlers['demon_hunter'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🏹 獵魔人行動";
    ctx.nightInstruction.innerHTML = "請選擇你要狩獵的對象（好人→自己出局，狼人→對方出局）：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};


// --- 惡魔（查驗神/民）---
roleHandlers['demon'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "😈 惡魔行動";
    ctx.nightInstruction.innerHTML = "請選擇你要查驗的對象（得知神牌或民牌）：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};


// --- 黑蝙蝠 ---
roleHandlers['black_bat'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🦇🖤 黑蝙蝠行動";
    ctx.nightInstruction.innerHTML = "請選擇你要庇護的對象（可選自己，被施技能者將反彈）：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 搗蛋鬼 ---
roleHandlers['troublemaker'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "👹 搗蛋鬼行動";
    ctx.nightInstruction.innerHTML = "請選擇你要耍寶的對象（被耍寶者技能視為對自己使用）：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 流光伯爵 ---
roleHandlers['light_count'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🧛 流光伯爵行動";
    ctx.nightInstruction.innerHTML = "請選擇你要庇護的對象（免疫夜間傷害，不可自選）：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 蝕日侍女 ---
roleHandlers['eclipse_maid'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🌑 蝕日侍女行動";
    let wolves = Object.keys(s.player_roles).filter(k => wolf_team_roles.includes(s.player_roles[k]) && k !== ctx.actorSeat);
    let wolf_text = wolves.length > 0 ? `<span style="color:#e94560;">你的狼隊友為：${wolves.join(', ')} 號</span><br><br>` : "";
    ctx.nightInstruction.innerHTML = wolf_text + "請選擇你要吞噬技能的對象（非狼人）：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 九尾狐（被動確認）---
roleHandlers['nine_tail_fox'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🦊✨ 九尾狐確認";
    ctx.nightInstruction.innerHTML = "請確認你的尾巴狀態（被動技能，無需選擇）：";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

// --- 刺客 ---
roleHandlers['assassin'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🗡️ 刺客行動";
    // 第一晚僅確認身分，第二晚起才能刺殺
    ctx.nightInstruction.innerHTML = "請選擇你要刺殺的對象並猜測其身分<br><small>（第一晚僅確認，不可行動）</small>";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

// --- 禁言長老 ---
roleHandlers['silence_elder'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🤫 禁言長老行動";
    ctx.nightInstruction.innerHTML = "請選擇你要禁言的對象（隔天不能說話）：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};


// --- 殭屍（感染 0~2 人）---
roleHandlers['zombie'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🧟 殭屍行動";
    ctx.nightInstruction.innerHTML = "請選擇你要感染的對象（可選 0~2 人）：";
    ctx.btnOptionalSkip.textContent = "跳過（不感染）"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 殭屍感染者確認（所有感染者睜眼）---
roleHandlers['zombie_infected'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🧟 感染者確認";
    let infected = s.zombie_infected || [];
    let text = infected.length > 0 ? `感染者為：${infected.join(', ')}號` : '（尚無感染者）';
    ctx.nightInstruction.innerHTML = `所有感染者請睜眼確認彼此<br><span style="color:#e94560;">${text}</span>`;
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

// --- 魔術師 ---
roleHandlers['magician'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🎩 魔術師行動";
    ctx.nightInstruction.innerHTML = "請選擇要交換的兩個號碼（先選第一個）：";
    ctx.btnOptionalSkip.textContent = "不交換"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 詭術師（功能同魔術師，但換白天票數）---
roleHandlers['trickster'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🃏 詭術師行動";
    ctx.nightInstruction.innerHTML = "請選擇要交換票數的兩個號碼（先選第一個）：";
    ctx.btnOptionalSkip.textContent = "不交換"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 狼術師（功能同魔術師）---
roleHandlers['wolf_sorcerer'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🧙‍♂️ 狼術師行動";
    ctx.nightInstruction.innerHTML = "請選擇要交換的兩個號碼（先選第一個）：";
    ctx.btnOptionalSkip.textContent = "不交換"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 狐狸（三人查驗）---
roleHandlers['real_fox'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🦊 狐狸行動";
    ctx.nightInstruction.innerHTML = "請選擇要查驗的中間玩家（將查驗該玩家及兩側）：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 烏鴉 ---
roleHandlers['crow'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🐦‍⬛ 烏鴉行動";
    ctx.nightInstruction.innerHTML = "請選擇你要詛咒的對象（隔天投票多一票）：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 定序王子（確認）---
roleHandlers['sequence_prince'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "👑 定序王子確認";
    ctx.nightInstruction.innerHTML = "確認定序王子身分（被動技能，無需夜間選擇）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

// --- 鏽劍騎士（確認）---
roleHandlers['rust_sword_knight'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "⚔️ 鏽劍騎士確認";
    ctx.nightInstruction.innerHTML = "確認鏽劍騎士身分（被動技能）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

// --- 子狐 ---
roleHandlers['fox'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🦊 子狐行動";
    ctx.nightInstruction.innerHTML = "請選擇你要魅惑的對象（一次性，魅到狼則空刀）：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 河豚（確認）---
roleHandlers['pufferfish'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🐡 河豚確認";
    ctx.nightInstruction.innerHTML = "確認河豚身分（白天翻牌炸人，無需夜間操作）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

// --- 白貓（確認）---
roleHandlers['white_cat'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🐱 白貓確認";
    ctx.nightInstruction.innerHTML = "確認白貓身分（被動翻牌免死，無需夜間操作）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};


// ============================================================
// 批量確認型面板（第一晚僅確認身分，無需選人）
// ============================================================

roleHandlers['wolf_crow'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🐦‍⬛🐺 狼鴉之爪確認";
    ctx.nightInstruction.innerHTML = "確認狼鴉之爪身分";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

roleHandlers['day_scholar'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "☀️ 白晝學者確認";
    ctx.nightInstruction.innerHTML = "確認白晝學者身分（第二晚起可增幅/削弱）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

roleHandlers['night_mentor'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🌙 寂夜導師確認";
    ctx.nightInstruction.innerHTML = "確認寂夜導師身分（第二晚起可增幅/削弱）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

roleHandlers['medium'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "👻 通靈者確認";
    ctx.nightInstruction.innerHTML = "確認通靈者身分（第二晚起可通靈死者技能給繼承者）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

roleHandlers['light_messenger'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🌅 白夜使者確認";
    ctx.nightInstruction.innerHTML = "確認白夜使者身分（白天可發動時光倒流）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

roleHandlers['detective'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🔍 偵探確認";
    ctx.nightInstruction.innerHTML = "確認偵探身分（白天可翻牌搶警徽並處決）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

roleHandlers['police_dog'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🐕 警犬確認";
    ctx.nightInstruction.innerHTML = "確認警犬身分（偵探處決後激活技能）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

roleHandlers['perseus'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "⚔️ 珀爾修斯確認";
    ctx.nightInstruction.innerHTML = "確認珀爾修斯身分（免疫石化，第二晚起可處決）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

roleHandlers['bar_fighter'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🗣️ 槓精確認";
    ctx.nightInstruction.innerHTML = "確認槓精身分（白天可翻牌開槓）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

roleHandlers['masked_man'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🎭 蒙面人確認";
    ctx.nightInstruction.innerHTML = "確認蒙面人身分（被殺不立即死亡，延遲到隔天發言後）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

roleHandlers['twins'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "👯 雙子相認";
    ctx.nightInstruction.innerHTML = "雙子請睜眼確認彼此";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

roleHandlers['alien_prince'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🤴 異族王子確認";
    ctx.nightInstruction.innerHTML = "確認異族王子身分（第二晚起可查驗睡美人）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

roleHandlers['phantom_king'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🦹 怪盜狼王確認";
    ctx.nightInstruction.innerHTML = "請問是否發動「無敵」技能？<br><small>（發動後免疫死亡直到下次入夜）</small>";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "不發動，確認閉眼";
    ctx.btnOptionalSkip.textContent = "發動無敵"; ctx.btnOptionalSkip.classList.remove('hidden');
};

roleHandlers['little_girl'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "👧 小女孩確認";
    ctx.nightInstruction.innerHTML = "小女孩與狼人一同睜眼（已在狼人階段處理）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

roleHandlers['high_villager'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🌟 高級平民確認";
    ctx.nightInstruction.innerHTML = "確認高級平民身分（第一天死訊後公布身分）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

// ============================================================
// 選人型面板（第一晚有主動選人技能）
// ============================================================

// --- 梅杜莎（石化）---
roleHandlers['medusa'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🐍 梅杜莎行動";
    ctx.nightInstruction.innerHTML = "請選擇你要石化的對象（被石化者當晚不能用技能，隔天不能投票）：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 機械狼（學習）---
roleHandlers['machine_wolf'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🤖🐺 機械狼行動";
    ctx.nightInstruction.innerHTML = "請選擇你要學習技能的對象：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 邪惡商人（分槍給小狼）---
roleHandlers['evil_merchant'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🏴 邪惡商人行動";
    ctx.nightInstruction.innerHTML = "請選擇要分槍的小狼：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 白蛇預言家（查驗是否為許仙）---
roleHandlers['snake_seer'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🐍✨ 白蛇預言家行動";
    ctx.nightInstruction.innerHTML = "請選擇要查驗的對象（得知是否為許仙尋香魅影）：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 許仙尋香魅影（與尋香共用 phantom UI，stage = snake_phantom）---
// 已由 _target_select 或 phantom 處理，無需獨立面板

// --- 潘朵拉（選人贈魔盒）---
roleHandlers['pandora'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "📦 潘朵拉行動";
    ctx.nightInstruction.innerHTML = "請選擇你要贈送魔盒的對象：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 超級黑市商人（選三人分配禮物）---
roleHandlers['super_black_market'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🏴‍☠️ 超級黑市商人行動";
    ctx.nightInstruction.innerHTML = "請依序選擇三位幸運兒：<br><small>第1人→查驗、第2人→毒藥、第3人→獵槍</small>";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 盜寶大師（從底牌選一張）---
roleHandlers['treasure_master'] = (ctx) => {
    const { btnConfirmAction, btnOptionalSkip, numberPad, actionPad, nightRoleTitle, nightInstruction } = ctx;
    nightRoleTitle.textContent = "💎 盜寶大師行動";
    nightInstruction.innerHTML = "請從三張底牌中選擇一張身分使用：";
    numberPad.classList.add('hidden'); actionPad.innerHTML = '';
    let cardContainer = document.createElement('div');
    cardContainer.style = 'display:flex; justify-content:center; gap:15px; width:100%; flex-wrap:wrap;';
    s.spare_cards.forEach(role => {
        const b = document.createElement('button'); b.className = 'num-btn';
        b.innerHTML = `${s.ROLE_DICT[role]?.icon || '?'} <br> ${s.ROLE_DICT[role]?.name || role}`;
        b.style.width = '120px'; b.style.height = '120px'; b.style.fontSize = '18px';
        b.onclick = () => {
            cardContainer.querySelectorAll('.num-btn').forEach(btn => btn.classList.remove('selected'));
            b.classList.add('selected'); s.treasure_hunter_choice = role;
            btnConfirmAction.classList.remove('hidden');
        };
        cardContainer.appendChild(b);
    });
    actionPad.appendChild(cardContainer); actionPad.classList.remove('hidden');
    btnOptionalSkip.classList.add('hidden');
};

// --- 黑夜使者（庇護狼人）---
roleHandlers['dark_messenger'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🌑 黑夜使者行動";
    ctx.nightInstruction.innerHTML = "請選擇要庇護的狼人（免疫夜間傷害+絕對反殺）：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 舞者（第一晚確認）---
roleHandlers['dancer'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "💃 舞者確認";
    ctx.nightInstruction.innerHTML = "確認舞者身分（第二晚起選三人入舞池）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

// --- 假面（第一晚確認）---
roleHandlers['mask_wolf'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🎭🐺 假面確認";
    ctx.nightInstruction.innerHTML = "確認假面身分（第二晚起可查驗舞池+改變判定）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

// --- 狼僕（第一晚確認）---
roleHandlers['wolf_servant'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🍵🐺 狼僕確認";
    ctx.nightInstruction.innerHTML = "確認狼僕身分（第二晚起可上茶）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

// --- 管家（第一晚確認）---
roleHandlers['butler'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🍵 管家確認";
    ctx.nightInstruction.innerHTML = "確認管家身分（第二晚起可上茶）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

// --- 覺醒白痴（已有 _target_select 覆蓋）---
// awaken_idiot 已在 _target_select 批量匹配中

// --- 咒狐（第一晚確認）---
roleHandlers['curse_fox'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🦊🔮 咒狐確認";
    ctx.nightInstruction.innerHTML = "確認咒狐身分（免疫狼刀，被查驗會死）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

// --- 超級守墓人（每晚選繼承者）---
roleHandlers['super_grave_keeper'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🪦✨ 超級守墓人行動";
    ctx.nightInstruction.innerHTML = "請選擇你的繼承者 (不可自選)：<br><small>若你出局，繼承者會得知所有放逐紀錄</small>";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 傀儡選擇（唯鄰是從板子，狼人開刀前選傀儡）---
roleHandlers['puppet_select'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🐺 狼人選擇傀儡";
    ctx.nightInstruction.innerHTML = "請選擇與狼人相鄰的一位玩家作為傀儡 (必須選擇)：<br><small>傀儡會被查殺、技能錯亂，但不知道自己被傀</small>";
};

// --- 夜之貴族（第一晚與狼隊睜眼，無額外行動）---
roleHandlers['night_noble'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🧛🐺 夜之貴族確認";
    ctx.nightInstruction.innerHTML = "確認夜之貴族身分（第二晚起可選夜僕）";
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

// --- 隱狼（第一晚看狼隊友）---
roleHandlers['hidden_wolf'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "👁️🐺 隱狼確認";
    let wolves = Object.keys(s.player_roles).filter(k => evil_roles.includes(s.player_roles[k]) && k !== ctx.actorSeat);
    ctx.nightInstruction.innerHTML = `確認你的狼隊友位置：<br><br><span style="color:#e94560; font-size:24px; font-weight:bold;">${wolves.length > 0 ? wolves.join(', ') + ' 號' : '無'}</span>`;
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

// --- 影子（第一晚選主人）---
roleHandlers['shadow'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🫥 影子行動";
    ctx.nightInstruction.innerHTML = "請選擇你的主人（勝利條件與主人相同）：";
};

// --- 復仇者（第一晚告知陣營，無需選人）---
roleHandlers['revenger'] = (ctx) => {
    const { btnConfirmAction, numberPad, actionPad, nightRoleTitle, nightInstruction } = ctx;
    nightRoleTitle.textContent = "🔥 復仇者確認";
    numberPad.classList.add('hidden');

    let shadow_seat = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'shadow');
    let shadow_master = s.shadow_master_target;
    let revenger_seat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'revenger'));
    
    let revenger_side = "";
    let color = "";

    // 影子若選到復仇者，兩人連為情侶鏈，成為第三方
    if (shadow_master && shadow_master === revenger_seat) {
        revenger_side = '第三方';
        color = '#ff00ff';
    } else {
        let master_role = shadow_master ? s.player_roles[shadow_master] : null;
        let master_is_wolf = master_role ? wolf_faction.includes(master_role) : false;
        // 若影子主人是狼人 → 復仇者幫好人；反之幫狼人
        revenger_side = master_is_wolf ? '好人' : '狼人';
        color = master_is_wolf ? '#00ff88' : '#e94560';
    }

    nightInstruction.innerHTML = `你的陣營為：<br><span style="color:${color}; font-size:32px; font-weight:bold;">${revenger_side}陣營</span><br><br><small>死亡後可刺殺一名玩家，若與你陣營對立則倒牌。</small>`;
    btnConfirmAction.classList.remove('hidden');
    btnConfirmAction.textContent = "了解並閉眼";
};

// --- 開膛手傑克（第一晚選擊殺目標）---
roleHandlers['jack_ripper'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🔪 開膛手傑克行動";
    ctx.nightInstruction.innerHTML = "請選擇你要擊殺的目標（不可自選，此刀無法被解藥救）：<br><small style='color:#fca311;'>守衛可以擋住此刀。勝利條件：場上只剩一種性別。</small>";
};

// --- 超級守墓人（第一晚選繼承者）---
roleHandlers['super_grave_keeper'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🪦✨ 超級守墓人行動";
    ctx.nightInstruction.innerHTML = "請選擇你的繼承者（你出局後繼承者能得知所有放逐紀錄）：";
    ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
};

// --- 月靈狼（嗥叫為被動，無需面板操作）---
// moon_wolf 已由狼隊面板處理
