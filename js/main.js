import { s, getStageVoiceName, getActualTarget, applyTimeWolfReflection, wolfFaction, evilRoles, speak } from './core.js';
import { createNumberPad, resetSelections } from './night.js';
import { calculateNightDeaths, proceedDayResultRender, handleChainDeaths } from './day.js';

// ==========================================
// 1. 夜晚陣列排程建構
// ==========================================
function buildNightQueue() {
    s.nightQueue = [];
    const activeRoles = Object.values(s.playerRoles);
    let queueList = [];

    const pushStage = (stage, order, seat = null, subLabel = null, isFake = false) => {
        queueList.push({ stage, order, seat, subLabel, isFake });
    };

    let addedStages = new Set();
    activeRoles.forEach(role => {
        if (addedStages.has(role)) return;
        let orders = s.ROLE_DICT[role]?.wakeOrder;
        if (orders && orders.length > 0) {
            if (role === 'ghost_bride') {
                pushStage('ghost_bride', orders[0]);
                pushStage('ghost_bride_couple', orders[1]);
            } else if (role === 'awaken_wolf_king') {
                pushStage('awaken_wolf_king_gun', orders[0]);
                pushStage('wolf_gun_confirm', orders[1]);
            } else if (role === 'awaken_witch') {
                pushStage('awaken_witch', orders[0]);
                pushStage('awaken_witch_assign', orders[1]);
            } else {
                pushStage(role, orders[0]);
            }
            addedStages.add(role);
        }
    });

    s.discardedRoles.forEach(role => {
        let orders = s.ROLE_DICT[role]?.wakeOrder;
        if (orders && ['seer', 'witch', 'hunter', 'cupid'].includes(role)) pushStage(role, orders[0], null, null, true);
    });

    if (activeRoles.includes('cupid')) pushStage('lovers_meet', 70);
    if (activeRoles.includes('wolf_brother') && activeRoles.includes('wolf_brother_little')) pushStage('wolf_brother_meet', 80);
    if (activeRoles.some(r => wolfFaction.includes(r) && r !== 'hidden_wolf' && r !== 'night_noble')) {
        pushStage(s.currentBoard?.id === '12_animals' ? 'wolf_meet' : 'wolf', 210);
    }
    if (activeRoles.includes('miracle_merchant') || activeRoles.includes('black_market')) pushStage('lucky_boy_action', 285);
    if (activeRoles.includes('awaken_witch')) pushStage('awaken_witch_assistant_action', 295);
    if (s.vwkSeat) pushStage('variable_wolf_king', 350);
    if (activeRoles.includes('awaken_dreamwalker')) pushStage('awaken_dreamwalker_result', 360);
    
    let notifyPos = 25; 
    if (activeRoles.includes('ghost_bride')) notifyPos = 68;
    else if (activeRoles.includes('seed_wolf')) notifyPos = 215;
    else if (activeRoles.includes('awaken_witch')) notifyPos = 292;

    let needsNotify = activeRoles.some(r => ['cupid', 'black_market', 'miracle_merchant', 'awaken_witch', 'seed_wolf', 'ghost_bride', 'awaken_gargoyle'].includes(r));
    if (needsNotify) { for (let i = 1; i <= s.totalPlayers; i++) pushStage(`notify_${i}`, notifyPos); }
    if (activeRoles.includes('ghost_bride')) pushStage('ghost_bride_witness', 69);
    if (activeRoles.includes('awaken_gargoyle')) { for (let i = 1; i <= s.totalPlayers; i++) pushStage(`notify_end_${i}`, 999); }

    if (s.currentBoard?.id === '12_shadow') {
        queueList = queueList.filter(q => q.stage !== 'seer' && q.stage !== 'shadow_seer');
        let sA = Object.keys(s.playerRoles).find(k=>s.playerRoles[k]==='seer_A') || Object.keys(s.playerRoles).find(k=>s.playerRoles[k]==='seer');
        let sB = Object.keys(s.playerRoles).find(k=>s.playerRoles[k]==='seer_B') || Object.keys(s.playerRoles).find(k=>s.playerRoles[k]==='shadow_seer');
        if(sA) pushStage('seer', 310, sA, 'A');
        if(sB) pushStage('seer', 310, sB, 'B');
    } else {
        let seerSeat = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'seer');
        if (seerSeat) { let sItem = queueList.find(q => q.stage === 'seer'); if (sItem) sItem.seat = seerSeat; }
    }

    queueList.sort((a, b) => a.order - b.order);
    s.nightQueue = queueList;
}

// ==========================================
// 2. 顯示天亮結果 (包含煉金魔女法老之蛇結算)
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
        alchemistCallSection.innerHTML = `
            <div style="background:#24345e; padding:20px; border-radius:8px; margin-bottom: 20px;">
                <h3 style="color:#fca311; margin-top:0;">🗣️ 白天發言階段</h3>
                <p style="color:#a2a8d3;">請所有玩家進行發言。發言結束後，法官將公佈昨晚被狼刀的對象，並由煉金魔女決定是否使用法老之蛇。</p>
                <button id="btn-end-speech" class="primary-btn" style="margin-top:15px;">發言結束，公佈狼刀</button>
            </div>
        `;
        alchemistCallSection.classList.remove('hidden');
        
        document.getElementById('btn-end-speech').onclick = () => {
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
            if (wTarget) {
                document.getElementById('btn-alch-save').onclick = () => {
                    s.primaryKilled = s.primaryKilled.filter(k => k !== parseInt(wTarget));
                    s.chainKilled = [];
                    s.finalKilled = [...s.primaryKilled];
                    handleChainDeaths(); // 重新推演連鎖死亡
                    s.alchemistSnakeUsed = true;
                    alchemistCallSection.classList.add('hidden');
                    dayResultContent.classList.remove('hidden');
                    proceedDayResultRender(); 
                };
            }
            document.getElementById('btn-alch-pass').onclick = () => {
                alchemistCallSection.classList.add('hidden');
                dayResultContent.classList.remove('hidden');
                proceedDayResultRender(); 
            };
        };
        return;
    }
    
    dayResultContent.classList.remove('hidden');
    proceedDayResultRender();
}

