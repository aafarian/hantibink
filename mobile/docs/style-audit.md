# Hardcoded Colors Audit

**Generated**: 2026-03-31
**Purpose**: Document all hardcoded color values in components/ and screens/ directories for migration to theme tokens.

## Theme Token Reference

Source: `mobile/src/styles/Theme.js`

| Token Path                    | Value                | Description               |
| ----------------------------- | -------------------- | ------------------------- |
| `colors.primary`              | `#D32F2F`            | Armenian red              |
| `colors.secondary`            | `#1565C0`            | Armenian blue             |
| `colors.accent`               | `#F57C00`            | Armenian orange           |
| `colors.premium`              | `#FFD700`            | Gold for premium features |
| `colors.text.primary`         | `#333`               | Primary text              |
| `colors.text.secondary`       | `#666`               | Secondary text            |
| `colors.text.muted`           | `#999`               | Muted text                |
| `colors.text.white`           | `#fff`               | White text                |
| `colors.background.primary`   | `#fff`               | Primary background        |
| `colors.background.secondary` | `#f8f9fa`            | Secondary background      |
| `colors.background.overlay`   | `rgba(0, 0, 0, 0.5)` | Overlay background        |
| `colors.status.success`       | `#4CAF50`            | Success green             |
| `colors.status.error`         | `#F44336`            | Error red                 |
| `colors.status.warning`       | `#FF9800`            | Warning orange            |
| `colors.status.info`          | `#2196F3`            | Info blue                 |
| `colors.border.light`         | `#e0e0e0`            | Light border              |
| `colors.border.medium`        | `#ccc`               | Medium border             |

---

## Summary Statistics

- **Total files with hardcoded colors**: 61
- **Components directory**: 33 files
- **Screens directory**: 28 files
- **Priority tiers**: High (core/shared), Medium (feature screens), Low (auth/modals)

---

## Priority 1: High-Use Shared Components

These files are used across multiple screens and should be migrated first.

### ProfileBottomSheet.js

**Path**: `mobile/src/components/shared/ProfileBottomSheet.js`
**Occurrences**: 22

| Line                                             | Hardcoded Value          | Recommended Token                                   |
| ------------------------------------------------ | ------------------------ | --------------------------------------------------- |
| 237, 265, 271, 287, 293, 303, 319, 325, 331, 337 | `#666`                   | `theme.colors.text.secondary`                       |
| 397, 469                                         | `#333`                   | `theme.colors.text.primary`                         |
| 424                                              | `#fff` (default)         | `theme.colors.text.white`                           |
| 426                                              | `#fff` (default)         | `theme.colors.text.white`                           |
| 445, 496, 567                                    | `#fff`                   | `theme.colors.background.primary`                   |
| 450                                              | `#ddd`                   | `theme.colors.border.medium`                        |
| 461                                              | `#f0f0f0`                | `theme.colors.border.light` (needs addition)        |
| 487                                              | `#f8f9fa`                | `theme.colors.background.secondary`                 |
| 501, 523                                         | `#1a1a1a`                | `theme.colors.text.primary` (darker variant needed) |
| 507, 528, 542                                    | `#4a4a4a`                | `theme.colors.text.primary` (variant needed)        |
| 516, 532                                         | `#999`                   | `theme.colors.text.muted`                           |
| 552                                              | `rgba(211, 47, 47, 0.1)` | `theme.colors.primary + opacity`                    |
| 587                                              | `#fff`                   | `theme.colors.text.white`                           |

### ProfileCard.js

**Path**: `mobile/src/components/shared/ProfileCard.js`
**Occurrences**: 18

| Line                        | Hardcoded Value         | Recommended Token                          |
| --------------------------- | ----------------------- | ------------------------------------------ |
| 96, 190, 329, 339, 373, 388 | `#fff`                  | `theme.colors.text.white`                  |
| 136                         | `rgba(255,255,255,0.5)` | `theme.colors.text.white + opacity`        |
| 174                         | `rgba(0,0,0,0.8)`       | `theme.colors.background.overlay` (darker) |
| 277                         | `#2a2a2a`               | New token needed: `colors.card.dark`       |
| 278                         | `#000`                  | `theme.shadows` (shadowColor)              |
| 306                         | `rgba(255,255,255,0.4)` | `theme.colors.text.white + opacity`        |
| 309, 368                    | `#fff`                  | `theme.colors.background.primary`          |
| 344                         | `rgba(255,255,255,0.9)` | `theme.colors.text.white + opacity`        |
| 357, 405                    | `rgba(255,255,255,0.7)` | `theme.colors.text.white + opacity`        |
| 382                         | `rgba(255,255,255,0.2)` | `theme.colors.text.white + opacity`        |

### Toast.js

**Path**: `mobile/src/components/Toast.js`
**Occurrences**: 31

