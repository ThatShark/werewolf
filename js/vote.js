import { s } from './core.js';

// ==========================================
// 白天投票相關邏輯（詭術師換票結算等）
// ==========================================

/**
 * 顯示詭術師換票結算面板與重新開始按鈕
 * 在開槍佇列處理完畢後呼叫
 */
export function triggerTricksterVoteSection() {
    const day_result_content = document.getElementById('day-result-content');
    const btn_reset = document.getElementById('btn-reset');

    if (Object.values(s.player_roles).includes('trickster') && document.getElementById('trickster-calc') === null) {
        let trickster_div = document.createElement('div'); trickster_div.id = 'trickster-calc';
        trickster_div.style = "background:#24345e; padding:15px; border-radius:8px; margin-bottom:20px;";
        trickster_div.innerHTML = `
            <h3 style="color:#fca311; margin-top:0;">🃏 詭術師換票結算</h3>
            <p style="color:#a2a8d3;">請輸入實際得票最高的玩家編號：</p>
            <div id="trickster-numpad" class="grid-container"></div>
            <div id="trickster-result" class="hidden" style="margin-top:15px; font-size:24px; font-weight:bold; color:#00ff88;"></div>
        `;
        day_result_content.insertBefore(trickster_div, btn_reset);

        let t_pad = document.getElementById('trickster-numpad');
        for (let i = 1; i <= s.total_players; i++) {
            if (s.final_killed.includes(i)) continue;
            let b = document.createElement('button'); b.className = 'num-btn'; b.textContent = i;
            b.onclick = () => {
                let mag_swap = [...s.magician_swap].sort().join(',');
                let tri_swap = [...s.trickster_swap].sort().join(',');
                let effective_trickster = s.trickster_swap;

                if (s.magician_swap.length && s.trickster_swap.length && mag_swap === tri_swap) effective_trickster = [];

                let exiled = i;
                if (effective_trickster.includes(i)) exiled = effective_trickster[0] === i ? effective_trickster[1] : effective_trickster[0];

                document.getElementById('trickster-result').textContent = `實際被放逐出局的是：【 ${exiled} 號 】`;
                document.getElementById('trickster-result').classList.remove('hidden');
                document.querySelectorAll('#trickster-numpad .num-btn').forEach(btn => btn.classList.remove('selected'));
                b.classList.add('selected');
            };
            t_pad.appendChild(b);
        }
    }
    btn_reset.classList.remove('hidden');
}
