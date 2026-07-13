import { s, getStageVoiceName, getActualTarget, applyTimeWolfReflection, wolfFaction, evilRoles, speak } from './core.js';
import { createNumberPad, resetSelections } from './night.js';
import { calculateNightDeaths, proceedDayResultRender, handleChainDeaths } from './day.js';

// ==========================================
// 1. 遊戲核心流程與佇列建置函式
// ==========================================

export function generateSpeechOrder(candidatesArray) {
    let pool = candidatesArray ? [...candidatesArray] : [];
    if (!candidatesArray) {
        for (let i = 1; i <= s.totalPlayers; i++) {
            if (!s.finalKilled.includes(i)) pool.push(i);
        }
    }
    if (pool.length === 0) return "無人發言";
    let startPlayer = pool[Math.floor(Math.random() * pool.length)];
    let direction = Math.random() > 0.5 ? "順序 (號碼遞增)" : "逆序 (號碼遞減)";
    return `請從 【 ${startPlayer} 號 】 玩家開始<br>以 【 ${direction} 】 進行發言。`;
}

function buildNightQueue() {
    s.nightQueue = [];
    const activeRoles = Object.values(s.playerRoles);
    let queueList = [];

    let orderMap = {};
    activeRoles.forEach(role => {
        let orders = s.ROLE_DICT[role]?.wakeOrder;
        if (orders) {
            orders.forEach(o => {
                if (!orderMap[o]) orderMap[o] = new Set();
                orderMap[o].add(role);
            });
        }
    });

    s.discardedRoles.forEach(role => {
        let orders = s.ROLE_DICT[role]?.wakeOrder;
        if (orders && ['seer', 'witch', 'hunter', 'cupid'].includes(role)) {
            queueList.push({ stage: role, order: orders[0], seat: null, subLabel: null, isFake: true });
        }
    });

    let activeOrderArr = Object.keys(orderMap).map(Number).sort((a, b) => a - b);

    activeOrderArr.forEach(order => {
        if (order === 292) return;
        let roles = Array.from(orderMap[order]);
        let stage = null;

        switch (order) {
            case 65: stage = 'ghost_bride_couple'; break;
            case 69: stage = 'ghost_bride_witness'; break;
            case 70: stage = 'lovers_meet'; break;
            case 80: stage = 'wolf_brother_meet'; break;
            case 148: stage = 'gray_wolf_steal'; break;
            case 325: stage = 'gray_wolf_action'; break; 
            case 210: stage = s.currentBoard?.id === '12_animals' ? 'wolf_meet' : 'wolf'; break;
            case 230: stage = 'awaken_wolf_king_gun'; break;
            case 235: stage = 'wolf_gun_confirm'; break;
            case 285: stage = 'lucky_boy_action'; break;
            case 295: stage = 'awaken_witch_assistant_action'; break;
            case 360: stage = 'awaken_dreamwalker_result'; break;
            default: stage = roles[0]; break;
        }
        if (stage) {
            queueList.push({ stage, order, seat: null, subLabel: null, isFake: false });
        }
    });

    if (activeRoles.includes('ghost_bride')) {
        for (let i = 1; i <= s.totalPlayers; i++) queueList.push({ stage: `notify_groom_${i}`, order: 64, seat: null, subLabel: null, isFake: false });
        for (let i = 1; i <= s.totalPlayers; i++) queueList.push({ stage: `notify_witness_${i}`, order: 67, seat: null, subLabel: null, isFake: false });
    }

    if (activeRoles.some(r => ['black_market', 'miracle_merchant'].includes(r))) {
        for (let i = 1; i <= s.totalPlayers; i++) queueList.push({ stage: `notify_luckyboy_${i}`, order: 284, seat: null, subLabel: null, isFake: false });
    }

    if (activeRoles.includes('awaken_witch')) {
        for (let i = 1; i <= s.totalPlayers; i++) queueList.push({ stage: `notify_assistant_${i}`, order: 294, seat: null, subLabel: null, isFake: false });
    }

    let otherNotifyRoles = activeRoles.some(r => ['cupid', 'seed_wolf'].includes(r));
    if (otherNotifyRoles) {
        let baseNotifyPos = activeRoles.includes('seed_wolf') ? 215 : 25;
        for (let i = 1; i <= s.totalPlayers; i++) queueList.push({ stage: `notify_general_${i}`, order: baseNotifyPos, seat: null, subLabel: null, isFake: false });
    }

    if (activeRoles.includes('awaken_gargoyle') || activeRoles.includes('awaken_gargoyle_A') || activeRoles.includes('awaken_gargoyle_B') || activeRoles.includes('awaken_dreamwalker')) {
        for (let i = 1; i <= s.totalPlayers; i++) queueList.push({ stage: `notify_end_${i}`, order: 999, seat: null, subLabel: null, isFake: false });
    }

    if (s.currentBoard?.id === '12_variable_wolf' && activeRoles.includes('bear')) {
        let bSeat = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'bear');
        queueList.push({ stage: 'bear', order: 345, seat: bSeat, subLabel: null, isFake: false });
    }

    queueList.sort((a, b) => a.order - b.order);

    queueList.forEach(q => {
        if (q.stage === 'seer' || q.stage === 'shadow_seer' || q.stage === 'seer_A' || q.stage === 'seer_B') {
            if (q.order === 310) {
                let sA = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'seer_A');
                let seerSeat = Object.keys(s.playerRoles).find(k => ['seer', 'pure_white', 'real_fox', 'psychic', 'awaken_seer'].includes(s.playerRoles[k]));
                q.seat = sA || seerSeat;
                if (sA) { q.subLabel = 'A'; q.stage = 'seer'; }
                else if (seerSeat) { q.stage = s.playerRoles[seerSeat]; }
            } else if (q.order === 311) {
                let sB = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'seer_B');
                let shadow = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'shadow_seer');
                q.seat = sB || shadow;
                if (sB) { q.subLabel = 'B'; q.stage = 'seer'; }
                else if (shadow) { q.stage = 'shadow_seer'; }
            }
        }
    });

    if (s.discardedRoles.includes('cupid')) {
        queueList.push({ stage: 'lovers_meet', order: 70, seat: null, subLabel: null, isFake: true });
        queueList.sort((a, b) => a.order - b.order);
    }

    s.nightQueue = queueList;
}

// ==========================================
// 2. 白天與夜晚介面切換與運作邏輯
// ==========================================

export function showDayResult() {
    document.getElementById('screen-night').classList.add('hidden');
    document.getElementById('screen-day').classList.remove('hidden');
    document.getElementById('day-skill-section').classList.add('hidden');
    document.getElementById('day-result-content').classList.add('hidden');

    let crowPanel = document.getElementById('crow-record-panel');
    let btnShowCrow = document.getElementById('btn-show-crow');
    if (crowPanel) crowPanel.classList.add('hidden');
    if (btnShowCrow) btnShowCrow.classList.add('hidden');

    let alchSeat = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'alchemist');
    let wTarget = s.wolfKillTarget;

    const alchemistCallSection = document.getElementById('alchemist-call-section');
    const dayResultContent = document.getElementById('day-result-content');

    if (alchSeat && !s.alchemistSnakeUsed && !s.primaryKilled.includes(parseInt(alchSeat))) {
        let orderHtml = s.speechOrderText ? `<div style="background:#16213e; padding:10px; border-radius:6px; margin: 15px 0;"><span style="color:#00ff88; font-size:18px; font-weight:bold;">🗣️ 發言順序：<br>${s.speechOrderText}</span></div>` : "";
        
        alchemistCallSection.innerHTML = `
            <div style="background:#24345e; padding:20px; border-radius:8px; margin-bottom: 20px;">
                <h3 style="color:#fca311; margin-top:0;">🗣️ 白天發言階段</h3>
                ${orderHtml}
                <p style="color:#a2a8d3;">請所有玩家進行發言。發言結束後，法官將公佈昨晚被狼刀的對象，並由煉金魔女決定是否使用法老之蛇。</p>
                <button id="btn-end-speech" class="primary-btn" style="margin-top:15px;">發言結束，公佈狼刀</button>
            </div>
        `;
        alchemistCallSection.classList.remove('hidden');

        document.getElementById('btn-end-speech').onclick = () => {
            speak("所有玩家請閉眼，煉金魔女請睜眼。", () => {
                let targetText = wTarget ? `【 ${wTarget} 號 】` : `【 無 】`;
                alchemistCallSection.innerHTML = `
                    <div style="background:#24345e; padding:20px; border-radius:8px; margin-bottom: 20px;">
                        <h3 style="color:#fca311; margin-top:0;">⚗️ 煉金魔女 法老之蛇</h3>
                        <p style="font-size:18px;">昨晚被狼刀的是：${targetText}</p>
                        ${wTarget ? `<p style="color:#a2a8d3;">請問是否使用法老之蛇將其救活？</p>
                        <div style="display:flex; gap:10px; margin-top:15px;">
                            <button id="btn-alch-save" class="primary-btn">使用 (救活)</button>
                            <button id="btn-alch-pass" class="secondary-btn">不使用</button>
                        </div>` : `<div style="margin-top:15px;"><button id="btn-alch-pass" class="secondary-btn">繼續結算</button></div>`}
                    </div>
                `;

                const finishAlchemist = (saved) => {
                    alchemistCallSection.classList.add('hidden');
                    if (saved) {
                        s.primaryKilled = s.primaryKilled.filter(k => k !== parseInt(wTarget));
                        s.chainKilled = [];
                        s.finalKilled = [...s.primaryKilled];
                        handleChainDeaths();
                        s.alchemistSnakeUsed = true;
                        s.nightActionLog.push(`【煉金魔女】使用了法老之蛇，救活了 ${wTarget}號`);
                    } else {
                        s.nightActionLog.push(`【煉金魔女】未發動法老之蛇`);
                    }
                    speak("煉金魔女請閉眼，三秒後所有玩家睜眼，三、二、一。", () => {
                        dayResultContent.classList.remove('hidden');
                        proceedDayResultRender();
                    });
                };

                if (wTarget) {
                    document.getElementById('btn-alch-save').onclick = () => finishAlchemist(true);
                }
                document.getElementById('btn-alch-pass').onclick = () => finishAlchemist(false);
            });
        };
        return;
    }

    dayResultContent.classList.remove('hidden');
    proceedDayResultRender();
}