| Line                                   | Hardcoded Value                | Recommended Token                            |
| -------------------------------------- | ------------------------------ | -------------------------------------------- |
| 84                                     | `#4CAF50`                      | `theme.colors.status.success`                |
| 90                                     | `#F44336`                      | `theme.colors.status.error`                  |
| 96                                     | `#FF9800`                      | `theme.colors.status.warning`                |
| 102, 472, 486                          | `#333`                         | `theme.colors.text.primary`                  |
| 177, 207, 222, 225, 363, 385, 420, 477 | `#fff`                         | `theme.colors.text.white`                    |
| 311, 469, 507                          | `#555`                         | `theme.colors.text.secondary` (close match)  |
| 343                                    | `#000`                         | `theme.shadows` (shadowColor)                |
| 369                                    | `rgba(255,255,255,0.7)`        | `theme.colors.text.white + opacity`          |
| 380, 349                               | `rgba(255, 255, 255, 0.2/0.9)` | `theme.colors.text.white + opacity`          |
| 401                                    | `rgba(0,0,0,0.5)`              | `theme.colors.background.overlay`            |
| 404, 438                               | `#fff`                         | `theme.colors.background.primary`            |
| 433, 451                               | `#eee`                         | `theme.colors.border.light`                  |
| 440, 481                               | `#f0f0f0`                      | `theme.colors.border.light` (needs addition) |
| 444, 490, 495                          | `#333`                         | `theme.colors.text.primary`                  |
| 464, 500                               | `#f5f5f5`                      | `theme.colors.background.secondary` (close)  |
| 483, 513                               | `#888`                         | `theme.colors.text.muted` (close)            |
| 492                                    | `#666`                         | `theme.colors.text.secondary`                |

### FilterPreferencesForm.js

**Path**: `mobile/src/components/shared/FilterPreferencesForm.js`
**Occurrences**: 33

| Line                              | Hardcoded Value | Recommended Token                            |
| --------------------------------- | --------------- | -------------------------------------------- |
| 239, 521                          | `#E5E5EA`       | New token needed: `colors.switch.track`      |
| 240, 378                          | `#f4f3f4`       | New token needed: `colors.switch.thumb`      |
| 240, 525, 630, 721, 741           | `#fff`          | `theme.colors.background.primary`            |
| 277, 294, 308, 505, 564, 571, 760 | `#fff`          | `theme.colors.text.white`                    |
| 529                               | `#000`          | `theme.shadows` (shadowColor)                |
| 586, 746                          | `#f0f0f0`       | `theme.colors.border.light` (needs addition) |
| 591, 613, 639, 679, 730           | `#666`          | `theme.colors.text.secondary`                |
| 608, 657, 706                     | `#333`          | `theme.colors.text.primary`                  |
| 629, 720                          | `#E5E5EA`       | `theme.colors.border.light`                  |
| 643, 733                          | `#fff`          | `theme.colors.text.white`                    |
| 662                               | `#F8F8F8`       | `theme.colors.background.secondary`          |
| 674, 695, 699                     | `#999`          | `theme.colors.text.muted`                    |

### PhotoViewer.js

**Path**: `mobile/src/components/shared/PhotoViewer.js`
**Occurrences**: 24

| Line                                        | Hardcoded Value    | Recommended Token                                          |
| ------------------------------------------- | ------------------ | ---------------------------------------------------------- |
| 180, 265                                    | `#666`             | `theme.colors.text.secondary`                              |
| 205                                         | `#FF4444` / `#ccc` | `theme.colors.status.error` / `theme.colors.border.medium` |
| 238, 247                                    | `#fff`             | `theme.colors.text.white`                                  |
| 279, 281, 360, 435                          | `#333`             | `theme.colors.text.primary`                                |
| 302, 305, 310, 317, 326, 381, 397, 419, 438 | `#fff`             | `theme.colors.background.primary`                          |
| 271, 305                                    | `#ccc`             | `theme.colors.border.medium`                               |
| 328, 399, 283, 405                          | `#f0f0f0` / `#ddd` | `theme.colors.border.light`                                |
| 332, 349, 424, 276                          | `#f8f9fa`          | `theme.colors.background.secondary`                        |
| 369                                         | `#000`             | New token: `colors.background.dark`                        |
| 379                                         | `rgba(0,0,0,0.5)`  | `theme.colors.background.overlay`                          |
| 429                                         | `#e9ecef`          | `theme.colors.border.light`                                |
| 448                                         | `#fff`             | `theme.colors.text.white`                                  |

---

## Priority 2: Core Feature Screens

### ChatScreen.js

**Path**: `mobile/src/screens/ChatScreen.js`
**Occurrences**: 16

| Line             | Hardcoded Value           | Recommended Token                   |
| ---------------- | ------------------------- | ----------------------------------- |
| 1261             | `#fff`                    | `theme.colors.text.white`           |
| 1341             | `#00000080`               | `theme.colors.background.overlay`   |
| 1344             | `#666`                    | `theme.colors.text.secondary`       |
| 1346, 1355, 1363 | `#fff`                    | `theme.colors.background.primary`   |
| 1347             | `rgba(211, 47, 47, 0.15)` | `theme.colors.primary + opacity`    |
| 1350             | `#f5f5f5`                 | `theme.colors.background.secondary` |
| 1351, 1354       | `#999`                    | `theme.colors.text.muted`           |
| 1352             | `#333`                    | `theme.colors.text.primary`         |
| 1413, 1417       | `#fff`                    | `theme.colors.background.primary`   |
| 1447             | `#f0f0f0`                 | `theme.colors.border.light`         |
| 1460             | `#666`                    | `theme.colors.text.secondary`       |
| 1473             | `#000`                    | `theme.shadows` (shadowColor)       |

