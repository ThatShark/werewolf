import { s } from './core.js';
import { generateSpeechOrder, showDayResult } from './main.js';

// ==========================================
// 警長競選流程
// ==========================================

/** 初始化警長競選畫面（號碼選擇） */
export function initSheriffScreen() {
    document.getElementById('sheriff-setup-section').classList.remove('hidden');
    document.getElementById('sheriff-action-section').classList.add('hidden');
    document.getElementById('sheriff-result-section').classList.add('hidden');

    const btn_start = document.getElementById('btn-start-sheriff-speech');
    const btn_no_sheriff = document.getElementById('btn-no-sheriff-candidates');
    btn_start.classList.add('hidden');
    btn_no_sheriff.classList.remove('hidden');

    const pad = document.getElementById('sheriff-numpad');
    pad.innerHTML = '';
    s.sheriff_candidates = [];

    for (let i = 1; i <= s.total_players; i++) {
        let btn = document.createElement('button');
        btn.className = 'num-btn';
        btn.textContent = i;
        btn.onclick = () => {
            if (s.sheriff_candidates.includes(i)) {
                s.sheriff_candidates = s.sheriff_candidates.filter(x => x !== i);
                btn.classList.remove('selected');
            } else {
                s.sheriff_candidates.push(i);
                btn.classList.add('selected');
            }

            if (s.sheriff_candidates.length === 0) {
                btn_start.classList.add('hidden');
                btn_no_sheriff.classList.remove('hidden');
            } else if (s.sheriff_candidates.length === 1) {
                btn_start.classList.remove('hidden');
                btn_start.textContent = "僅一人上警 (自動當選並結算)";
                btn_no_sheriff.classList.add('hidden');
            } else {
                btn_start.classList.remove('hidden');
                btn_start.textContent = s.sheriff_candidates.length >= s.total_players ? "全員上警 (確認並開始發言)" : "確認競選名單並開始發言";
                btn_no_sheriff.classList.add('hidden');
            }
        };
        pad.appendChild(btn);
    }
}

/** 綁定警長競選相關的 DOM 事件 */
export function initSheriffEvents() {
    const screen_sheriff = document.getElementById('screen-sheriff');

    document.getElementById('btn-start-sheriff-speech').addEventListener('click', () => {
        if (s.sheriff_candidates.length === 1) {
            // 僅一人上警 → 自動當選，直接結算
            s.speech_order_text = null;
            screen_sheriff.classList.add('hidden');
            showDayResult();
        } else {
            // 多人上警（含全員）→ 進入警上發言
            document.getElementById('sheriff-setup-section').classList.add('hidden');
            document.getElementById('sheriff-action-section').classList.remove('hidden');
            document.getElementById('sheriff-speech-order').innerHTML = generateSpeechOrder(s.sheriff_candidates);
            // 全員上警時按鈕文字改為不含「投票」
            const btn_finish = document.getElementById('btn-finish-sheriff');
            btn_finish.textContent = s.sheriff_candidates.length >= s.total_players ? "警長競選結束 (警徽流失)" : "警長競選結束 (開始投票)";
        }
    });

    document.getElementById('btn-no-sheriff-candidates').addEventListener('click', () => {
        s.speech_order_text = generateSpeechOrder(null);
        screen_sheriff.classList.add('hidden');
        showDayResult();
    });

    document.getElementById('btn-finish-sheriff').addEventListener('click', () => {
        if (s.sheriff_candidates.length >= s.total_players) {
            // 全員上警 → 警徽流失，跳過投票直接進白天
            s.speech_order_text = generateSpeechOrder(null);
            screen_sheriff.classList.add('hidden');
            showDayResult();
        } else {
            // 正常流程 → 顯示投票結果選擇
            document.getElementById('sheriff-action-section').classList.add('hidden');
            document.getElementById('sheriff-result-section').classList.remove('hidden');
        }
    });

    document.getElementById('btn-sheriff-wolf-blow').addEventListener('click', () => {
        s.speech_order_text = null;
        screen_sheriff.classList.add('hidden');
        showDayResult();
    });

    document.getElementById('btn-sheriff-elected').addEventListener('click', () => {
        s.speech_order_text = null;
        screen_sheriff.classList.add('hidden');
        showDayResult();
    });

    document.getElementById('btn-sheriff-not-elected').addEventListener('click', () => {
        s.speech_order_text = generateSpeechOrder(null);
        screen_sheriff.classList.add('hidden');
        showDayResult();
    });
}
