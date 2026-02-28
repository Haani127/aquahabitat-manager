/* ==========================================================
   AUTH.JS — Shared authentication utilities
   ========================================================== */

const Auth = (() => {
  "use strict";

  const TOKEN_KEY = "token";
  const USER_KEY  = "user";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = "/login";
  }

  function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = "/login";
      return false;
    }
    return true;
  }

  function redirectIfLoggedIn() {
    if (isLoggedIn()) {
      window.location.href = "/dashboard";
    }
  }

  // Password visibility toggle
  function initPasswordToggle() {
    const btn = document.getElementById("toggle-pass");
    const input = document.getElementById("password");
    if (!btn || !input) return;

    btn.addEventListener("click", () => {
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      btn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
    });
  }

  // Auto-init on DOMContentLoaded
  document.addEventListener("DOMContentLoaded", () => {
    initPasswordToggle();

    // If on login/signup, redirect if already logged in
    const path = window.location.pathname;
    if (path === "/login" || path === "/signup" || path === "/login.html" || path === "/signup.html") {
      redirectIfLoggedIn();
    }
  });

  return { getToken, getUser, isLoggedIn, logout, requireAuth, redirectIfLoggedIn };
})();
