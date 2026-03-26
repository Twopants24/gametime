# The Bean Farmer Technical Design Document

## Purpose

This document translates the high-level design in [GDD.md](/Users/logan/Documents/New%20project/GDD.md) into an implementation plan. It defines the recommended technical stack, gameplay architecture, core data structures, content authoring model, save system, and milestone scope for building a first playable version of The Bean Farmer.

The goal is not to lock every technical decision forever. The goal is to make the first implementation coherent, scalable, and easy to extend as bean content, quests, land, and upgrades grow.

## Product Scope

### Initial target

- Single-player
- 3D
- PC-first controls
- Offline-first
- Cozy stylized presentation
- Vertical slice focused on farm loop, land expansion, quests, and bean collection

### Recommended engine

- Unity

Unity is the practical recommendation for this project because:

- It handles stylized 3D games well at small-team scope.
- It supports rapid gameplay iteration.
- It has mature tooling for ScriptableObject-driven content.
- It is suitable for UI-heavy progression games.
- It keeps the implementation cost lower than building a custom 3D stack.

If the project later needs larger open-world streaming or more demanding rendering goals, Unreal can be reconsidered. For the current concept, Unity is the more efficient choice.

## High-Level Architecture

The game should be split into a small set of clear gameplay domains:

- World and scene management
- Farming simulation
- Bean and crop definitions
- Inventory and economy
- Land ownership and expansion
- Quest and challenge system
- Upgrade system
- Save/load system
- UI layer
- Audio/feedback layer

The architecture should be content-driven where possible. Beans, quests, upgrades, land plots, and rewards should be authored as data assets rather than hardcoded logic.

## Core Runtime Model

### Main loop domains

1. Player moves through the 3D farm.
2. Player interacts with plots, stations, NPCs, and menus.
3. Farming systems update crop state over time.
4. Quests and unlock systems evaluate progress.
5. Inventory, currency, and unlock flags persist to save data.
6. UI reflects current state and available actions.

### Core runtime managers

Recommended service layer:

- `GameManager`
- `SaveManager`
- `TimeManager`
- `FarmManager`
- `InventoryManager`
- `EconomyManager`
- `QuestManager`
- `UpgradeManager`
- `LandManager`
- `AudioManager`
- `UIManager`

These should be thin coordinators, not giant god-objects. Domain logic should live in dedicated systems and models.

## Scene Structure

### Recommended scenes

- `Boot`
- `MainMenu`
- `FarmWorld`
- `MiningMinigame`
- `ChallengeScene` or challenge loaded additively

### Boot responsibilities

- Load player profile
- Initialize persistent managers
- Load settings
- Resolve last save slot

### FarmWorld responsibilities

- Render main farm
- Host planting, harvesting, selling, land purchase, quest turn-in, and upgrade interactions
- Load owned land state and active crop state

## World Structure

### Farm layout model

The farm should be built from modular land parcels rather than one monolithic map state.

Each parcel should contain:

- Parcel ID
- World bounds
- Unlock cost
- Unlock prerequisite flags
- Plot sockets
- Decorative set dressing
- Optional special properties such as soil bonus or rare-bean affinity

### Plot model

Each plantable plot should have:

- Plot ID
- Parcel ID
- Occupancy state
- Soil state
- Water state
- Fertility modifier
- Current crop instance reference

This makes expansion and persistence straightforward.

## Time Simulation

### Time model

Use an in-game clock with accelerated time. Recommended first-pass structure:

- 1 real second = 1 in-game minute
- 1 in-game day = configurable, default 12 to 18 real minutes

This is long enough for progression and short enough for visible crop growth during a session.

### Time responsibilities

- Crop growth progression
- Quest timers
- Daily shop resets
- Market updates if added later
- Day boundary events

### Offline progression

For v1 vertical slice:

- Support simple offline crop growth catch-up
- Do not support full offline economy simulation

On load:

- Compare saved timestamp to current timestamp
- Advance crop timers up to capped catch-up duration
- Apply finished growth states

Cap recommended at 24 in-game hours initially to avoid exploit-heavy outcomes.

## Farming Simulation

### Crop lifecycle

Each planted crop instance should move through:

1. Seeded
2. Sprouting
3. Growing
4. Mature
5. Withered or expired if that mechanic is enabled later

### Crop instance fields

- `cropInstanceId`
- `beanTypeId`
- `plotId`
- `plantedAtGameTime`
- `growthProgress`
- `currentStage`
- `waterLevel`
- `qualityModifier`
- `yieldModifier`
- `isReadyToHarvest`

### Growth calculation

Recommended growth formula inputs:

- Base bean growth duration
- Soil modifier
- Water modifier
- Upgrade modifier
- Parcel modifier
- Special event modifier

Initial simplified formula:

`effectiveGrowthRate = baseRate * soilBonus * waterBonus * upgradeBonus`

This is enough for a vertical slice and can expand later.

## Bean Content Model

Beans should be authored as assets.

### `BeanDefinition`

Recommended fields:

