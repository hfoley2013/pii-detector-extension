/**
 * Development Auto-Reload Client
 *
 * This script connects to the dev server and reloads the extension
 * when file changes are detected.
 *
 * Only active in development mode (when dev server is running).
 */

(function() {
  // Only run in development
  const DEV_SERVER_PORT = 8976;
  const RECONNECT_INTERVAL = 3000;

  let ws = null;
  let reconnectTimeout = null;

  function connect() {
    try {
      ws = new WebSocket(`ws://localhost:${DEV_SERVER_PORT}`);

      ws.onopen = () => {
        console.log('🔄 Dev reload: Connected to dev server');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'reload') {
            console.log(`🔄 Dev reload: File changed - ${data.file}`);
            console.log('🔄 Dev reload: Reloading extension...');

            // Reload the extension
            chrome.runtime.reload();
          }
        } catch (e) {
          console.error('🔄 Dev reload: Error parsing message', e);
        }
      };

      ws.onclose = () => {
        console.log('🔄 Dev reload: Disconnected from dev server');
        scheduleReconnect();
      };

      ws.onerror = () => {
        // Silently fail - dev server probably not running
        ws.close();
      };

    } catch (e) {
      // WebSocket not available or connection failed
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    reconnectTimeout = setTimeout(connect, RECONNECT_INTERVAL);
  }

  // Start connection
  connect();

  console.log('🔄 Dev reload client loaded');
})();
