---
Status: Fixed
Area: proxy, infrastructure
Created: 2026-02-04
LastUpdated: 2026-02-05
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
4. The original fix attempted to use `pathRewrite` with `encodeURIComponent` to pre-encode paths
5. However, this caused double-encoding issues - the http-proxy library expects unencoded paths and handles encoding internally
6. Node.js HTTP client rejects the double-encoded URLs with `ERR_UNESCAPED_CHARACTERS`

**The problems:** 
1. `http-proxy-middleware` doesn't handle trailing slashes properly when constructing target URLs
2. Using `pathRewrite` with `encodeURIComponent` causes double-encoding since http-proxy already handles URL encoding

---

## Solution

Two-part fix:
1. Strip the trailing slash from the target URL before configuring the proxy middleware
2. Remove the `pathRewrite` function that was causing double-encoding issues

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
    target: cleanTargetUrl,
    changeOrigin: true,
    ws: true, // Proxy WebSocket connections (for hot reload)
    selfHandleResponse: true, // We'll handle the response to inject script
    // Don't rewrite paths - let them pass through as-is
    // The http-proxy library will handle URL encoding internally
    on: {
      // ... proxy event handlers
    }
  });
  
  // ... rest of function
}
```

**Key changes:**
1. Added `cleanTargetUrl` variable that strips trailing slash
2. Removed `encodeUrlPath` helper function
3. Removed `pathRewrite` configuration that was causing double-encoding
4. Let http-proxy-middleware handle URL encoding internally
5. Updated all references to use `cleanTargetUrl` instead of `targetUrl`
6. Preserved the clean URL in `this.targetUrl` for consistency

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
