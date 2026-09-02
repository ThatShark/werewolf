// js/roleUI.js
import { s, getStageVoiceName, getWolfTeamRoles, getNightTarget, getNightTargets } from './core.js';
import { createNumberPad } from './night.js';

export const roleHandlers = {};

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

    let base_stage = s.current_stage.replace(/_[AB]$/, '').replace('_couple', '');
    let ui_type = s.ROLE_DICT[base_stage]?.ui_type;

    let handler = roleHandlers[s.current_stage];
    if (!handler && (s.current_stage.startsWith('notify_') || s.current_stage.startsWith('status_'))) handler = roleHandlers['_notify'];
    if (!handler && ui_type === 'inspection') handler = roleHandlers['_inspection'];
    if (!handler && ['awaken_gargoyle', 'awaken_gargoyle_A', 'awaken_gargoyle_B'].includes(s.current_stage)) handler = roleHandlers['_awaken_gargoyle'];
    if (!handler && (ui_type === 'target_select' || s.current_stage === 'jack_ripper_select_fanatic')) handler = roleHandlers['_target_select'];
    if (!handler && (ui_type === 'info_only' || ['wolf_meet', 'lovers_meet', 'twins', 'hidden_wolf', 'eclipse_maid', 'big_gray_wolf_meet', 'wolf_brother_meet', 'ghost_bride_witness', 'wolf_gun_confirm', 'zombie_infected', 'fanatic_action'].includes(s.current_stage))) handler = roleHandlers['_info_only'];

    if (handler) handler(ctx);
    else {
        btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
        let name = getStageVoiceName(s.current_stage, s.current_sub_label);
        nightRoleTitle.textContent = `${s.ROLE_DICT[s.current_stage]?.icon || '🎭'} ${name}行動`;
    }
}

// --- 通用確認型面板 ---
roleHandlers['_info_only'] = (ctx) => {
    let roleData = s.ROLE_DICT[s.current_stage] || {};
    ctx.nightRoleTitle.textContent = `${roleData.icon || '🎭'} ${roleData.name || s.current_stage}確認`;

    let instruction = "請確認你的狀態或隊友。";
    let customHTML = "";

    switch (s.current_stage) {
        case 'wolf_meet':
            instruction = "請狼隊伍互相確認身分 (首夜不刀人)。";
            break;
        case 'lovers_meet':
            instruction = "請情侶互相確認身分。";
            break;
        case 'twins':
            let all_twins = Object.keys(s.player_roles).filter(k => s.player_roles[k] === 'twins');
            let other_twin = all_twins.find(k => k !== ctx.actorSeat.toString());
            customHTML = `你的雙子同伴是：<br><span style="color:#00ff88; font-size:24px; font-weight:bold;">${other_twin ? other_twin + ' 號' : '無'}</span>`;
            break;
        case 'hidden_wolf':
            let w = Object.keys(s.player_roles).filter(k => getWolfTeamRoles().includes(s.player_roles[k]) && s.player_roles[k] !== 'hidden_wolf');
            customHTML = `狼人陣營同伴是：<br><span style="color:#e94560; font-size:24px; font-weight:bold;">${w.length ? w.join(', ') + ' 號' : '無'}</span>`;
            break;
        case 'eclipse_maid':
            let em_w = Object.keys(s.player_roles).filter(k => getWolfTeamRoles().includes(s.player_roles[k]));
            customHTML = `狼人陣營同伴是：<br><span style="color:#e94560; font-size:24px; font-weight:bold;">${em_w.length ? em_w.join(', ') + ' 號' : '無'}</span>`;
            break;
        case 'big_gray_wolf_meet':
            let bgw = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'big_gray_wolf');
            let wolves = Object.keys(s.player_roles).filter(k => ['wolf', 'little_gray_wolf'].includes(s.player_roles[k]));
            customHTML = `大灰狼是：<span style='color:#e94560; font-weight:bold;'>${bgw}號</span><br>小狼是：<span style='color:#e94560; font-weight:bold;'>${wolves.length ? wolves.join(', ') : '無'}號</span>`;
            break;
        case 'wolf_brother_meet':
            let wb = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'wolf_brother');
            let wbl = Object.keys(s.player_roles).find(k => s.player_roles[k] === 'wolf_brother_little');
            customHTML = `狼兄是：<span style='color:#e94560; font-weight:bold;'>${wb}號</span><br>狼弟是：<span style='color:#e94560; font-weight:bold;'>${wbl}號</span>`;
            break;
        case 'ghost_bride_witness':
            let gb = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'ghost_bride'));
            let couple = [gb, s.ghost_bride_groom].sort((a, b) => a - b);
            customHTML = `這對鬼魅夫妻是：<br><span style='color:#e94560; font-size: 24px; font-weight:bold;'>${couple[0]}號 與 ${couple[1]}號</span><br><span style='color:#a2a8d3; font-size: 14px;'>(你不知道誰是新娘誰是新郎)</span>`;
            break;
        case 'wolf_gun_confirm':
            let awkWolfGunTarget = getNightTarget('grant_gun', 'awaken_wolf_king');
            let t = awkWolfGunTarget ? awkWolfGunTarget + " 號" : "無 (狼王自己保留兩把槍)";
            customHTML = `狼王分槍的對象是：<br><span style="color:#e94560; font-size:24px; font-weight:bold;">${t}</span>`;
            break;
        case 'zombie_infected':
            let infected = s.zombie_infected || [];
            infected.sort((a, b) => a - b);
            customHTML = `目前所有感染者是：<br><span style="color:#00ff88; font-size:24px; font-weight:bold;">${infected.length ? infected.join(', ') + ' 號' : '無'}</span>`;
            break;
        case 'fanatic_action':
            let jr = Object.keys(s.player_second_roles).find(k => s.player_second_roles[k] === 'jack_ripper');
            let fn = Object.keys(s.player_second_roles).find(k => s.player_second_roles[k] === 'fanatic');
            customHTML = `開膛手傑克是：<br><span style="color:#e94560; font-size:24px; font-weight:bold;">${jr ? jr + ' 號' : '無'}</span><br>狂熱粉是：<br><span style="color:#00ff88; font-size:24px; font-weight:bold;">${fn ? fn + ' 號' : '無'}</span>`;
            break;
    }

    ctx.nightInstruction.innerHTML = customHTML ? customHTML : instruction;
    ctx.numberPad.classList.add('hidden');
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