export function runNextNightRole() {
    const btnConfirmAction = document.getElementById('btn-confirm-action');
    const btnOptionalSkip = document.getElementById('btn-optional-skip');
    const numberPad = document.getElementById('number-pad');
    const actionPad = document.getElementById('action-pad');
    const nightRoleTitle = document.getElementById('night-role-title');
    const nightInstruction = document.getElementById('night-instruction');

    let existingCustomPanel = document.getElementById('custom-action-panel');
    if (existingCustomPanel) existingCustomPanel.remove();

    btnConfirmAction.classList.add('hidden');
    btnOptionalSkip.classList.add('hidden');
    numberPad.classList.add('hidden');
    actionPad.classList.add('hidden');
    actionPad.innerHTML = '';
    nightInstruction.innerHTML = "";

    resetSelections();
    s.isShowingResult = false; s.currentRoleFeared = false; s.isFakeWake = false;
    s.currentSubLabel = null; s.awakenWitchStep = null; s.isSeedWolfInfecting = false;

    if (s.nightQueue.length === 0) {
        nightRoleTitle.textContent = "🌅 天亮結算中";
        nightInstruction.textContent = "法官正在處理昨晚的行動結果...";
        calculateNightDeaths();
        let morningVoice = document.getElementById('setting-sheriff').checked ? "要競選警長的請舉手，三秒後天亮，三、二、一。" : "三秒後天亮，三、二、一。";
        speak(morningVoice, () => {
            if (document.getElementById('setting-sheriff').checked) {
                document.getElementById('screen-night').classList.add('hidden');
                document.getElementById('screen-sheriff').classList.remove('hidden');
                initSheriffScreen(); 
            } else {
                s.speechOrderText = generateSpeechOrder(null); 
                showDayResult();
            }
        });
        return;
    }

    let nextTask = s.nightQueue.shift();
    s.currentStage = nextTask.stage; s.currentActorSeat = nextTask.seat; s.currentSubLabel = nextTask.subLabel; s.isFakeWake = nextTask.isFake;

    if (s.isFakeWake) {
        let fakeName = s.ROLE_DICT[s.currentStage]?.name || getStageVoiceName(s.currentStage, s.currentSubLabel);
        nightRoleTitle.textContent = `🎭 ${fakeName}行動 (偽裝)`;
        nightInstruction.textContent = "該身分已被棄掉，模擬睜眼等待中...";
        let waitTime = Math.random() * 2000 + 3000;
        speak(`${getStageVoiceName(s.currentStage, s.currentSubLabel)}請睜眼。`, () => {
            setTimeout(() => {
                nightInstruction.textContent = "請閉眼等待...";
                speak(`${getStageVoiceName(s.currentStage, s.currentSubLabel)}請閉眼。`, runNextNightRole);
            }, waitTime);
        });
        return;
    }

    if (s.currentStage === 'lucky_boy_action' && (!s.merchantTarget || wolfFaction.includes(s.playerRoles[s.merchantTarget]))) return runNextNightRole();
    if (s.currentStage === 'awaken_witch_assistant_action' && (!s.awakenWitchAssistant || !s.witchPoisonTarget)) return runNextNightRole();
    if (s.currentStage === 'awaken_dreamwalker_result' && !s.awakenDreamwalkerTarget) return runNextNightRole();

    let actorSeat = s.currentActorSeat || Object.keys(s.playerRoles).find(k => s.playerRoles[k] === s.currentStage || s.playerRoles[k] === 'awaken_' + s.currentStage);
    let isVWKTurn = actorSeat && s.playerStatus[actorSeat]?.isVWK;

    if (s.seedWolfTarget === parseInt(actorSeat)) {
        let name = getStageVoiceName(s.currentStage, s.currentSubLabel);
        let baseRole = s.currentStage.replace('_A', '').replace('_B', '');
        nightRoleTitle.textContent = `${s.ROLE_DICT[baseRole]?.icon || '🎭'} ${name}行動 (已被感染)`;
        nightInstruction.innerHTML = `<span style="color:#e94560; font-weight:bold;">你已被感染成狼人，原技能失效。</span><br>請等待自動閉眼...`;
        
        numberPad.classList.add('hidden'); actionPad.classList.add('hidden'); btnConfirmAction.classList.add('hidden'); btnOptionalSkip.classList.add('hidden');
        s.nightActionLog.push(`【${name}】已被種狼感染，跳過技能`);
        
        speak(`${name}請睜眼。`, () => {
            setTimeout(() => {
                speak(`${name}請閉眼。`, runNextNightRole);
            }, 3000 + Math.random() * 2000);
        });
        return;
    }
    
    // 灰太狼偷竊阻擋機制
    let isStolen = s.grayWolfStolenPlayer && parseInt(actorSeat) === s.grayWolfStolenPlayer && s.grayWolfStolenPlayer !== s.pleasantGoatAntiTheft;
    
    if (isStolen) {
        let roleName = getStageVoiceName(s.currentStage, s.currentSubLabel);
        // 獵人不提示被偷，讓他看正常的狀態面板 (但內部 isStolen 為 true，會判定為不能開槍)
        if (s.currentStage === 'witch' || s.currentStage === 'awaken_witch') {
            // 女巫僅毒藥被封鎖，仍可自發進入女巫環節
        } else if (!s.currentStage.startsWith('notify_') && !['wolf', 'wolf_meet', 'little_gray_wolf', 'gray_wolf_steal', 'gray_wolf_action', 'pleasant_goat', 'hunter'].includes(s.currentStage)) {
            nightRoleTitle.textContent = `🚫 ${roleName}行動 (技能被偷取)`;
            nightInstruction.textContent = "今晚你的技能被灰太狼偷取，無法發動。";
            btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
            speak(`${roleName}請睜眼。`); return;
        }
    }

    if (isVWKTurn) {
        nightInstruction.innerHTML = `<span style="color:#e94560; font-weight:bold;">(你被指派為百變狼王)</span><br><br>` + nightInstruction.innerHTML;
    }

    if (s.nightmareTarget && parseInt(actorSeat) === s.nightmareTarget && !s.currentStage.startsWith('notify_') && !['lovers_meet', 'wolf_meet', 'lucky_boy_action', 'awaken_wolf_king_gun', 'wolf_gun_confirm', 'awaken_witch_assistant_action', 'hidden_wolf', 'curse_fox', 'ghost_bride_couple', 'ghost_bride_witness', 'awaken_dreamwalker_result'].includes(s.currentStage)) {
        s.currentRoleFeared = true;
        let roleName = getStageVoiceName(s.currentStage, s.currentSubLabel);
        if (s.currentStage === 'wolf') {
            let wSeats = Object.keys(s.playerRoles).filter(k => wolfFaction.includes(s.playerRoles[k]) && !['eclipse_maid', 'hidden_wolf', 'gray_wolf'].includes(s.playerRoles[k]));
            let hasLG = Object.values(s.playerRoles).includes('little_girl');
            if (hasLG) wSeats.push(Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'little_girl'));
            wSeats.sort((a, b) => a - b);
            nightRoleTitle.textContent = hasLG ? "🐺 狼隊與小女孩行動 (被恐懼)" : "🐺 狼人行動 (被恐懼)";
            nightInstruction.innerHTML = `<span style="color:#e94560;">今晚已被夢魘恐懼，無法刀人。</span><br><br>🐺 睜眼名單：${hasLG ? '【隱藏】' : wSeats.map(id => id + '號').join(', ')}`;
            btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
            speak(`${hasLG ? "狼隊和小女孩" : "狼人"}請睜眼。`); return;
        }
        nightRoleTitle.textContent = `🚫 ${roleName}行動 (被恐懼)`;
        nightInstruction.textContent = "今晚已被夢魘恐懼，無法發動技能。";
        btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
        speak(`${roleName}請睜眼。`); return;
    }

    if (s.currentStage === 'bear' && !isVWKTurn) {
        nightRoleTitle.textContent = "🐻 熊確認";
        nightInstruction.innerHTML = `<span style="color:#00ff88; font-weight:bold;">你是一般的熊 (不是百變狼王)。</span><br>請確認後閉眼。`;
        numberPad.classList.add('hidden');
        btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
        speak(`熊請睜眼。`);
        return;
    }

    let autoCloseStages = ['wolf_gun_confirm', 'lovers_meet', 'wolf_meet', 'hidden_wolf', 'curse_fox', 'ghost_bride_witness'];

    if (autoCloseStages.includes(s.currentStage)) {
        if (s.currentStage === 'wolf_gun_confirm') {
            nightRoleTitle.textContent = "🐺 三小狼確認分槍";
            let t = s.awakenWolfGunTarget ? s.awakenWolfGunTarget + " 號" : "無 (狼王自己保留兩把槍)";
            nightInstruction.innerHTML = `狼王分槍的對象是：<br><span style="color:#e94560; font-size:24px; font-weight:bold;">${t}</span>`;
        } else if (s.currentStage === 'ghost_bride_witness') {
            nightRoleTitle.textContent = "🕊️ 證婚人確認";
            let gb = parseInt(Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'ghost_bride'));
            let couple = [gb, s.ghostBrideGroom].sort((a, b) => a - b);
            nightInstruction.innerHTML = `這對鬼魅夫妻是：<br><span style='color:#e94560; font-size: 24px; font-weight:bold;'>${couple[0]}號 與 ${couple[1]}號</span><br><span style='color:#a2a8d3; font-size: 14px;'>(你不知道誰是新娘誰是新郎)</span>`;
        } else if (s.currentStage === 'hidden_wolf') {
            nightRoleTitle.textContent = "🐺😶‍🌫️ 隱狼確認";
            let w = Object.keys(s.playerRoles).filter(k => (wolfFaction.includes(s.playerRoles[k]) || ['gargoyle', 'awaken_gargoyle', 'awaken_gargoyle_A', 'awaken_gargoyle_B'].includes(s.playerRoles[k])) && s.playerRoles[k] !== 'hidden_wolf');
            nightInstruction.innerHTML = `狼人陣營同伴是：<br><span style="color:#e94560;">${w.length ? w.join(', ') + ' 號' : '無'}</span>`;
        } else {
            if (s.currentStage === 'lovers_meet') nightRoleTitle.textContent = "💕 情侶相認";
            if (s.currentStage === 'wolf_meet') nightRoleTitle.textContent = "🐺 狼隊相認";
            nightInstruction.textContent = s.currentStage === 'wolf_meet' ? "請狼隊伍互相確認身分 (首夜不刀人)。" : "請互相確認身分。";
        }
        numberPad.classList.add('hidden');
        btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
        
        let v = getStageVoiceName(s.currentStage, s.currentSubLabel);
        if (s.currentStage === 'wolf_meet' && Object.values(s.playerRoles).includes('little_girl')) v = "狼隊和小女孩";
        speak(`${v}請睜眼。`);
        return;
    }

    if (s.currentStage === 'wolf_brother_meet') {
        nightRoleTitle.textContent = "🐺 狼兄狼弟相認";
        let wb = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'wolf_brother');
        let wbl = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'wolf_brother_little');
        nightInstruction.innerHTML = `狼兄是：<span style='color:#e94560; font-weight:bold;'>${wb}號</span><br>狼弟是：<span style='color:#e94560; font-weight:bold;'>${wbl}號</span>`;
        numberPad.classList.add('hidden');
        btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
        speak(`狼兄狼弟請睜眼. `);
        return;
    }

    if (s.currentStage === 'awaken_dreamwalker_result') {
        nightRoleTitle.textContent = "💤✨ 覺醒攝夢人確認";
        let t = s.awakenDreamwalkerTarget;
        let acted = s.actedPlayers.includes(parseInt(t)) || s.playerRoles[t] === 'grave_keeper';
        nightInstruction.innerHTML = `你指定的夢語者是：<br><span style="color:#fca311; font-size:24px; font-weight:bold;">${t} 號</span><br><br>該玩家今晚<span style="color:${acted?'#00ff88':'#e94560'}; font-weight:bold; font-size:20px;">${acted?'有行動':'沒有行動'}</span>`;
        numberPad.classList.add('hidden');
        btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
        speak(`覺醒攝夢人請睜眼。`);
        return;
    }

    if (s.currentStage === 'awaken_witch_assistant_action') {
        nightRoleTitle.textContent = "👤 協助者確認";
        nightInstruction.innerHTML = `覺醒女巫選擇毒殺：<span style='color:#e94560; font-weight:bold; font-size:24px;'>${s.witchPoisonTarget} 號</span><br>請問你是否同意這項行動？`;
        numberPad.classList.add('hidden'); actionPad.innerHTML = ''; actionPad.classList.remove('hidden');
        
        let btnAgree = document.createElement('button'); btnAgree.className = 'primary-btn'; btnAgree.textContent = "同意";
        let btnDisagree = document.createElement('button'); btnDisagree.className = 'secondary-btn'; btnDisagree.textContent = "不同意";
        
        btnAgree.onclick = () => { s.awakenWitchAssistantAgreed = true; btnConfirmAction.click(); };
        btnDisagree.onclick = () => { s.awakenWitchAssistantAgreed = false; btnConfirmAction.click(); };
        
        actionPad.appendChild(btnAgree); actionPad.appendChild(btnDisagree);
        speak(`協助者請睜眼。`);
        return;
    }

    createNumberPad(); numberPad.classList.remove('hidden');

    if (s.currentStage === 'witch' || s.currentStage === 'awaken_witch') {
        let titleName = s.currentStage === 'awaken_witch' ? '覺醒女巫' : '女巫';
        nightRoleTitle.textContent = `🧪 ${titleName}行動`;
        nightInstruction.innerHTML += (isVWKTurn ? "" : "請選擇你要使用的藥水：");
        numberPad.classList.add('hidden');

        let target = s.isSeedWolfInfecting ? null : (s.wolfKillTarget ? getActualTarget(parseInt(s.wolfKillTarget)) : null);

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
        let witchSeat = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'witch' || s.playerRoles[k] === 'awaken_witch');
        let rule = document.getElementById('setting-witch-rule').checked ? 'can_save' : 'cannot_save';
        if (isVWKTurn) {
            btnSave.disabled = true; btnSave.textContent = "解藥 (狼王不可用)"; btnSave.style.opacity = "0.5";
        } else {
            if (target && target === getActualTarget(parseInt(witchSeat)) && rule === 'cannot_save') {
                btnSave.disabled = true; btnSave.textContent = "解藥 (不可自救)"; btnSave.style.opacity = "0.5";
            }
            if (!target) { btnSave.disabled = true; btnSave.style.opacity = "0.5"; }
        }

        let btnPoison = document.createElement('button');
        btnPoison.className = 'special-btn'; 
        btnPoison.textContent = "毒藥 (毒)";
        if (isStolen) {
            btnPoison.disabled = true; btnPoison.textContent = "毒藥 (被偷取)"; btnPoison.style.opacity = "0.5"; btnPoison.style.cursor = "not-allowed";
        }

        let btnSkip = document.createElement('button');
        btnSkip.className = 'text-btn'; btnSkip.textContent = "不使用";

        btnGroup.appendChild(btnSave); btnGroup.appendChild(btnPoison); btnGroup.appendChild(btnSkip);
        customPanel.appendChild(btnGroup);
        numberPad.parentNode.insertBefore(customPanel, numberPad);

        btnSave.onclick = () => {
            document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
            s.selectedNumber = 'witch_save'; s.selectedNumbersArr = [];
            btnSave.classList.add('action-selected'); btnPoison.classList.remove('action-selected'); btnSkip.classList.remove('action-selected');
            numberPad.classList.add('hidden');
            btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認";
            nightInstruction.textContent = "請選擇你要使用的藥水：";
        };
        if (!isStolen) {
            btnPoison.onclick = () => {
                document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
                s.selectedNumber = null; s.selectedNumbersArr = [];
                btnPoison.classList.add('action-selected'); btnSave.classList.remove('action-selected'); btnSkip.classList.remove('action-selected');
                numberPad.classList.remove('hidden');
                btnConfirmAction.classList.add('hidden');
                if (s.currentStage === 'awaken_witch') {
                    s.awakenWitchStep = 'poison_target'; nightInstruction.textContent = "請選擇你要毒殺的號碼：";
                } else {
                    nightInstruction.textContent = "請選擇你要毒殺的號碼：";
                }
            };
        }
        btnSkip.onclick = () => {
            document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
            s.selectedNumber = 'skip'; s.selectedNumbersArr = [];
            btnSkip.classList.add('action-selected'); btnSave.classList.remove('action-selected'); btnPoison.classList.remove('action-selected');
            numberPad.classList.add('hidden');
            btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認";
            nightInstruction.textContent = "請選擇你要使用的藥水：";
        };

    } else if (['black_market', 'miracle_merchant'].includes(s.currentStage)) {
        nightRoleTitle.textContent = `🎁 ${s.ROLE_DICT[s.currentStage].name}行動`;
        nightInstruction.innerHTML += "請選擇你要給予的技能：";
        numberPad.classList.add('hidden');

        let customPanel = document.createElement('div'); customPanel.id = 'custom-action-panel';
        customPanel.style = "display: flex; gap: 10px; width: 100%; justify-content: center; margin-bottom: 15px;";

        let btnSeer = document.createElement('button'); btnSeer.className = 'secondary-btn'; btnSeer.textContent = "預言家查驗";
        let btnPoison = document.createElement('button'); btnPoison.className = 'special-btn'; btnPoison.textContent = "女巫毒藥";
        
        let btnGuard = document.createElement('button'); btnGuard.className = 'primary-btn'; 
        let gSkill = s.currentStage === 'black_market' ? 'gun' : 'guard';
        let gName = s.currentStage === 'black_market' ? '獵人的槍' : '守衛護盾';
        btnGuard.textContent = gName;
        
        let btnSkip = document.createElement('button'); btnSkip.className = 'text-btn'; btnSkip.textContent = "不發動";

        customPanel.appendChild(btnSeer); customPanel.appendChild(btnPoison); customPanel.appendChild(btnGuard); customPanel.appendChild(btnSkip);
        numberPad.parentNode.insertBefore(customPanel, numberPad);

        const setupMerchantSkill = (skill, name, btn) => {
            [btnSeer, btnPoison, btnGuard, btnSkip].forEach(b => b.classList.remove('action-selected'));
            btn.classList.add('action-selected');
            s.merchantItem = skill; s.selectedNumber = null;
            document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
            
            if (skill) {
                numberPad.classList.remove('hidden'); btnConfirmAction.classList.add('hidden');
                nightInstruction.textContent = `請選擇你要給予【${name}】的對象：`;
            } else {
                numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden');
                btnConfirmAction.textContent = "確認"; s.selectedNumber = 'skip';
                nightInstruction.textContent = "請確認不發動技能：";
            }
        };

        btnSeer.onclick = () => setupMerchantSkill('seer', '查驗', btnSeer);
        btnPoison.onclick = () => setupMerchantSkill('poison', '毒藥', btnPoison);
        btnGuard.onclick = () => setupMerchantSkill(gSkill, gName.replace('獵人的', ''), btnGuard);
        btnSkip.onclick = () => setupMerchantSkill(null, null, btnSkip);

    } else if (s.currentStage === 'pleasant_goat') {
        nightRoleTitle.textContent = "🐏 喜羊羊行動";
        nightInstruction.innerHTML += "請選擇目標並決定要使用的技能 (對自己使用視為雙重防護)：";
        numberPad.classList.add('hidden');
        
        let customPanel = document.createElement('div');
        customPanel.id = 'custom-action-panel';
        customPanel.style = "display: flex; gap: 10px; width: 100%; justify-content: center; margin-bottom: 15px;";
        
        let btnGuard = document.createElement('button'); btnGuard.className = 'primary-btn'; btnGuard.textContent = "守護";
        let btnAntiTheft = document.createElement('button'); btnAntiTheft.className = 'special-btn'; btnAntiTheft.textContent = "防盜";
        let btnSkip = document.createElement('button'); btnSkip.className = 'text-btn'; btnSkip.textContent = "跳過";
        
        customPanel.appendChild(btnGuard); customPanel.appendChild(btnAntiTheft); customPanel.appendChild(btnSkip);
        numberPad.parentNode.insertBefore(customPanel, numberPad);

        const setupPGSkill = (skillType, btn) => {
            [btnGuard, btnAntiTheft, btnSkip].forEach(b => b.classList.remove('action-selected'));
            btn.classList.add('action-selected');
            s.selectedNumber = null;
            document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
            
            if (skillType) {
                s.currentSubLabel = skillType;
                numberPad.classList.remove('hidden'); btnConfirmAction.classList.add('hidden');
            } else {
                numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden');
                btnConfirmAction.textContent = "確認"; s.selectedNumber = 'skip';
            }
        };

        btnGuard.onclick = () => setupPGSkill('guard', btnGuard);
        btnAntiTheft.onclick = () => setupPGSkill('anti_theft', btnAntiTheft);
        btnSkip.onclick = () => setupPGSkill(null, btnSkip);

    } else if (s.currentStage === 'gray_wolf_steal') {
        nightRoleTitle.textContent = "🐺🎩 灰太狼行動 (偷取)";
        nightInstruction.innerHTML += "請選擇你要偷取技能的目標：";
        btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');

    } else if (s.currentStage === 'gray_wolf_action') {
        nightRoleTitle.textContent = "🐺🎩 灰太狼行動 (發動技能)";
        let targetRole = s.grayWolfStolenPlayer ? s.playerRoles[s.grayWolfStolenPlayer] : null;

        if (!s.grayWolfStolenPlayer || s.grayWolfStolenPlayer === s.pleasantGoatAntiTheft) {
            nightInstruction.innerHTML = `<span style="color:#e94560; font-size:20px; font-weight:bold;">偷取失敗</span><br>(對方被防盜或未選擇目標)`;
            numberPad.classList.add('hidden');
            btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
        } else if (targetRole === 'pleasant_goat') {
            nightInstruction.innerHTML = `偷取到 <span style="color:#00ff88; font-size:24px; font-weight:bold;">🐏 喜羊羊</span>！<br>請猜測對方昨晚使用的技能 (猜錯將出局)：`;
            numberPad.classList.add('hidden');

            let customPanel = document.createElement('div');
            customPanel.id = 'custom-action-panel';
            customPanel.style = "display: flex; gap: 10px; width: 100%; justify-content: center; margin-bottom: 15px;";

            let btnGuessGuard = document.createElement('button'); btnGuessGuard.className = 'primary-btn'; btnGuessGuard.textContent = "猜測：守護";
            let btnGuessAnti = document.createElement('button'); btnGuessAnti.className = 'special-btn'; btnGuessAnti.textContent = "猜測：防盜";

            customPanel.appendChild(btnGuessGuard); customPanel.appendChild(btnGuessAnti);
            numberPad.parentNode.insertBefore(customPanel, numberPad);

            const setupGWGuess = (guess, btn) => {
                [btnGuessGuard, btnGuessAnti].forEach(b => b.classList.remove('action-selected'));
                btn.classList.add('action-selected');
                s.grayWolfGuess = guess;
                
                btnConfirmAction.classList.remove('hidden');
                btnConfirmAction.textContent = "確認並閉眼";
            };

            btnGuessGuard.onclick = () => setupGWGuess('guard', btnGuessGuard);
            btnGuessAnti.onclick = () => setupGWGuess('anti_theft', btnGuessAnti);

        } else if (['wolf', 'little_gray_wolf'].includes(targetRole)) {
            nightInstruction.innerHTML = `偷取失敗！但得知對方是 <span style="color:#e94560; font-size:24px; font-weight:bold;">🐺 狼人</span>`;
            numberPad.classList.add('hidden');
            btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
        } else if (targetRole === 'hunter') {
            s.grayWolfStolenSkill = 'hunter';
            nightInstruction.innerHTML = `偷取成功！獲得【獵人】技能，若今晚死亡可以開槍。`;
            numberPad.classList.add('hidden');
            btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
        } else if (targetRole === 'seer' || targetRole === 'seer_A' || targetRole === 'seer_B') {
            s.grayWolfStolenSkill = 'seer';
            nightInstruction.innerHTML = `偷取成功！獲得【預言家】技能，請選擇查驗對象：`;
            btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
        } else if (targetRole === 'witch') {
            s.grayWolfStolenSkill = 'witch';
            nightInstruction.innerHTML = `偷取成功！獲得【女巫】技能，只能使用毒藥，請選擇毒殺對象：`;
            btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
        } else if (targetRole === 'guard') {
            s.grayWolfStolenSkill = 'guard';
            nightInstruction.innerHTML = `偷取成功！獲得【守衛】技能，請選擇守護對象：`;
            btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
        } else if (targetRole === 'dreamwalker') {
            s.grayWolfStolenSkill = 'dreamwalker';
            nightInstruction.innerHTML = `偷取成功！獲得【攝夢人】技能，請選擇攝夢對象：`;
            btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
        } else {
            nightInstruction.innerHTML = `偷取成功！對方是 <span style="color:#a2a8d3;">【${s.ROLE_DICT[targetRole].name}】</span>，但該職業夜晚無可用技能或不適用於偷取。`;
            numberPad.classList.add('hidden');
            btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
        }

    } else if (s.currentStage === 'lucky_boy_action') {
        nightRoleTitle.textContent = "🎁 幸運兒行動";
        let itemText = s.merchantItem === 'seer' ? '預言家查驗' : s.merchantItem === 'poison' ? '女巫毒藥' : (s.merchantItem === 'gun' ? '獵人的槍' : '守衛護盾');
        
        if (s.merchantType === 'black_market') {
            nightInstruction.innerHTML += `你獲得了黑市商人的【${itemText}】<br><span style="color:#e94560;">(此為技能今晚無法發動)</span>`;
            numberPad.classList.add('hidden');
            btnConfirmAction.classList.remove('hidden');
            btnConfirmAction.textContent = "確認並閉眼";
        } else {
            nightInstruction.textContent = `你獲得了奇蹟商人的【${itemText}】，請選擇目標：`;
            btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
        }

    } else if (s.currentStage === 'hunter') {
        nightRoleTitle.textContent = "🎯 獵人行動";
        nightInstruction.innerHTML += "請確認你今晚的開槍狀態：";
        numberPad.classList.add('hidden'); actionPad.classList.remove('hidden');

        calculateNightDeaths();
        const hSeat = parseInt(Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'hunter'));
        // 獵人不提示被偷，但是如果 isStolen 為 true，canShoot 就會變成 false，只顯示「不能開槍」
        let canShoot = isVWKTurn ? true : !(s.witchPoisonTarget === hSeat || s.chainKilled.includes(hSeat) || isStolen);

        let statusBox = document.createElement('div');
        statusBox.style = `padding: 20px; background-color: #24345e; border-radius: 8px; width: 100%; text-align: center; border: 2px solid ${canShoot ? '#00ff88' : '#e94560'}; margin: 20px 0;`;

        let statusP = document.createElement('p');
        statusP.style = "font-size: 18px; margin: 0;"; statusP.textContent = "若今晚倒牌，你的狀態為：";
        statusBox.appendChild(statusP);

        let valP = document.createElement('p');
        valP.style = "font-size: 32px; font-weight: bold; margin: 10px 0 0 0;";
        if (!canShoot) {
            valP.textContent = "🚫 不能開槍"; valP.style.color = "#e94560";
        } else {
            valP.textContent = "🔫 可以開槍"; valP.style.color = "#00ff88";
        }
        statusBox.appendChild(valP); actionPad.appendChild(statusBox);
        btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "了解並閉眼";

    } else if (['seer', 'shadow_seer', 'seer_A', 'seer_B', 'pure_white', 'real_fox', 'psychic', 'wolf_witch', 'gargoyle', 'machine_wolf', 'awaken_seer'].includes(s.currentStage)) {
        let name = getStageVoiceName(s.currentStage, s.currentSubLabel);
        let baseRole = s.currentStage.replace('_A', '').replace('_B', '');
        nightRoleTitle.textContent = `${s.ROLE_DICT[baseRole]?.icon || '🎭'} ${name}行動`;

        let instText = "請選擇你要查驗的對象：";
        if (s.currentStage === 'machine_wolf') instText = "請選擇你要學習的對象：";

        nightInstruction.innerHTML += instText;
        btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');

    } else if (s.currentStage === 'diviner') {
        nightRoleTitle.textContent = "🔮 占卜師行動";
        nightInstruction.innerHTML += "請選擇你要標記的號碼 (當晚狼隊只能刀此號及其左右兩位)：";
        btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
    } else if (s.currentStage === 'thief') {
        nightRoleTitle.textContent = "🦹 盜賊行動"; nightInstruction.innerHTML += "請從兩張底牌中選擇一張 (若有狼陣營必須選狼)：";
        numberPad.classList.add('hidden'); actionPad.innerHTML = '';
        
        let cardContainer = document.createElement('div');
        cardContainer.style = 'display:flex; justify-content:center; gap:20px; width:100%;';
        
        let hasWolf = s.spareCards.some(r => wolfFaction.includes(r));
        s.spareCards.forEach(role => {
            const b = document.createElement('button'); b.className = 'num-btn'; b.innerHTML = `${s.ROLE_DICT[role].icon} <br> ${s.ROLE_DICT[role].name}`;
            b.style.width = '140px'; b.style.height = '140px'; b.style.fontSize = '20px';
            if (hasWolf && !wolfFaction.includes(role)) { b.disabled = true; b.style.opacity = '0.3'; }
            else { 
                b.onclick = () => { 
                    cardContainer.querySelectorAll('.num-btn').forEach(btn => btn.classList.remove('selected')); 
                    b.classList.add('selected'); 
                    s.thiefChosenRole = role; 
                    btnConfirmAction.classList.remove('hidden'); 
                }; 
            }
            cardContainer.appendChild(b);
        });
        actionPad.appendChild(cardContainer);
        actionPad.classList.remove('hidden');
        btnOptionalSkip.classList.add('hidden');
    } else if (s.currentStage === 'cupid') {
        nightRoleTitle.textContent = "👼 邱比特行動"; nightInstruction.innerHTML += "請選擇兩名玩家成為情侶 (可選自己)：";
    } else if (s.currentStage === 'awaken_wolf_king_gun') {
        nightRoleTitle.textContent = "👑✨ 覺醒狼王行動";
        nightInstruction.innerHTML += "請選擇你要分槍的對象 (限狼隊友)：";
        btnOptionalSkip.textContent = "跳過 (自己保留兩把槍)"; btnOptionalSkip.classList.remove('hidden');
    } else if (['awaken_gargoyle', 'awaken_gargoyle_A', 'awaken_gargoyle_B'].includes(s.currentStage)) {
        let baseRole = s.currentStage.replace('_A', '').replace('_B', '');
        nightRoleTitle.textContent = `${s.ROLE_DICT[baseRole]?.icon || '🦇✨'} ${s.ROLE_DICT[s.currentStage]?.name || '覺醒石像鬼'}行動`;
        nightInstruction.innerHTML += "請選擇要轉化的對象：";
        btnOptionalSkip.classList.add('hidden');
    } else if (s.currentStage === 'bear' && isVWKTurn) {
        nightRoleTitle.textContent = "🐻 熊行動";
        nightInstruction.innerHTML += "請選擇你要魅惑的對象：";
        btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
    } else if (['half_blood', 'wild_child', 'awaken_lonely_girl', 'awaken_idiot', 'crow', 'ghost_bride', 'ghost_bride_couple', 'awaken_dreamwalker', 'dreamwalker'].includes(s.currentStage)) {
        let baseKey = s.currentStage.replace('_couple', '');
        nightRoleTitle.textContent = `${s.ROLE_DICT[baseKey].icon} ${s.ROLE_DICT[baseKey].name}行動`;
        if (['ghost_bride', 'ghost_bride_couple', 'awaken_dreamwalker', 'dreamwalker', 'half_blood', 'awaken_lonely_girl'].includes(s.currentStage)) {
            nightInstruction.innerHTML += "請選擇你的目標對象 (必須選擇)：";
            if (s.currentStage === 'ghost_bride_couple') nightInstruction.innerHTML += "請選擇你們的證婚人 (必須選擇)：";
        } else {
            nightInstruction.innerHTML += "請選擇你的目標對象 (或跳過)："; btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
        }
    } else if (s.currentStage === 'alchemist') {
        nightRoleTitle.textContent = "⚗️ 煉金魔女行動";
        nightInstruction.innerHTML += "請選擇要使用未明之霧的目標 (請選擇 3 名不同玩家，或跳過)：";
        btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
    } else if (s.currentStage === 'wolf') {
        let wSeats = Object.keys(s.playerRoles).filter(k => wolfFaction.includes(s.playerRoles[k]) && !['eclipse_maid', 'hidden_wolf', 'gray_wolf'].includes(s.playerRoles[k]));
        let hasLG = Object.values(s.playerRoles).includes('little_girl');
        if (hasLG) wSeats.push(Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'little_girl'));
        wSeats.sort((a, b) => a - b);
        let wText = wSeats.map(id => {
            let tag = '';
            if (id === s.initialThiefSeat?.toString()) tag = (s.playerRoles[id] === 'wolf_king' || s.playerRoles[id] === 'awaken_wolf_king') ? '(盜賊狼王)' : '(盜賊)';
            else if (s.playerRoles[id] !== 'wolf' && s.playerRoles[id] !== 'little_girl') tag = `(${s.ROLE_DICT[s.playerRoles[id]].name})`;
            return `${id}號${tag}`;
        }).join(', ');
        let dmText = s.divinerMark ? `<br><span style="color:#fca311;">⚠️ 占卜師已發動技能，只能刀 ${s.divinerMark}號 及左右兩號</span>` : '';
        let alchText = s.alchemistFogTargets.length > 0 ? `<br><span style="color:#fca311;">⚠️ 煉金魔女已施放迷霧，只能從 ${s.alchemistFogTargets.sort().join(', ')} 號中擊殺</span>` : '';
        nightRoleTitle.textContent = hasLG ? "🐺 狼隊與小女孩行動" : "🐺 狼人行動";

        if (Object.values(s.playerRoles).includes('seed_wolf')) {
            nightInstruction.innerHTML += "請選擇行動模式：";
            numberPad.classList.add('hidden');

            let customPanel = document.createElement('div');
            customPanel.id = 'custom-action-panel';
            customPanel.style = "display: flex; gap: 10px; width: 100%; justify-content: center; margin-bottom: 15px;";

            let btnKill = document.createElement('button'); btnKill.className = 'primary-btn'; btnKill.textContent = "一般刀人";
            let btnInfect = document.createElement('button'); btnInfect.className = 'special-btn'; btnInfect.textContent = "發動感染";
            let btnSkip = document.createElement('button'); btnSkip.className = 'secondary-btn'; btnSkip.textContent = "空刀 (不擊殺)";

            customPanel.appendChild(btnKill); customPanel.appendChild(btnInfect); customPanel.appendChild(btnSkip);
            numberPad.parentNode.insertBefore(customPanel, numberPad);

            btnKill.onclick = () => {
                s.isSeedWolfInfecting = false; createNumberPad(); document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected')); s.selectedNumber = null;
                btnKill.classList.add('action-selected'); btnInfect.classList.remove('action-selected'); btnSkip.classList.remove('action-selected');
                numberPad.classList.remove('hidden'); btnConfirmAction.classList.add('hidden');
                nightInstruction.innerHTML = `請選擇擊殺目標：<br><span style="color:#e94560; font-size:16px;">🐺 睜眼名單：${hasLG ? '【隱藏】' : wText}</span>${dmText}${alchText}`;
            };
            btnInfect.onclick = () => {
                s.isSeedWolfInfecting = true; createNumberPad(); document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected')); s.selectedNumber = null;
                document.querySelectorAll('#number-pad .num-btn').forEach(b => {
                    let seatId = parseInt(b.textContent);
                    if (seatId && wolfFaction.includes(s.playerRoles[seatId])) { b.disabled = true; b.style.opacity = '0.3'; b.style.cursor = 'not-allowed'; }
                });
                btnInfect.classList.add('action-selected'); btnKill.classList.remove('action-selected'); btnSkip.classList.remove('action-selected');
                numberPad.classList.remove('hidden'); btnConfirmAction.classList.add('hidden');
                nightInstruction.innerHTML = `請選擇要感染的目標：<br><span style="color:#e94560; font-size:16px;">🐺 睜眼名單：${hasLG ? '【隱藏】' : wText}</span>${dmText}${alchText}`;
            };
            btnSkip.onclick = () => {
                s.isSeedWolfInfecting = false; createNumberPad(); document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected')); s.selectedNumber = 'skip';
                btnSkip.classList.add('action-selected'); btnKill.classList.remove('action-selected'); btnInfect.classList.remove('action-selected');
                numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認";
                nightInstruction.innerHTML = "請選擇行動模式：";
            };
        } else {
            nightInstruction.innerHTML += `請點擊擊殺目標號碼 (或空刀)：<br><span style="color:#e94560; font-size:16px;">🐺 睜眼名單：${hasLG ? '【隱藏】' : wText}</span>${dmText}${alchText}`;
            btnOptionalSkip.textContent = "空刀 (不擊殺)"; btnOptionalSkip.classList.remove('hidden');
        }
    } else if (s.currentStage.startsWith('notify_')) {
        let seat = parseInt(s.currentStage.split('_').pop());
        let notifyType = s.currentStage.substring(0, s.currentStage.lastIndexOf('_'));

        nightRoleTitle.textContent = `${seat}號確認狀態`;
        nightInstruction.textContent = "請點擊下方按鈕確認狀態：";
        numberPad.classList.add('hidden');
        actionPad.classList.remove('hidden');

        let btnView = document.createElement('button');
        btnView.className = 'primary-btn';
        btnView.style.width = '200px';
        btnView.textContent = "查看狀態";
        actionPad.appendChild(btnView);

        btnView.onclick = () => {
            actionPad.innerHTML = '';
            let msgs = [];

            if (notifyType === 'notify_groom' && s.ghostBrideGroom === seat) msgs.push(`你是鬼魅新娘的新郎 🤵`);
            if (notifyType === 'notify_witness' && s.ghostBrideWitness === seat) msgs.push(`你是證婚人 🕊️`);
            
            if (notifyType === 'notify_luckyboy' && s.merchantTarget === seat && !wolfFaction.includes(s.playerRoles[seat])) {
                msgs.push(`你是幸運兒 🎁`);
            }
            if (notifyType === 'notify_assistant' && s.awakenWitchAssistant === seat) msgs.push(`你是女巫的協助者`);

            if (notifyType === 'notify_general') {
                if (s.cupidLovers.includes(seat)) msgs.push("你是情侶 💕");
                if (s.seedWolfTarget === seat) msgs.push(`你被種狼感染成了狼人！🐺`);
            }

            if (notifyType === 'notify_end') {
                if (s.awakenGargoyleTarget === seat || s.awakenGargoyleTargetA === seat || s.awakenGargoyleTargetB === seat) {
                    msgs.push(`你被覺醒石像鬼轉化了！🦇`);
                }
            }

            let resBox = document.createElement('div');
            resBox.style = "padding: 20px; background-color: #24345e; border-radius: 8px; width: 100%; text-align: center; border: 2px solid #00ff88; margin: 20px 0;";
            let txt = document.createElement('p');
            txt.style = "font-size: 24px; font-weight: bold; margin: 0;";
            txt.innerHTML = msgs.length ? msgs.join('<br>') : "無特殊狀態";
            txt.style.color = msgs.length ? "#fca311" : "#00ff88";
            resBox.appendChild(txt);
            actionPad.appendChild(resBox);

            btnConfirmAction.classList.remove('hidden');
            btnConfirmAction.textContent = "了解並閉眼";
        };
    } else {
        btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
        let name = getStageVoiceName(s.currentStage, s.currentSubLabel);
        nightRoleTitle.textContent = `${s.ROLE_DICT[s.currentStage]?.icon || '🎭'} ${name}行動`;
    }

    let voiceName = getStageVoiceName(s.currentStage, s.currentSubLabel);
    if (s.currentStage === 'wolf' && Object.values(s.playerRoles).includes('little_girl')) voiceName = "狼隊和小女孩";
    speak(`${voiceName}請睜眼。`);
}

