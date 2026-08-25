# 技術規範：狼人殺第一天法官

## 技術棧

- 純前端 Web App（無後端、無框架）
- 原生 JavaScript（ES Modules）
- **非同步控制 (Async/Await & Promises)**：精準處理語音播報與 UI 轉場時序
- **資料驅動架構 (Data-Driven Architecture)**：將角色邏輯屬性徹底抽離至靜態 JSON
- **策略模式 (Strategy Pattern)**：消除冗長的 if-else 分支，統一收斂角色行動
- 單一 HTML 入口 + CSS 樣式檔 (支援 PWA)
- Web Speech API 語音播報

## 檔案結構與分工

```text
├── index.html          # 唯一 HTML 入口，所有畫面（screen）以 div 切換顯示/隱藏
├── style.css           # 全域樣式，深色主題，CSS 變數集中管理
├── data.json           # 靜態資料：ROLE_DICT（角色定義/UI型態/免疫屬性）、BOARD_CONFIGS（板子配置）
└── js/
    ├── core.js         # 全域狀態 (s)、陣營判定、Promise 工具函式、行動紀錄器 (addNightAction)
    ├── night.js        # 夜晚 UI 互動邏輯，依靠 data.json 動態產生號碼鍵盤與選擇限制
    ├── day.js          # 白天結算邏輯，掃描 Action Queue 進行護盾/毒殺/反傷與連帶死亡遞迴
    ├── setup.js        # 設定頁初始化、角色錄入、隨機發牌、板子選擇、data.json 載入
    ├── sheriff.js      # 警長競選流程（上警名單、發言順序、競選結果）
    ├── actions.js      # 角色行動結果寫入，採用「策略註冊表」統一處理查驗與技能寫入
    ├── roleUI.js       # 角色夜晚面板渲染，利用 ui_type 動態分派對應的視圖處理器
    ├── vote.js         # 白天放逐投票特殊結算（如詭術師換票）
    └── main.js         # 主流程骨架：async/await 夜晚流程調度、畫面切換、法官面板、重置
```

### 各檔案職責原則

| 檔案 | 負責範圍 |
|------|---------|
| `core.js` | 狀態定義、依賴 JSON 的陣營判定、`delay`/`speak` Promise 封裝、夜間行為容器 API |
| `night.js` | 依據 `max_targets`, `can_select_self`, `ui_type` 等資料驅動變數繪製鍵盤與限制 |
| `day.js` | 掃描 `getActionsByEffect` 進行死亡結算、管線化 (Pipeline) 的死亡與免疫計算 |
| `setup.js` | 遊戲設定頁面、動態下拉選單、進入黑夜前配置校驗 |
| `sheriff.js` | 警長競選流程（上警名單、發言順序、競選結果） |
| `actions.js` | `inspectionStrategies` 與 `nonInspectionStrategies` 策略註冊表 |
| `roleUI.js` | 透過字典映射 `ui_type` 到 `_info_only`, `_inspection`, `_target_select` 等通用渲染面板 |
| `main.js` | 非同步主迴圈 `runNextNightRole`、法官面板更新、遊戲整體推進 |

## 狀態管理與架構升級

所有的狀態變數集中於 `core.js` 的 `s` 物件中，邏輯流動以「隊列驅動」為主，並細分為以下類別：

1. **基礎資料與規則** — `total_players`, `current_board`, `ROLE_DICT`, `BOARD_CONFIGS`
2. **玩家角色配置** — `player_roles`, `player_status`, `spare_cards`, `discarded_roles`
3. **行動隊列 (Action Queue)** — `night_actions`。所有夜晚操作透過 `addNightAction` 統一寫入，取代零散的布林值，結算時統一查詢交互。
4. **狀態流轉 (Status Flow)** — `night_status_flows`。處理商人給裝備、感染、轉化、綁定等複雜通知與群體相認機制。
5. **流程控制** — `night_queue`, `current_stage`, `selected_number`, `night_action_log`
6. **單一目標追蹤** — `seed_wolf_target`, `awk_gargoyle_target` 等
7. **第三方與特殊陣營** — `cupid_lovers`（情侶）, `phantom_targets`（尋香綁定）, `ghost_bride_groom`（鬼魅新娘）等
8. **死亡清單** — `primary_killed`, `chain_killed`, `final_killed`
9. **非同步流程** — 語音與轉場全數使用 `await speak()` 與 `await delay()`，根除 `setTimeout` 競態條件。