### PeopleScreenOptimized.js

**Path**: `mobile/src/screens/PeopleScreenOptimized.js`
**Occurrences**: 24

| Line                    | Hardcoded Value       | Recommended Token                                        |
| ----------------------- | --------------------- | -------------------------------------------------------- |
| 601, 628                | `#fff` / `#ccc`       | `theme.colors.text.white` / `theme.colors.border.medium` |
| 683                     | `#666`                | `theme.colors.text.secondary`                            |
| 743                     | `#FFB300`             | `theme.colors.accent` (close)                            |
| 750, 859                | `#FF5252`             | `theme.colors.status.error` (close)                      |
| 763, 870, 192           | `#00BCD4`             | New token: `colors.superlike`                            |
| 770, 863                | `#4CAF50`             | `theme.colors.status.success`                            |
| 812, 745                | `#f8f9fa`             | `theme.colors.background.secondary`                      |
| 820, 847, 186, 194, 890 | `rgba/white variants` | Various white with opacity                               |
| 824, 851, 878           | `#000`                | `theme.shadows` (shadowColor)                            |
| 877                     | `#FFB300`             | `theme.colors.accent`                                    |
| 904                     | `#333`                | `theme.colors.text.primary`                              |
| 909, 940                | `#666`                | `theme.colors.text.secondary`                            |
| 928, 951                | `#fff`                | `theme.colors.text.white`                                |

### ProfileScreen.js

**Path**: `mobile/src/screens/ProfileScreen.js`
**Occurrences**: 47

| Line                                   | Hardcoded Value                | Recommended Token                   |
| -------------------------------------- | ------------------------------ | ----------------------------------- |
| 147                                    | `#ccc`                         | `theme.colors.border.medium`        |
| 255, 302                               | `#999`                         | `theme.colors.text.muted`           |
| 316, 621, 682, 901, 926                | `#666`                         | `theme.colors.text.secondary`       |
| 411, 420, 429, 438                     | `#ccc`                         | `theme.colors.border.medium`        |
| 524, 591, 745                          | `#f8f9fa`                      | `theme.colors.background.secondary` |
| 531, 607, 687, 877                     | `#fff`                         | `theme.colors.background.primary`   |
| 559, 571, 600                          | `rgba(0,0,0,0.3/0.7)`          | `theme.colors.background.overlay`   |
| 578, 737                               | `#fff`                         | `theme.colors.text.white`           |
| 587                                    | `#ddd`                         | `theme.colors.border.medium`        |
| 596, 814, 851, 914, 946                | `#999`                         | `theme.colors.text.muted`           |
| 603, 617, 631, 660, 701, 822, 859, 930 | `#333`                         | `theme.colors.text.primary`         |
| 638, 671, 707, 753, 779, 804, 841, 890 | `rgba(211, 47, 47, *)`         | `theme.colors.primary + opacity`    |
| 645, 678, 758                          | `rgba(211, 47, 47, 0.12/0.15)` | `theme.colors.primary + opacity`    |
| 695, 798, 835                          | `#F0F0F0`                      | `theme.colors.border.light`         |
| 726                                    | `rgba(211, 47, 47, 0.7)`       | `theme.colors.primary + opacity`    |
| 866                                    | `#e0e0e0`                      | `theme.colors.border.light`         |
| 878                                    | `#000`                         | `theme.shadows` (shadowColor)       |
| 907, 936                               | `#f5f5f5` / `#f8f8f8`          | `theme.colors.background.secondary` |
| 940                                    | `#e0e0e0`                      | `theme.colors.border.light`         |

### LikedYouScreen.js

**Path**: `mobile/src/screens/LikedYouScreen.js`
**Occurrences**: 11

| Line          | Hardcoded Value | Recommended Token                   |
| ------------- | --------------- | ----------------------------------- |
| 745, 838      | `#f8f9fa`       | `theme.colors.background.secondary` |
| 827, 849      | `#333`          | `theme.colors.text.primary`         |
| 832, 860, 909 | `#666` / `#555` | `theme.colors.text.secondary`       |
| 844           | `#eee`          | `theme.colors.border.light`         |
| 897           | `#fff`          | `theme.colors.text.white`           |

---

## Priority 3: Supporting Components

### FullscreenSwipeableCard.js

**Path**: `mobile/src/components/FullscreenSwipeableCard.js`
**Occurrences**: 30