// --- 女巫 / 覺醒女巫 ---
roleHandlers['witch'] = roleHandlers['awaken_witch'] = (ctx) => {
    const { btnConfirmAction, numberPad, nightRoleTitle, nightInstruction, isStolen, isVWKTurn } = ctx;
    let title_name = s.current_stage === 'awaken_witch' ? '覺醒女巫' : '女巫';
    nightRoleTitle.textContent = `🧪 ${title_name}行動`;
    nightInstruction.innerHTML += (isVWKTurn ? "" : "請選擇你要使用的藥水：");
    numberPad.classList.add('hidden');

    let w_target = getNightTarget('kill', 'wolf');
    let target = s.is_seed_wolf_infecting ? null : (w_target ? parseInt(w_target) : null);

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
    if (isVWKTurn) { btnSave.disabled = true; btnSave.textContent = "解藥 (百變狼王不可用)"; btnSave.style.opacity = "0.5"; }
    else {
        if (target && target === parseInt(witch_seat) && rule === 'cannot_save') { btnSave.disabled = true; btnSave.textContent = "解藥 (不可自救)"; btnSave.style.opacity = "0.5"; }
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
        s.selected_number = 'witch_save'; s.selected_numbers_arr = [];
        btnSave.classList.add('action-selected'); btnPoison.classList.remove('action-selected'); btnSkip.classList.remove('action-selected');
        numberPad.classList.add('hidden');
        btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認";
        nightInstruction.textContent = "請選擇你要使用的藥水：";
    };
    if (!isStolen) {
        btnPoison.onclick = () => {
            document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
            s.selected_number = null; s.selected_numbers_arr = [];
            btnPoison.classList.add('action-selected'); btnSave.classList.remove('action-selected'); btnSkip.classList.remove('action-selected');
            numberPad.classList.remove('hidden'); btnConfirmAction.classList.add('hidden');
            if (s.current_stage === 'awaken_witch') { s.awk_witch_step = 'poison_target'; }
            nightInstruction.textContent = "請選擇你要毒殺的號碼：";
        };
    }
    btnSkip.onclick = () => {
        document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
        s.selected_number = 'skip'; s.selected_numbers_arr = [];
        btnSkip.classList.add('action-selected'); btnSave.classList.remove('action-selected'); btnPoison.classList.remove('action-selected');
        numberPad.classList.add('hidden');
        btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認";
        nightInstruction.textContent = "請選擇你要使用的藥水：";
    };
};

// --- 機械狼 ---
roleHandlers['machine_wolf'] = (ctx) => {
    const { btnOptionalSkip, nightRoleTitle, nightInstruction, numberPad, btnConfirmAction } = ctx;
    if (!s.machine_wolf_learn_target) {
        nightRoleTitle.textContent = "🤖🐺 機械狼行動";
        nightInstruction.innerHTML = "請選擇你要學習技能的對象：";
        
        let ruleEl = document.getElementById('setting-machine-wolf-rule');
        if (ruleEl && ruleEl.checked) {
            btnOptionalSkip.textContent = "跳過"; 
            btnOptionalSkip.classList.remove('hidden');
        } else {
            btnOptionalSkip.classList.add('hidden');
        }
    } else {
        let lr = s.player_roles[s.machine_wolf_learn_target];
        nightRoleTitle.textContent = `🤖🐺 機械狼行動 (學習 ${s.ROLE_DICT[lr]?.name})`;
        nightInstruction.innerHTML = "你只知道學到的身分，不會使用該身分的技能。";
        numberPad.classList.add('hidden');
        btnOptionalSkip.classList.add('hidden');
        btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
    }
};

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
        btn.classList.add('action-selected'); s.merchant_item = skill; s.selected_number = null;
        document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
        if (skill) { numberPad.classList.remove('hidden'); btnConfirmAction.classList.add('hidden'); nightInstruction.textContent = `請選擇你要給予【${name}】的對象：`; }
        else { numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認"; s.selected_number = 'skip'; nightInstruction.textContent = "請確認不發動技能："; }
    };
    btnSeer.onclick = () => setup('seer', '查驗', btnSeer); btnPoison.onclick = () => setup('poison', '毒藥', btnPoison);
    btnGuard.onclick = () => setup(g_skill, g_name.replace('獵人的', ''), btnGuard); btnSkip.onclick = () => setup(null, null, btnSkip);
};

// --- 超級黑市商人 ---
roleHandlers['super_black_market'] = (ctx) => {
    const { btnConfirmAction, btnOptionalSkip, numberPad, actionPad, nightRoleTitle, nightInstruction } = ctx;
    nightRoleTitle.textContent = "🛒 超級黑市商人行動";
    nightInstruction.innerHTML += "請依序選擇三名不同的玩家 (將分別獲得查驗、毒藥、獵槍)：";
    
    let selected = [];
    let gifts = ['查驗', '毒藥', '獵槍'];
    
    let displayDiv = document.createElement('div');
    displayDiv.style = "margin-bottom: 15px; font-size: 18px; color: #fca311; text-align:center;";
    displayDiv.innerHTML = `尚未選擇`;
    actionPad.appendChild(displayDiv);
    actionPad.classList.remove('hidden');

    numberPad.querySelectorAll('.num-btn').forEach(btn => {
        let i = parseInt(btn.textContent);
        if (i === parseInt(ctx.actorSeat) || s.final_killed.includes(i)) {
            btn.disabled = true; btn.style.opacity = '0.3'; return;
        }
        let newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.onclick = () => {
            if (selected.includes(i)) {
                selected = selected.filter(x => x !== i);
                newBtn.classList.remove('selected');
            } else if (selected.length < 3) {
                selected.push(i);
                newBtn.classList.add('selected');
            }
            
            if (selected.length > 0) {
                displayDiv.innerHTML = selected.map((s_seat, idx) => `[${gifts[idx]}] 給 ${s_seat}號`).join('<br>');
            } else {
                displayDiv.innerHTML = `尚未選擇`;
            }
            
            if (selected.length === 3) {
                s.selected_numbers_arr = [...selected];
                s.selected_number = null;
                btnConfirmAction.classList.remove('hidden');
                btnConfirmAction.textContent = "確認";
            } else {
                btnConfirmAction.classList.add('hidden');
                s.selected_numbers_arr = [];
            }
        };
    });
    
    btnOptionalSkip.textContent = "不發動技能";
    btnOptionalSkip.classList.remove('hidden');
    
    btnOptionalSkip.onclick = () => {
        s.selected_number = 'skip';
        s.selected_numbers_arr = [];
        btnConfirmAction.classList.remove('hidden');
        btnConfirmAction.textContent = "確認";
        btnOptionalSkip.classList.add('action-selected');
        numberPad.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
        displayDiv.innerHTML = `跳過發動技能`;
    };
};