- `id`
- `displayName`
- `description`
- `rarity`
- `seedCost`
- `sellValue`
- `baseGrowthMinutes`
- `baseYield`
- `waterNeed`
- `soilPreference`
- `unlockType`
- `unlockRef`
- `icon`
- `seedMesh`
- `growthStagePrefabs`
- `harvestVfx`
- `beanColor`
- `indexEntryText`
- `tags`

### Bean rarity enum

- Common
- Uncommon
- Rare
- Special

### Content loading approach

- ScriptableObjects in editor
- Serialized into asset references at build time
- Referenced by stable string IDs in save data

Never store direct asset references in save files.

## Inventory System

The game needs a flexible inventory that supports seeds, harvested beans, quest items, and mining materials.

### Inventory categories

- Seeds
- Crops
- Materials
- Quest items
- Special rewards

### Inventory data structure

Recommended structure:

- Dictionary keyed by item ID
- Value includes count and metadata if required

Example model:

```text
InventoryItemStack
- itemId
- quantity
- itemType
- instanceMetadata(optional)
```

For v1, most items should be stackable and non-unique.

## Economy System

### Currency

Single primary currency for v1:

- Credits

### Economy responsibilities

- Selling harvested beans
- Purchasing seeds
- Buying land
- Buying upgrades
- Granting quest rewards

### Economy rules

- Keep crop values deterministic in v1
- Defer dynamic market prices
- Defer crafting/processing economy unless vertical slice scope allows it

### Pricing balance inputs

- Seed cost
- Growth time
- Yield count
- Sale value
- Upgrade multipliers

## Land Expansion System

Land is both content and progression gating.

### `LandParcelDefinition`

Recommended fields:

- `id`
- `displayName`
- `unlockCost`
- `requiredFlags`
- `plotCount`
- `specialModifiers`
- `visualTheme`
- `adjacentParcelIds`

### Parcel ownership save state

- `parcelId`
- `isOwned`
- `isVisible`

### Expansion flow

1. Player reaches unlock threshold.
2. Parcel becomes available for purchase.
3. Purchase updates save flags.
4. World visuals and plot availability update immediately.

## Quest System

Quests should be data-defined and event-driven.

### `QuestDefinition`

Recommended fields:

- `id`
- `title`
- `description`
- `category`
- `objectives`
- `prerequisites`
- `rewards`
- `isRepeatable`

### Objective types

- Grow bean type X
- Harvest count X
- Sell count X
- Earn credits X
- Unlock parcel X
- Deliver item X
- Discover bean X
- Complete challenge X

### Runtime tracking

Quest progress should be updated through domain events:

- `OnCropPlanted`
- `OnCropHarvested`
- `OnItemSold`
- `OnParcelUnlocked`
- `OnBeanDiscovered`
- `OnChallengeCompleted`

Do not poll all quest conditions every frame.

## Challenge System

Challenges should reuse the quest/objective infrastructure where possible, with added rule wrappers.

### `ChallengeDefinition`

- `id`
- `title`
- `description`
- `constraints`
- `startRequirements`
- `rewardTable`
- `timeLimit(optional)`

### Challenge examples in code terms

- Profit target in one in-game day
- Harvest target under water constraints
- Grow restricted bean set only

## Bean Index System

The Bean Index is primarily a codex and completion tracker.

### `BeanIndexEntryState`

- `beanTypeId`
- `isDiscovered`
- `timesPlanted`
- `timesHarvested`
- `highestQuality`
- `isMastered`

### Unlock trigger

Recommended first rule:

- Discovery occurs on first planted or harvested bean

Mastery can be defined later, but for v1 a simple threshold system works:

- Plant bean at least once
- Harvest bean at least 10 times
- Sell a threshold amount

## Upgrade System

Split upgrades into player upgrades and farm upgrades.

### `UpgradeDefinition`

- `id`
- `title`
- `description`
- `category`
- `costCurrency`
- `costItems(optional)`
- `prerequisites`
- `effectType`
- `effectValues`

### Player upgrade examples

- Movement speed multiplier
- Harvest animation speed bonus
- Carry capacity bonus
- Rare find chance bonus

### Farm upgrade examples

- Water retention bonus
- Soil fertility bonus
- Yield multiplier
- Unlock automation slot

### Application model

Upgrades should resolve into a shared stat aggregator:

- `PlayerStats`
- `FarmStats`
- `EconomyStats`

This avoids hardcoding upgrade checks across the codebase.

## Mining Mini-Game

Mining should be scoped as a side loop, not a second game.

### v1 implementation target

- Separate small scene or contained area
- Basic node interaction
- Reward materials and occasional rare seed items
- Short session length, 2 to 5 minutes

### Mining data model

- `MiningNodeDefinition`
- `MiningRewardTable`
- `MiningToolStats`

Mining rewards should feed:

- Upgrade materials
- Quest requirements
- Rare bean unlock conditions

## Player Controller

### Perspective

- Third-person

### Responsibilities

- Movement
- Camera-relative navigation
- Interaction raycast
- Tool use
- Menu trigger access

### Technical recommendation

- Use a character-controller-based movement setup
- Avoid physics-heavy rigidbody character behavior unless the project later needs complex traversal

