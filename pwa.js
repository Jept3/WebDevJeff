(() => {
  const installBtn = document.getElementById("installAppBtn");
  const sheet = document.getElementById("pwaInstallSheet");
  const closeBtn = document.getElementById("closePwaInstall");
  const nativeBtn = document.getElementById("nativeInstallBtn");
  const instructions = document.getElementById("pwaInstallInstructions");
  let deferredPrompt = null;

  const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

  function showInstallButton() {
    if (!installBtn || isStandalone()) return;
    installBtn.classList.remove("hidden");
  }

  function hideInstallButton() {
    installBtn?.classList.add("hidden");
  }

  function openSheet() {
    if (!sheet) return;
    sheet.classList.remove("hidden");
    requestAnimationFrame(() => sheet.classList.add("is-open"));
    document.body.classList.add("pwa-sheet-open");

    if (instructions) {
      instructions.innerHTML = isIOS()
        ? '<strong>iPhone / iPad:</strong> Tap the <b>Share</b> button in Safari, then choose <b>Add to Home Screen</b> → <b>Add</b>.'
        : deferredPrompt
          ? '<strong>Ready to install.</strong> Tap “Install Jeffdesign101” below. It will open from your home screen like a standalone app.'
          : '<strong>Install from your browser menu:</strong> choose <b>Install app</b> or <b>Add to Home screen</b>.';
    }
    if (nativeBtn) nativeBtn.classList.toggle("hidden", !deferredPrompt);
  }

  function closeSheet() {
    if (!sheet) return;
    sheet.classList.remove("is-open");
    sheet.classList.add("hidden");
    document.body.classList.remove("pwa-sheet-open");
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hideInstallButton();
    closeSheet();
  });

  installBtn?.addEventListener("click", openSheet);
  closeBtn?.addEventListener("click", closeSheet);
  sheet?.addEventListener("click", event => {
    if (event.target === sheet) closeSheet();
  });
  nativeBtn?.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => null);
    deferredPrompt = null;
    closeSheet();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeSheet();
  });

  if (isIOS() && !isStandalone()) showInstallButton();
  if (isStandalone()) hideInstallButton();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(error => {
        console.warn("PWA service worker registration failed", error);
      });
    });
  }
})();
