# 技術規範：狼人殺第一天法官

## 技術棧

- 純前端 Web App（無後端、無框架）
- 原生 JavaScript（ES Modules）
- 單一 HTML 入口 + CSS 樣式檔
- Web Speech API 語音播報
- 靜態 JSON 資料檔（角色字典、板子配置）

## 檔案結構與分工

```
├── index.html          # 唯一 HTML 入口，所有畫面（screen）以 div 切換顯示/隱藏
├── style.css           # 全域樣式，深色主題，行動裝置優先
├── data.json           # 靜態資料：ROLE_DICT（角色定義）、BOARD_CONFIGS（板子配置）
└── js/
    ├── core.js         # 全域狀態物件 (s)、陣營定義、共用工具函式（不操作 DOM）
    ├── night.js        # 夜晚 UI 互動邏輯（號碼鍵盤生成、選擇重置）
    ├── day.js          # 白天結算邏輯（死亡計算、連帶死亡鏈、開槍佇列）
    ├── setup.js        # 設定頁初始化、角色錄入、隨機發牌、板子選擇、data.json 載入
    ├── sheriff.js      # 警長競選流程（號碼選擇、發言順序、結果判定）
    ├── actions.js      # 角色行動結果寫入（查驗結果顯示、非查驗類狀態寫入）
    ├── roleUI.js       # 角色夜晚面板渲染（根據 currentStage 顯示操作介面）
    └── main.js         # 主流程骨架：佇列建置、夜晚流程調度、確認/跳過按鈕事件、法官面板、重置
```

### 各檔案職責原則

| 檔案 | 負責範圍 |
|------|---------|
| `core.js` | 狀態定義、陣營常數、純邏輯工具函式（不操作 DOM） |
| `night.js` | 夜晚階段的號碼鍵盤 UI 建構與選擇限制規則 |
| `day.js` | 天亮後的死亡結算邏輯與白天開槍/投票 UI |
| `setup.js` | 遊戲設定頁面（板子選擇、角色錄入、隨機發牌、進入黑夜前校驗） |
| `sheriff.js` | 警長競選流程（上警名單、發言順序、競選結果） |
| `actions.js` | 確認按鈕按下後的狀態寫入邏輯（每個角色的 resolve） |
| `roleUI.js` | 每個角色夜晚操作面板的 DOM 渲染（面板按鈕、指示文字） |
| `main.js` | 遊戲主迴圈骨架、畫面切換調度、事件總入口、法官紀錄面板、重置 |

### 新增檔案的判斷準則

- 如果新邏輯屬於「角色面板渲染」→ 放 `roleUI.js`
- 如果新邏輯屬於「確認按鈕後的狀態寫入」→ 放 `actions.js`
- 如果新邏輯屬於「夜晚號碼鍵盤選擇限制」→ 放 `night.js`
- 如果新邏輯屬於「天亮後結算或白天操作」→ 放 `day.js`
- 如果是純資料運算或跨階段共用 → 放 `core.js`
- 如果是流程串接或畫面切換 → 放 `main.js`
- 當單一檔案超過 600 行時，考慮拆分為更細的模組

## 狀態管理

所有遊戲狀態集中在 `core.js` 的 `s` 物件中，依功能分類：

1. **遊戲基礎設定** — `totalPlayers`, `currentBoard`, `ROLE_DICT`, `BOARD_CONFIGS`
2. **玩家角色配置** — `playerRoles`, `playerStatus`, `spareCards`
3. **流程控制** — `nightQueue`, `currentStage`, `selectedNumber`, `nightActionLog`
4. **單一目標追蹤** — `wolfKillTarget`, `witchPoisonTarget`, `seerTarget` 等
5. **陣列目標** — `magicianSwap`, `cupidLovers`, `phantomTargets` 等
6. **技能旗標** — `witchSaved`, `pufferfishTriggered` 等布林值
7. **死亡清單** — `primaryKilled`, `chainKilled`, `finalKilled`
8. **擴展板子專用** — `pleasantGoatGuard`, `grayWolfStolenPlayer` 等
9. **第三方陣營** — `cupidLovers`（邱比特情侶）, `phantomTargets`（尋香綁定）, `snakeWin`（千年之戀勝利）, `ghostBrideGroom`/`ghostBrideWitness`（鬼魅新娘）, `halfBloodTarget`（混血兒）, `wildChildTarget`（野孩子）, `lonelyGirlTarget`（覺醒孤獨少女）

## 規則參考文件

各板子的完整規則（職業介紹、夜間睜眼順序、法官主持流程、Q&A）存放於：
#[[file:proposal/狼人殺各版子 前.md]]
#[[file:proposal/狼人殺各版子 中.md]]
#[[file:proposal/狼人殺各版子 後.md]]

新增或修改角色邏輯時，應對照該文件中對應板子的章節確認規則正確性。

## 命名規範

### 變數

- 使用 **snake_case**（單詞之間以 `_` 區隔）
- 變數名稱應淺顯易懂，能直接看出用途
- 範例：
  - `wolf_kill_target` — 狼刀目標
  - `witch_poison_target` — 女巫毒藥目標
  - `night_queue` — 夜晚行動佇列

#### 角色縮寫規則