## Interaction System

All gameplay interaction points should use a common interface.

### `IInteractable`

Recommended methods:

- `CanInteract(playerState)`
- `GetPrompt()`
- `Interact(playerState)`

Example interactables:

- Plot
- Shop stand
- Land sign
- Quest giver
- Upgrade bench
- Mine entrance
- Sell bin

This keeps prompts and actions consistent.

## UI Architecture

### Main UI modules

- HUD
- Inventory panel
- Seed selection panel
- Bean Index panel
- Quest log
- Upgrade screen
- Land purchase dialog
- Shop screen
- Pause/settings menu

### UI pattern

- Event-driven updates where possible
- Data binding layer or presenter layer between systems and UI
- Keep runtime UI state separate from persistent game state

## Save System

### Save format

- JSON for development readability
- Optional binary compression later if save size becomes a concern

### Save slots

- Support at least 3 manual save slots

### Root save model

```text
SaveGameData
- version
- createdAt
- updatedAt
- playtimeSeconds
- currency
- ownedParcelIds[]
- inventory[]
- plantedCrops[]
- unlockedBeanIds[]
- beanIndexEntries[]
- activeQuestStates[]
- completedQuestIds[]
- unlockedUpgradeIds[]
- playerStatsState
- worldTimeState
- settingsRef(optional)
```

### Save versioning

Include explicit version number and migration path.

Recommended pattern:

- `ISaveMigrator`
- One migration per schema version jump

## Event System

The simulation should use a lightweight event bus for domain events.

### Events to support early

- Crop planted
- Crop advanced stage
- Crop harvested
- Bean discovered
- Item sold
- Currency changed
- Parcel unlocked
- Quest completed
- Upgrade purchased

This reduces direct coupling between farming, quests, UI, audio, and achievements.

## Content Authoring Workflow

### Designer-authored assets

- Bean definitions
- Quest definitions
- Upgrade definitions
- Land parcel definitions
- Reward tables
- Challenge definitions

### Authoring rules

- All content uses stable IDs
- Definitions validate required fields in editor
- Runtime systems fail loudly on missing IDs during development

### Validation tools

Recommended editor validators:

- Duplicate ID checker
- Missing icon/prefab checker
- Invalid prerequisite checker
- Reward reference checker

## Testing Strategy

### Automated tests

- Crop growth progression math
- Sell-price calculation
- Quest objective event tracking
- Upgrade stat aggregation
- Save/load round-trip integrity
- Unlock prerequisite evaluation

### Manual test focus

- Planting flow
- Harvest feedback
- Land purchase visibility
- Quest completion UX
- Bean Index discovery flow
- Offline progression catch-up

## Performance Targets

For the first PC build:

- 60 FPS target on mid-range hardware
- Farm scene must handle at least 200 active crop instances without visible hitching
- Save/load should complete in under 2 seconds for standard save sizes

### Optimization priorities

- Pool crop visuals if needed
- Avoid per-frame allocations in simulation loops
- Prefer batched UI updates over full refreshes
- Keep event dispatch lightweight

## Folder Structure Recommendation

```text
Assets/
  Art/
  Audio/
  Prefabs/
  Scenes/
  Scripts/
    Core/
    Farming/
    Economy/
    Inventory/
    Land/
    Quests/
    Upgrades/
    Save/
    UI/
    Player/
    Mining/
  ScriptableObjects/
    Beans/
    Quests/
    Upgrades/
    Parcels/
    Rewards/
```

## Vertical Slice Deliverables

The first playable milestone should include:

- One farm scene
- 6 to 10 bean types
- Plant, grow, harvest, sell loop
- One buyable land expansion
- Bean Index with discovery tracking
- Basic quest system with 5 to 10 quests
- One mining mini-game
- Basic player upgrades
- Basic farm upgrades
- Save/load

## Deferred Features

Defer these unless the core loop is already strong:

- Multiplayer
- Dynamic market pricing
- Bean processing/crafting chains
- Full weather simulation
- Complex NPC schedules
- Deep automation networks
- Seasonal crop calendar

## Technical Risks

- Too much content logic in MonoBehaviours will make systems hard to test.
- Hardcoded bean or quest data will slow iteration quickly.
- Real-time crop updates on too many individual objects can create unnecessary scene overhead.
- Save-data schema churn can become painful without versioning early.
- Mining and challenge systems can drift from the main progression loop if rewards are not integrated carefully.

## Recommended Build Order

1. Core scene bootstrap and save framework
2. Player controller and interaction system
3. Plot system and crop growth simulation
4. Inventory and sell loop
5. Bean definitions and Bean Index
6. Land parcel unlock flow
7. Quest system
8. Upgrade system
9. Mining mini-game
10. UX polish, audio hooks, balancing tools

## Open Technical Questions

- Should the game use a continuous real-time world clock or pause crop simulation during menus and mini-games?
- Should mining exist in a separate scene or as an in-world sub-area?
- Is late-game automation a core feature or a post-launch stretch feature?
- Does the project need mod-friendly external data files, or is editor-authored content enough?
- How many simultaneous active plots should the target hardware support?