function initSheriffScreen() {
    document.getElementById('sheriff-setup-section').classList.remove('hidden');
    document.getElementById('sheriff-action-section').classList.add('hidden');
    document.getElementById('sheriff-result-section').classList.add('hidden');
    
    const btnStart = document.getElementById('btn-start-sheriff-speech');
    const btnNoSheriff = document.getElementById('btn-no-sheriff-candidates');
    btnStart.classList.add('hidden');
    btnNoSheriff.classList.remove('hidden');

    const pad = document.getElementById('sheriff-numpad');
    pad.innerHTML = '';
    s.sheriffCandidates = [];
    
    for (let i = 1; i <= s.totalPlayers; i++) {
        let btn = document.createElement('button');
        btn.className = 'num-btn';
        btn.textContent = i;
        btn.onclick = () => {
            if (s.sheriffCandidates.includes(i)) {
                s.sheriffCandidates = s.sheriffCandidates.filter(x => x !== i);
                btn.classList.remove('selected');
            } else {
                s.sheriffCandidates.push(i);
                btn.classList.add('selected');
            }
            
            if (s.sheriffCandidates.length === 0) {
                btnStart.classList.add('hidden');
                btnNoSheriff.classList.remove('hidden');
            } else if (s.sheriffCandidates.length === 1) {
                btnStart.classList.remove('hidden');
                btnStart.textContent = "僅一人上警 (自動當選並結算)";
                btnNoSheriff.classList.add('hidden');
            } else {
                btnStart.classList.remove('hidden');
                btnStart.textContent = "確認競選名單並開始發言";
                btnNoSheriff.classList.add('hidden');
            }
        };
        pad.appendChild(btn);
    }
}