roleHandlers['pleasant_goat'] = (ctx) => {
    const { btnConfirmAction, numberPad, nightRoleTitle, nightInstruction } = ctx;
    nightRoleTitle.textContent = "🐏 喜羊羊行動"; nightInstruction.innerHTML += "請選擇目標並決定要使用的技能 (對自己使用視為雙重防護)：";
    numberPad.classList.add('hidden');
    let customPanel = document.createElement('div'); customPanel.id = 'custom-action-panel'; customPanel.style = "display: flex; gap: 10px; width: 100%; justify-content: center; margin-bottom: 15px;";
    let btnGuard = document.createElement('button'); btnGuard.className = 'primary-btn'; btnGuard.textContent = "守護";
    let btnAntiTheft = document.createElement('button'); btnAntiTheft.className = 'special-btn'; btnAntiTheft.textContent = "防盜";
    let btnSkip = document.createElement('button'); btnSkip.className = 'text-btn'; btnSkip.textContent = "跳過";
    customPanel.appendChild(btnGuard); customPanel.appendChild(btnAntiTheft); customPanel.appendChild(btnSkip);
    numberPad.parentNode.insertBefore(customPanel, numberPad);
    const setup = (skillType, btn) => {
        [btnGuard, btnAntiTheft, btnSkip].forEach(b => b.classList.remove('action-selected'));
        btn.classList.add('action-selected'); s.selected_number = null; document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
        if (skillType) { s.current_sub_label = skillType; numberPad.classList.remove('hidden'); btnConfirmAction.classList.add('hidden'); }
        else { numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認"; s.selected_number = 'skip'; }
    };
    btnGuard.onclick = () => setup('guard', btnGuard); btnAntiTheft.onclick = () => setup('anti_theft', btnAntiTheft); btnSkip.onclick = () => setup(null, btnSkip);
};

roleHandlers['gray_wolf_steal'] = (ctx) => { ctx.nightRoleTitle.textContent = "🐺🎩 灰太狼行動 (偷取)"; ctx.nightInstruction.innerHTML += "請選擇你要偷取技能的目標："; ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden'); };
roleHandlers['gray_wolf_action'] = (ctx) => {
    const { btnConfirmAction, numberPad, nightRoleTitle, nightInstruction } = ctx;
    nightRoleTitle.textContent = "🐺🎩 灰太狼行動 (發動技能)"; let targetRole = s.gray_wolf_stolen_player ? s.player_roles[s.gray_wolf_stolen_player] : null;
    let pgAntiTheft = getNightTarget('anti_theft', 'pleasant_goat') || getNightTarget('guard_and_anti_theft', 'pleasant_goat');
    if (!s.gray_wolf_stolen_player || s.gray_wolf_stolen_player === pgAntiTheft) {
        nightInstruction.innerHTML = `<span style="color:#e94560; font-size:20px; font-weight:bold;">偷取失敗</span><br>(對方被防盜或未選擇目標)`;
        numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
    } else if (targetRole === 'pleasant_goat') {
        nightInstruction.innerHTML = `偷取到 <span style="color:#00ff88; font-size:24px; font-weight:bold;">🐏 喜羊羊</span>！<br>請猜測對方昨晚使用的技能 (猜錯將出局)：`;
        numberPad.classList.add('hidden'); let customPanel = document.createElement('div'); customPanel.id = 'custom-action-panel'; customPanel.style = "display: flex; gap: 10px; width: 100%; justify-content: center; margin-bottom: 15px;";
        let btnG = document.createElement('button'); btnG.className = 'primary-btn'; btnG.textContent = "猜測：守護"; let btnA = document.createElement('button'); btnA.className = 'special-btn'; btnA.textContent = "猜測：防盜";
        customPanel.appendChild(btnG); customPanel.appendChild(btnA); numberPad.parentNode.insertBefore(customPanel, numberPad);
        const guess = (g, b) => { [btnG, btnA].forEach(x => x.classList.remove('action-selected')); b.classList.add('action-selected'); s.gray_wolf_guess = g; btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼"; };
        btnG.onclick = () => guess('guard', btnG); btnA.onclick = () => guess('anti_theft', btnA);
    } else if (s.ROLE_DICT[targetRole]?.faction === 'wolf') {
        nightInstruction.innerHTML = `偷取失敗！但得知對方是 <span style="color:#e94560; font-size:24px; font-weight:bold;">🐺 狼人</span>`; numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
    } else if (targetRole === 'hunter') {
        s.gray_wolf_stolen_skill = 'hunter'; nightInstruction.innerHTML = `偷取成功！獲得【獵人】技能，若今晚死亡可以開槍。`; numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
    } else if (['seer', 'seer_A', 'seer_B'].includes(targetRole)) {
        s.gray_wolf_stolen_skill = 'seer'; nightInstruction.innerHTML = `偷取成功！獲得【預言家】技能，請選擇查驗對象：`; ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
    } else if (targetRole === 'witch') {
        s.gray_wolf_stolen_skill = 'witch'; nightInstruction.innerHTML = `偷取成功！獲得【女巫】技能，只能使用毒藥，請選擇毒殺對象：`; ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
    } else if (targetRole === 'guard') {
        s.gray_wolf_stolen_skill = 'guard'; nightInstruction.innerHTML = `偷取成功！獲得【守衛】技能，請選擇守護對象：`; ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
    } else if (targetRole === 'dreamwalker') {
        s.gray_wolf_stolen_skill = 'dreamwalker'; nightInstruction.innerHTML = `偷取成功！獲得【攝夢人】技能，請選擇攝夢對象：`; ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden');
    } else {
        nightInstruction.innerHTML = `偷取成功！對方是 <span style="color:#a2a8d3;">【${s.ROLE_DICT[targetRole].name}】</span>，但該職業夜晚無可用技能或不適用於偷取。`; numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
    }
};

roleHandlers['lucky_boy_action'] = (ctx) => {
    const { btnConfirmAction, btnOptionalSkip, numberPad, nightRoleTitle, nightInstruction } = ctx;
    nightRoleTitle.textContent = "🍀 幸運兒行動";
    let item_text = s.merchant_item === 'seer' ? '查驗' : s.merchant_item === 'poison' ? '毒藥' : (s.merchant_item === 'gun' ? '槍' : '守護');

    if (s.merchant_type === 'black_market') {
        nightInstruction.innerHTML = `你獲得了黑市商人的【${item_text}】<br><span style="color:#e94560;">(此技能今晚無法發動)</span>`;
        numberPad.classList.add('hidden');
        btnConfirmAction.classList.remove('hidden');
        btnConfirmAction.textContent = "確認並閉眼";
    } else {
        nightInstruction.innerHTML = `你獲得了奇蹟商人的【<span style="color:#00ff88;">${item_text}</span>】技能。<br>請選擇你要使用的對象：`;
        btnOptionalSkip.textContent = "不使用";
        btnOptionalSkip.classList.remove('hidden');
        numberPad.classList.remove('hidden');

        if (s.merchant_item === 'poison' || s.merchant_item === 'seer') {
            let selfBtn = Array.from(numberPad.querySelectorAll('.num-btn')).find(b => parseInt(b.textContent) === parseInt(s.merchant_target));
            if (selfBtn) {
                selfBtn.disabled = true;
                selfBtn.style.opacity = '0.3';
                selfBtn.style.pointerEvents = 'none';
            }
        }
    }
};

roleHandlers['_inspection'] = (ctx) => {
    const { btnOptionalSkip, nightRoleTitle, nightInstruction } = ctx;
    let name = getStageVoiceName(s.current_stage, s.current_sub_label);
    let base_role = s.current_stage.replace('_A', '').replace('_B', '');
    nightRoleTitle.textContent = `${s.ROLE_DICT[base_role]?.icon || '🎭'} ${name}行動`;
    let inst_text = s.current_stage === 'machine_wolf' ? "請選擇你要學習的對象：" : "請選擇你要查驗的對象：";
    nightInstruction.innerHTML += inst_text;
    btnOptionalSkip.textContent = "跳過";
    btnOptionalSkip.classList.remove('hidden');
};

roleHandlers['phantom'] = roleHandlers['snake_phantom'] = (ctx) => {
    const { btnOptionalSkip, nightRoleTitle, nightInstruction } = ctx;
    nightRoleTitle.textContent = `${s.ROLE_DICT[s.current_stage].icon} ${s.ROLE_DICT[s.current_stage].name}行動`;
    let wolf_info = s.phantom_known_wolf ? `<br><span style="color:#e94560; font-size: 18px; font-weight:bold;">首夜得知一名狼隊友位置：${s.phantom_known_wolf} 號</span>` : "";
    nightInstruction.innerHTML += "請選擇任意兩名玩家綁定 (或跳過)：" + wolf_info;
    btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
};
roleHandlers['diviner'] = (ctx) => { ctx.nightRoleTitle.textContent = "🔮 占卜師行動"; ctx.nightInstruction.innerHTML += "請選擇你要標記的號碼 (當晚狼隊只能刀此號及其左右兩位)："; ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden'); };

// --- 盜賊 ---
roleHandlers['thief'] = (ctx) => { 
    const { btnConfirmAction, btnOptionalSkip, numberPad, actionPad, nightRoleTitle, nightInstruction } = ctx; 
    nightRoleTitle.textContent = "🦹 盜賊行動"; 
    nightInstruction.innerHTML += "請從兩張底牌中選擇一張 (若有狼陣營必須選狼)："; 
    numberPad.classList.add('hidden'); 
    actionPad.innerHTML = ''; 
    let cardContainer = document.createElement('div'); 
    cardContainer.style = 'display:flex; justify-content:center; gap:20px; width:100%;'; 
    let has_wolf = s.spare_cards.some(r => s.ROLE_DICT[r]?.faction === 'wolf'); 
    s.spare_cards.forEach(role => { 
        const b = document.createElement('button'); 
        b.className = 'num-btn'; 
        b.innerHTML = `${s.ROLE_DICT[role].icon} <br> ${s.ROLE_DICT[role].name}`; 
        b.style.width = '140px'; b.style.height = '140px'; b.style.fontSize = '20px'; 
        if (has_wolf && s.ROLE_DICT[role]?.faction !== 'wolf') { 
            b.disabled = true; b.style.opacity = '0.3'; 
        } else { 
            b.onclick = () => { 
                cardContainer.querySelectorAll('.num-btn').forEach(btn => btn.classList.remove('selected')); 
                b.classList.add('selected'); 
                s.thief_chosen_role = role; 
                btnConfirmAction.classList.remove('hidden'); 
                btnConfirmAction.textContent = "確認";
            }; 
        } 
        cardContainer.appendChild(b); 
    }); 
    actionPad.appendChild(cardContainer); 
    actionPad.classList.remove('hidden'); 
    btnOptionalSkip.classList.add('hidden'); 
};

// --- 盜寶大師 ---
roleHandlers['treasure_master'] = (ctx) => {
    const { btnConfirmAction, btnOptionalSkip, numberPad, actionPad, nightRoleTitle, nightInstruction } = ctx;
    nightRoleTitle.textContent = "💎 盜寶大師行動";
    nightInstruction.innerHTML += "請從底牌中選擇一張身分來使用 (若選到狼陣營將成為狼人陣營)：";
    numberPad.classList.add('hidden');
    actionPad.innerHTML = '';
    
    let cardContainer = document.createElement('div');
    cardContainer.style = 'display:flex; justify-content:center; gap:10px; width:100%;';
    
    s.spare_cards.forEach(role => {
        const b = document.createElement('button');
        b.className = 'num-btn';
        b.innerHTML = `${s.ROLE_DICT[role].icon} <br> ${s.ROLE_DICT[role].name}`;
        b.style.flex = '1';
        b.style.height = '120px';
        b.style.fontSize = '18px';
        b.style.padding = '5px';
        
        b.onclick = () => {
            cardContainer.querySelectorAll('.num-btn').forEach(btn => btn.classList.remove('selected'));
            b.classList.add('selected');
            s.treasure_hunter_choice = role;
            btnConfirmAction.classList.remove('hidden');
            btnConfirmAction.textContent = "確認";
        };
        cardContainer.appendChild(b);
    });
    
    actionPad.appendChild(cardContainer);
    actionPad.classList.remove('hidden');
    btnOptionalSkip.classList.add('hidden'); // 必須選擇
};

// --- 潘朵拉 ---
roleHandlers['pandora'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "📦 潘朵拉行動";
    ctx.nightInstruction.innerHTML += "請選擇你要給予魔盒的對象 (可選自己)：";
    ctx.btnOptionalSkip.textContent = "跳過 (不給予)";
    ctx.btnOptionalSkip.classList.remove('hidden');
};

roleHandlers['show_pandora_gift'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🎁 魔盒開啟";
    ctx.numberPad.classList.add('hidden');
    
    const gift_names = { knife: '一把刀 (但你無法使用)', poison: '一滴毒', hope_light: '希望之光', day_gun: '日槍' };
    let gift = s.pandora_gift;
    let desc = "";
    if (gift === 'poison') desc = "你已經死亡，且無法發動技能。";
    if (gift === 'hope_light') desc = "若你是潘朵拉，你將獲得勝利！否則無事發生。";
    if (gift === 'day_gun') desc = "白天被放逐出局時，可開槍帶走一人。";
    if (gift === 'knife') desc = "潘朵拉本人抽到刀，無法使用。";

    ctx.nightInstruction.innerHTML = `你打開了潘朵拉的魔盒，獲得：<br><span style="color:#fca311; font-size:24px; font-weight:bold;">【${gift_names[gift]}】</span><br><span style="color:#a2a8d3;">${desc}</span>`;
    ctx.btnConfirmAction.classList.remove('hidden');
    ctx.btnConfirmAction.textContent = "確認並閉眼";
};

roleHandlers['pandora_knife'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🔪 魔盒之刀行動";
    ctx.nightInstruction.innerHTML = `你從魔盒中獲得了<span style="color:#e94560; font-weight:bold;">【一把刀】</span>！<br>請選擇你要襲擊的對象 (無視解藥，可跳過)：`;
    ctx.btnOptionalSkip.textContent = "跳過 (不使用)";
    ctx.btnOptionalSkip.classList.remove('hidden');
};

roleHandlers['cupid'] = (ctx) => { ctx.nightRoleTitle.textContent = "👼 邱比特行動"; ctx.nightInstruction.innerHTML += "請選擇兩名玩家成為情侶 (可選自己)："; };
roleHandlers['awaken_wolf_king_gun'] = (ctx) => { ctx.nightRoleTitle.textContent = "👑✨ 覺醒狼王行動"; ctx.nightInstruction.innerHTML += "請選擇你要分槍的對象 (限狼隊友)："; ctx.btnOptionalSkip.textContent = "跳過 (自己保留兩把槍)"; ctx.btnOptionalSkip.classList.remove('hidden'); };
roleHandlers['_awaken_gargoyle'] = (ctx) => { let base_role = s.current_stage.replace('_A', '').replace('_B', ''); ctx.nightRoleTitle.textContent = `${s.ROLE_DICT[base_role]?.icon || '🦇✨'} ${s.ROLE_DICT[s.current_stage]?.name || '覺醒石像鬼'}行動`; ctx.nightInstruction.innerHTML += "請選擇要轉化的對象："; ctx.btnOptionalSkip.classList.add('hidden'); };

// --- 動態替換文案型選擇面板 ---
roleHandlers['_target_select'] = (ctx) => {
    const { btnOptionalSkip, nightRoleTitle, nightInstruction } = ctx;
    let base_key = s.current_stage.replace('_couple', '');
    nightRoleTitle.textContent = `${s.ROLE_DICT[base_key]?.icon || '🎯'} ${s.ROLE_DICT[base_key]?.name || '選擇'}行動`;

    let customInst = "請選擇你的目標對象 (或跳過)：";
    let isMandatory = false;
    let skipText = "跳過";

    switch (s.current_stage) {
        case 'shadow':
            customInst = "請選擇你的主人 (必須選擇)：";
            isMandatory = true;
            break;
        case 'half_blood':
            customInst = "請選擇你要支持/暗戀的玩家 (必須選擇)：";
            isMandatory = true;
            break;
        case 'awaken_lonely_girl':
            customInst = "請選擇你的偶像 (必須選擇)：";
            isMandatory = true;
            break;
        case 'wild_child':
            customInst = "請選擇你的榜樣 (必須選擇)：";
            isMandatory = true;
            break;
        case 'ghost_bride':
            customInst = "請選擇你的新郎 (必須選擇)：";
            isMandatory = true;
            break;
        case 'ghost_bride_couple':
            customInst = "請選擇你們的證婚人 (必須選擇)：";
            isMandatory = true;
            break;
        case 'awaken_dreamwalker':
        case 'dreamwalker':
            customInst = "請選擇你要攝夢的對象 (必須選擇)：";
            isMandatory = true;
            break;
        case 'nightmare':
            customInst = "請選擇你要恐懼的對象 (必須選擇)：";
            isMandatory = true;
            break;
        case 'guard':
            customInst = "請選擇你要守護的玩家 (可選自己，不可連守同人，或空守)：";
            skipText = "空守";
            break;
        case 'crow':
            customInst = "請選擇你要詛咒的玩家 (或跳過)：";
            break;
        case 'magician':
        case 'trickster':
        case 'wolf_sorcerer':
            customInst = "請選擇兩名玩家交換號碼牌 (或跳過)：";
            break;
        case 'zombie':
            customInst = "請選擇你要感染的對象 (或跳過)：";
            break;
        case 'jack_ripper':
            customInst = "請選擇你要擊殺的對象 (或跳過)：";
            break;
        case 'super_grave_keeper':
            customInst = "請選擇你要傳交的繼承者 (必須選擇)：";
            isMandatory = true;
            break;
        case 'medusa':
            customInst = "請選擇你要石化的對象 (或跳過)：";
            break;
        case 'black_bat':
            customInst = "請選擇你要庇護的對象 (可選自己，或跳過)：";
            break;
        case 'evil_merchant':
            customInst = "請選擇你要給予獵槍的小狼 (或跳過)：";
            break;
        case 'dark_messenger':
            customInst = "請選擇你要庇護的狼人 (可選自己，或跳過)：";
            break;
        case 'little_gray_wolf':
        case 'big_bad_wolf':
            customInst = "請選擇你要擊殺的對象 (或跳過)：";
            break;
        case 'charmer':
            customInst = "請選擇你要蠱惑的對象 (或跳過)：";
            break;
        case 'wolf_beauty':
        case 'awaken_wolf_beauty':
            customInst = "請選擇你要魅惑的對象 (或跳過)：";
            break;
    }

    nightInstruction.innerHTML += customInst;

    if (!isMandatory) {
        btnOptionalSkip.textContent = skipText;
        btnOptionalSkip.classList.remove('hidden');
    }
};

roleHandlers['alchemist'] = (ctx) => { ctx.nightRoleTitle.textContent = "⚗️ 煉金魔女行動"; ctx.nightInstruction.innerHTML += "請選擇要使用未明之霧的目標 (請選擇 3 名不同玩家，或跳過)："; ctx.btnOptionalSkip.textContent = "跳過"; ctx.btnOptionalSkip.classList.remove('hidden'); };
roleHandlers['wolf'] = (ctx) => {
    const { btnConfirmAction, btnOptionalSkip, numberPad, nightRoleTitle, nightInstruction } = ctx;
    let w_seats = Object.keys(s.player_roles).filter(k => getWolfTeamRoles().includes(s.player_roles[k]));
    let has_lg = Object.values(s.player_roles).includes('little_girl');
    if (has_lg) w_seats.push(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'little_girl'));
    w_seats.sort((a, b) => a - b);
    let w_text = w_seats.map(id => { let tag = ''; if (id === s.initial_thief_seat?.toString()) tag = (s.player_roles[id] === 'wolf_king' || s.player_roles[id] === 'awaken_wolf_king') ? '(盜賊狼王)' : '(盜賊)'; else if (s.player_roles[id] !== 'wolf' && s.player_roles[id] !== 'little_girl') tag = `(${s.ROLE_DICT[s.player_roles[id]].name})`; return `${id}號${tag}`; }).join(', ');

    let divinerMark = getNightTarget('mark', 'diviner');
    let dm_text = divinerMark ? `<br><span style="color:#fca311;">⚠️ 占卜師已發動技能，只能刀 ${divinerMark}號 及左右兩號</span>` : '';
    let alchFogs = getNightTargets('mark', 'alchemist');
    let alch_text = alchFogs.length > 0 ? `<br><span style="color:#fca311;">⚠️ 煉金魔女已施放迷霧，只能從 ${alchFogs.sort().join(', ')} 號中擊殺</span>` : '';
    nightRoleTitle.textContent = has_lg ? "🐺 狼隊與小女孩行動" : "🐺 狼人行動";

    let wolf_list_html = `<br><span style="color:#e94560; font-size:16px;">🐺 睜眼名單：${has_lg ? '【隱藏】' : w_text}</span>${dm_text}${alch_text}`;

    if (Object.values(s.player_roles).includes('seed_wolf')) {
        nightInstruction.innerHTML += `請選擇行動模式：${wolf_list_html}`;
        numberPad.classList.add('hidden');

        let customPanel = document.createElement('div'); customPanel.id = 'custom-action-panel'; customPanel.style = "display: flex; gap: 10px; width: 100%; justify-content: center; margin-bottom: 15px;";
        let btnKill = document.createElement('button'); btnKill.className = 'primary-btn'; btnKill.textContent = "一般刀人";
        let btnInfect = document.createElement('button'); btnInfect.className = 'special-btn'; btnInfect.textContent = "發動感染";
        let btnSkip = document.createElement('button'); btnSkip.className = 'secondary-btn'; btnSkip.textContent = "空刀 (不擊殺)";

        customPanel.appendChild(btnKill); customPanel.appendChild(btnInfect); customPanel.appendChild(btnSkip);
        numberPad.parentNode.insertBefore(customPanel, numberPad);

        btnKill.onclick = () => {
            s.is_seed_wolf_infecting = false; createNumberPad(); document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected')); s.selected_number = null;
            btnKill.classList.add('action-selected'); btnInfect.classList.remove('action-selected'); btnSkip.classList.remove('action-selected');
            numberPad.classList.remove('hidden'); btnConfirmAction.classList.add('hidden');
            nightInstruction.innerHTML = `請選擇擊殺目標：${wolf_list_html}`;
        };

        btnInfect.onclick = () => {
            s.is_seed_wolf_infecting = true; createNumberPad(); document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected')); s.selected_number = null;
            document.querySelectorAll('#number-pad .num-btn').forEach(b => { let seat_id = parseInt(b.textContent); if (seat_id && s.ROLE_DICT[s.player_roles[seat_id]]?.faction === 'wolf') { b.disabled = true; b.style.opacity = '0.3'; b.style.cursor = 'not-allowed'; } });
            btnInfect.classList.add('action-selected'); btnKill.classList.remove('action-selected'); btnSkip.classList.remove('action-selected');
            numberPad.classList.remove('hidden'); btnConfirmAction.classList.add('hidden');
            nightInstruction.innerHTML = `請選擇要感染的目標：${wolf_list_html}`;
        };

        btnSkip.onclick = () => {
            s.is_seed_wolf_infecting = false; createNumberPad(); document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected')); s.selected_number = 'skip';
            btnSkip.classList.add('action-selected'); btnKill.classList.remove('action-selected'); btnInfect.classList.remove('action-selected');
            numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認";
            nightInstruction.innerHTML = `請選擇行動模式：${wolf_list_html}`;
        };

        if (alchFogs.length > 0) btnSkip.classList.add('hidden');
    } else {
        nightInstruction.innerHTML += `請點擊擊殺目標號碼 (或空刀)：${wolf_list_html}`;
        btnOptionalSkip.textContent = "空刀 (不擊殺)"; btnOptionalSkip.classList.remove('hidden');
        if (alchFogs.length > 0) btnOptionalSkip.classList.add('hidden');
    }
};

roleHandlers['_notify'] = (ctx) => {
    const { btnConfirmAction, numberPad, actionPad, nightRoleTitle, nightInstruction } = ctx;

    const group_match = s.current_stage.match(/^status_check_group_(\d+)$/);
    if (group_match) {
        const seat = parseInt(group_match[1]);
        const messages = [];

        s.night_status_flows.forEach(flow => {
            const is_selected_target = flow.targets.includes(seat);
            if (flow.type === 'merchant' && is_selected_target && !isPlayerWolfFaction(seat)) {
                if (flow.metadata.merchant_type === 'black_market') {
                    const item_names = { seer: '預言家查驗', poison: '女巫毒藥', guard: '守衛護盾', gun: '獵人的槍' };
                    messages.push(`你是幸運兒，獲得【${item_names[flow.metadata.gift] || '未知技能'}】`);
                    messages.push('此技能今晚不能使用');
                } else {
                    messages.push(`你是幸運兒！🎁`);
                }
            }
            if (flow.type === 'super_black_market') {
                const gift = flow.metadata.gifts?.find(item => item.seat === seat);
                const item_names = { seer: '預言家查驗', poison: '女巫毒藥', gun: '獵人的槍' };
                if (gift) messages.push(`你是幸運兒 ${gift.label}，獲得【${item_names[gift.gift]}】`);
            }
            if (flow.type === 'lovers' && is_selected_target) messages.push('你是情侶 💕');
            if (flow.type === 'assistant' && is_selected_target) messages.push('你是覺醒女巫的協助者');
            if (flow.type === 'gargoyle_conversion' && is_selected_target) messages.push('你被覺醒石像鬼轉化成狼人！🐺');
            if (flow.type === 'ghost_groom' && is_selected_target) messages.push('你是鬼魅新娘的新郎 🤵');
            if (flow.type === 'ghost_witness' && is_selected_target) messages.push('你是證婚人 🕊️');
            if (flow.type === 'seed_wolf' && is_selected_target) messages.push('你被種狼感染成了狼人！🐺');
            
            // 潘朵拉全體輪流階段不透露獲得什麼，僅告知收到魔盒
            if (flow.type === 'pandora' && is_selected_target) {
                messages.push(`你收到了一個潘朵拉魔盒！🎁`);
            }
            
            if (flow.type === 'fanatic' && is_selected_target) messages.push('你是狂熱粉 🔪');
        });

        const status_text = messages.length ? messages.join('<br>') : '沒有特殊身份';
        numberPad.classList.add('hidden'); actionPad.classList.remove('hidden'); actionPad.innerHTML = '';

        nightRoleTitle.textContent = `${seat}號確認狀態`;
        nightInstruction.textContent = "請確認自己的狀態：";

        const status_box = document.createElement('div');
        status_box.style = "padding: 20px; background-color: var(--bg-card); border-radius: 8px; width: 100%; text-align: center; border: 2px solid var(--color-success); margin: 20px 0;";
        const status_text_element = document.createElement('p');
        status_text_element.style = "font-size: 24px; font-weight: bold; margin: 0;";
        status_text_element.innerHTML = status_text;
        status_text_element.style.color = messages.length ? "#fca311" : "#a2a8d3";
        status_box.appendChild(status_text_element); actionPad.appendChild(status_box);
        btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
        return;
    }

    const notify_match = s.current_stage.match(/^status_notify_(.+)_(\d+)$/);
    if (notify_match) {
        const [, flow_id, seat_text] = notify_match; const seat = parseInt(seat_text);
        const flow = s.night_status_flows.find(item => item.id === flow_id);
        const wake_names = { merchant: '幸運兒', super_black_market: '幸運兒', lovers: '情侶', assistant: '協助者', gargoyle_conversion: '覺醒石像鬼轉化者', ghost_groom: '新郎', ghost_witness: '證婚人', seed_wolf: '感染者' };
        const gift = flow?.metadata?.gifts?.find(item => item.seat === seat);
        const wake_name = flow?.type === 'super_black_market' && gift ? `幸運兒 ${gift.label}` : (wake_names[flow?.type] || '特殊身份');

        nightRoleTitle.textContent = `${wake_name}請睜眼`;
        nightInstruction.textContent = "請確認你的身份，完成後閉眼。";
        numberPad.classList.add('hidden'); actionPad.classList.remove('hidden'); actionPad.innerHTML = '';

        const status_box = document.createElement('div');
        status_box.style = "padding: 20px; background-color: var(--bg-card); border-radius: 8px; width: 100%; text-align: center; border: 2px solid var(--color-success); margin: 20px 0;";
        const status_text_element = document.createElement('p');
        status_text_element.style = "font-size: 24px; font-weight: bold; margin: 0;";
        status_text_element.innerHTML = "請確認你的新身份或狀態";
        status_text_element.style.color = "#fca311";
        status_box.appendChild(status_text_element); actionPad.appendChild(status_box);
        btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "了解並閉眼";
        return;
    }
};

roleHandlers['hunter'] = (ctx) => {
    const { btnConfirmAction, numberPad, actionPad, nightRoleTitle, nightInstruction, isStolen, isVWKTurn } = ctx;
    let roleData = s.ROLE_DICT[s.current_stage];
    nightRoleTitle.textContent = `${roleData?.icon || ''} ${roleData?.name || s.current_stage}確認`;
    nightInstruction.innerHTML += "請確認你今晚的開槍狀態：";
    numberPad.classList.add('hidden'); actionPad.classList.remove('hidden');
    const hunterSeat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'hunter'));
    const witchPoisonTarget = getNightTarget('poison', 'witch') || getNightTarget('poison', 'awaken_witch');
    const isSleeping = s.sleeping_beauty_seat === hunterSeat && s.is_sleeping_beauty_active;
    const canShoot = isVWKTurn || !(witchPoisonTarget === hunterSeat || isStolen || isSleeping);
    const statusBox = document.createElement('div');
    statusBox.style = `padding: 20px; background-color: var(--bg-card); border-radius: 8px; width: 100%; text-align: center; border: 2px solid ${canShoot ? 'var(--color-success)' : 'var(--color-primary)'}; margin: 20px 0;`;
    const statusText = document.createElement('p');
    statusText.style = "font-size: 18px; margin: 0; color: var(--color-text);";
    statusText.textContent = "若今晚倒牌，你的狀態為：";
    statusBox.appendChild(statusText);
    const resultText = document.createElement('p');
    resultText.style = "font-size: 32px; font-weight: bold; margin: 10px 0 0 0;";
    resultText.textContent = canShoot ? "🔫 可以開槍" : "🚫 不能開槍";
    resultText.style.color = canShoot ? "#00ff88" : "#e94560";
    statusBox.appendChild(resultText);
    actionPad.appendChild(statusBox);
    btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "了解並閉眼";
};

roleHandlers['revenger'] = (ctx) => {
    const { btnConfirmAction, numberPad, actionPad, nightRoleTitle, nightInstruction, actorSeat } = ctx;
    let roleData = s.ROLE_DICT[s.current_stage];
    nightRoleTitle.textContent = `${roleData?.icon || '🔥'} ${roleData?.name || s.current_stage}確認`;
    nightInstruction.innerHTML = "請確認你本局的所屬對立陣營：";
    numberPad.classList.add('hidden');
    actionPad.classList.remove('hidden');
    actionPad.innerHTML = '';

    let master = s.shadow_master_target;
    let isLovers = s.shadow_revenger_lovers && s.shadow_revenger_lovers.length > 0;
    let resultMessage = "";
    let resultColor = "";
    let topMessage = "";

    if (isLovers) {
        topMessage = "影子選擇了你！你們連為情侶，失去原技能。";
        resultMessage = "💕 第三方陣營 (同生共死)";
        resultColor = "#ff00ff";
    } else if (master) {
        let mRole = s.player_roles[master];
        let mFaction = s.ROLE_DICT[mRole]?.faction;
        
        if (mRole === 'half_blood' && s.half_blood_target) {
            mFaction = s.ROLE_DICT[s.player_roles[s.half_blood_target]]?.faction;
            let hbSeat = parseInt(Object.keys(s.player_roles).find(k => s.player_roles[k] === 'half_blood'));
            if (s.half_blood_target == actorSeat && master === hbSeat) mFaction = 'good';
        }
        if (mRole === 'treasure_master') mFaction = s.is_treasure_hunter_evil ? 'wolf' : 'good';

        let rFaction = mFaction === 'wolf' ? "🧑‍🌾 好人陣營" : "🐺 狼人陣營";
        resultColor = mFaction === 'wolf' ? "#00ff88" : "#e94560";
        resultMessage = rFaction;
    } else {
        topMessage = "影子尚未選擇主人";
        resultMessage = "❓ 無法確認陣營";
        resultColor = "#a2a8d3";
    }

    const statusBox = document.createElement('div');
    statusBox.style = `padding: 20px; background-color: var(--bg-card); border-radius: 8px; width: 100%; text-align: center; border: 2px solid ${resultColor}; margin: 20px 0;`;

    const topText = document.createElement('p');
    topText.style = "font-size: 18px; margin: 0; color: var(--color-text);";
    topText.innerHTML = topMessage;
    statusBox.appendChild(topText);

    const resultText = document.createElement('p');
    resultText.style = "font-size: 32px; font-weight: bold; margin: 10px 0 0 0;";
    resultText.innerHTML = resultMessage;
    resultText.style.color = resultColor;
    statusBox.appendChild(resultText);

    actionPad.appendChild(statusBox);
    btnConfirmAction.classList.remove('hidden');
    btnConfirmAction.textContent = "了解並閉眼";
};

roleHandlers['phantom_king'] = (ctx) => { ctx.nightRoleTitle.textContent = "🦹 怪盜狼王確認"; ctx.nightInstruction.innerHTML = "請問是否發動「無敵」技能？<br><small>（發動後免疫死亡直到下次入夜）</small>"; ctx.numberPad.classList.add('hidden'); ctx.btnConfirmAction.classList.remove('hidden'); ctx.btnConfirmAction.textContent = "不發動，確認閉眼"; ctx.btnOptionalSkip.textContent = "發動無敵"; ctx.btnOptionalSkip.classList.remove('hidden'); };

roleHandlers['puppet_select'] = (ctx) => {
    const { btnOptionalSkip, nightRoleTitle, nightInstruction } = ctx;
    nightRoleTitle.textContent = `🐺 狼隊行動 (選傀儡)`;
    let all_wolf_seats = Object.keys(s.player_roles).filter(k => getWolfTeamRoles().includes(s.player_roles[k]));
    nightInstruction.innerHTML = `請狼隊伍選擇一名與狼相鄰的玩家作為傀儡：<br><span style="color:#e94560; font-size:16px;">🐺 狼隊名單：${all_wolf_seats.sort((a, b) => a - b).join(', ')} 號</span>`;
    btnOptionalSkip.classList.add('hidden');
};

roleHandlers['jack_ripper_select_fanatic'] = (ctx) => {
    ctx.nightRoleTitle.textContent = "🔪 開膛手傑克行動 (選狂熱粉)";
    ctx.nightInstruction.innerHTML += "請選擇一位玩家成為你的狂熱粉：";
    ctx.btnOptionalSkip.textContent = "跳過";
    ctx.btnOptionalSkip.classList.remove('hidden');
};