## 命名規範

### 變數與屬性

- 使用 **snake_case**（單詞之間以 `_` 區隔）：`wolf_kill_target`, `night_actions`
- 布林值 **必須帶助動詞**（is / has / can / was / did）：`is_witch_saved`, `has_gun`, `can_shoot`

#### 角色與目標縮寫規則
- 角色名 **不縮寫**，維持完整可讀性。例外前綴：
  - 「覺醒」→ `awk_`（如 `awk_gargoyle_target`）
  - 「超級」→ `sp_`（如 `sp_grave_keeper_heir`）
- 目標後綴規範：
  - 單一目標統一加 `_target`：`half_blood_target`
  - 兩人配對用 `_pair` / `_lovers`：`cupid_lovers`
  - 多人列表用 `_targets` / `_infected`：`phantom_targets`, `zombie_infected`

### 角色識別碼與 JSON 屬性

角色邏輯移至 `data.json` 中的 `ROLE_DICT`，核心屬性包含：
- `faction`: 陣營 (wolf, good, third_party, lone_wolf)
- `seer_result`: 查驗結果 (evil, good, dynamic)
- `ui_type`: 面板型態 (none, info_only, inspection, target_select, custom_panel)
- `max_targets` / `min_targets`: 目標數量限制
- `can_select_self`: 是否可點擊自己
- `immune_poison` / `immune_gun` / `immune_wolf_kill`: 特定免疫旗標，取代寫死的 if-else 判定。

### 函式

- 使用 **camelCase**：`buildNightQueue()`, `calculateNightDeaths()`, `insertNightStatusFlow()`
- 避免過度縮寫，`btn` (button)、`el` (element)、`arr` (array) 等常見縮寫可接受。

### CSS Class 與 DOM ID

- 使用 **kebab-case**：`num-btn`, `grid-container`, `screen-night`, `btn-confirm-action`
- 狀態類別：`hidden`, `selected`, `action-selected`

## 可維護性與可延伸性

### 核心設計原則

- **資料驅動 (Data-Driven)**：角色的基本屬性集中在 `data.json`，避免散落在邏輯程式碼中。
- **策略模式 (Strategy Pattern)**：每個角色的行動邏輯應透過 `actions.js` 註冊表獨立，避免在單一 `if-else` 分支中混合判斷。
- **統一介面模式**：角色行動的共通流程為「語音播報→顯示操作面板→玩家選擇→紀錄結果(Action Queue)→閉眼」。

### 程式碼品質與開發準則

- **避免魔法數字**：`wake_queue` 應在 `data.json` 集中管理，程式碼中以有意義的 stage 名稱引用。
- **複雜邏輯註解**：結算邏輯應附帶區塊註解，說明對應的遊戲規則（例如「// 規則：奶穿判定」）。
- **管線化結算**：`day.js` 中的死亡結算必須分層處理（失效→防護→查驗致死→狼刀/毒藥→反傷→連鎖死亡），所有護盾/免疫判定必須在加入 `primary_killed` 前完成。
- **遞迴連帶死亡**：`handleChainDeaths()` 以遞迴方式處理連帶死亡鏈，直到沒有新增死亡為止。

### 新增角色的標準步驟 (Data-Driven Approach)

1. **設定資料 (data.json)**：
   在 `ROLE_DICT` 中宣告角色，包含 `ui_type`、陣營、查驗結果、免疫屬性、選擇目標數量等。
2. **處理自訂面板 (roleUI.js)** *(若 ui_type 不為預設)*：
   若使用了 `custom_panel`，在 `roleUI.js` 的 `roleHandlers` 中新增對應的 UI 繪製邏輯。預設型態（如 `target_select`）則無需撰寫 UI 程式碼。
3. **註冊行動策略 (actions.js)**：
   在 `inspectionStrategies` 或 `nonInspectionStrategies` 中註冊該角色確認後的邏輯。單/多目標技能可直接使用 `createSingleTargetStrategy` 或 `createMultiTargetStrategy`。
4. **特殊結算 (day.js)** *(若有特殊死亡/免疫效果)*：
   在 `calculateNightDeaths` 的管線中，使用 `getActionsByEffect` 提取行動紀錄並施加影響。若為單純的護盾/毒藥免疫，只需在 `data.json` 加上 `immune_xxx` 即可。
5. **板子加入 (data.json)**：
   於 `BOARD_CONFIGS` 加入對應配置，並對照規則文件確認實作正確性。