| Line                    | Hardcoded Value       | Recommended Token                                            |
| ----------------------- | --------------------- | ------------------------------------------------------------ |
| 289                     | `#666` / `#ccc`       | `theme.colors.text.secondary` / `theme.colors.border.medium` |
| 318, 454, 462, 530, 549 | `#fff`                | `theme.colors.text.white`                                    |
| 443, 531, 550           | `rgba(0,0,0,0.5/0.7)` | `theme.colors.background.overlay`                            |
| 495, 574, 588, 618      | `#fff`                | `theme.colors.background.primary`                            |
| 568                     | `rgba(0,0,0,0.5)`     | `theme.colors.background.overlay`                            |
| 581                     | `#e0e0e0`             | `theme.colors.border.light`                                  |
| 593, 608, 630           | `#888` / `#999`       | `theme.colors.text.muted`                                    |
| 602, 644, 662           | `#333` / `#222`       | `theme.colors.text.primary`                                  |
| 612                     | `#bbb`                | `theme.colors.text.muted` (close)                            |
| 625                     | `#f0f0f0`             | `theme.colors.border.light`                                  |
| 655                     | `#f5f5f5`             | `theme.colors.background.secondary`                          |
| 676, 683                | `#4CAF50`             | `theme.colors.status.success`                                |
| 692, 699                | `#FF5252`             | `theme.colors.status.error` (close)                          |

### SwipeableCardStack.js

**Path**: `mobile/src/components/SwipeableCardStack.js`
**Occurrences**: 5

| Line     | Hardcoded Value | Recommended Token                   |
| -------- | --------------- | ----------------------------------- |
| 279      | `#ccc`          | `theme.colors.border.medium`        |
| 343      | `#f5f5f5`       | `theme.colors.background.secondary` |
| 367      | `#333`          | `theme.colors.text.primary`         |
| 372, 378 | `#666`          | `theme.colors.text.secondary`       |

### AudioMessage.js

**Path**: `mobile/src/components/AudioMessage.js`
**Occurrences**: 12

| Line          | Hardcoded Value          | Recommended Token                                         |
| ------------- | ------------------------ | --------------------------------------------------------- |
| 308           | `rgba(255,255,255,0.25)` | `theme.colors.text.white + opacity`                       |
| 309, 310, 313 | `#fff`                   | `theme.colors.text.white`                                 |
| 311           | `rgba(255,255,255,0.4)`  | `theme.colors.text.white + opacity`                       |
| 312           | `rgba(255,255,255,0.9)`  | `theme.colors.text.white + opacity`                       |
| 316           | `rgba(0,0,0,0.08)`       | New token needed                                          |
| 317, 320      | `#666` / `#888`          | `theme.colors.text.secondary` / `theme.colors.text.muted` |
| 318, 321      | `#555`                   | `theme.colors.text.secondary`                             |
| 319           | `rgba(0,0,0,0.2)`        | `theme.colors.background.overlay` (variant)               |

### AudioRecorder.js

**Path**: `mobile/src/components/AudioRecorder.js`
**Occurrences**: 13

| Line          | Hardcoded Value    | Recommended Token                                          |
| ------------- | ------------------ | ---------------------------------------------------------- |
| 403           | `#F44336`          | `theme.colors.status.error`                                |
| 439           | `#999`             | `theme.colors.text.muted`                                  |
| 454           | `#fff`             | `theme.colors.text.white`                                  |
| 466           | `#ccc` / `#F44336` | `theme.colors.border.medium` / `theme.colors.status.error` |
| 497           | `#FEE2E2`          | New token: `colors.error.light`                            |
| 500, 527, 554 | `#F44336`          | `theme.colors.status.error`                                |
| 537           | `#999`             | `theme.colors.text.muted`                                  |
| 541, 560      | `#F44336` / `#333` | `theme.colors.status.error` / `theme.colors.text.primary`  |

### RangeSlider.js

**Path**: `mobile/src/components/RangeSlider.js`
**Occurrences**: 8

| Line     | Hardcoded Value | Recommended Token                   |
| -------- | --------------- | ----------------------------------- |
| 168      | `#333`          | `theme.colors.text.primary`         |
| 179      | `#F8F8F8`       | `theme.colors.background.secondary` |
| 187, 256 | `#999`          | `theme.colors.text.muted`           |
| 200, 210 | `#E5E5EA`       | New token: `colors.slider.track`    |
| 233      | `#FFF`          | `theme.colors.background.primary`   |
| 234      | `#000`          | `theme.shadows` (shadowColor)       |

### MatchCard.js

**Path**: `mobile/src/components/MatchCard.js`
**Occurrences**: 3

| Line     | Hardcoded Value          | Recommended Token                |
| -------- | ------------------------ | -------------------------------- |
| 253, 260 | `#4CAF50`                | `theme.colors.status.success`    |
| 288      | `rgba(211, 47, 47, 0.1)` | `theme.colors.primary + opacity` |

---

## Priority 4: Modal Components

### ProfileSetupModal/index.js

**Path**: `mobile/src/components/modals/ProfileSetupModal/index.js`
**Occurrences**: 20

| Line                  | Hardcoded Value      | Recommended Token                                         |
| --------------------- | -------------------- | --------------------------------------------------------- |
| 966, 1119, 1139, 1148 | `#666` / `#999`      | `theme.colors.text.secondary` / `theme.colors.text.muted` |
| 1022                  | `#FFF`               | `theme.colors.text.white`                                 |
| 1039                  | `rgba(0, 0, 0, 0.5)` | `theme.colors.background.overlay`                         |
| 1050, 1128            | `#FFF`               | `theme.colors.background.primary`                         |
| 1070                  | `#F5F5F5`            | `theme.colors.background.secondary`                       |
| 1075, 1172            | `#333` / `#FFF`      | `theme.colors.text.primary` / `theme.colors.text.white`   |
| 1079, 1148            | `#666` / `#999`      | `theme.colors.text.secondary` / `theme.colors.text.muted` |
| 1095                  | `#E5E5E5`            | `theme.colors.border.light`                               |

