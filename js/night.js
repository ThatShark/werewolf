import { s, wolfFaction, getActualTarget, applyTimeWolfReflection } from './core.js';

export function resetSelections() {
    document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
    ['btn-optional-skip', 'btn-witch-save', 'btn-witch-poison', 'btn-witch-skip'].forEach(id => {
        let el = document.getElementById(id);
        if (el) el.classList.remove('action-selected');
    });
    const actionPad = document.getElementById('action-pad');
    if (actionPad) {
        actionPad.innerHTML = ''; actionPad.classList.add('hidden');
    }
    s.selectedNumber = null;
    s.selectedNumbersArr = [];
}

export function createNumberPad() {
    const numberPad = document.getElementById('number-pad');
    numberPad.innerHTML = '';

    // 確認當前真實行動者座位
    let actualCurrentActorSeat = parseInt(Object.keys(s.playerRoles).find(k => s.playerRoles[k] === s.currentStage || s.playerRoles[k] === 'awaken_' + s.currentStage) || -1);
    if (s.currentActorSeat) actualCurrentActorSeat = parseInt(s.currentActorSeat);

    // 修正: 覺醒狼王分槍時，需要正確抓取自己的座位以防自選
    if (s.currentStage === 'awaken_wolf_king_gun') {
        actualCurrentActorSeat = parseInt(Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'awaken_wolf_king'));
    }

    for (let i = 1; i <= s.totalPlayers; i++) {
        const btn = document.createElement('button');
        btn.classList.add('num-btn');
        btn.textContent = i;

        let isDisabled = false;

        // ==========================================
        // 規則 1：狼刀限制規則
        // ==========================================
        if (s.currentStage === 'wolf') {
            // 大狼不可自刀
            if (['white_wolf_king', 'ghost_rider', 'wolf_beauty', 'awaken_wolf_beauty'].includes(s.playerRoles[i])) isDisabled = true;
            // 占卜師標記限制
            if (s.divinerMark) {
                let dm = parseInt(s.divinerMark);
                let p1 = dm - 1 < 1 ? s.totalPlayers : dm - 1;
                let p2 = dm + 1 > s.totalPlayers ? 1 : dm + 1;
                if (i !== dm && i !== p1 && i !== p2) isDisabled = true;
            }
            // 煉金魔女迷霧限制
            if (s.alchemistFogTargets && s.alchemistFogTargets.length > 0) {
                if (!s.alchemistFogTargets.includes(i.toString()) && !s.alchemistFogTargets.includes(i)) isDisabled = true;
            }
        }

        // ==========================================
        // 規則 2：不可自選規則
        // ==========================================
        if (i === actualCurrentActorSeat) {
            const cannotSelectSelf = [
                'witch', 'awaken_witch', 'seer', 'seer_A', 'seer_B', 'bear', 'psychic', 'pure_white', 'dreamwalker', 'awaken_dreamwalker', 'black_market', 'miracle_merchant', 'crow',
                'nightmare', 'gargoyle', 'machine_wolf', 'wolf_beauty', 'awaken_wolf_beauty', 'wolf_witch', 'gray_wolf',
                'half_blood', 'awaken_lonely_girl', 'ghost_bride', 'ghost_bride_couple'                
            ];
            if (cannotSelectSelf.includes(s.currentStage)) isDisabled = true;
        }

        // ==========================================
        // 規則 3：特殊角色選擇目標限制
        // ==========================================
        // 覺醒狼王分槍：限選其他狼隊友
        if (s.currentStage === 'awaken_wolf_king_gun' && (!wolfFaction.includes(s.playerRoles[i]) || i === actualCurrentActorSeat)) isDisabled = true;

        // 鬼魅新娘選證婚人：不能是新郎或自己
        if (s.currentStage === 'ghost_bride_couple' && (i === parseInt(Object.keys(s.playerRoles).find(k => s.playerRoles[k] === 'ghost_bride')) || i === s.ghostBrideGroom)) isDisabled = true;

        // 幸運兒用毒/查驗：不可自點
        if (s.currentStage === 'lucky_boy_action' && ['seer', 'poison'].includes(s.merchantItem) && i === actualCurrentActorSeat) isDisabled = true;

        // 覺醒石像鬼：必須選鄰近座位且不能是其他狼人
        if (['awaken_gargoyle', 'awaken_gargoyle_A', 'awaken_gargoyle_B'].includes(s.currentStage)) {
            let gargoyleSeats = Object.keys(s.playerRoles).filter(k => ['awaken_gargoyle', 'awaken_gargoyle_A', 'awaken_gargoyle_B'].includes(s.playerRoles[k]));
            let adjacentSeats = [];
            gargoyleSeats.forEach(w => {
                let ws = parseInt(w);
                adjacentSeats.push(ws - 1 < 1 ? s.totalPlayers : ws - 1, ws + 1 > s.totalPlayers ? 1 : ws + 1);
            });
            let wSeats = Object.keys(s.playerRoles).filter(k => wolfFaction.includes(s.playerRoles[k]));
            if (!adjacentSeats.includes(i) || wSeats.includes(i.toString())) isDisabled = true;
        }

        if (isDisabled) {
            btn.disabled = true; btn.style.opacity = '0.3'; btn.style.cursor = 'not-allowed';
        }

        // 按鈕點擊綁定邏輯 (保持原本操作邏輯不變)
        btn.addEventListener('click', () => {
            if (s.currentRoleFeared || ['wolf_brother_meet', 'wolf_gun_confirm', 'lovers_meet', 'wolf_meet', 'hidden_wolf', 'curse_fox', 'awaken_dreamwalker_result', 'ghost_bride_witness'].includes(s.currentStage) || s.currentStage.startsWith('notify_')) return;

            const btnConfirmAction = document.getElementById('btn-confirm-action');
            if (s.currentStage === 'awaken_witch' && s.awakenWitchStep === 'poison_target') {
                resetSelections(); btn.classList.add('selected');
                s.selectedNumber = i;
                s.witchPoisonTarget = applyTimeWolfReflection(getActualTarget(parseInt(i)), s.currentActorSeat);
                btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "下一步";
                return;
            }
            if (s.currentStage === 'awaken_witch' && s.awakenWitchStep === 'assistant_target') {
                resetSelections(); btn.classList.add('selected');
                s.awakenWitchAssistant = parseInt(i);
                btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認";
                return;
            }
            if (['magician', 'trickster', 'wolf_sorcerer', 'phantom', 'awaken_seer', 'cupid', 'alchemist'].includes(s.currentStage)) {
                let maxSelect = s.currentStage === 'alchemist' ? 3 : 2;
                if (s.selectedNumber === 'skip') { s.selectedNumber = null; document.getElementById('btn-optional-skip').classList.remove('action-selected'); }
                if (s.selectedNumbersArr.includes(i)) {
                    s.selectedNumbersArr = s.selectedNumbersArr.filter(n => n !== i); btn.classList.remove('selected');
                } else if (s.selectedNumbersArr.length < maxSelect) {
                    s.selectedNumbersArr.push(i); btn.classList.add('selected');
                }
                btnConfirmAction.classList.toggle('hidden', s.selectedNumbersArr.length !== maxSelect);
                btnConfirmAction.textContent = "確認";
            } else {
                resetSelections(); btn.classList.add('selected'); s.selectedNumber = i;
                btnConfirmAction.classList.remove('hidden'); btnConfirmAction.textContent = "確認";
            }
        });
        numberPad.appendChild(btn);
    }
}