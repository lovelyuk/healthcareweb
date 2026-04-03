
(function () {
  const KEY = "bodycheck_user_email";

  function normalizeEmail(value) {
    return (value || "").trim();
  }

  function getEmailFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return normalizeEmail(params.get("email"));
  }

  function getStoredEmail() {
    try {
      return normalizeEmail(localStorage.getItem(KEY));
    } catch (e) {
      return "";
    }
  }

  function setStoredEmail(email) {
    const next = normalizeEmail(email);
    if (!next) return "";
    try {
      localStorage.setItem(KEY, next);
    } catch (e) {}
    return next;
  }

  function getCurrentUserEmail() {
    const fromUrl = getEmailFromUrl();
    if (fromUrl) return setStoredEmail(fromUrl);
    return getStoredEmail();
  }

  function appendEmailToHref(href) {
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return href;
    const email = getCurrentUserEmail();
    if (!email) return href;
    try {
      const url = new URL(href, window.location.href);
      url.searchParams.set("email", email);
      return url.toString();
    } catch (e) {
      return href;
    }
  }

  function syncNavLinks() {
    document.querySelectorAll(".nav-menu a, a[data-preserve-email='true']").forEach((node) => {
      const href = node.getAttribute("href");
      if (!href) return;
      node.setAttribute("href", appendEmailToHref(href));
    });
  }

  window.BodyCheckUser = {
    key: KEY,
    getCurrentUserEmail,
    getStoredEmail,
    setStoredEmail,
    appendEmailToHref,
    syncNavLinks,
  };
})();
