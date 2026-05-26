# The-Big-One-Beta Deployment Files

## Files to Update in Your Repository

Upload/replace these files in your **The-Big-One-Beta** GitHub repository:

### Root Directory Files
1. **vite.config.ts** - Updated with:
   - Base path `/The-Big-One-Beta/`
   - PWA with `injectRegister: 'inline'` (fixes build error)
2. **index.html** - Clean template (no hardcoded scripts)
3. **package.json** - Dependencies and scripts
4. **tsconfig.json** - TypeScript configuration

### src/ Directory Files
1. **src/App.tsx** - Main app with all new features:
   - ROSC timer fix (stays at 2:00)
   - Checklist persistence
   - Tutorial integration
   - Button flash animations

2. **src/types.ts** - Updated with checklist state arrays

3. **src/TutorialOverlay.tsx** - Tutorial component

4. **src/index.css** - CSS with button flash animations

## What's Fixed/Added

### 1. Build Configuration ✓ (CRITICAL FIX)
- Base path set to `/The-Big-One-Beta/` for GitHub Pages
- **PWA plugin NOW USES INLINE INJECTION** - this fixes the `registerSW.js` error
- Changed from `injectRegister: 'auto'` to `injectRegister: 'inline'`
- Service worker registration code is now embedded in index.html
- Workbox glob patterns added

### 2. ROSC Timer ✓
- When logging "Disarm - ROSC", rhythm check timer stays at 2:00
- Sets `frozenCountdown: 120` to freeze display

### 3. Checklist Persistence ✓
- Check marks in Reversibles/ROSC/PHEA checklists persist
- State tracked in: `reversiblesChecked`, `roscChecked`, `pheaChecked` arrays
- Saved to localStorage with rest of app state

### 4. Tutorial ✓
- Interactive tutorial overlay system
- 6 tutorial screens with sequential nodes
- Button flash animations guide user through steps
- Works with real app state, not static screenshots

## After Uploading

1. Commit and push all files to The-Big-One-Beta repository
2. GitHub Actions will automatically build and deploy
3. **Build should now succeed** - no more `registerSW.js` errors
4. Site will be available at: `https://mattjonesactas.github.io/The-Big-One-Beta/`

## Why the Previous Builds Failed

The PWA plugin was trying to inject a separate `registerSW.js` script file, which Vite couldn't bundle properly. The `injectRegister: 'inline'` option embeds the service worker registration directly in the HTML instead, avoiding the bundling issue entirely.

## Switching to Production Later

When moving to the main **The-Big-One** repository:
- Change `vite.config.ts` line 7 to: `base: '/The-Big-One/',`
- Everything else stays the same
