/**
 * magnificTabPath() returns this tab's path, such as "/app/ai-image-generator".
 * It reads the browser's tab list, because page.url() can lag after an in-app
 * navigation. null means the tab is gone.
 *
 * Needs: no other helper.
 */

globalThis.magnificTabPath = async () => {
  const tab = (await listBrowserTabs()).find((t) => t.targetId === page.targetId);
  return tab ? new URL(tab.url).pathname : null;
};
