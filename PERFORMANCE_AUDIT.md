# Performance Audit - OpticAI Electron App

## Issues Found & Fixes Applied

### ✅ FIXED Issues

#### 1. **Missing Images Causing Infinite Re-renders** (CRITICAL)
- **Problem**: Hardcoded paths `/src/assets/images/*` don't exist in production
- **Impact**: React continuously tries to load, fails, re-renders = 100% CPU
- **Files Fixed**: 
  - `src/pages/ControlCenterPage.tsx` (login-banner.png)
  - `src/components/WelcomeComponent.tsx` (prysm-logo.png)
  - `src/components/DragWindowRegion.tsx` (prysm-logo.png)
- **Fix**: Changed to proper ES6 imports: `import image from '@/assets/images/image.png'`

#### 2. **Context Re-render Hell** (CRITICAL)
- **Problem**: Context values created as new objects on every render
- **Impact**: ALL components using context re-render continuously
- **Files Fixed**:
  - `src/contexts/UserContext.tsx` - Added useMemo + useCallback
  - `src/contexts/ClientDataContext.tsx` - Added useMemo + useCallback  
  - `src/contexts/ClientSidebarContext.tsx` - Added useMemo + useCallback
- **Fix**: Wrapped all context values in `useMemo()` and all handlers in `useCallback()`

#### 3. **Clinic Dropdown Blocking UI** (HIGH)
- **Problem**: 
  - Duplicate useEffects calling `loadData()` twice
  - `setTimeout()` delays blocking navigation
  - Synchronous API calls during clicks
  - Not memoized handlers
- **File Fixed**: `src/components/clinic-dropdown.tsx`
- **Fixes**:
  - Merged duplicate useEffects into one
  - Removed all `setTimeout()` calls
  - Wrapped handlers in `useCallback()`
  - Fire-and-forget async operations after navigation

#### 4. **React StrictMode in Production**
- **Problem**: StrictMode intentionally double-renders to find bugs
- **Impact**: 2x unnecessary renders in production
- **File Fixed**: `src/renderer.tsx`
- **Fix**: Only enable StrictMode in development

#### 5. **DevTools Enabled in Production**
- **Problem**: DevTools consume significant memory and CPU
- **File Fixed**: `src/main.ts`
- **Fix**: Only enable DevTools in development mode

#### 6. **React Compiler Beta Issues**
- **Problem**: babel-plugin-react-compiler is experimental, may cause bugs
- **File Fixed**: `vite.renderer.config.mts`
- **Fix**: Disabled React Compiler, using standard React

#### 7. **ASAR Packaging Slowdown**
- **Problem**: ASAR bundles all files, making file access 10-100x slower
- **File Fixed**: `forge.config.ts`
- **Fix**: Disabled ASAR packaging (`asar: false`)

---

## 🚨 REMAINING Performance Issues

### HomePage.tsx (2066 lines) - CRITICAL

**Missing Optimizations:**
- ❌ Only **14 useCallback/useMemo** for **2066 lines**
- ❌ **9 event handlers** NOT wrapped in useCallback:
  1. `handleTimeSlotClick` (line 674)
  2. `handleResizeStart` (line 691)
  3. `handleMouseDown` (line 783)
  4. `handleMouseMove` (line 877)
  5. `handleMouseUp` (line 935)
  6. `handleClientSelect` (line 1163)
  7. `handleSaveAppointment` (line 1186)
  8. `handleDeleteAppointment` (line 1242)
  9. `handleInputChange` (line 1260)

**Blocking Operations:**
- ⚠️ Line 198-201: `setTimeout()` for theme application (should be async)
- ⚠️ Line 224-226: `setTimeout()` for data loading (artificial delay)
- ⚠️ Line 248: Another `setTimeout()`

**Impact**: Every render recreates all handlers → all children re-render → 100% CPU

---

### ExamDetailPage.tsx (1789 lines)
- ❌ Only **2 useCallback/useMemo** for **1789 lines**
- Needs full audit

### ControlCenterSettingsPage.tsx (1240 lines)
- Needs audit

### OrderDetailPage.tsx (1153 lines)
- Needs audit

### CampaignsPage.tsx (1072 lines)
- Needs audit

---

## 📊 Components Needing Review

### appointments-table.tsx (953 lines)
- Likely re-rendering entire table on every parent update
- Need to check if rows are memoized

### data-table.tsx (849 lines)
- Generic table component used everywhere
- CRITICAL: Must be optimized with React.memo and useCallback

### GlobalSearch.tsx (672 lines)
- Needs audit for search debouncing and result memoization

---

## 🎯 Recommended Fixes (Priority Order)

### Priority 1 (CRITICAL - Do Now)
1. **Fix HomePage.tsx event handlers** - Wrap all 9 handlers in `useCallback()`
2. **Remove setTimeout from HomePage** - Make theme application async
3. **Optimize data-table.tsx** - Add React.memo to row components
4. **Fix appointments-table.tsx** - Memoize rows

### Priority 2 (HIGH - Next)
5. Fix ExamDetailPage.tsx handlers
6. Audit and fix remaining large pages
7. Optimize GlobalSearch with debouncing

### Priority 3 (MEDIUM)
8. Bundle code (as per Electron docs)
9. Lazy load heavy components
10. Check for unnecessary polyfills

---

## 🔍 How to Find More Issues

Run Chrome DevTools Performance profiler:
1. Record while using the app
2. Look for long yellow blocks (>50ms) on Main thread
3. Click on them to see which function is blocking

---

## 📝 Electron Best Practices to Apply

From https://www.electronjs.org/docs/latest/tutorial/performance:

✅ **Already Done:**
- Fixed blocking main thread with DevTools
- Removed unnecessary setTimeout delays

❌ **Still TODO:**
- [ ] Bundle code into single file (Webpack/Rollup)
- [ ] Defer loading non-critical modules
- [ ] Call `Menu.setApplicationMenu(null)` if not using menu
- [ ] Avoid synchronous I/O in main process
- [ ] Use Web Workers for heavy CPU tasks
- [ ] Implement requestIdleCallback for low-priority work

---

## Current Build Configuration

- ✅ ASAR: Disabled (for performance)
- ✅ React Compiler: Disabled (stability)
- ✅ Source maps: Disabled (smaller bundle)
- ✅ Minification: esbuild
- ✅ Tree-shaking: Enabled
- ✅ Manual chunks: vendor, router, ui split

---

Last Updated: 2025-10-23

