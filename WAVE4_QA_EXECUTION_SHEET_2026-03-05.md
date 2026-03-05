# Wave 4 QA Execution Sheet

Date: ____________  
Tester: ____________  
Environment: ☐ Local ☐ Staging ☐ Production  
Build/Commit: ____________  

## 1) Run Order (Recommended)
1. Documents
2. Finance
3. Supply Chain
4. Portfolio Analytics
5. Project Management
6. Timeline

## 2) Pass/Fail Matrix

| Module | Scenario | Result | Notes |
|---|---|---|---|
| Documents | Query + category + uploader + date range combined | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Documents | Reset Filters clears advanced controls correctly | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Documents | Filter state persists after refresh | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Finance (AP) | Query/status/sort + vendor + due-date range combined | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Finance (AR) | Query/status/sort + period range combined | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Finance | AP/AR reset works and does not break base toolbar | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Supply Chain (Requests) | Query/status/sort + requester + required-date range | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Supply Chain (Orders) | Query/status/sort + vendor + created-date range | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Supply Chain | Per-tab reset behavior is correct | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Portfolio Analytics | Query/health/sort + status + owner + end-date range | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Portfolio Analytics | Date filter excludes rows without end date when range applied | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Project Management | Query/status/sort + owner + deadline range | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Timeline | Query/status + resource + start-date range | ☐ PASS ☐ FAIL ☐ BLOCKED | |

## 3) Accessibility & UX Quick Checks
- [ ] Keyboard navigation reaches all advanced controls
- [ ] Labels are clear and match control purpose
- [ ] Result count updates after filter changes
- [ ] No layout break on desktop/tablet/mobile

## 4) Regression Quick Checks
- [ ] No console errors while switching tabs and changing filters repeatedly
- [ ] Existing create/edit/delete actions still work in touched modules
- [ ] Refresh persistence (localStorage) behaves as expected

## 5) Exit Decision
- Overall: ☐ PASS ☐ FAIL ☐ BLOCKED
- Critical defects count: ____
- Major defects count: ____
- Minor defects count: ____

## 6) Defect Log
1. ID: ____ | Module: ____ | Severity: ____ | Summary: __________________
2. ID: ____ | Module: ____ | Severity: ____ | Summary: __________________
3. ID: ____ | Module: ____ | Severity: ____ | Summary: __________________

## 7) Sign-off
QA Lead: __________________  
Product Owner: __________________  
Date: __________________
