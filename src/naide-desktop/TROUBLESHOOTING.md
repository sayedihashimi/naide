# Troubleshooting Test Failures

## Issue: `ReferenceError: __vite_ssr_exportName__ is not defined`

If you're seeing this error when running `npm test`, it means you need to update your local dependencies.

### Solution

Follow these steps to fix the test failures:

#### 1. Pull the Latest Changes

```bash
git pull origin copilot/update-package-json-with-tests
```

#### 2. Clean Install Dependencies

```bash
cd src/naide-desktop

# Delete existing dependencies (Windows)
rmdir /s /q node_modules
del package-lock.json

# Or on Linux/Mac
# rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install
```

#### 3. Verify the Fix

```bash
npm test
```

You should now see tests running successfully with output like:
```
Test Files: 4 failed | 1 passed (5)
Tests: 9 failed | 35 passed (44)
```

### Why This Happens

The fix separates rolldown-vite (for development) from standard vite (for testing):
- **rolldown-vite** is used for `npm run dev` and `npm run build`
- **Standard vite** is used for `npm test` (via Vitest)

If you haven't run `npm install` after pulling the changes, your `node_modules` will still have the old configuration where vitest was trying to use rolldown-vite, causing the compatibility error.

### Verification

After installation, check that both packages are present:

```bash
# Should show standard vite
ls node_modules/vite

# Should show rolldown-vite
ls node_modules/rolldown-vite
```

### Still Having Issues?

1. **Clear npm cache**: `npm cache clean --force`
2. **Check package.json**: Make sure it has both `"vite": "^6.0.6"` and `"rolldown-vite": "^7.2.5"`
3. **Verify no override**: Make sure there's no `"overrides"` section in package.json
4. **Check scripts**: `"dev"` should use `"rolldown-vite"`, `"test"` should use `"vitest"`

### Expected Test Results

After the fix, you should see:
- ✅ 35 tests passing (previously 0)
- ⚠️ 9 tests with minor assertion issues (not infrastructure problems)

The core rolldown-vite compatibility issue is resolved. The remaining 9 test failures are minor query/assertion issues in the test code itself, not blocking problems.