### ReportReasonModal.js

**Path**: `mobile/src/components/ReportReasonModal.js`
**Occurrences**: 16

| Line          | Hardcoded Value      | Recommended Token                 |
| ------------- | -------------------- | --------------------------------- |
| 52            | `#666`               | `theme.colors.text.secondary`     |
| 92            | `#999`               | `theme.colors.text.muted`         |
| 112, 243      | `#fff`               | `theme.colors.text.white`         |
| 129           | `rgba(0, 0, 0, 0.5)` | `theme.colors.background.overlay` |
| 133           | `#fff`               | `theme.colors.background.primary` |
| 146, 170, 229 | `#f0f0f0`            | `theme.colors.border.light`       |
| 151, 193, 215 | `#333`               | `theme.colors.text.primary`       |
| 158, 206      | `#666`               | `theme.colors.text.secondary`     |
| 180, 211      | `#ddd`               | `theme.colors.border.medium`      |
| 220           | `#999`               | `theme.colors.text.muted`         |

### SelectionPanel.js

**Path**: `mobile/src/components/SelectionPanel.js`
**Occurrences**: 13

| Line               | Hardcoded Value       | Recommended Token                          |
| ------------------ | --------------------- | ------------------------------------------ |
| 104, 143, 222      | `#007AFF`             | `theme.colors.secondary` (or new iOS blue) |
| 136, 248           | `#fff`                | `theme.colors.text.white`                  |
| 166                | `rgba(0, 0, 0, 0.5)`  | `theme.colors.background.overlay`          |
| 173, 211, 231, 247 | `#fff`                | `theme.colors.background.primary`          |
| 184, 208, 240      | `#E5E5EA` / `#F0F0F0` | `theme.colors.border.light`                |
| 192, 218, 244      | `#333`                | `theme.colors.text.primary`                |
| 230, 246           | `#C8C7CC`             | `theme.colors.border.medium`               |

### GifPicker.js

**Path**: `mobile/src/components/GifPicker.js`
**Occurrences**: 18

| Line                         | Hardcoded Value         | Recommended Token                   |
| ---------------------------- | ----------------------- | ----------------------------------- |
| 150                          | `#E91E63`               | New token: `colors.gif.accent`      |
| 159, 171, 199, 203, 211, 354 | `#999`                  | `theme.colors.text.muted`           |
| 191, 264, 271, 285           | `#333`                  | `theme.colors.text.primary`         |
| 247                          | `#fff`                  | `theme.colors.background.primary`   |
| 256, 300                     | `#eee` / `#f0f0f0`      | `theme.colors.border.light`         |
| 272                          | `#f5f5f5`               | `theme.colors.background.secondary` |
| 315, 320, 326                | `#666`                  | `theme.colors.text.secondary`       |
| 333                          | `#E91E63`               | New token: `colors.gif.accent`      |
| 337                          | `#fff`                  | `theme.colors.text.white`           |
| 349                          | `rgba(255,255,255,0.9)` | `theme.colors.text.white + opacity` |

### LocationPicker.js

**Path**: `mobile/src/components/LocationPicker.js`
**Occurrences**: 17

| Line                    | Hardcoded Value | Recommended Token                                          |
| ----------------------- | --------------- | ---------------------------------------------------------- |
| 80, 150, 182, 334, 353  | `#007AFF`       | `theme.colors.secondary` (or iOS blue)                     |
| 88                      | `#4CAF50`       | `theme.colors.status.success`                              |
| 203, 210                | `#666`          | `theme.colors.text.secondary`                              |
| 243, 274                | `#ddd` / `#eee` | `theme.colors.border.medium` / `theme.colors.border.light` |
| 256, 313, 339, 371, 196 | `#333`          | `theme.colors.text.primary`                                |
| 262, 304                | `#999` / `#666` | `theme.colors.text.muted` / `theme.colors.text.secondary`  |
| 328, 365                | `#f5f5f5`       | `theme.colors.background.secondary`                        |

### ConfirmationModal.js

**Path**: `mobile/src/components/ConfirmationModal.js`
**Occurrences**: 7

| Line        | Hardcoded Value      | Recommended Token                 |
| ----------- | -------------------- | --------------------------------- |
| 55          | `rgba(0, 0, 0, 0.5)` | `theme.colors.background.overlay` |
| 61          | `#fff`               | `theme.colors.background.primary` |
| 70          | `#333`               | `theme.colors.text.primary`       |
| 76, 97, 102 | `#666`               | `theme.colors.text.secondary`     |
| 92          | `#f0f0f0`            | `theme.colors.border.light`       |
| 105         | `#fff`               | `theme.colors.text.white`         |

### LocationPromptModal.js