// ==========================================
// 3. 夜晚行動調度器
// ==========================================
export function runNextNightRole() {
    const btnConfirmAction = document.getElementById('btn-confirm-action');
    const btnOptionalSkip = document.getElementById('btn-optional-skip');
    const witchActions = document.getElementById('witch-actions');
    const skillResult = document.getElementById('skill-result');
    const hunterStatus = document.getElementById('hunter-status');
    const numberPad = document.getElementById('number-pad');
    const actionPad = document.getElementById('action-pad');
    const nightRoleTitle = document.getElementById('night-role-title');
    const nightInstruction = document.getElementById('night-instruction');

    btnConfirmAction.classList.add('hidden'); btnOptionalSkip.classList.add('hidden');
    witchActions.classList.add('hidden'); skillResult.classList.add('hidden'); hunterStatus.classList.add('hidden');
    numberPad.classList.add('hidden'); actionPad.classList.add('hidden');
    
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
            } else {
                showDayResult();
            }
        });
        return;
    }

    let nextTask = s.nightQueue.shift();
    s.currentStage = nextTask.stage; s.currentActorSeat = nextTask.seat; s.currentSubLabel = nextTask.subLabel; s.isFakeWake = nextTask.isFake;
    
    if (s.isFakeWake) {
        nightRoleTitle.textContent = `🎭 ${s.ROLE_DICT[s.currentStage]?.name}行動 (偽裝)`;
        nightInstruction.textContent = "該身分已被棄掉，模擬睜眼等待中...";
        let waitTime = Math.random() * 2000 + 3000;
        speak(`${getStageVoiceName(s.currentStage, s.currentSubLabel)}請睜眼。`, () => { 
            setTimeout(() => { speak(`${getStageVoiceName(s.currentStage, s.currentSubLabel)}請閉眼。`, runNextNightRole); }, waitTime); 
        });
        return;
    }

    if (s.currentStage === 'lucky_boy_action' && !s.merchantTarget) return runNextNightRole();
    if (s.currentStage === 'awaken_witch_assistant_action' && (!s.awakenWitchAssistant || !s.witchPoisonTarget)) return runNextNightRole();
    if (s.currentStage === 'awaken_dreamwalker_result' && !s.awakenDreamwalkerTarget) return runNextNightRole();

    let actorSeat = s.currentActorSeat || Object.keys(s.playerRoles).find(k => s.playerRoles[k] === s.currentStage || s.playerRoles[k] === 'awaken_' + s.currentStage);
    let isVWKTurn = actorSeat && s.playerStatus[actorSeat]?.isVWK;

    if (isVWKTurn && s.currentStage !== 'variable_wolf_king') {
        nightRoleTitle.textContent = `🎭 百變狼王 (${s.ROLE_DICT[s.currentStage]?.name || s.currentStage})`;
        nightInstruction.innerHTML = `<span style="color:#e94560;">你是百變狼王，原身分技能已失效。</span>`;
        btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
        speak(`${getStageVoiceName(s.currentStage, s.currentSubLabel)}請睜眼。`); return;
    }

    if (s.nightmareTarget && parseInt(actorSeat) === s.nightmareTarget && !s.currentStage.startsWith('notify_') && !['lovers_meet', 'wolf_meet', 'lucky_boy_action', 'awaken_wolf_king_gun', 'wolf_gun_confirm', 'variable_wolf_king', 'awaken_witch_assistant_action', 'hidden_wolf', 'curse_fox', 'ghost_bride_couple', 'ghost_bride_witness', 'awaken_dreamwalker_result'].includes(s.currentStage)) {
        s.currentRoleFeared = true;
        let roleName = getStageVoiceName(s.currentStage, s.currentSubLabel);
        if (s.currentStage === 'wolf') {
            let wSeats = Object.keys(s.playerRoles).filter(k => wolfFaction.includes(s.playerRoles[k]) && !['eclipse_maid', 'hidden_wolf'].includes(s.playerRoles[k]));
            let hasLG = Object.values(s.playerRoles).includes('little_girl');
            if (hasLG) wSeats.push(Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'little_girl'));
            wSeats.sort((a,b)=>a-b);
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
    
    createNumberPad(); numberPad.classList.remove('hidden');
    
    // UI 指引文字切換
    if (s.currentStage === 'wolf_crow') {
        nightRoleTitle.textContent = "🦅 狼鴉之爪行動"; nightInstruction.textContent = "請選擇你要標記的號碼 (當晚狼隊只能刀此號及其左右兩位)：";
        btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
    } else if (s.currentStage === 'thief') {
        nightRoleTitle.textContent = "🦹 盜賊行動"; nightInstruction.textContent = "請從兩張底牌中選擇一張 (若有狼陣營必須選狼)：";
        numberPad.classList.add('hidden'); actionPad.innerHTML = '';
        let hasWolf = s.spareCards.some(r => wolfFaction.includes(r));
        s.spareCards.forEach(role => {
            const b = document.createElement('button'); b.className = 'num-btn'; b.innerHTML = `${s.ROLE_DICT[role].icon} ${s.ROLE_DICT[role].name}`; b.style.width = '120px';
            if (hasWolf && !wolfFaction.includes(role)) { b.disabled = true; b.style.opacity = '0.3'; } 
            else { b.onclick = () => { document.querySelectorAll('#action-pad .num-btn').forEach(btn=>btn.classList.remove('selected')); b.classList.add('selected'); s.thiefChosenRole = role; btnConfirmAction.classList.remove('hidden'); }; }
            actionPad.appendChild(b);
        });
        actionPad.classList.remove('hidden');
    } else if (s.currentStage === 'cupid') {
        nightRoleTitle.textContent = "👼 邱比特行動"; nightInstruction.textContent = "請選擇兩名玩家成為情侶 (可選自己)：";
    } else if (['half_blood', 'wild_child', 'awaken_lonely_girl', 'awaken_idiot', 'crow', 'ghost_bride', 'ghost_bride_couple', 'awaken_dreamwalker'].includes(s.currentStage)) {
        let baseKey = s.currentStage.replace('_couple', '');
        nightRoleTitle.textContent = `${s.ROLE_DICT[baseKey].icon} ${s.ROLE_DICT[baseKey].name}行動`;
        if (['ghost_bride', 'ghost_bride_couple', 'awaken_dreamwalker'].includes(s.currentStage)) { 
            nightInstruction.textContent = "請選擇你的目標對象 (必須選擇)："; 
            if (s.currentStage === 'ghost_bride_couple') nightInstruction.textContent = "請選擇你們的證婚人 (必須選擇)："; 
        } else { 
            nightInstruction.textContent = "請選擇你的目標對象 (或跳過)："; btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden'); 
        }
    } else if (s.currentStage === 'ghost_bride_witness') {
        nightRoleTitle.textContent = "🕊️ 證婚人確認"; 
        let gb = Object.keys(s.playerRoles).find(k=>s.playerRoles[k]==='ghost_bride');
        nightInstruction.innerHTML = `鬼魅新娘是：<span style='color:#e94560;'>${gb}號</span><br>新郎是：<span style='color:#e94560;'>${s.ghostBrideGroom}號</span>`;
        numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
    } else if (s.currentStage === 'hidden_wolf') {
        nightRoleTitle.textContent = "🐺😶‍🌫️ 隱狼確認";
        let w = Object.keys(s.playerRoles).filter(k => wolfFaction.includes(s.playerRoles[k]) && s.playerRoles[k] !== 'hidden_wolf');
        nightInstruction.innerHTML = `狼人同伴是：<br><span style="color:#e94560;">${w.length ? w.join(', ') + ' 號' : '無'}</span>`;
        numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
    } else if (s.currentStage === 'wolf') {
        let wSeats = Object.keys(s.playerRoles).filter(k => wolfFaction.includes(s.playerRoles[k]) && !['eclipse_maid', 'hidden_wolf'].includes(s.playerRoles[k]));
        let hasLG = Object.values(s.playerRoles).includes('little_girl');
        if (hasLG) wSeats.push(Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'little_girl'));
        wSeats.sort((a,b)=>a-b);
        let wText = wSeats.map(id => {
            let tag = '';
            if (id === s.initialThiefSeat?.toString()) tag = (s.playerRoles[id] === 'wolf_king' || s.playerRoles[id] === 'awaken_wolf_king') ? '(盜賊狼王)' : '(盜賊)';
            else if (s.playerRoles[id] !== 'wolf' && s.playerRoles[id] !== 'little_girl') tag = `(${s.ROLE_DICT[s.playerRoles[id]].name})`;
            return `${id}號${tag}`;
        }).join(', ');
        let crowText = s.wolfCrowMark ? `<br><span style="color:#fca311;">⚠️ 已被標記，只能刀 ${s.wolfCrowMark}號 及左右兩號</span>` : '';
        nightRoleTitle.textContent = hasLG ? "🐺 狼隊與小女孩行動" : "🐺 狼人行動";
        nightInstruction.innerHTML = `請點擊擊殺目標號碼 (或空刀)：<br><span style="color:#e94560; font-size:16px;">🐺 睜眼名單：${hasLG ? '【隱藏】' : wText}</span>${crowText}`;
        if (Object.values(s.playerRoles).includes('seed_wolf')) {
            numberPad.classList.add('hidden'); actionPad.innerHTML = `
                <button class="primary-btn" id="btn-sw-kill">一般刀人</button><button class="special-btn" id="btn-sw-infect">發動感染</button><button class="secondary-btn" id="btn-sw-skip">空刀 (不擊殺)</button>`;
            actionPad.classList.remove('hidden');
            const showBackBtn = () => { actionPad.classList.add('hidden'); numberPad.classList.remove('hidden'); btnOptionalSkip.textContent = "返回選單"; btnOptionalSkip.classList.remove('hidden'); };
            document.getElementById('btn-sw-kill').onclick = () => { s.isSeedWolfInfecting = false; showBackBtn(); };
            document.getElementById('btn-sw-infect').onclick = () => { s.isSeedWolfInfecting = true; showBackBtn(); };
            document.getElementById('btn-sw-skip').onclick = () => { s.wolfKillTarget = null; btnConfirmAction.click(); };
        } else { btnOptionalSkip.textContent = "空刀 (不擊殺)"; btnOptionalSkip.classList.remove('hidden'); }
    } else if (s.currentStage === 'witch' || s.currentStage === 'awaken_witch') {
        let titleName = s.currentStage === 'awaken_witch' ? '覺醒女巫' : '女巫';
        nightRoleTitle.textContent = `🧪 ${titleName}行動`; numberPad.classList.add('hidden');
        let target = s.isSeedWolfInfecting ? null : (s.wolfKillTarget ? getActualTarget(parseInt(s.wolfKillTarget)) : null);
        document.getElementById('witch-actions').classList.remove('hidden');
        if (!target) {
            document.getElementById('witch-info').textContent = `昨晚倒牌的是：【 無 】`;
            document.getElementById('btn-witch-save').disabled = true; document.getElementById('btn-witch-save').style.opacity = "0.5";
        } else {
            document.getElementById('witch-info').textContent = `昨晚倒牌的是：【 ${target} 號 】`;
            const witchSeat = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'witch' || s.playerRoles[k] === 'awaken_witch');
            const rule = document.getElementById('setting-witch-rule').checked ? 'can_save' : 'cannot_save';
            if (target === getActualTarget(parseInt(witchSeat)) && rule === 'cannot_save') {
                document.getElementById('btn-witch-save').disabled = true; document.getElementById('btn-witch-save').textContent = "解藥 (不可自救)"; document.getElementById('btn-witch-save').style.opacity = "0.5";
            } else {
                document.getElementById('btn-witch-save').disabled = false; document.getElementById('btn-witch-save').textContent = "解藥 (救)"; document.getElementById('btn-witch-save').style.opacity = "1";
            }
        }
    } else if (s.currentStage === 'hunter') {
        nightRoleTitle.textContent = "🎯 獵人行動"; nightInstruction.textContent = "請確認你今晚的開槍狀態：";
        numberPad.classList.add('hidden'); document.getElementById('hunter-status').classList.remove('hidden');
        btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "了解並閉眼";
        
        // 預先計算夜晚死亡，提前判斷獵人是否被毒或殉情
        calculateNightDeaths();
        const hSeat = parseInt(Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'hunter'));
        if (s.witchPoisonTarget === hSeat || s.chainKilled.includes(hSeat)) {
            document.getElementById('hunter-status-text').textContent = "🚫 不能開槍"; document.getElementById('hunter-status-text').style.color = "#e94560";
        } else {
            document.getElementById('hunter-status-text').textContent = "🔫 可以開槍"; document.getElementById('hunter-status-text').style.color = "#00ff88";
        }
    } else if (s.currentStage.startsWith('notify_')) {
        let seat = parseInt(s.currentStage.split('_').pop());
        nightRoleTitle.textContent = `${seat}號確認狀態`; nightInstruction.textContent = "請點擊下方按鈕確認狀態：";
        numberPad.classList.add('hidden'); actionPad.innerHTML = `<button class="primary-btn" id="btn-view-status" style="width:200px;">查看狀態</button>`; actionPad.classList.remove('hidden');
        document.getElementById('btn-view-status').onclick = () => {
            actionPad.classList.add('hidden'); let msgs = [];
            if (s.cupidLovers.includes(seat)) msgs.push("你是情侶 💕");
            if (s.merchantTarget === seat && !wolfFaction.includes(s.playerRoles[seat])) msgs.push(`你是幸運兒 🎁`);
            if (s.awakenWitchAssistant === seat) msgs.push(`你是女巫的協助者`);
            if (s.seedWolfTarget === seat) msgs.push(`你被種狼感染成了狼人！🐺`);
            if (s.awakenGargoyleTarget === seat) msgs.push(`你被覺醒石像鬼轉化了！🦇`);
            if (s.currentStage.includes('bride') && s.ghostBrideGroom === seat) msgs.push(`你是鬼魅新娘的新郎 🤵`);
            
            document.getElementById('skill-result-text').innerHTML = msgs.length ? msgs.join('<br>') : "無特殊狀態";
            document.getElementById('skill-result').classList.remove('hidden');
            btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "了解並閉眼";
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

// ==========================================
// 4. DOMContentLoaded 頁面初始化與按鈕綁定
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 綁定 DOM
    const style = document.createElement('style');
    style.innerHTML = `.action-selected { background-color: #e94560 !important; color: white !important; border: 2px solid #fff !important; transform: scale(1.05); }`;
    document.head.appendChild(style);
    document.querySelector('#screen-start h1').textContent = '🐺 狼人殺 第一天法官';

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
    
    // ✅ 補上在拆分過程中漏掉的警長按鈕宣告
    const btnFinishSheriff = document.getElementById('btn-finish-sheriff');

    const judgeModal = document.getElementById('judge-modal');
    const btnCloseJudge = document.getElementById('btn-close-judge');
    const judgePlayerStatus = document.getElementById('judge-player-status');
    const judgeNightLog = document.getElementById('judge-night-log');

    // 烏鴉按鈕 UI 配置
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

    // 讀取外部 JSON
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
        })
        .catch(err => {
            console.error(err); alert("資料載入失敗！請確保您是透過網頁伺服器開啟 (因同源政策不支援 file:// 直接讀取 JSON)。");
        });

    // 身份設定視窗
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
            btnStartNight.classList.remove('hidden');
            return;
        }
        let dispRole = s.playerRoles[s.currentViewingSeat];
        container.innerHTML = `
            <button id="btn-view-role" class="num-btn" style="width:100%; padding:30px; font-size:22px;">點擊查看 ${s.currentViewingSeat} 號 身分</button>
            <div id="view-role-result" class="hidden" style="background:#24345e; padding:30px; border-radius:12px; width:100%; border:2px solid #fca311;">
                <p style="margin:0; color:#a2a8d3; font-size:18px;">你的身分是：</p>
                <p style="font-size:40px; margin:10px 0; font-weight:bold; color:#fca311;">
                    ${s.ROLE_DICT[dispRole].icon} ${s.ROLE_DICT[dispRole].name}
                </p>
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
            roleSetupGrid.classList.add('hidden'); if(pTag) pTag.classList.add('hidden'); btnStartNight.classList.add('hidden');
            if (!document.getElementById('random-role-ui')) {
                let rrDiv = document.createElement('div'); rrDiv.id = 'random-role-ui';
                rrDiv.style = "margin-top:20px; display:flex; flex-direction:column; gap:15px; align-items:center;";
                roleSetupGrid.parentNode.insertBefore(rrDiv, roleSetupGrid);
            }
            document.getElementById('random-role-ui').classList.remove('hidden');
            let rolesArr = [];
            for (let r in s.currentBoard.roles) { 
                if (r === 'seer_A' || r === 'seer_B') { rolesArr.push(r); continue; }
                for (let i=0; i<s.currentBoard.roles[r]; i++) rolesArr.push(r); 
            }
            rolesArr.sort(() => Math.random() - 0.5);
            for (let i = 1; i <= s.totalPlayers; i++) {
                s.playerRoles[i] = rolesArr[i-1];
                s.playerStatus[i] = { poisoned: false, injured: false, isWhiteCatFlipped: false, isVWK: false };
            }
            s.currentViewingSeat = 1; renderRandomRoleView();
        } else {
            roleSetupGrid.classList.remove('hidden'); if(pTag) pTag.classList.remove('hidden'); btnStartNight.classList.remove('hidden');
            if (document.getElementById('random-role-ui')) document.getElementById('random-role-ui').classList.add('hidden');
            roleSetupGrid.innerHTML = '';
            for (let i = 1; i <= s.totalPlayers; i++) {
                s.playerRoles[i] = null; s.playerStatus[i] = { poisoned: false, injured: false, isWhiteCatFlipped: false, isVWK: false };
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

            if (s.currentBoard.id === '12_thief_cupid') {
                s.spareCards = []; let tempBoard = {...s.currentBoard.roles};
                for (let i = 1; i <= 12; i++) tempBoard[s.playerRoles[i]]--;
                for (let r in tempBoard) { while (tempBoard[r] > 0) { s.spareCards.push(r); tempBoard[r]--; } }
                if (s.spareCards.filter(r => wolfFaction.includes(r)).length === 2) { alert("底牌為雙狼，此局必須重開！"); return btnReset.click(); }
            } else {
                for (const [roleId, reqCount] of Object.entries(s.currentBoard.roles)) {
                    if ((currentCounts[roleId] || 0) !== reqCount) { isMatch = false; errorMsg += `${s.ROLE_DICT[roleId].name}: 配置數量錯誤\n`; }
                }
            }
            if (!isMatch) return alert(errorMsg);
        }

        if (s.currentBoard.id === '12_shadow' && !s.isRandomMode) {
            let sA = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'seer_A');
            let sB = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'seer_B');
            if (Math.random() > 0.5) { s.playerRoles[sA] = 'seer'; s.playerRoles[sB] = 'shadow_seer'; } 
            else { s.playerRoles[sA] = 'shadow_seer'; s.playerRoles[sB] = 'seer'; }
        }

        if (s.currentBoard.id === '12_variable_wolf') {
            let godSeats = Object.keys(s.playerRoles).filter(k => ['seer', 'witch', 'hunter', 'dreamwalker', 'bear'].includes(s.playerRoles[k]));
            s.vwkSeat = parseInt(godSeats[Math.floor(Math.random() * godSeats.length)]);
            s.playerStatus[s.vwkSeat].isVWK = true;
        }

        let wSeats = Object.keys(s.playerRoles).filter(k => wolfFaction.includes(s.playerRoles[k]) && !['eclipse_maid', 'hidden_wolf'].includes(s.playerRoles[k]));
        if (wSeats.length > 0) s.phantomKnownWolf = wSeats[Math.floor(Math.random() * wSeats.length)];
        
        let thiefKey = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'thief');
        s.initialThiefSeat = thiefKey ? parseInt(thiefKey) : null;

        buildNightQueue(); s.nightActionLog = []; lockModal.classList.remove('hidden');
    });

    document.getElementById('btn-cancel-lock').addEventListener('click', () => lockModal.classList.add('hidden'));
    document.getElementById('btn-confirm-lock').addEventListener('click', () => {
        lockModal.classList.add('hidden'); screenSetup.classList.add('hidden'); screenNight.classList.remove('hidden');
        document.getElementById('number-pad').classList.add('hidden');
        document.getElementById('night-role-title').textContent = "🐺 黑夜降臨";
        document.getElementById('night-instruction').textContent = "請大家閉上眼睛...";
        speak("天黑請閉眼。", runNextNightRole);
    });

    // 核心動作綁定
    btnConfirmAction.addEventListener('click', () => {
        if (s.currentRoleFeared) {
            let roleLog = getStageVoiceName(s.currentStage, s.currentSubLabel);
            if (s.currentStage === 'seer' && s.playerRoles[s.currentActorSeat] === 'shadow_seer') roleLog = '燈影預言家';
            s.nightActionLog.push(`【${roleLog}】被恐懼，跳過技能`);
            btnConfirmAction.classList.add('hidden'); speak(`${getStageVoiceName(s.currentStage, s.currentSubLabel)}請閉眼。`, runNextNightRole); return;
        }
        if (['wolf_brother_meet', 'wolf_gun_confirm', 'wolf_meet', 'lovers_meet', 'hidden_wolf', 'curse_fox', 'ghost_bride_witness', 'awaken_dreamwalker_result'].includes(s.currentStage) || s.currentStage.startsWith('notify_') || s.currentStage === 'bear') {
            btnConfirmAction.classList.add('hidden'); document.getElementById('skill-result').classList.add('hidden'); document.getElementById('action-pad').classList.add('hidden');
            if (s.currentStage === 'wolf_meet') s.nightActionLog.push(`狼人互相確認身分，首夜不刀人`);
            if (s.currentStage === 'hidden_wolf') s.nightActionLog.push(`隱狼確認了狼隊友`);
            let v = getStageVoiceName(s.currentStage, s.currentSubLabel);
            if (s.currentStage === 'wolf_meet' && Object.values(s.playerRoles).includes('little_girl')) v = "狼隊和小女孩";
            speak(`${v}請閉眼。`, runNextNightRole); return;
        }

        const needsResultRoles = ['seer', 'diviner', 'real_fox', 'awaken_seer', 'gargoyle', 'psychic', 'pure_white', 'wolf_witch', 'machine_wolf'];
        if (needsResultRoles.includes(s.currentStage) && s.selectedNumber !== 'skip' && !s.isShowingResult) {
            let isVWKTurn = (s.currentStage === 'variable_wolf_king'); 
            document.getElementById('number-pad').classList.add('hidden'); document.getElementById('skill-result').classList.remove('hidden');
            btnConfirmAction.textContent = "了解並閉眼"; document.getElementById('btn-optional-skip').classList.add('hidden');
            
            let txt = document.getElementById('skill-result-text'); let lbl = document.getElementById('skill-result-label');
            if (s.currentStage === 'awaken_seer') {
                lbl.textContent = "兩名玩家的陣營為：";
                s.awakenSeerTargets = [ applyTimeWolfReflection(getActualTarget(s.selectedNumbersArr[0]), s.currentActorSeat), applyTimeWolfReflection(getActualTarget(s.selectedNumbersArr[1]), s.currentActorSeat) ];
                let isEvil = evilRoles.includes(s.playerRoles[s.awakenSeerTargets[0]]) || evilRoles.includes(s.playerRoles[s.awakenSeerTargets[1]]);
                if (isEvil && !['hidden_wolf', 'ghost_bride'].includes(s.playerRoles[s.awakenSeerTargets[0]]) && !['hidden_wolf', 'ghost_bride'].includes(s.playerRoles[s.awakenSeerTargets[1]])) { txt.textContent = "🐺 疑似狼人"; txt.style.color = "#e94560"; } 
                else { txt.textContent = "🧑‍🌾 雙好人"; txt.style.color = "#00ff88"; }
            } else if (s.currentStage === 'real_fox') {
                lbl.textContent = "查驗範圍的陣營為：";
                let t = parseInt(s.selectedNumber); let p1 = t - 1 < 1 ? s.totalPlayers : t - 1; let p2 = t + 1 > s.totalPlayers ? 1 : t + 1;
                let hW = wolfFaction.includes(s.playerRoles[t]) || wolfFaction.includes(s.playerRoles[p1]) || wolfFaction.includes(s.playerRoles[p2]);
                if (hW) { txt.textContent = "🐺 有狼人"; txt.style.color = "#e94560"; } else { txt.textContent = "🧑‍🌾 無狼人"; txt.style.color = "#00ff88"; }
            } else {
                let actualTarget = applyTimeWolfReflection(getActualTarget(parseInt(s.selectedNumber)), s.currentActorSeat);
                if (['seer', 'diviner'].includes(s.currentStage)) {
                    s.seerTarget = actualTarget; let targetRole = s.playerRoles[actualTarget];
                    let isEvil = evilRoles.includes(targetRole) || s.playerStatus[actualTarget]?.isVWK;
                    if (['hidden_wolf', 'wolf_brother_little', 'ghost_bride'].includes(targetRole)) isEvil = false;
                    if (s.playerRoles[s.currentActorSeat] === 'shadow_seer') isEvil = !isEvil; 
                    if (isEvil) { txt.textContent = "🐺 狼人 (壞人)"; txt.style.color = "#e94560"; } else { txt.textContent = "🧑‍🌾 好人"; txt.style.color = "#00ff88"; }
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
            s.isShowingResult = true; return;
        }

        // 進行 Action Log 的推演
        btnConfirmAction.classList.add('hidden'); document.getElementById('btn-optional-skip').classList.add('hidden'); document.getElementById('number-pad').classList.add('hidden'); document.getElementById('skill-result').classList.add('hidden');
        
        if (s.currentStage === 'wolf_crow') { s.wolfCrowMark = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)); s.nightActionLog.push(s.wolfCrowMark ? `狼鴉之爪標記了 ${s.wolfCrowMark}號` : `狼鴉之爪未標記`); }
        else if (s.currentStage === 'thief') { s.playerRoles[Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'thief')] = s.thiefChosenRole; s.discardedRoles = s.spareCards.filter(r => r !== s.thiefChosenRole); s.nightActionLog.push(`盜賊選擇 ${s.ROLE_DICT[s.thiefChosenRole].name}`); buildNightQueue(); }
        else if (s.currentStage === 'cupid') { s.cupidLovers = [...s.selectedNumbersArr]; s.nightActionLog.push(`邱比特連接了 ${s.cupidLovers.join('和')}號`); }
        else if (['half_blood', 'wild_child', 'awaken_lonely_girl'].includes(s.currentStage)) {
            let t = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber));
            if (s.currentStage === 'half_blood') s.halfBloodTarget = t; if (s.currentStage === 'wild_child') s.wildChildTarget = t; if (s.currentStage === 'awaken_lonely_girl') s.lonelyGirlTarget = t;
            s.nightActionLog.push(t ? `${s.ROLE_DICT[s.currentStage].name}選擇了 ${t}號` : `${s.ROLE_DICT[s.currentStage].name}未選擇`);
        }
        else if (s.currentStage === 'ghost_bride') { s.ghostBrideGroom = getActualTarget(parseInt(s.selectedNumber)); s.nightActionLog.push(`鬼魅新娘選擇了 ${s.ghostBrideGroom}號為新郎`); }
        else if (s.currentStage === 'ghost_bride_couple') { s.ghostBrideWitness = getActualTarget(parseInt(s.selectedNumber)); s.nightActionLog.push(`鬼魅新娘與新郎選擇了 ${s.ghostBrideWitness}號為證婚人`); }
        else if (s.currentStage === 'awaken_dreamwalker') { s.awakenDreamwalkerTarget = getActualTarget(parseInt(s.selectedNumber)); s.nightActionLog.push(`覺醒攝夢人指定了 ${s.awakenDreamwalkerTarget}號為夢語者`); }
        else if (s.currentStage === 'time_wolf') { s.timeWolfTarget = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)); s.nightActionLog.push(s.timeWolfTarget ? `蝕時狼妃封鎖了 ${s.timeWolfTarget}號` : `蝕時狼妃未封鎖`); }
        else if (s.currentStage === 'awaken_idiot') { s.awakenIdiotTarget = applyTimeWolfReflection((s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)), s.currentActorSeat); s.nightActionLog.push(s.awakenIdiotTarget ? `覺醒白痴守護了 ${s.awakenIdiotTarget}號` : `覺醒白痴未守護`); }
        else if (s.currentStage === 'crow') { s.crowTarget = applyTimeWolfReflection((s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)), s.currentActorSeat); s.nightActionLog.push(s.crowTarget ? `烏鴉詛咒了 ${s.crowTarget}號` : `烏鴉未詛咒`); }
        else if (['magician', 'trickster', 'wolf_sorcerer'].includes(s.currentStage)) {
            let swap = (s.selectedNumber === 'skip') ? [] : [...s.selectedNumbersArr];
            if (s.currentStage === 'magician') s.magicianSwap = swap; if (s.currentStage === 'trickster') s.tricksterSwap = swap; if (s.currentStage === 'wolf_sorcerer') s.wolfSorcererSwap = swap;
            s.nightActionLog.push(swap.length ? `${s.ROLE_DICT[s.currentStage].name}交換了 ${swap[0]}號 和 ${swap[1]}號` : `${s.ROLE_DICT[s.currentStage].name}未交換`);
        }
        else if (s.currentStage === 'phantom') { s.phantomTargets = (s.selectedNumber === 'skip') ? [] : [getActualTarget(s.selectedNumbersArr[0]), getActualTarget(s.selectedNumbersArr[1])]; }
        else if (s.currentStage === 'nightmare') { s.nightmareTarget = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)); s.nightActionLog.push(s.nightmareTarget ? `夢魘恐懼了 ${s.nightmareTarget}號` : `夢魘未恐懼`); }
        else if (s.currentStage === 'guard') { s.guardTarget = applyTimeWolfReflection((s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)), s.currentActorSeat); s.nightActionLog.push(s.guardTarget ? `守衛守護了 ${s.guardTarget}號` : `守衛空守`); }
        else if (s.currentStage === 'dreamwalker') { s.dreamTarget = applyTimeWolfReflection(getActualTarget(parseInt(s.selectedNumber)), s.currentActorSeat); s.nightActionLog.push(`攝夢人攝夢了 ${s.dreamTarget}號`); }
        else if (s.currentStage === 'awaken_wolf_king_gun') { s.awakenWolfGunTarget = (s.selectedNumber === 'skip') ? null : parseInt(s.selectedNumber); }
        else if (s.currentStage === 'wolf') { 
            if (s.isSeedWolfInfecting) { s.seedWolfTarget = getActualTarget(parseInt(s.selectedNumber)); s.wolfKillTarget = null; if(s.seedWolfTarget) s.playerRoles[s.seedWolfTarget] = 'wolf'; }
            else { s.wolfKillTarget = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)); }
        }
        else if (s.currentStage === 'big_bad_wolf') { s.bigBadWolfKillTarget = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)); s.nightActionLog.push(s.bigBadWolfKillTarget ? `大野狼擊殺了 ${s.bigBadWolfKillTarget}號` : `大野狼空刀`); }
        else if (s.currentStage === 'alchemist_fog') { s.alchemistFogTargets = (s.selectedNumber === 'skip') ? [] : [...s.selectedNumbersArr]; s.nightActionLog.push(s.alchemistFogTargets.length ? `煉金魔女對 ${s.alchemistFogTargets.join(', ')}號 施放未名之霧` : `煉金未放霧`); }
        else if (s.currentStage === 'awaken_gargoyle') { s.awakenGargoyleTarget = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)); }
        else if (s.currentStage === 'witch') {
            if (s.selectedNumber === 'skip') { s.witchPoisonTarget = null; } else if (s.selectedNumber === 'witch_save') { s.witchSaved = true; } else if (typeof s.selectedNumber === 'number') { s.witchPoisonTarget = applyTimeWolfReflection(getActualTarget(s.selectedNumber), s.currentActorSeat); }
            document.getElementById('witch-actions').classList.add('hidden');
        }

        s.nightActionLog.push(`完成 ${s.ROLE_DICT[s.currentStage]?.name || s.currentStage} 的操作`);
        let v = getStageVoiceName(s.currentStage, s.currentSubLabel);
        if (s.currentStage === 'wolf' && Object.values(s.playerRoles).includes('little_girl')) v = "狼隊和小女孩";
        speak(`${v}請閉眼。`, runNextNightRole);
    });

    btnOptionalSkip.addEventListener('click', () => {
        if (s.currentStage === 'wolf' && document.getElementById('btn-optional-skip').textContent === "返回選單") {
            resetSelections(); document.getElementById('number-pad').classList.add('hidden'); document.getElementById('action-pad').classList.remove('hidden'); 
            document.getElementById('btn-optional-skip').classList.add('hidden'); btnConfirmAction.classList.add('hidden'); s.isSeedWolfInfecting = false; return;
        }
        resetSelections(); document.getElementById('btn-optional-skip').classList.add('action-selected'); s.selectedNumber = 'skip'; btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認";
        if (s.currentStage === 'awaken_witch') s.awakenWitchStep = null;
    });

    // 警長與天亮結算
    btnFinishSheriff.addEventListener('click', () => {
        screenSheriff.classList.add('hidden'); 
        showDayResult();
    });

    // 查看法官紀錄
    btnShowJudge.addEventListener('click', () => {
        let statusHtml = '';
        for (let i = 1; i <= s.totalPlayers; i++) {
            let role = s.playerRoles[i]; let statusStrs = [];
            if (s.finalKilled.includes(i)) statusStrs.push("💀 死亡");
            if (s.playerStatus[i].poisoned) statusStrs.push("🧪 中毒");
            if (s.playerStatus[i].injured) statusStrs.push("🏹 負傷");
            if (s.playerStatus[i].isWhiteCatFlipped) statusStrs.push("🐱 已翻牌");
            if (s.playerStatus[i].isVWK) statusStrs.push("🎭 百變狼王");
            if (s.dreamTarget === i) statusStrs.push("💤 被攝夢");
            if (s.guardTarget === i) statusStrs.push("🛡️ 被守護");
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
            if (s.awakenDreamwalkerTarget === i) statusStrs.push("💤 夢語者");
            if (s.ghostBrideGroom === i) statusStrs.push("🤵 新郎");
            if (s.ghostBrideWitness === i) statusStrs.push("🕊️ 證婚人");
            if (s.rustSwordInfectedTarget === i) statusStrs.push("🦠 傷口感染");
            
            let statusBadge = statusStrs.length > 0 ? `<span style="color:#fca311;">(${statusStrs.join(', ')})</span>` : '';
            let thiefTag = (i === s.initialThiefSeat) ? '(盜賊)' : '';
            statusHtml += `<div style="margin-bottom:5px;"><b>${i}號</b> ${s.ROLE_DICT[role]?.icon}${s.ROLE_DICT[role]?.name}${thiefTag} ${statusBadge}</div>`;
        }
        judgePlayerStatus.innerHTML = statusHtml;
        judgeNightLog.innerHTML = s.nightActionLog.map(log => `<div style="margin-bottom:5px;">• ${log}</div>`).join('');
        judgeModal.classList.remove('hidden');
    });

    btnCloseJudge.addEventListener('click', () => judgeModal.classList.add('hidden'));

    // Reset logic
    btnReset.addEventListener('click', () => {
        s.nightQueue = []; s.currentStage = null; s.wolfKillTarget = null; s.witchPoisonTarget = null; s.witchSaved = false;
        s.guardTarget = null; s.dreamTarget = null; s.magicianSwap = []; s.tricksterSwap = []; s.wolfSorcererSwap = []; s.nightmareTarget = null; s.gargoyleTarget = null;
        s.beautyTarget = null; s.machineWolfTarget = null; s.phantomTargets = []; s.awakenSeerTargets = []; s.awakenBeautyTarget = null; s.wolfCrowMark = null;
        s.phantomKnownWolf = null; s.selectedNumber = null; s.currentEditingSeat = null; s.finalKilled = []; s.dayShootersQueue = [];
        s.ghostRiderReflected = false; s.nightActionLog = []; s.pufferfishTriggered = false; s.whiteCatFlippedLastNight = false;
        s.spareCards = []; s.discardedRoles = []; s.initialThiefSeat = null; s.thiefChosenRole = null; s.cupidLovers = []; s.merchantTarget = null; s.merchantItem = null;
        s.awakenWitchStep = null; s.awakenWitchAssistant = null; s.alchemistFogTargets = []; s.alchemistSnakeUsed = false; s.vwkSeat = null; s.awakenWolfGunTarget = null;
        s.halfBloodTarget = null; s.wildChildTarget = null; s.lonelyGirlTarget = null; s.timeWolfTarget = null; s.awakenIdiotTarget = null; s.crowTarget = null;
        s.seedWolfTarget = null; s.isSeedWolfInfecting = false; s.awakenGargoyleTarget = null; s.awakenDreamwalkerTarget = null; s.ghostBrideGroom = null; s.ghostBrideWitness = null;
        s.primaryKilled = []; s.chainKilled = []; s.currentSubLabel = null; s.isFakeWake = false; s.currentRoleFeared = false; s.rustSwordInfectedTarget = null; s.bigBadWolfKillTarget = null;
        
        let tCalc = document.getElementById('trickster-calc'); if (tCalc) tCalc.remove();
        document.getElementById('crow-record-panel').classList.add('hidden');
        screenDay.classList.add('hidden'); screenStart.classList.remove('hidden');
    });
});
