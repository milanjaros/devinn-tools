// The UI is shared by the Windows web server and the bundled iOS web view.
// Native calls never pass through a local or hosted HTTP service.
(() => {
  const bridge = window.webkit?.messageHandlers?.aktion;
  window.aktionTransport = {
    native: Boolean(bridge),
    async request(path, body, csrf) {
      if (bridge) {
        try { return await bridge.postMessage({path, body: body ?? {}}); }
        catch (error) { throw new Error(error?.message || String(error)); }
      }
      const response = await fetch(path, body === undefined ? {} : {
        method: 'POST', headers: {'Content-Type': 'application/json', 'X-CSRF-Token': csrf},
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok) {
        const error = new Error(result.error || 'Požadavek se nezdařil.');
        error.status = response.status;
        throw error;
      }
      return result;
    }
  };
})();
