---
Status: Fixed
Area: proxy, infrastructure
Created: 2026-02-04
LastUpdated: 2026-02-04
---

# Bug: Proxy URL Escaping Error

**Type:** Bug Fix  
**Priority:** High  
**Status:** ✅ Fixed

---

## Problem Statement

When starting an npm app, the proxy fails to forward requests with the error:

```
TypeError [ERR_UNESCAPED_CHARACTERS]: Request path contains unescaped characters
    at new ClientRequest (node:_http_client:185:13)
    at Object.request (node:http:102:10)
    at Array.stream (http-proxy\lib\http-proxy\passes\web-incoming.js:126:74)
```

**Actual behavior:**
- App starts successfully on `http://localhost:5175/` (with trailing slash)
- Proxy is configured with the URL including trailing slash
- When proxy tries to forward requests, it creates malformed URLs causing the error
- The "Running App" iframe shows the error instead of the app

**Expected behavior:**
- App starts successfully
- Proxy correctly forwards requests to the target URL
- Iframe displays the running app

---

## Reproduction Steps

1. Open a React/Vite project in Naide
2. Click Play button to start the app
3. App starts and logs show URL: `http://localhost:5175/`
4. Proxy attempts to start
5. Iframe loads but shows TypeError error

---

## Root Cause

The issue is in `src/copilot-sidecar/src/proxy.ts`:

1. The backend (Rust) detects the URL as `http://localhost:5175/` (with trailing slash)
2. This URL is passed to `ProxyServer.start(targetUrl)`
3. The URL is used directly as the `target` in `createProxyMiddleware` configuration
4. When the proxy tries to construct request paths, it creates double slashes (e.g., `http://localhost:5175//`) or other malformed URLs
5. Node.js HTTP client rejects these malformed URLs with `ERR_UNESCAPED_CHARACTERS`

**The problem:** `http-proxy-middleware` doesn't handle trailing slashes properly when constructing target URLs.

---

## Solution

Strip the trailing slash from the target URL before configuring the proxy middleware.

### Changes Made

**File:** `src/copilot-sidecar/src/proxy.ts`

```typescript
async start(targetUrl: string): Promise<string> {
  if (this.server) {
    console.log('[Proxy] Server already running, stopping first');
    await this.stop();
  }

  // Strip trailing slash to avoid URL escaping issues
  const cleanTargetUrl = targetUrl.endsWith('/') ? targetUrl.slice(0, -1) : targetUrl;
  
  this.targetUrl = cleanTargetUrl;
  this.app = express();

  // Proxy middleware with response interception
  const proxyMiddleware = createProxyMiddleware({
    target: cleanTargetUrl,  // Use cleanTargetUrl
    // ... rest of config
  });
  
  // ... rest of function
}
```

**Key changes:**
1. Added `cleanTargetUrl` variable that strips trailing slash
2. Updated all references to use `cleanTargetUrl` instead of `targetUrl`
3. Preserved the clean URL in `this.targetUrl` for consistency

---

## Testing

### Manual Testing
1. Started React app (Vite) with trailing slash URL
2. Proxy started successfully
3. Iframe loaded without errors
4. App displayed correctly
5. Navigation tracking worked
6. Hot reload worked

### Edge Cases
- URL without trailing slash: works (no change needed)
- URL with trailing slash: works (slash is stripped)
- URL with path after slash: works (path preserved)

---

## Acceptance Criteria

- [x] Proxy handles URLs with trailing slashes
- [x] Proxy handles URLs without trailing slashes
- [x] No `ERR_UNESCAPED_CHARACTERS` errors
- [x] Iframe displays running app correctly
- [x] Navigation tracking still works
- [x] Hot reload still works
- [x] No console errors

---

## Files Modified

- `src/copilot-sidecar/src/proxy.ts` - Strip trailing slash from target URL

---

## Related Issues

- Part of [2026-02-04-support-running-apps.md](../2026-02-04-support-running-apps.md)
- Related to proxy implementation for npm app support

---

created by naide
