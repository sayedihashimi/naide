import express from 'express';
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import { Server, IncomingMessage, ServerResponse } from 'http';
import type { Socket } from 'net';

const PROXY_PORT = 3002;

// Script that gets injected into HTML responses to track navigation
const TRACKING_SCRIPT = `
<script>
(function() {
  console.log('[Naide] Navigation tracking script loaded');
  
  // Only run if we're in an iframe
  if (window.parent === window) {
    console.log('[Naide] Not in iframe, skipping');
    return;
  }
  
  // Send current URL to parent
  function sendNavigation() {
    console.log('[Naide] Sending navigation:', window.location.href);
    try {
      window.parent.postMessage({
        type: 'naide-navigation',
        url: window.location.href
      }, '*');
    } catch (e) {
      console.error('[Naide] Failed to send navigation:', e);
    }
  }
  
  // Send initial page load
  sendNavigation();
  
  // Listen for navigation changes
  window.addEventListener('popstate', sendNavigation);
  
  // Intercept link clicks (for SPAs)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    sendNavigation();
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    sendNavigation();
  };
})();
</script>
`;

export class ProxyServer {
  private app: express.Express | null = null;
  private server: Server | null = null;
  private targetUrl: string | null = null;

  async start(targetUrl: string): Promise<string> {
    if (this.server) {
      console.log('[Proxy] Server already running, stopping first');
      await this.stop();
    }

    // Strip trailing slash to avoid URL escaping issues
    const cleanTargetUrl = targetUrl.endsWith('/') ? targetUrl.slice(0, -1) : targetUrl;
    
    this.targetUrl = cleanTargetUrl;
    this.app = express();

    // Middleware to encode URL path before proxy handles it
    // This fixes ERR_UNESCAPED_CHARACTERS errors for paths with special characters
    this.app.use((req, res, next) => {
      try {
        // Split path and query string
        const [pathPart, queryPart] = req.url.split('?');
        // Encode each path segment, preserving already-encoded parts
        const encodedPath = pathPart.split('/').map(segment => {
          // Check if segment contains characters that need encoding
          // and isn't already encoded
          try {
            // Decode first to normalize, then re-encode
            const decoded = decodeURIComponent(segment);
            return encodeURIComponent(decoded);
          } catch {
            // If decoding fails, it might have invalid sequences - encode as-is
            return encodeURIComponent(segment);
          }
        }).join('/');
        // Reconstruct full URL
        req.url = queryPart ? `${encodedPath}?${queryPart}` : encodedPath;
      } catch (e) {
        console.error('[Proxy] Error encoding URL:', e);
      }
      next();
    });

    // Proxy middleware with response interception
    const proxyMiddleware = createProxyMiddleware({
      target: cleanTargetUrl,
      changeOrigin: true,
      ws: true, // Proxy WebSocket connections (for hot reload)
      selfHandleResponse: true, // We'll handle the response to inject script
      on: {
        proxyReq: (proxyReq, req, res) => {
          console.log(`[Proxy] ${req.method} ${req.url} -> ${cleanTargetUrl}${proxyReq.path}`);
        },
        proxyRes: responseInterceptor(
          async (responseBuffer, proxyRes, req, res) => {
            const contentType = proxyRes.headers['content-type'] || '';
            
            // Only inject script into HTML responses
            if (contentType.includes('text/html')) {
              let html = responseBuffer.toString('utf8');
              
              // Inject script before closing </body> tag if it exists
              if (html.includes('</body>')) {
                html = html.replace('</body>', `${TRACKING_SCRIPT}</body>`);
              } else if (html.includes('</html>')) {
                // Fallback: inject before closing </html> tag
                html = html.replace('</html>', `${TRACKING_SCRIPT}</html>`);
              } else {
                // Fallback: append to end
                html += TRACKING_SCRIPT;
              }
              
              return Buffer.from(html, 'utf8');
            }
            
            // Return other content types unchanged
            return responseBuffer;
          }
        ),
        error: (err: Error, req: IncomingMessage, res: ServerResponse | Socket) => {
          console.error('[Proxy] Error:', err.message);
          if (res instanceof ServerResponse && !res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
          }
        },
      },
    });

    this.app.use('/', proxyMiddleware);

    return new Promise((resolve, reject) => {
      this.server = this.app!.listen(PROXY_PORT, () => {
        const proxyUrl = `http://localhost:${PROXY_PORT}`;
        console.log(`[Proxy] Started on ${proxyUrl} -> ${cleanTargetUrl}`);
        resolve(proxyUrl);
      });

      this.server.on('error', (err: Error) => {
        console.error('[Proxy] Failed to start:', err);
        reject(err);
      });

      // Handle WebSocket upgrade for hot reload
      this.server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
        console.log('[Proxy] WebSocket upgrade request');
        proxyMiddleware.upgrade!(req, socket, head);
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          console.log('[Proxy] Stopped');
          this.server = null;
          this.app = null;
          this.targetUrl = null;
          resolve();
        });
      });
    }
  }

  isRunning(): boolean {
    return this.server !== null;
  }

  getTargetUrl(): string | null {
    return this.targetUrl;
  }
}

// Singleton instance
export const proxyServer = new ProxyServer();