// ==========================================
// 3. 系統初始化與 DOM 事件綁定 
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    const style = document.createElement('style');
    style.innerHTML = `.action-selected { background-color: #51c9c1 !important; color: white !important; border: 2px solid #fff !important; transform: scale(1.05); }`;
    document.head.appendChild(style);

    const countSelect = document.getElementById('setting-player-count');
    const settingBoard = document.getElementById('setting-board');

    const screenStart = document.getElementById('screen-start');
    const screenSetup = document.getElementById('screen-setup');
    const screenNight = document.getElementById('screen-night');
    const screenSheriff = document.getElementById('screen-sheriff');
    const screenDay = document.getElementById('screen-day');

    const roleSetupGrid = document.getElementById('role-setup-grid');
    const btnGoSetup = document.getElementById('btn-go-setup');
    const btnBackStart = document.getElementById('btn-back-start');
    const btnStartNight = document.getElementById('btn-start-night');

    const btnConfirmAction = document.getElementById('btn-confirm-action');
    const btnOptionalSkip = document.getElementById('btn-optional-skip');
    const btnShowJudge = document.getElementById('btn-show-judge');
    const btnReset = document.getElementById('btn-reset');
    const lockModal = document.getElementById('lock-modal');
    const roleModal = document.getElementById('role-modal');

    const judgeModal = document.getElementById('judge-modal');
    const btnCloseJudge = document.getElementById('btn-close-judge');
    const judgePlayerStatus = document.getElementById('judge-player-status');
    const judgeNightLog = document.getElementById('judge-night-log');

    const actionPad = document.getElementById('action-pad');
    const numberPad = document.getElementById('number-pad');
    const nightInstruction = document.getElementById('night-instruction');

    const actionContainer = document.createElement('div');
    actionContainer.style = 'display:flex; justify-content:center; gap:10px; margin-bottom:10px;';
    btnShowJudge.parentNode.insertBefore(actionContainer, btnShowJudge);
    actionContainer.appendChild(btnShowJudge);

    const btnShowCrow = document.createElement('button');
    btnShowCrow.id = 'btn-show-crow'; btnShowCrow.className = 'text-btn hidden';
    btnShowCrow.style = 'border: 1px solid #4b5563;'; btnShowCrow.textContent = '🐦‍⬛ 查看烏鴉詛咒';
    actionContainer.appendChild(btnShowCrow);
    btnShowJudge.style.marginBottom = '0';

    const crowPanel = document.createElement('div');
    crowPanel.id = 'crow-record-panel'; crowPanel.className = 'hidden';
    crowPanel.style = 'background:#24345e; padding:15px; border-radius:8px; margin-bottom:15px; text-align:left;';
    crowPanel.innerHTML = `
        <h3 style="margin-top:0; color:#fca311;">🐦‍⬛ 烏鴉詛咒紀錄</h3>
        <p style="font-size:16px;">昨晚被烏鴉詛咒的玩家是：<span id="crow-panel-target" style="color:#e94560; font-weight:bold; font-size:20px;">無 號</span></p>
        <p style="color:#a2a8d3; font-size:14px; margin-bottom:0;">該玩家在今日的放逐投票中，將被額外計算一票。</p>
    `;
    actionContainer.parentNode.insertBefore(crowPanel, actionContainer.nextSibling);
    btnShowCrow.onclick = () => {
        document.getElementById('crow-panel-target').textContent = s.crowTarget ? `${s.crowTarget} 號` : '無';
        crowPanel.classList.toggle('hidden');
    };

    fetch('data.json')
        .then(res => res.json())
        .then(data => {
            s.ROLE_DICT = data.ROLE_DICT;
            s.BOARD_CONFIGS = data.BOARD_CONFIGS;
            const updateBoards = () => {
                if (!s.BOARD_CONFIGS || Object.keys(s.BOARD_CONFIGS).length === 0) return;
                settingBoard.innerHTML = '';
                (s.BOARD_CONFIGS[countSelect.value] || []).forEach(b => {
                    const opt = document.createElement('option');
                    opt.value = b.id; opt.textContent = b.name; settingBoard.appendChild(opt);
                });
            };
            countSelect.addEventListener('change', updateBoards);
            updateBoards();
        });

    function openRoleModal() {
        const modalRoleOptions = document.getElementById('modal-role-options');
        modalRoleOptions.innerHTML = '';
        for (const roleId of Object.keys(s.currentBoard.roles)) {
            const btn = document.createElement('button');
            btn.classList.add('role-select-btn');
            btn.innerHTML = `${s.ROLE_DICT[roleId].icon} ${s.ROLE_DICT[roleId].name}`;
            btn.addEventListener('click', () => {
                s.playerRoles[s.currentEditingSeat] = roleId;
                const gridBtn = roleSetupGrid.children[s.currentEditingSeat - 1];
                gridBtn.dataset.status = 'set';
                gridBtn.innerHTML = `<span class="seat-num">${s.currentEditingSeat}號</span><span class="role-name">✔️已隱藏</span>`;
                roleModal.classList.add('hidden');
            });
            modalRoleOptions.appendChild(btn);
        }
        roleModal.classList.remove('hidden');
    }

    function renderRandomRoleView() {
        let container = document.getElementById('random-role-ui');
        if (s.currentViewingSeat > s.totalPlayers) {
            container.innerHTML = `<h3 style="color:#00ff88;">✅ 所有玩家確認完畢</h3>`;
            btnStartNight.classList.remove('hidden'); return;
        }
        let dispRole = s.playerRoles[s.currentViewingSeat];
        
        let displayRoleKey = dispRole;
        if (s.currentBoard?.id === '12_shadow' && (dispRole === 'seer_A' || dispRole === 'seer_B')) {
            displayRoleKey = 'seer';
        }

        container.innerHTML = `
            <button id="btn-view-role" class="num-btn" style="width:100%; padding:30px; font-size:22px;">點擊查看 ${s.currentViewingSeat} 號 身分</button>
            <div id="view-role-result" class="hidden" style="background:#24345e; padding:30px; border-radius:12px; width:100%; border:2px solid #fca311;">
                <p style="margin:0; color:#a2a8d3; font-size:18px;">你的身分是：</p>
                <p style="font-size:40px; margin:10px 0; font-weight:bold; color:#fca311;">${s.ROLE_DICT[displayRoleKey].icon} ${s.ROLE_DICT[displayRoleKey].name}</p>
            </div>
            <button id="btn-next-view" class="primary-btn hidden" style="margin-top:10px;">確認並換下一位</button>
        `;
        document.getElementById('btn-view-role').onclick = () => {
            document.getElementById('btn-view-role').classList.add('hidden');
            document.getElementById('view-role-result').classList.remove('hidden');
            document.getElementById('btn-next-view').classList.remove('hidden');
        };
        document.getElementById('btn-next-view').onclick = () => { s.currentViewingSeat++; renderRandomRoleView(); };
    }

    function initRoleSetup() {
        s.totalPlayers = parseInt(countSelect.value);
        s.currentBoard = s.BOARD_CONFIGS[s.totalPlayers].find(b => b.id === settingBoard.value);
        s.playerRoles = {}; s.playerStatus = {};
        s.isRandomMode = document.getElementById('setting-random-role').checked;

        let pTag = document.querySelector('#screen-setup p');
        if (s.isRandomMode) {
            roleSetupGrid.classList.add('hidden'); if (pTag) pTag.classList.add('hidden'); btnStartNight.classList.add('hidden');
            if (!document.getElementById('random-role-ui')) {
                let rrDiv = document.createElement('div'); rrDiv.id = 'random-role-ui';
                rrDiv.style = "margin-top:20px; display:flex; flex-direction:column; gap:15px; align-items:center;";
                roleSetupGrid.parentNode.insertBefore(rrDiv, roleSetupGrid);
            }
            document.getElementById('random-role-ui').classList.remove('hidden');
            let rolesArr = [];
            for (let r in s.currentBoard.roles) {
                for (let i = 0; i < s.currentBoard.roles[r]; i++) rolesArr.push(r);
            }
            rolesArr.sort(() => Math.random() - 0.5);

            if (s.currentBoard.id === '12_thief_cupid') {
                let thiefIndex = rolesArr.indexOf('thief');
                if (thiefIndex >= 12) {
                    let swapIndex = Math.floor(Math.random() * 12);
                    [rolesArr[thiefIndex], rolesArr[swapIndex]] = [rolesArr[swapIndex], rolesArr[thiefIndex]];
                }
                s.spareCards = rolesArr.slice(12);
                s.discardedRoles = [...s.spareCards];
            }

            for (let i = 1; i <= s.totalPlayers; i++) {
                s.playerRoles[i] = rolesArr[i - 1];
                s.playerStatus[i] = { poisoned: false, injured: false, isWhiteCatFlipped: false, isVWK: false, deathReason: null };
            }
            s.currentViewingSeat = 1; renderRandomRoleView();
        } else {
            roleSetupGrid.classList.remove('hidden'); if (pTag) pTag.classList.remove('hidden'); btnStartNight.classList.remove('hidden');
            if (document.getElementById('random-role-ui')) document.getElementById('random-role-ui').classList.add('hidden');
            roleSetupGrid.innerHTML = '';
            for (let i = 1; i <= s.totalPlayers; i++) {
                s.playerRoles[i] = null; s.playerStatus[i] = { poisoned: false, injured: false, isWhiteCatFlipped: false, isVWK: false, deathReason: null };
                const btn = document.createElement('div'); btn.classList.add('role-btn'); btn.dataset.status = 'unset';
                btn.innerHTML = `<span class="seat-num">${i}號</span><span class="role-name">未設定</span>`;
                btn.addEventListener('click', () => { s.currentEditingSeat = i; document.getElementById('modal-seat-title').textContent = `設定 ${i} 號身分`; openRoleModal(); });
                roleSetupGrid.appendChild(btn);
            }
        }
    }

    document.getElementById('btn-close-modal').addEventListener('click', () => roleModal.classList.add('hidden'));
    btnGoSetup.addEventListener('click', () => { screenStart.classList.add('hidden'); screenSetup.classList.remove('hidden'); initRoleSetup(); });
    btnBackStart.addEventListener('click', () => { screenSetup.classList.add('hidden'); screenStart.classList.remove('hidden'); });

    btnStartNight.addEventListener('click', () => {
        if (!s.isRandomMode) {
            for (let i = 1; i <= s.totalPlayers; i++) { if (!s.playerRoles[i]) return alert(`請設定 ${i} 號玩家的身分！`); }
            let currentCounts = {};
            for (let i = 1; i <= s.totalPlayers; i++) { let role = s.playerRoles[i]; currentCounts[role] = (currentCounts[role] || 0) + 1; }
            let errorMsg = "⚠️ 職業配置錯誤！\n\n"; let isMatch = true; s.discardedRoles = [];

            for (const [roleId, reqCount] of Object.entries(s.currentBoard.roles)) {
                if ((currentCounts[roleId] || 0) !== reqCount) { isMatch = false; errorMsg += `${s.ROLE_DICT[roleId].name}: 配置數量錯誤\n`; }
            }
            if (!isMatch && s.currentBoard.id !== '12_thief_cupid') return alert(errorMsg);
        }

        if (s.currentBoard.id === '12_thief_cupid') {
            s.spareCards = []; let tempBoard = { ...s.currentBoard.roles };
            for (let i = 1; i <= 12; i++) tempBoard[s.playerRoles[i]]--;
            for (let r in tempBoard) { while (tempBoard[r] > 0) { s.spareCards.push(r); tempBoard[r]--; } }
            if (s.spareCards.filter(r => wolfFaction.includes(r)).length === 2) { alert("底牌為雙狼，此局必須重開！"); return btnReset.click(); }
        }

        if (s.currentBoard.id === '12_shadow') {
            let sA = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'seer_A');
            let sB = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'seer_B');
            s.shadowSeerSeat = Math.random() > 0.5 ? parseInt(sA) : parseInt(sB);
        }

        if (s.currentBoard.id === '12_variable_wolf') {
            let godSeats = Object.keys(s.playerRoles).filter(k => ['seer', 'witch', 'hunter', 'dreamwalker', 'bear'].includes(s.playerRoles[k]));
            s.vwkSeat = parseInt(godSeats[Math.floor(Math.random() * godSeats.length)]);
            s.playerStatus[s.vwkSeat].isVWK = true;
        }

        let wSeats = Object.keys(s.playerRoles).filter(k => wolfFaction.includes(s.playerRoles[k]) && !['eclipse_maid', 'hidden_wolf', 'gray_wolf'].includes(s.playerRoles[k]));
        if (wSeats.length > 0) s.phantomKnownWolf = wSeats[Math.floor(Math.random() * wSeats.length)];

        let thiefKey = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'thief');
        s.initialThiefSeat = thiefKey ? parseInt(thiefKey) : null;

        buildNightQueue(); s.nightActionLog = []; lockModal.classList.remove('hidden');
    });

    document.getElementById('btn-cancel-lock').addEventListener('click', () => lockModal.classList.add('hidden'));
    document.getElementById('btn-confirm-lock').addEventListener('click', () => {
        lockModal.classList.add('hidden'); screenSetup.classList.add('hidden'); screenNight.classList.remove('hidden');
        numberPad.classList.add('hidden');
        document.getElementById('night-role-title').textContent = "🐺 黑夜降臨";
        nightInstruction.textContent = "請大家閉上眼睛...";
        speak("天黑請閉眼。", runNextNightRole);
    });

    document.getElementById('btn-start-sheriff-speech').addEventListener('click', () => {
        if (s.sheriffCandidates.length === 1) {
            s.speechOrderText = null; 
            document.getElementById('screen-sheriff').classList.add('hidden');
            showDayResult();
        } else {
            document.getElementById('sheriff-setup-section').classList.add('hidden');
            document.getElementById('sheriff-action-section').classList.remove('hidden');
            document.getElementById('sheriff-speech-order').innerHTML = generateSpeechOrder(s.sheriffCandidates);
        }
    });

    document.getElementById('btn-no-sheriff-candidates').addEventListener('click', () => {
        s.speechOrderText = generateSpeechOrder(null); 
        document.getElementById('screen-sheriff').classList.add('hidden');
        showDayResult();
    });

    document.getElementById('btn-finish-sheriff').addEventListener('click', () => {
        document.getElementById('sheriff-action-section').classList.add('hidden');
        document.getElementById('sheriff-result-section').classList.remove('hidden');
    });

    document.getElementById('btn-sheriff-wolf-blow').addEventListener('click', () => {
        s.speechOrderText = null; 
        screenSheriff.classList.add('hidden');
        showDayResult();
    });

    document.getElementById('btn-sheriff-elected').addEventListener('click', () => {
        s.speechOrderText = null; 
        screenSheriff.classList.add('hidden');
        showDayResult();
    });

    document.getElementById('btn-sheriff-not-elected').addEventListener('click', () => {
        s.speechOrderText = generateSpeechOrder(null); 
        screenSheriff.classList.add('hidden');
        showDayResult();
    });

    btnConfirmAction.addEventListener('click', () => {

        let isRealAction = (s.selectedNumber !== 'skip' && s.selectedNumber !== null) || s.selectedNumbersArr.length > 0 || s.witchSaved || s.currentStage === 'awaken_witch_assistant_action';
        if (isRealAction && s.currentStage !== 'awaken_witch') {
            if (s.currentActorSeat) s.actedPlayers.push(parseInt(s.currentActorSeat));
            else {
                let p = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === s.currentStage || s.playerRoles[k] === 'awaken_' + s.currentStage);
                if (p) s.actedPlayers.push(parseInt(p));
            }
            if (s.currentStage === 'wolf' && !s.isSeedWolfInfecting) {
                let ws = Object.keys(s.playerRoles).filter(k => wolfFaction.includes(s.playerRoles[k]) && !['hidden_wolf', 'gray_wolf'].includes(s.playerRoles[k]));
                ws.forEach(x => s.actedPlayers.push(parseInt(x)));
            }
        }

        if (s.currentRoleFeared) {
            let roleLog = getStageVoiceName(s.currentStage, s.currentSubLabel);
            if (s.currentBoard.id === '12_shadow' && parseInt(s.currentActorSeat) === s.shadowSeerSeat) {
                roleLog += ' (燈影)';
            }
            s.nightActionLog.push(`【${roleLog}】被恐懼，跳過技能`);

            btnConfirmAction.classList.add('hidden');
            actionPad.innerHTML = ''; actionPad.classList.add('hidden');
            nightInstruction.textContent = "請閉眼等待...";
            speak(`${getStageVoiceName(s.currentStage, s.currentSubLabel)}請閉眼。`, runNextNightRole);
            return;
        }

        if (s.currentStage === 'awaken_witch_assistant_action') {
            btnConfirmAction.classList.add('hidden'); actionPad.classList.add('hidden');
            nightInstruction.textContent = "請閉眼等待...";
            let agreeText = s.awakenWitchAssistantAgreed ? "同意" : "不同意";
            s.nightActionLog.push(`【覺醒女巫】對 ${s.witchPoisonTarget}號 使用毒藥 (指派 ${s.awakenWitchAssistant}號 協助，他 ${agreeText})`);
            if (!s.awakenWitchAssistantAgreed) s.witchPoisonTarget = null;
            speak(`協助者請閉眼。`, runNextNightRole);
            return;
        }

        if (['wolf_brother_meet', 'wolf_gun_confirm', 'lovers_meet', 'wolf_meet', 'hidden_wolf', 'curse_fox', 'ghost_bride_witness', 'hunter', 'bear'].includes(s.currentStage) || s.currentStage.startsWith('notify_')) {
            btnConfirmAction.classList.add('hidden');
            actionPad.innerHTML = ''; actionPad.classList.add('hidden');
            nightInstruction.textContent = "請閉眼等待...";

            if (s.currentStage === 'wolf_meet') s.nightActionLog.push(`【狼人】互相確認身分，首夜不刀人`);
            if (s.currentStage === 'hidden_wolf') s.nightActionLog.push(`【隱狼】確認了狼人陣營隊友`);
            let v = getStageVoiceName(s.currentStage, s.currentSubLabel);
            if (s.currentStage === 'wolf_meet' && Object.values(s.playerRoles).includes('little_girl')) v = "狼隊和小女孩";

            speak(`${v}請閉眼。`, runNextNightRole);
            return;
        }

        let needsResultRoles = ['seer', 'real_fox', 'awaken_seer', 'gargoyle', 'psychic', 'pure_white', 'wolf_witch', 'machine_wolf'];
        if (s.currentStage === 'lucky_boy_action' && s.merchantItem === 'seer' && s.merchantType !== 'black_market') needsResultRoles.push('lucky_boy_action');
        if (s.currentStage === 'gray_wolf_action' && s.grayWolfStolenSkill === 'seer') needsResultRoles.push('gray_wolf_action');

        if (needsResultRoles.includes(s.currentStage) && s.selectedNumber !== 'skip' && !s.isShowingResult) {
            let actorSeat = s.currentActorSeat || Object.keys(s.playerRoles).find(k => s.playerRoles[k] === s.currentStage || s.playerRoles[k] === 'awaken_' + s.currentStage);
            let isVWKTurn = actorSeat && s.playerStatus[actorSeat]?.isVWK;

            numberPad.classList.add('hidden');
            actionPad.innerHTML = '';
            actionPad.classList.remove('hidden');
            btnConfirmAction.textContent = "了解並閉眼";
            btnOptionalSkip.classList.add('hidden');

            let resultBox = document.createElement('div');
            resultBox.style = "padding: 20px; background-color: #24345e; border-radius: 8px; width: 100%; text-align: center; border: 2px solid #fca311; margin: 20px 0;";
            let lbl = document.createElement('p');
            lbl.style = "font-size: 18px; margin: 0; color: #fff;"; lbl.textContent = "該名玩家的查驗結果為：";
            let txt = document.createElement('p');
            txt.style = "font-size: 32px; font-weight: bold; margin: 10px 0 0 0;";

            let logName = getStageVoiceName(s.currentStage, s.currentSubLabel);
            if (s.currentBoard.id === '12_shadow' && parseInt(actorSeat) === s.shadowSeerSeat) {
                logName += ' (燈影)';
            }

            if (s.currentStage === 'awaken_seer') {
                lbl.textContent = "兩名玩家的陣營為：";
                s.awakenSeerTargets = [applyTimeWolfReflection(getActualTarget(s.selectedNumbersArr[0]), s.currentActorSeat), applyTimeWolfReflection(getActualTarget(s.selectedNumbersArr[1]), s.currentActorSeat)];
                let isEvil = evilRoles.includes(s.playerRoles[s.awakenSeerTargets[0]]) || evilRoles.includes(s.playerRoles[s.awakenSeerTargets[1]]);
                if (isEvil && !['hidden_wolf', 'ghost_bride'].includes(s.playerRoles[s.awakenSeerTargets[0]]) && !['hidden_wolf', 'ghost_bride'].includes(s.playerRoles[s.awakenSeerTargets[1]])) { txt.textContent = "🐺 疑似狼人"; txt.style.color = "#e94560"; }
                else { txt.textContent = "🧑‍🌾 雙好人"; txt.style.color = "#00ff88"; }
                s.nightActionLog.push(`【${logName}】查驗了 ${s.awakenSeerTargets[0]}號 和 ${s.awakenSeerTargets[1]}號`);
            } else if (s.currentStage === 'real_fox') {
                lbl.textContent = "查驗範圍的陣營為：";
                let t = parseInt(s.selectedNumber); let p1 = t - 1 < 1 ? s.totalPlayers : t - 1; let p2 = t + 1 > s.totalPlayers ? 1 : t + 1;
                let isT_infected = (t === s.seedWolfTarget); let isP1_infected = (p1 === s.seedWolfTarget); let isP2_infected = (p2 === s.seedWolfTarget);
                let hW = wolfFaction.includes(s.playerRoles[t]) || wolfFaction.includes(s.playerRoles[p1]) || wolfFaction.includes(s.playerRoles[p2]) || isT_infected || isP1_infected || isP2_infected;
                
                if (hW) { txt.textContent = "🐺 有狼人"; txt.style.color = "#e94560"; } else { txt.textContent = "🧑‍🌾 無狼人"; txt.style.color = "#00ff88"; }
                s.nightActionLog.push(`【${logName}】查驗了 ${t}號 範圍`);
            } else if (s.currentStage === 'lucky_boy_action') {
                let actualTarget = applyTimeWolfReflection(getActualTarget(parseInt(s.selectedNumber)), s.currentActorSeat);
                s.nightActionLog.push(`【幸運兒(${s.merchantTarget}號)】查驗了 ${actualTarget}號`);
                let targetRole = s.playerRoles[actualTarget];
                let isEvil = evilRoles.includes(targetRole) || s.playerStatus[actualTarget]?.isVWK;
                if (['hidden_wolf', 'wolf_brother_little', 'ghost_bride'].includes(targetRole)) isEvil = false;
                if (isEvil) { txt.textContent = "🐺 狼人 (壞人)"; txt.style.color = "#e94560"; } else { txt.textContent = "🧑‍🌾 好人"; txt.style.color = "#00ff88"; }
            } else if (s.currentStage === 'gray_wolf_action') {
                let actualTarget = applyTimeWolfReflection(getActualTarget(parseInt(s.selectedNumber)), s.currentActorSeat);
                s.nightActionLog.push(`【灰太狼(偷取預言家)】查驗了 ${actualTarget}號`);
                let targetRole = s.playerRoles[actualTarget];
                let isEvil = evilRoles.includes(targetRole) || s.playerStatus[actualTarget]?.isVWK;
                if (['hidden_wolf', 'wolf_brother_little', 'ghost_bride'].includes(targetRole)) isEvil = false;
                if (isEvil) { txt.textContent = "🐺 狼人 (壞人)"; txt.style.color = "#e94560"; } else { txt.textContent = "🧑‍🌾 好人"; txt.style.color = "#00ff88"; }
            } else {
                let actualTarget = applyTimeWolfReflection(getActualTarget(parseInt(s.selectedNumber)), s.currentActorSeat);
                s.nightActionLog.push(`【${logName}】查驗了 ${actualTarget}號`);

                if (['seer'].includes(s.currentStage)) {
                    s.seerTarget = actualTarget; let targetRole = s.playerRoles[actualTarget];
                    if (isVWKTurn) {
                        txt.textContent = `${s.ROLE_DICT[targetRole].icon} ${s.ROLE_DICT[targetRole].name}`; 
                        txt.style.color = "#fca311";
                    } else {
                        let isEvil = evilRoles.includes(targetRole) || s.playerStatus[actualTarget]?.isVWK;
                        if (['hidden_wolf', 'wolf_brother_little', 'ghost_bride'].includes(targetRole)) isEvil = false;
                        if (targetRole === 'machine_wolf' && s.machineWolfTarget) { let learnedRole = s.playerRoles[s.machineWolfTarget]; if (!evilRoles.includes(learnedRole)) isEvil = false; }
                        if (s.currentBoard.id === '12_shadow' && parseInt(actorSeat) === s.shadowSeerSeat) isEvil = !isEvil;
                        
                        if (isEvil) { txt.textContent = "🐺 狼人 (壞人)"; txt.style.color = "#e94560"; } else { txt.textContent = "🧑‍🌾 好人"; txt.style.color = "#00ff88"; }
                    }
                } else if (s.currentStage === 'machine_wolf') {
                    s.machineWolfTarget = actualTarget; let r = s.playerRoles[actualTarget];
                    txt.textContent = `${s.ROLE_DICT[r].icon} ${s.ROLE_DICT[r].name}`; txt.style.color = "#fca311";
                } else {
                    if (s.currentStage === 'gargoyle') s.gargoyleTarget = actualTarget;
                    let displayRole = s.playerRoles[actualTarget];
                    if (s.currentStage === 'psychic' && displayRole === 'machine_wolf' && s.machineWolfTarget) displayRole = s.playerRoles[s.machineWolfTarget];
                    txt.textContent = `${s.ROLE_DICT[displayRole].icon} ${s.ROLE_DICT[displayRole].name}`; txt.style.color = "#fca311";
                }
            }
            resultBox.appendChild(lbl); resultBox.appendChild(txt); actionPad.appendChild(resultBox);
            s.isShowingResult = true; return;
        }

        if (s.currentStage === 'awaken_witch' && s.awakenWitchStep === 'poison_target') {
            s.awakenWitchStep = 'assistant_target';
            resetSelections();
            btnConfirmAction.classList.add('hidden');
            document.getElementById('night-instruction').textContent = "請選擇你要指派的協助者：";
            return;
        }

        btnConfirmAction.classList.add('hidden');
        btnOptionalSkip.classList.add('hidden');
        numberPad.classList.add('hidden');

        let customPanel = document.getElementById('custom-action-panel');
        if (customPanel) customPanel.remove();
        actionPad.innerHTML = '';
        actionPad.classList.add('hidden');
        nightInstruction.textContent = "請閉眼等待...";

        if (needsResultRoles.includes(s.currentStage) && s.selectedNumber === 'skip') { 
            s.nightActionLog.push(`【${getStageVoiceName(s.currentStage, s.currentSubLabel)}】跳過技能`); 
        }
        else if (s.currentStage === 'pleasant_goat') {
            let t = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber));
            let pgSeat = parseInt(s.currentActorSeat || Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'pleasant_goat'));
            if (t) {
                if (t === pgSeat) { s.pleasantGoatGuard = t; s.pleasantGoatAntiTheft = t; } 
                else { if (s.currentSubLabel === 'guard') s.pleasantGoatGuard = t; if (s.currentSubLabel === 'anti_theft') s.pleasantGoatAntiTheft = t; }
                s.nightActionLog.push(`【喜羊羊】對 ${t}號 使用了 ${t === pgSeat ? '雙重防護' : (s.currentSubLabel === 'guard' ? '守護' : '防盜')}`);
            } else { s.nightActionLog.push(`【喜羊羊】未發動技能`); }
        }
        else if (s.currentStage === 'gray_wolf_steal') {
            s.grayWolfStolenPlayer = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber));
            s.nightActionLog.push(s.grayWolfStolenPlayer ? `【灰太狼】嘗試偷取 ${s.grayWolfStolenPlayer}號` : `【灰太狼】未偷取`);
        }
        else if (s.currentStage === 'gray_wolf_action') {
            let targetRole = s.grayWolfStolenPlayer ? s.playerRoles[s.grayWolfStolenPlayer] : null;

            if (!s.grayWolfStolenPlayer || s.grayWolfStolenPlayer === s.pleasantGoatAntiTheft) {
                s.nightActionLog.push(`【灰太狼】偷取失敗 (目標被防盜或未選擇)`);
            } else if (targetRole === 'pleasant_goat') {
                s.nightActionLog.push(`【灰太狼】發現目標是喜羊羊，猜測其使用了：${s.grayWolfGuess === 'guard' ? '守護' : '防盜'}`);
            } else if (['wolf', 'little_gray_wolf'].includes(targetRole)) {
                s.nightActionLog.push(`【灰太狼】偷取失敗 (目標為狼人)`);
            } else if (s.grayWolfStolenSkill === 'witch' && s.selectedNumber && s.selectedNumber !== 'skip') {
                s.witchPoisonTarget = applyTimeWolfReflection(getActualTarget(parseInt(s.selectedNumber)), s.currentActorSeat);
                s.nightActionLog.push(`【灰太狼(偷取女巫)】對 ${s.witchPoisonTarget}號 使用了毒藥`);
            } else if (s.grayWolfStolenSkill === 'guard' && s.selectedNumber && s.selectedNumber !== 'skip') {
                s.guardTarget = applyTimeWolfReflection(getActualTarget(parseInt(s.selectedNumber)), s.currentActorSeat);
                s.nightActionLog.push(`【灰太狼(偷取守衛)】守護了 ${s.guardTarget}號`);
            } else if (s.grayWolfStolenSkill === 'dreamwalker' && s.selectedNumber && s.selectedNumber !== 'skip') {
                s.dreamTarget = applyTimeWolfReflection(getActualTarget(parseInt(s.selectedNumber)), s.currentActorSeat);
                s.nightActionLog.push(`【灰太狼(偷取攝夢人)】攝夢了 ${s.dreamTarget}號`);
            } else if (s.selectedNumber === 'skip') {
                s.nightActionLog.push(`【灰太狼(偷取技能)】跳過發動`);
            }
        }
        else if (s.currentStage === 'diviner') { s.divinerMark = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)); s.nightActionLog.push(s.divinerMark ? `【占卜師】標記了 ${s.divinerMark}號` : `【占卜師】未發動技能`); }
        else if (s.currentStage === 'thief') { 
            s.playerRoles[Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'thief')] = s.thiefChosenRole; 
            s.discardedRoles = s.spareCards.filter(r => r !== s.thiefChosenRole); 
            s.nightActionLog.push(`【盜賊】選擇了 ${s.ROLE_DICT[s.thiefChosenRole].name}`); 
            buildNightQueue(); 
        }
        else if (s.currentStage === 'cupid') { s.cupidLovers = [...s.selectedNumbersArr]; s.nightActionLog.push(`【邱比特】連接了 ${s.cupidLovers.join('和')}號`); }
        else if (['half_blood', 'wild_child', 'awaken_lonely_girl'].includes(s.currentStage)) {
            let t = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber));
            if (s.currentStage === 'half_blood') s.halfBloodTarget = t; if (s.currentStage === 'wild_child') s.wildChildTarget = t; if (s.currentStage === 'awaken_lonely_girl') s.lonelyGirlTarget = t;
            s.nightActionLog.push(t ? `【${s.ROLE_DICT[s.currentStage].name}】選擇了 ${t}號` : `【${s.ROLE_DICT[s.currentStage].name}】未選擇`);
        }
        else if (s.currentStage === 'ghost_bride') { s.ghostBrideGroom = getActualTarget(parseInt(s.selectedNumber)); s.nightActionLog.push(`【鬼魅新娘】選擇了 ${s.ghostBrideGroom}號為新郎`); }
        else if (s.currentStage === 'ghost_bride_couple') { s.ghostBrideWitness = getActualTarget(parseInt(s.selectedNumber)); s.nightActionLog.push(`【鬼魅新娘與新郎】選擇了 ${s.ghostBrideWitness}號為證婚人`); }
        else if (s.currentStage === 'awaken_dreamwalker') { s.awakenDreamwalkerTarget = getActualTarget(parseInt(s.selectedNumber)); s.nightActionLog.push(`【覺醒攝夢人】指定了 ${s.awakenDreamwalkerTarget}號為夢語者`); }
        else if (s.currentStage === 'time_wolf') { s.timeWolfTarget = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)); s.nightActionLog.push(s.timeWolfTarget ? `【蝕時狼妃】封鎖了 ${s.timeWolfTarget}號` : `【蝕時狼妃】未封鎖`); }
        else if (s.currentStage === 'awaken_idiot') { s.awakenIdiotTarget = applyTimeWolfReflection((s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)), s.currentActorSeat); s.nightActionLog.push(s.awakenIdiotTarget ? `【覺醒白痴】守護了 ${s.awakenIdiotTarget}號` : `【覺醒白痴】未守護`); }
        else if (s.currentStage === 'crow') { s.crowTarget = applyTimeWolfReflection((s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)), s.currentActorSeat); s.nightActionLog.push(s.crowTarget ? `【烏鴉】詛咒了 ${s.crowTarget}號` : `【烏鴉】未詛咒`); }
        else if (['magician', 'trickster', 'wolf_sorcerer'].includes(s.currentStage)) {
            let swap = (s.selectedNumber === 'skip') ? [] : [...s.selectedNumbersArr];
            if (s.currentStage === 'magician') s.magicianSwap = swap; if (s.currentStage === 'trickster') s.tricksterSwap = swap; if (s.currentStage === 'wolf_sorcerer') s.wolfSorcererSwap = swap;
            s.nightActionLog.push(swap.length ? `【${s.ROLE_DICT[s.currentStage].name}】交換了 ${swap[0]}號 和 ${swap[1]}號` : `【${s.ROLE_DICT[s.currentStage].name}】未交換`);
        }
        else if (s.currentStage === 'phantom') { s.phantomTargets = (s.selectedNumber === 'skip') ? [] : [getActualTarget(s.selectedNumbersArr[0]), getActualTarget(s.selectedNumbersArr[1])]; s.nightActionLog.push(s.phantomTargets.length ? `【尋香魅影】綁定了 ${s.phantomTargets.join('和')}號` : `【尋香魅影】未綁定`); }
        else if (s.currentStage === 'nightmare') { s.nightmareTarget = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)); s.nightActionLog.push(s.nightmareTarget ? `【夢魘】恐懼了 ${s.nightmareTarget}號` : `【夢魘】未恐懼`); }
        else if (s.currentStage === 'guard') { s.guardTarget = applyTimeWolfReflection((s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)), s.currentActorSeat); s.nightActionLog.push(s.guardTarget ? `【守衛】守護了 ${s.guardTarget}號` : `【守衛】空守`); }
        else if (s.currentStage === 'dreamwalker') { s.dreamTarget = applyTimeWolfReflection(getActualTarget(parseInt(s.selectedNumber)), s.currentActorSeat); s.nightActionLog.push(`【攝夢人】攝夢了 ${s.dreamTarget}號`); }
        else if (s.currentStage === 'bear') { s.vwkCharmTarget = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)); s.nightActionLog.push(s.vwkCharmTarget ? `【百變狼王(熊)】魅惑了 ${s.vwkCharmTarget}號` : `【百變狼王(熊)】未魅惑`); }
        else if (s.currentStage === 'awaken_wolf_king_gun') { s.awakenWolfGunTarget = (s.selectedNumber === 'skip') ? null : parseInt(s.selectedNumber); s.nightActionLog.push(s.awakenWolfGunTarget ? `【覺醒狼王】把槍分給了 ${s.awakenWolfGunTarget}號` : `【覺醒狼王】未分槍，自己保留兩把槍`); }
        else if (['black_market', 'miracle_merchant'].includes(s.currentStage)) {
            s.merchantTarget = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber));
            s.merchantType = s.merchantTarget ? s.currentStage : null; 
            let itemText = s.merchantItem === 'seer' ? '預言家查驗' : s.merchantItem === 'poison' ? '女巫毒藥' : '守衛護盾/獵人的槍';
            s.nightActionLog.push(s.merchantTarget ? `【${s.ROLE_DICT[s.currentStage].name}】將 ${itemText} 給了 ${s.merchantTarget}號` : `【${s.ROLE_DICT[s.currentStage].name}】未發動技能`);
        }
        else if (s.currentStage === 'lucky_boy_action') {
            if (s.merchantType === 'black_market') {
                s.nightActionLog.push(`【幸運兒(${s.merchantTarget}號)】獲得黑市商人技能，技能暫時還無法發動`);
            } else {
                let t = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber));
                if (t) {
                    if (s.merchantItem === 'poison') s.witchPoisonTarget = t;
                    if (s.merchantItem === 'guard') s.guardTarget = t;
                    if (s.merchantItem === 'seer') s.seerTarget = t;
                }
                let itemText = s.merchantItem === 'seer' ? '預言家查驗' : s.merchantItem === 'poison' ? '女巫毒藥' : '守衛護盾';
                s.nightActionLog.push(t ? `【幸運兒(${s.merchantTarget}號)】使用了【${itemText}】對 ${t}號` : `【幸運兒(${s.merchantTarget}號)】未使用技能`);
            }
        }
        else if (s.currentStage === 'wolf') {
            if (s.isSeedWolfInfecting) {
                s.seedWolfTarget = getActualTarget(parseInt(s.selectedNumber)); s.wolfKillTarget = null;
                s.nightActionLog.push(s.seedWolfTarget ? `【種狼】感染了 ${s.seedWolfTarget}號` : `【種狼】空感染`);
            } else {
                s.wolfKillTarget = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber));
                let lgLog = Object.values(s.playerRoles).includes('little_girl') ? '與小女孩' : '';
                s.nightActionLog.push(s.wolfKillTarget ? `【狼人${lgLog}】擊殺了 ${s.wolfKillTarget}號` : `【狼人${lgLog}】空刀`);
            }
        }
        else if (s.currentStage === 'big_bad_wolf') { s.bigBadWolfKillTarget = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)); s.nightActionLog.push(s.bigBadWolfKillTarget ? `【大野狼】擊殺了 ${s.bigBadWolfKillTarget}號` : `【大野狼】空刀`); }
        else if (s.currentStage === 'alchemist') { s.alchemistFogTargets = (s.selectedNumber === 'skip') ? [] : [...s.selectedNumbersArr]; s.nightActionLog.push(s.alchemistFogTargets.length ? `【煉金魔女】對 ${s.alchemistFogTargets.join(', ')}號 施放未名之霧` : `【煉金魔女】未放霧`); }
        else if (s.currentStage === 'awaken_gargoyle') { s.awakenGargoyleTarget = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)); s.nightActionLog.push(s.awakenGargoyleTarget ? `【覺醒石像鬼】轉化了 ${s.awakenGargoyleTarget}號` : `【覺醒石像鬼】未轉化`); }
        else if (s.currentStage === 'awaken_gargoyle_A') {
            s.awakenGargoyleTargetA = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber));
            if (s.awakenGargoyleTargetA && s.playerRoles[s.awakenGargoyleTargetA] === 'machine_wolf') s.awakenGargoyleTargetA = null;
            s.nightActionLog.push(s.awakenGargoyleTargetA ? `【覺醒石像鬼A】轉化了 ${s.awakenGargoyleTargetA}號` : `【覺醒石像鬼A】未轉化`);
        }
        else if (s.currentStage === 'awaken_gargoyle_B') {
            s.awakenGargoyleTargetB = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber));
            if (s.awakenGargoyleTargetB && s.playerRoles[s.awakenGargoyleTargetB] === 'machine_wolf') s.awakenGargoyleTargetB = null;
            s.nightActionLog.push(s.awakenGargoyleTargetB ? `【覺醒石像鬼B】轉化了 ${s.awakenGargoyleTargetB}號` : `【覺醒石像鬼B】未轉化`);
        }
        else if (s.currentStage === 'witch' || s.currentStage === 'awaken_witch') {
            let logName = s.currentStage === 'awaken_witch' ? '覺醒女巫' : '女巫';
            if (s.selectedNumber === 'skip') { s.witchPoisonTarget = null; s.nightActionLog.push(`【${logName}】未發動技能`); }
            else if (s.selectedNumber === 'witch_save') { s.witchSaved = true; s.nightActionLog.push(`【${logName}】使用了救藥`); }
            else if (s.selectedNumber && !isNaN(s.selectedNumber) && s.currentStage === 'witch') {
                s.witchPoisonTarget = applyTimeWolfReflection(getActualTarget(parseInt(s.selectedNumber)), s.currentActorSeat);
                s.nightActionLog.push(`【女巫】對 ${s.witchPoisonTarget}號 使用了毒藥`);
            }
        }

        let v = getStageVoiceName(s.currentStage, s.currentSubLabel);
        if (s.currentStage === 'wolf' && Object.values(s.playerRoles).includes('little_girl')) v = "狼隊和小女孩";
        speak(`${v}請閉眼。`, runNextNightRole);
    });

    btnOptionalSkip.addEventListener('click', () => {
        if (s.currentStage === 'wolf' && btnOptionalSkip.textContent === "返回選單") {
            resetSelections(); numberPad.classList.add('hidden'); actionPad.classList.remove('hidden');
            btnOptionalSkip.classList.add('hidden'); btnConfirmAction.classList.add('hidden'); s.isSeedWolfInfecting = false; return;
        }

        resetSelections();
        btnOptionalSkip.classList.add('action-selected');
        s.selectedNumber = 'skip';
        btnConfirmAction.classList.remove('hidden');
        btnConfirmAction.textContent = "確認";
        if (s.currentStage === 'awaken_witch') s.awakenWitchStep = null;
    });

    btnShowJudge.addEventListener('click', () => {
        let statusHtml = '';
        for (let i = 1; i <= s.totalPlayers; i++) {
            let role = s.playerRoles[i]; let statusStrs = [];
            
            if (s.finalKilled.includes(i)) statusStrs.push(`💀 死亡 (${s.playerStatus[i].deathReason || "未知"})`);
            if (s.playerStatus[i].poisoned) statusStrs.push("🧪 中毒");
            if (s.playerStatus[i].injured) statusStrs.push("🏹 負傷");
            if (s.playerStatus[i].isWhiteCatFlipped) statusStrs.push("🐱 已翻牌");
            if (s.playerStatus[i].isVWK) statusStrs.push("🎭 百變狼王");
            
            if (s.merchantTarget === i) {
                let itemMap = { 'seer': '預查', 'poison': '毒藥', 'guard': '護盾', 'gun': '槍' };
                statusStrs.push(`🎁 幸運兒 (${itemMap[s.merchantItem] || '無'})`);
            }

            if (s.dreamTarget === i) statusStrs.push("💤 被攝夢");
            if (s.guardTarget === i) statusStrs.push("🛡️ 被守護");
            if (s.pleasantGoatGuard === i) statusStrs.push("🛡️ 喜羊羊守護");
            if (s.pleasantGoatAntiTheft === i) statusStrs.push("🔒 喜羊羊防盜");
            if (s.grayWolfStolenPlayer === i) statusStrs.push("🎩 被偷取技能");
            if (s.nightmareTarget === i) statusStrs.push("🌑 被恐懼");
            if (s.beautyTarget === i || s.awakenBeautyTarget === i) statusStrs.push("💋 被魅惑");
            if (s.phantomTargets.includes(i)) statusStrs.push("🌸 被綁定");
            if (s.machineWolfTarget === i) statusStrs.push("🤖 被學習");
            if (s.cupidLovers.includes(i)) statusStrs.push("💕 情侶");
            if (s.awakenWolfGunTarget === i) statusStrs.push("🔫 獲槍");
            if (s.awakenWitchAssistant === i) statusStrs.push("👤 協助者");
            if (s.halfBloodTarget === i) statusStrs.push("🩸 混血兒支持");
            if (s.wildChildTarget === i) statusStrs.push("👶 野孩子榜樣");
            if (s.lonelyGirlTarget === i) statusStrs.push("👧 少女偶像");
            if (s.timeWolfTarget === i) statusStrs.push("⏳ 蝕時封鎖");
            if (s.awakenIdiotTarget === i) statusStrs.push("🤡 白痴保護");
            if (s.crowTarget === i) statusStrs.push("🐦‍⬛ 烏鴉詛咒");
            if (s.seedWolfTarget === i) statusStrs.push("🐺 感染成狼");
            if (s.awakenGargoyleTarget === i) statusStrs.push("🦇 覺石轉化");
            if (s.awakenGargoyleTargetA === i) statusStrs.push("🦇 覺石A轉化");
            if (s.awakenGargoyleTargetB === i) statusStrs.push("🦇 覺石B轉化");
            if (s.awakenDreamwalkerTarget === i) statusStrs.push("💤 夢語者");
            if (s.ghostBrideGroom === i) statusStrs.push("🤵 新郎");
            if (s.ghostBrideWitness === i) statusStrs.push("🕊️ 證婚人");
            if (s.rustSwordInfectedTarget === i) statusStrs.push("🦠 傷口感染");

            let statusBadge = statusStrs.length > 0 ? `<span style="color:#fca311;">(${statusStrs.join(', ')})</span>` : '';
            let thiefTag = (i === s.initialThiefSeat) ? '(盜賊)' : '';
            
            let roleObj = s.ROLE_DICT[role];
            let nameText = roleObj?.name || role;
            if (s.currentBoard?.id === '12_shadow') {
                if (i === s.shadowSeerSeat) {
                    nameText = "燈影預言家";
                } else if (role === 'seer_A' || role === 'seer_B') {
                    nameText = "預言家";
                }
            }

            statusHtml += `<div style="margin-bottom:5px;"><b>${i}號</b> ${roleObj?.icon || ''}${nameText}${thiefTag} ${statusBadge}</div>`;
        }
        judgePlayerStatus.innerHTML = statusHtml;
        judgeNightLog.innerHTML = s.nightActionLog.map(log => `<div style="margin-bottom:5px;">• ${log}</div>`).join('');
        judgeModal.classList.remove('hidden');
    });

    btnCloseJudge.addEventListener('click', () => judgeModal.classList.add('hidden'));

    btnReset.addEventListener('click', () => {
        s.nightQueue = []; s.currentStage = null; s.wolfKillTarget = null; s.witchPoisonTarget = null; s.witchSaved = false;
        s.guardTarget = null; s.dreamTarget = null; s.magicianSwap = []; s.tricksterSwap = []; s.wolfSorcererSwap = []; s.nightmareTarget = null; s.gargoyleTarget = null;
        s.beautyTarget = null; s.machineWolfTarget = null; s.phantomTargets = []; s.awakenSeerTargets = []; s.awakenBeautyTarget = null; s.divinerMark = null;
        s.phantomKnownWolf = null; s.selectedNumber = null; s.currentEditingSeat = null; s.finalKilled = []; s.dayShootersQueue = [];
        s.ghostRiderReflected = false; s.nightActionLog = []; s.pufferfishTriggered = false; s.whiteCatFlippedLastNight = false;
        s.spareCards = []; s.discardedRoles = []; s.initialThiefSeat = null; s.thiefChosenRole = null; s.cupidLovers = []; 
        s.merchantTarget = null; s.merchantItem = null; s.merchantType = null;
        s.awakenWitchStep = null; s.awakenWitchAssistant = null; s.awakenWitchAssistantAgreed = null; s.vwkCharmTarget = null; s.actedPlayers = [];
        s.alchemistFogTargets = []; s.alchemistSnakeUsed = false; s.vwkSeat = null; s.awakenWolfGunTarget = null;
        s.halfBloodTarget = null; s.wildChildTarget = null; s.lonelyGirlTarget = null; s.timeWolfTarget = null; s.awakenIdiotTarget = null; s.crowTarget = null;
        s.seedWolfTarget = null; s.isSeedWolfInfecting = false; s.awakenGargoyleTarget = null; s.awakenGargoyleTargetA = null; s.awakenGargoyleTargetB = null; 
        s.awakenDreamwalkerTarget = null; s.ghostBrideGroom = null; s.ghostBrideWitness = null;
        s.primaryKilled = []; s.chainKilled = []; s.currentSubLabel = null; s.isFakeWake = false; s.currentRoleFeared = false; s.rustSwordInfectedTarget = null; s.bigBadWolfKillTarget = null;
        
        s.pleasantGoatGuard = null; s.pleasantGoatAntiTheft = null; s.grayWolfStolenPlayer = null; s.grayWolfStolenSkill = null; s.grayWolfGuess = null;
        
        s.sheriffCandidates = []; s.speechOrderText = null; s.shadowSeerSeat = null;

        let tCalc = document.getElementById('trickster-calc'); if (tCalc) tCalc.remove();
        document.getElementById('crow-record-panel').classList.add('hidden');
        screenDay.classList.add('hidden'); screenStart.classList.remove('hidden');
    });
});