**Path**: `mobile/src/components/LocationPromptModal.js`
**Occurrences**: 19

| Line                             | Hardcoded Value | Recommended Token                                             |
| -------------------------------- | --------------- | ------------------------------------------------------------- |
| 45, 116, 203, 216, 225, 258, 259 | `#007AFF`       | `theme.colors.secondary` (or iOS blue)                        |
| 53                               | `#4CAF50`       | `theme.colors.status.success`                                 |
| 97                               | `#FF9800`       | `theme.colors.status.warning`                                 |
| 105                              | `#F44336`       | `theme.colors.status.error`                                   |
| 179, 231, 267                    | `#fff`          | `theme.colors.background.primary` / `theme.colors.text.white` |
| 194, 209, 263                    | `#333`          | `theme.colors.text.primary`                                   |
| 201, 242                         | `#666`          | `theme.colors.text.secondary`                                 |
| 247                              | `#f8f9fa`       | `theme.colors.background.secondary`                           |
| 249                              | `#e1e5e9`       | `theme.colors.border.light`                                   |

---

## Priority 5: Auth Screens

### LoginScreen.js

**Path**: `mobile/src/screens/auth/LoginScreen.js`
**Occurrences**: 21

| Line               | Hardcoded Value | Recommended Token                    |
| ------------------ | --------------- | ------------------------------------ |
| 219, 361           | `#f8f9fa`       | `theme.colors.background.secondary`  |
| 304, 339, 370      | `#666`          | `theme.colors.text.secondary`        |
| 321, 369, 431      | `#fff`          | `theme.colors.text.white`            |
| 380, 407, 466, 382 | `#333`          | `theme.colors.text.primary`          |
| 385, 447, 474, 484 | `#666`          | `theme.colors.text.secondary`        |
| 394, 454           | `#fff`          | `theme.colors.background.primary`    |
| 399, 458           | `#e0e0e0`       | `theme.colors.border.light`          |
| 443                | `#e0e0e0`       | `theme.colors.background.secondary`  |
| 490, 501           | `#FFF5F5`       | New token: `colors.error.background` |
| 507                | `#FFD1D1`       | New token: `colors.error.border`     |
| 514                | `#D32F2F`       | `theme.colors.primary`               |

### SimpleRegisterScreen.js

**Path**: `mobile/src/screens/auth/SimpleRegisterScreen.js`
**Occurrences**: 18

| Line          | Hardcoded Value | Recommended Token                    |
| ------------- | --------------- | ------------------------------------ |
| 292           | `#333`          | `theme.colors.text.primary`          |
| 378, 414      | `#666`          | `theme.colors.text.secondary`        |
| 474           | `#f8f9fa`       | `theme.colors.background.secondary`  |
| 492, 506      | `#333`          | `theme.colors.text.primary`          |
| 510, 521, 293 | `#fff`          | `theme.colors.background.primary`    |
| 516, 524      | `#e0e0e0`       | `theme.colors.border.light`          |
| 549           | `#FFB6B6`       | New token: `colors.error.light`      |
| 552, 296      | `#fff`          | `theme.colors.text.white`            |
| 563, 582, 594 | `#666`          | `theme.colors.text.secondary`        |
| 573           | `#FFF5F5`       | New token: `colors.error.background` |

### SetNewPasswordScreen.js

**Path**: `mobile/src/screens/auth/SetNewPasswordScreen.js`
**Occurrences**: 27

| Line                        | Hardcoded Value       | Recommended Token                                      |
| --------------------------- | --------------------- | ------------------------------------------------------ |
| 30                          | `#ccc`                | `theme.colors.border.medium`                           |
| 39                          | `#D32F2F`             | `theme.colors.primary`                                 |
| 40, 331                     | `#FF9800`             | `theme.colors.status.warning`                          |
| 41                          | `#FFC107`             | New token: `colors.strength.good`                      |
| 42, 210, 212, 218, 226, 242 | `#4CAF50`             | `theme.colors.status.success`                          |
| 43                          | `#2E7D32`             | New token: `colors.strength.veryStrong`                |
| 93                          | `#333`                | `theme.colors.text.primary`                            |
| 124, 167                    | `#999`                | `theme.colors.text.muted`                              |
| 138                         | `#e0e0e0`             | `theme.colors.border.light`                            |
| 176, 181                    | `#4CAF50` / `#D32F2F` | `theme.colors.status.success` / `theme.colors.primary` |
| 198, 353                    | `#fff`                | `theme.colors.text.white`                              |
| 239, 345                    | `#f8f9fa`             | `theme.colors.background.secondary`                    |
| 246, 284, 349, 354          | `#fff`                | `theme.colors.background.primary`                      |
| 252                         | `#000`                | `theme.shadows` (shadowColor)                          |
| 270, 298, 352, 356, 358     | `#333`                | `theme.colors.text.primary`                            |
| 276, 369                    | `#666`                | `theme.colors.text.secondary`                          |
| 290, 351, 355               | `#e0e0e0`             | `theme.colors.border.light`                            |

---

## Priority 6: Chat Components

### ChatHeader.js

**Path**: `mobile/src/screens/chat/ChatHeader.js`
**Occurrences**: 9