- 角色名**不縮寫**，維持完整可讀性
- 例外前綴縮寫：
  - 「覺醒」→ `awk`（如 `awk_seer_target`）
  - 「超級」→ `sp`（如 `sp_grave_keeper_target`）

#### 目標後綴

- 單一目標統一加 `_target`：`guard_target`, `bat_target`, `medusa_target`
- 兩人配對用 `_pair`：`cupid_pair`, `phantom_pair`
- 多人列表用 `_list`：`zombie_infected_list`, `fog_target_list`

#### 布林值

- **必須帶助動詞**（is / has / can / was / did）
- 範例：`is_witch_saved`, `has_gun`, `can_shoot`, `is_thief_invincible`

### 函式

- 使用 **camelCase**
- 範例：`buildNightQueue()`, `calculateNightDeaths()`, `handleChainDeaths()`
- 避免過度縮寫，`btn` (button)、`el` (element)、`arr` (array) 等常見縮寫可接受

### 角色識別碼 (Role ID)

- 使用 **snake_case** 英文：`wolf_beauty`, `awaken_wolf_king`, `ghost_rider`
- 覺醒角色統一前綴 `awaken_`
- 對應的中文名稱存放在 `data.json` 的 `ROLE_DICT[role].name`

### CSS Class

- 使用 **kebab-case**：`num-btn`, `grid-container`, `primary-btn`
- 狀態類別：`hidden`, `selected`, `action-selected`

### DOM ID

- 使用 **kebab-case**：`screen-night`, `btn-confirm-action`, `number-pad`
- 按鈕前綴 `btn-`，畫面前綴 `screen-`，區塊前綴依功能命名

## 可維護性與可延伸性

### 核心設計原則

- **資料驅動**：角色的基本屬性（名稱、圖示、行動順序）集中在 `data.json`，避免散落在邏輯程式碼中
- **單一職責**：每個角色的行動邏輯應盡量獨立，避免在一個 `if-else` 分支中混合多個角色的判斷
- **統一介面模式**：角色行動的共通流程為「語音播報→顯示操作面板→玩家選擇→紀錄結果→閉眼」，新角色應遵循此模式
- **集中註冊**：新增角色時，所有需要修改的位置都列在「新增角色的步驟」中，不應有隱藏的散落判斷

### 延伸新職業的指引

- 新角色的夜晚行動邏輯，優先以獨立 `if` 區塊處理，而非嵌套在既有角色的邏輯中
- 如果新角色的行為與既有角色高度相似（如覺醒版本），可共用部分邏輯但透過旗標區分差異
- 角色間的交互效果（如免疫、反傷、連帶死亡）應在 `calculateNightDeaths` 中以明確的條件判斷處理，並附帶註解說明規則來源
- 「不入狼隊」的角色（隱狼、石像鬼、蝕日侍女等）統一透過 `wolfFaction` 陣列管理陣營歸屬，入隊時機透過 wakeOrder 和 nightQueue 控制
- 新增的狀態變數應在 `core.js` 的 `s` 物件中對應分類區段內加入，並附帶中文註解

### 程式碼品質

- 避免魔法數字：wake_queue 應在 `data.json` 集中管理，程式碼中以有意義的 stage 名稱引用
- 複雜的結算邏輯應附帶區塊註解，說明對應的遊戲規則（例如「// 規則：奶穿判定」）
- 當某角色的邏輯超過 50 行，考慮抽成獨立函式並以角色名命名（如 `handleGrayWolfAction()`）

## 開發準則

### 一般原則

- 保持程式碼可在手機瀏覽器順暢運行，注意效能
- UI 以行動裝置為主要考量（觸控友善、字體夠大）
- 所有使用者看到的文字使用繁體中文
- 程式碼註解使用繁體中文
- 角色相關的硬編碼數值（wake_queue_、陣營歸屬）集中在 `data.json` 或 `core.js` 頂層

### 夜晚流程

- 夜晚行動順序由 `ROLE_DICT` 中的 `wake_queue` 數值決定，佇列越前越早行動
- `nightQueue` 在每夜開始時根據場上存活角色動態建立
- 每個角色行動結束後呼叫 `runNextNightRole()` 推進佇列

### 結算邏輯

- 死亡結算分為 `primaryKilled`（直接致死）和 `chainKilled`（連帶死亡）
- `handleChainDeaths()` 以遞迴方式處理連帶死亡鏈，直到沒有新增死亡為止
- 所有護盾/免疫判定必須在加入 `primaryKilled` 之前完成

### 新增角色的步驟

1. 在 `data.json` 的 `ROLE_DICT` 加入角色定義（name, icon, wakeOrder）
2. 在 `core.js` 的陣營陣列（`wolfFaction` 或 `evilRoles`）中加入（如適用）
3. 在 `roleUI.js` 的 `renderRolePanel` 中加入該角色的面板渲染邏輯
4. 在 `night.js` 的 `createNumberPad` 中加入選擇限制規則（如適用）
5. 在 `actions.js` 的 `resolveNonInspectionAction` 中加入結果寫入邏輯
6. 在 `day.js` 的 `calculateNightDeaths` 中加入結算邏輯（如適用）
7. 在對應的 `BOARD_CONFIGS` 板子中加入角色配置
8. 對照 `proposal/狼人殺各版子 前.md`、`proposal/狼人殺各版子 中.md`、`proposal/狼人殺各版子 後.md` 中的規則確認實作正確性
