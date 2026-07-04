// js/main.js
import { s, getStageVoiceName, getActualTarget, applyTimeWolfReflection, wolfFaction, evilRoles, speak } from './core.js';
import { createNumberPad, resetSelections } from './night.js';
import { calculateNightDeaths, proceedDayResultRender, handleChainDeaths } from './day.js';

document.addEventListener('DOMContentLoaded', () => {
    // 綁定 DOM 常用元素
    const btnConfirmAction = document.getElementById('btn-confirm-action');
    const btnOptionalSkip = document.getElementById('btn-optional-skip'); 
    const numberPad = document.getElementById('number-pad');
    const actionPad = document.getElementById('action-pad');
    const nightRoleTitle = document.getElementById('night-role-title');
    const nightInstruction = document.getElementById('night-instruction');
    const skillResult = document.getElementById('skill-result');
    const witchActions = document.getElementById('witch-actions');
    const hunterStatus = document.getElementById('hunter-status');

    // 讀取外部 JSON
    fetch('data.json')
        .then(res => res.json())
        .then(data => {
            s.ROLE_DICT = data.ROLE_DICT;
            s.BOARD_CONFIGS = data.BOARD_CONFIGS;
            
            const countSelect = document.getElementById('setting-player-count');
            const updateBoards = () => {
                if (!s.BOARD_CONFIGS || Object.keys(s.BOARD_CONFIGS).length === 0) return;
                const count = countSelect.value;
                const boards = s.BOARD_CONFIGS[count] || [];
                const settingBoard = document.getElementById('setting-board');
                settingBoard.innerHTML = '';
                boards.forEach(b => {
                    const opt = document.createElement('option');
                    opt.value = b.id; opt.textContent = b.name; settingBoard.appendChild(opt);
                });
            };
            countSelect.addEventListener('change', updateBoards);
            updateBoards();
        })
        .catch(err => {
            console.error(err); alert("資料載入失敗！請使用 Live Server 或網頁伺服器開啟。");
        });

    // 動態構建夜晚排隊陣列
    function buildNightQueue() {
        s.nightQueue = [];
        let activeRoles = Object.values(s.playerRoles);
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
            pushStage(s.currentBoard.id === '12_animals' ? 'wolf_meet' : 'wolf', 210);
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

        if (s.currentBoard.id === '12_shadow') {
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

    // 將 runNextNightRole 封裝為全域可呼叫的模組函數
    export function runNextNightRole() {
        btnConfirmAction.classList.add('hidden'); btnOptionalSkip.classList.add('hidden');
        witchActions.classList.add('hidden'); skillResult.classList.add('hidden'); hunterStatus.classList.add('hidden');
        numberPad.classList.add('hidden'); actionPad.classList.add('hidden');
        
        resetSelections(); s.isShowingResult = false; s.currentRoleFeared = false; s.isFakeWake = false; s.currentSubLabel = null; s.awakenWitchStep = null; s.isSeedWolfInfecting = false;

        if (s.nightQueue.length === 0) {
            nightRoleTitle.textContent = "🌅 天亮結算中";
            nightInstruction.textContent = "法官正在處理昨晚的行動結果...";
            calculateNightDeaths();
            let morningVoice = document.getElementById('setting-sheriff').checked ? "要競選警長的請舉手，三秒後天亮，三、二、一。" : "三秒後天亮，三、二、一。";
            speak(morningVoice, () => {
                if (document.getElementById('setting-sheriff').checked) {
                    document.getElementById('screen-night').classList.add('hidden'); document.getElementById('screen-sheriff').classList.remove('hidden');
                } else {
                    document.getElementById('screen-night').classList.add('hidden'); document.getElementById('screen-day').classList.remove('hidden'); proceedDayResultRender();
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
            speak(`${getStageVoiceName(s.currentStage, s.currentSubLabel)}請睜眼。`, () => { setTimeout(() => { speak(`${getStageVoiceName(s.currentStage, s.currentSubLabel)}請閉眼。`, runNextNightRole); }, waitTime); });
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
        
        // --- 根據 stage 設定畫面 UI 與引導文字 ---
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
            if (['ghost_bride', 'ghost_bride_couple', 'awaken_dreamwalker'].includes(s.currentStage)) { nightInstruction.textContent = "請選擇你的目標對象 (必須選擇)："; if (s.currentStage === 'ghost_bride_couple') nightInstruction.textContent = "請選擇你們的證婚人 (必須選擇)："; } 
            else { nightInstruction.textContent = "請選擇你的目標對象 (或跳過)："; btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden'); }
        } else if (s.currentStage === 'ghost_bride_witness') {
            nightRoleTitle.textContent = "🕊️ 證婚人確認"; 
            let gb = Object.keys(s.playerRoles).find(k=>s.playerRoles[k]==='ghost_bride');
            nightInstruction.innerHTML = `鬼魅新娘是：<span style='color:#e94560;'>${gb}號</span><br>新郎是：<span style='color:#e94560;'>${s.ghostBrideGroom}號</span>`;
            numberPad.classList.add('hidden'); btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認並閉眼";
        } else if (s.currentStage === 'hidden_wolf') {
            nightRoleTitle.textContent = "🐺 隱狼確認";
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
            nightInstruction.innerHTML = `請點擊擊殺目標號碼 (或空刀)：<br><span style="color:#e94560; font-size:16px;">🐺 睜眼名單：${hasLG ? wText : wText}</span>${crowText}`;
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
            
            let tempPrimary = []; let tempChain = []; let tempKilled = [];
            let wTarget = s.wolfKillTarget; if (wTarget && s.witchSaved) wTarget = null;
            if (wTarget) tempPrimary.push(parseInt(wTarget));
            if (s.witchPoisonTarget) tempPrimary.push(parseInt(s.witchPoisonTarget));
            
            let dwSeat = Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'dreamwalker');
            [dwSeat].forEach(seat => { if (seat && tempPrimary.includes(parseInt(seat)) && s.dreamTarget) { tempChain.push(s.dreamTarget); tempKilled.push(s.dreamTarget); } });
            if (s.phantomTargets.length === 2) {
                if (tempPrimary.includes(s.phantomTargets[0])) tempChain.push(s.phantomTargets[1]);
                else if (tempPrimary.includes(s.phantomTargets[1])) tempChain.push(s.phantomTargets[0]);
            }
            if (s.cupidLovers.length === 2) {
                if (tempPrimary.includes(s.cupidLovers[0])) tempChain.push(s.cupidLovers[1]);
                else if (tempPrimary.includes(s.cupidLovers[1])) tempChain.push(s.cupidLovers[0]);
            }

            const hSeat = parseInt(Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'hunter'));
            if (s.witchPoisonTarget === hSeat || tempChain.includes(hSeat)) {
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
            // 剩下的常規版子，一律開啟跳過與確認按鈕
            btnOptionalSkip.textContent = "跳過"; btnOptionalSkip.classList.remove('hidden');
            let name = getStageVoiceName(s.currentStage, s.currentSubLabel);
            nightRoleTitle.textContent = `${s.ROLE_DICT[s.currentStage]?.icon || '🎭'} ${name}行動`;
        }

        let voiceName = getStageVoiceName(s.currentStage, s.currentSubLabel);
        if (s.currentStage === 'wolf' && Object.values(s.playerRoles).includes('little_girl')) voiceName = "狼隊和小女孩";
        speak(`${voiceName}請睜眼。`);
    }

    // 將主要的 Confirm 動作獨立，避免過長
    btnConfirmAction.addEventListener('click', () => {
        if (s.currentRoleFeared) {
            let roleLog = getStageVoiceName(s.currentStage, s.currentSubLabel);
            s.nightActionLog.push(`【${roleLog}】被恐懼，跳過技能`);
            btnConfirmAction.classList.add('hidden'); speak(`${roleLog}請閉眼。`, runNextNightRole); return;
        }
        if (['wolf_brother_meet', 'wolf_gun_confirm', 'wolf_meet', 'lovers_meet', 'hidden_wolf', 'curse_fox', 'ghost_bride_witness', 'awaken_dreamwalker_result'].includes(s.currentStage) || s.currentStage.startsWith('notify_') || s.currentStage === 'bear') {
            btnConfirmAction.classList.add('hidden'); document.getElementById('skill-result').classList.add('hidden'); actionPad.classList.add('hidden');
            let v = getStageVoiceName(s.currentStage, s.currentSubLabel);
            if (s.currentStage === 'wolf_meet' && Object.values(s.playerRoles).includes('little_girl')) v = "狼隊和小女孩";
            speak(`${v}請閉眼。`, runNextNightRole); return;
        }

        // 查驗類需要先看結果
        const needsResultRoles = ['seer', 'diviner', 'real_fox', 'awaken_seer', 'gargoyle', 'psychic', 'pure_white', 'wolf_witch', 'machine_wolf'];
        if (needsResultRoles.includes(s.currentStage) && s.selectedNumber !== 'skip' && !s.isShowingResult) {
            numberPad.classList.add('hidden'); document.getElementById('skill-result').classList.remove('hidden');
            btnConfirmAction.textContent = "了解並閉眼"; btnOptionalSkip.classList.add('hidden');

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

        // 行動 Log
        btnConfirmAction.classList.add('hidden'); btnOptionalSkip.classList.add('hidden'); numberPad.classList.add('hidden'); document.getElementById('skill-result').classList.add('hidden');
        
        if (s.currentStage === 'wolf_crow') { s.wolfCrowMark = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)); }
        else if (s.currentStage === 'thief') { s.playerRoles[Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'thief')] = s.thiefChosenRole; s.discardedRoles = s.spareCards.filter(r => r !== s.thiefChosenRole); buildNightQueue(); }
        else if (s.currentStage === 'cupid') { s.cupidLovers = [...s.selectedNumbersArr]; }
        else if (['half_blood', 'wild_child', 'awaken_lonely_girl'].includes(s.currentStage)) {
            let t = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber));
            if (s.currentStage === 'half_blood') s.halfBloodTarget = t; if (s.currentStage === 'wild_child') s.wildChildTarget = t; if (s.currentStage === 'awaken_lonely_girl') s.lonelyGirlTarget = t;
        }
        else if (s.currentStage === 'ghost_bride') { s.ghostBrideGroom = getActualTarget(parseInt(s.selectedNumber)); }
        else if (s.currentStage === 'ghost_bride_couple') { s.ghostBrideWitness = getActualTarget(parseInt(s.selectedNumber)); }
        else if (s.currentStage === 'time_wolf') { s.timeWolfTarget = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)); }
        else if (s.currentStage === 'awaken_idiot') { s.awakenIdiotTarget = applyTimeWolfReflection((s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)), s.currentActorSeat); }
        else if (s.currentStage === 'crow') { s.crowTarget = applyTimeWolfReflection((s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)), s.currentActorSeat); }
        else if (['magician', 'trickster', 'wolf_sorcerer'].includes(s.currentStage)) {
            let swap = (s.selectedNumber === 'skip') ? [] : [...s.selectedNumbersArr];
            if (s.currentStage === 'magician') s.magicianSwap = swap; if (s.currentStage === 'trickster') s.tricksterSwap = swap; if (s.currentStage === 'wolf_sorcerer') s.wolfSorcererSwap = swap;
        }
        else if (s.currentStage === 'phantom') { s.phantomTargets = (s.selectedNumber === 'skip') ? [] : [getActualTarget(s.selectedNumbersArr[0]), getActualTarget(s.selectedNumbersArr[1])]; }
        else if (s.currentStage === 'nightmare') { s.nightmareTarget = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)); }
        else if (s.currentStage === 'guard') { s.guardTarget = applyTimeWolfReflection((s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)), s.currentActorSeat); }
        else if (s.currentStage === 'dreamwalker') { s.dreamTarget = applyTimeWolfReflection(getActualTarget(parseInt(s.selectedNumber)), s.currentActorSeat); }
        else if (s.currentStage === 'awaken_wolf_king_gun') { s.awakenWolfGunTarget = (s.selectedNumber === 'skip') ? null : parseInt(s.selectedNumber); }
        else if (s.currentStage === 'wolf') { 
            if (s.isSeedWolfInfecting) { s.seedWolfTarget = getActualTarget(parseInt(s.selectedNumber)); s.wolfKillTarget = null; if(s.seedWolfTarget) s.playerRoles[s.seedWolfTarget] = 'wolf'; }
            else { s.wolfKillTarget = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)); }
        }
        else if (s.currentStage === 'big_bad_wolf') { s.bigBadWolfKillTarget = (s.selectedNumber === 'skip') ? null : getActualTarget(parseInt(s.selectedNumber)); }
        else if (s.currentStage === 'alchemist_fog') { s.alchemistFogTargets = (s.selectedNumber === 'skip') ? [] : [...s.selectedNumbersArr]; }
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
        if (s.currentStage === 'wolf' && btnOptionalSkip.textContent === "返回選單") {
            resetSelections(); numberPad.classList.add('hidden'); actionPad.classList.remove('hidden'); btnOptionalSkip.classList.add('hidden'); btnConfirmAction.classList.add('hidden'); s.isSeedWolfInfecting = false; return;
        }
        resetSelections(); btnOptionalSkip.classList.add('action-selected'); s.selectedNumber = 'skip'; btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認";
    });

    document.getElementById('btn-witch-save').addEventListener('click', () => { resetSelections(); document.getElementById('btn-witch-save').classList.add('action-selected'); s.selectedNumber = 'witch_save'; btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認"; });
    document.getElementById('btn-witch-skip').addEventListener('click', () => { resetSelections(); document.getElementById('btn-witch-skip').classList.add('action-selected'); s.selectedNumber = 'witch_skip'; btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認"; });
    document.getElementById('btn-witch-poison').addEventListener('click', () => { resetSelections(); document.getElementById('btn-witch-poison').classList.add('action-selected'); nightInstruction.textContent = "請選擇你要毒殺的目標 (或取消下毒)："; numberPad.classList.remove('hidden'); btnOptionalSkip.textContent = "取消下毒"; btnOptionalSkip.classList.remove('hidden'); btnConfirmAction.classList.add('hidden'); });

    // 設定重置按鈕
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