| Line        | Hardcoded Value | Recommended Token                 |
| ----------- | --------------- | --------------------------------- |
| 36, 79, 115 | `#333`          | `theme.colors.text.primary`       |
| 69          | `#FFB800`       | `theme.colors.premium` (close)    |
| 92          | `#f0f0f0`       | `theme.colors.border.light`       |
| 93          | `#fff`          | `theme.colors.background.primary` |
| 133, 140    | `#4CAF50`       | `theme.colors.status.success`     |
| 145         | `#666`          | `theme.colors.text.secondary`     |

### ChatMessageBubble.js

**Path**: `mobile/src/screens/chat/ChatMessageBubble.js`
**Occurrences**: 18

| Line          | Hardcoded Value                                        | Recommended Token                          |
| ------------- | ------------------------------------------------------ | ------------------------------------------ |
| 288           | `#4CAF50`                                              | `theme.colors.status.success`              |
| 292, 296      | `#999`                                                 | `theme.colors.text.muted`                  |
| 300, 269      | `#FFB800`                                              | `theme.colors.premium` (close)             |
| 366           | `#F0F0F3`                                              | New token: `colors.chat.received`          |
| 371, 386, 487 | `#000`                                                 | `theme.shadows` (shadowColor)              |
| 400           | `#1c1c1e`                                              | `theme.colors.text.primary` (darker)       |
| 406           | `#FFFFFF`                                              | `theme.colors.text.white`                  |
| 436, 439      | `rgba(211, 47, 47, 0.15)` / `rgba(21, 101, 192, 0.12)` | `theme.colors.primary/secondary + opacity` |
| 472, 475, 510 | `#666` / `#555`                                        | `theme.colors.text.secondary`              |
| 480, 540      | `#fff`                                                 | `theme.colors.background.primary`          |
| 486           | `rgba(0, 0, 0, 0.08)`                                  | New token needed                           |
| 526           | `#8e8e93`                                              | `theme.colors.text.muted`                  |

### ChatInput.js

**Path**: `mobile/src/screens/chat/ChatInput.js`
**Occurrences**: 5

| Line | Hardcoded Value    | Recommended Token                                       |
| ---- | ------------------ | ------------------------------------------------------- |
| 81   | `#F44336` / `#999` | `theme.colors.status.error` / `theme.colors.text.muted` |
| 105  | `#fff`             | `theme.colors.background.primary`                       |
| 115  | `#666`             | `theme.colors.text.secondary`                           |
| 126  | `#f5f5f5`          | `theme.colors.background.secondary`                     |

### ChatReplyPreview.js

**Path**: `mobile/src/screens/ChatScreen/ChatReplyPreview.js`
**Occurrences**: 4

| Line   | Hardcoded Value | Recommended Token                   |
| ------ | --------------- | ----------------------------------- |
| 40, 80 | `#666`          | `theme.colors.text.secondary`       |
| 52     | `#f5f5f5`       | `theme.colors.background.secondary` |
| 54     | `#e0e0e0`       | `theme.colors.border.light`         |

### ChatMenu.js

**Path**: `mobile/src/screens/chat/ChatMenu.js`
**Occurrences**: 10

| Line       | Hardcoded Value      | Recommended Token                 |
| ---------- | -------------------- | --------------------------------- |
| 18, 19, 24 | `#333`               | `theme.colors.text.primary`       |
| 26         | `#FF9800`            | `theme.colors.status.warning`     |
| 27, 28     | `#F44336`            | `theme.colors.status.error`       |
| 67         | `rgba(0, 0, 0, 0.4)` | `theme.colors.background.overlay` |
| 73         | `#fff`               | `theme.colors.background.primary` |
| 77         | `#000`               | `theme.shadows` (shadowColor)     |
| 89         | `#f0f0f0`            | `theme.colors.border.light`       |

### ChatReactionsSheet.js

**Path**: `mobile/src/screens/chat/ChatReactionsSheet.js`
**Occurrences**: 12

| Line               | Hardcoded Value | Recommended Token                                        |
| ------------------ | --------------- | -------------------------------------------------------- |
| 157                | `#fff`          | `theme.colors.text.white`                                |
| 190                | `#fff`          | `theme.colors.background.primary`                        |
| 195, 282           | `#ddd` / `#999` | `theme.colors.border.medium` / `theme.colors.text.muted` |
| 212, 262           | `#333`          | `theme.colors.text.primary`                              |
| 219, 250, 261, 294 | `#f0f0f0`       | `theme.colors.border.light`                              |
| 233, 260           | `#666`          | `theme.colors.text.secondary`                            |
| 268                | `#999`          | `theme.colors.text.muted`                                |

---

## Priority 7: Other Screens

### AccountSettingsScreen.js

**Path**: `mobile/src/screens/AccountSettingsScreen.js`
**Occurrences**: 17

| Line               | Hardcoded Value | Recommended Token                                         |
| ------------------ | --------------- | --------------------------------------------------------- |
| 131                | `#FF3B30`       | `theme.colors.status.error` (iOS red)                     |
| 134                | `#ccc`          | `theme.colors.border.medium`                              |
| 145, 272           | `#fff`          | `theme.colors.text.white`                                 |
| 192                | `#e0e0e0`       | `theme.colors.border.light`                               |
| 193                | `#f4f3f4`       | New token: `colors.switch.thumb`                          |
| 246                | `#999`          | `theme.colors.text.muted`                                 |
| 288, 331, 363      | `#333`          | `theme.colors.text.primary`                               |
| 293, 326, 370, 382 | `#666` / `#999` | `theme.colors.text.secondary` / `theme.colors.text.muted` |
| 298, 342           | `#f0f0f0`       | `theme.colors.border.light`                               |
| 301, 366           | `#FF3B30`       | `theme.colors.status.error` (iOS red)                     |
| 307                | `#f8f9fa`       | `theme.colors.background.secondary`                       |
| 354                | `#FF3B3015`     | `theme.colors.status.error + opacity`                     |

### NotificationSettingsScreen.js

**Path**: `mobile/src/screens/NotificationSettingsScreen.js`
**Occurrences**: 14

| Line              | Hardcoded Value | Recommended Token                |
| ----------------- | --------------- | -------------------------------- |
| 83                | `#E5E5EA`       | New token: `colors.switch.track` |
| 84                | `#f4f3f4`       | New token: `colors.switch.thumb` |
| 94, 111, 125, 178 | `#fff`          | `theme.colors.text.white`        |
| 153, 246          | `#999`          | `theme.colors.text.muted`        |
| 192, 212          | `#f0f0f0`       | `theme.colors.border.light`      |
| 197, 230          | `#333`          | `theme.colors.text.primary`      |
| 202, 234          | `#666`          | `theme.colors.text.secondary`    |

### LegalScreen.js

**Path**: `mobile/src/screens/LegalScreen.js`
**Occurrences**: 7

| Line     | Hardcoded Value | Recommended Token                                           |
| -------- | --------------- | ----------------------------------------------------------- |
| 205      | `#fff`          | `theme.colors.text.white`                                   |
| 225      | `#fff`          | `theme.colors.background.primary`                           |
| 241      | `#fff`          | `theme.colors.text.white`                                   |
| 249      | `#888`          | `theme.colors.text.muted`                                   |
| 256, 268 | `#333` / `#555` | `theme.colors.text.primary` / `theme.colors.text.secondary` |
| 262      | `#555`          | `theme.colors.text.secondary`                               |

---

## Required Theme Token Additions

Based on this audit, the following tokens should be added to Theme.js:

### New Color Tokens Needed

```javascript
colors: {
  // ... existing tokens

  // Text variants
  text: {
    // ... existing
    dark: '#1a1a1a',     // Darker primary text
    darker: '#1c1c1e',   // iOS-style dark text
  },

  // Background variants
  background: {
    // ... existing
    dark: '#000',        // Dark/black background
    card: '#2a2a2a',     // Dark card background
  },

  // Border variants
  border: {
    // ... existing
    lighter: '#f0f0f0',  // Very light border
    veryLight: '#eee',   // Even lighter
  },

  // Switch/toggle controls
  switch: {
    track: '#E5E5EA',
    trackActive: theme.colors.primary,
    thumb: '#f4f3f4',
    thumbActive: '#fff',
  },

  // Chat bubbles
  chat: {
    received: '#F0F0F3',
    sent: theme.colors.primary,
  },

  // Error states
  error: {
    light: '#FEE2E2',
    background: '#FFF5F5',
    border: '#FFD1D1',
  },

  // Action buttons
  action: {
    pass: '#FF5252',
    like: '#4CAF50',
    superlike: '#00BCD4',
    undo: '#FFB300',
  },

  // iOS-style colors
  ios: {
    blue: '#007AFF',
    red: '#FF3B30',
  },

  // Special use
  gif: {
    accent: '#E91E63',
  },
}
```

---

## Migration Strategy

### Phase 1: High-Impact Shared Components (Week 1)

1. ProfileBottomSheet.js
2. ProfileCard.js
3. Toast.js
4. FilterPreferencesForm.js
5. PhotoViewer.js

### Phase 2: Core Screens (Week 2)

1. ChatScreen.js
2. PeopleScreenOptimized.js
3. ProfileScreen.js
4. LikedYouScreen.js

### Phase 3: Supporting Components (Week 3)

1. FullscreenSwipeableCard.js
2. SwipeableCardStack.js
3. AudioMessage.js
4. AudioRecorder.js
5. RangeSlider.js
6. MatchCard.js

### Phase 4: Modals (Week 4)

1. ProfileSetupModal
2. ReportReasonModal
3. SelectionPanel
4. GifPicker
5. LocationPicker
6. ConfirmationModal
7. LocationPromptModal

### Phase 5: Auth & Chat (Week 5)

1. All auth screens
2. All chat components

---

## Notes

- **Total hardcoded color instances**: ~500+
- **Unique color values**: ~80
- **Colors mapping directly to theme**: ~60%
- **New tokens needed**: ~15
- **iOS-style colors (#007AFF, #FF3B30)**: Consider keeping or creating ios namespace
- **Shadow colors**: All should use theme.shadows or a consistent shadowColor token
