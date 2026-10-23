/* CheckATS Auth — Supabase password login and device-independent email codes.
 *
 * Vendored on purpose: zero CDN dependency, so login works even when
 * third-party CDNs are slow or blocked. Uses the Supabase HTTP API directly.
 *
 * PUBLIC values only. The anon key is public by design (Supabase RLS model).
 * NEVER put the service_role key in frontend code.
 */
(function () {
  "use strict";

  var SUPABASE_URL = "https://qcjlagocvexlwbjvonps.supabase.co";
  // TODO(setup): paste the Supabase "anon public" key here.
  // Supabase dashboard -> checkats project -> Project Settings -> API -> "anon public".
  // Public by design (safe in frontend); keep service_role server-side only.
  var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjamxhZ29jdmV4bHdianZvbnBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MjI4NjEsImV4cCI6MjEwODI5ODg2MX0.evVu-7zJpsMbkFaKRHlvdAR1Jv8nc4DrRTy0mJwvS78";

  var STORAGE_KEY = "checkats-auth-session";
  var PKCE_KEY = STORAGE_KEY + "-pkce";
  // Must match Supabase dashboard -> Authentication -> URL Configuration -> Site URL.
  var REDIRECT_TO = "https://checkats.online/";

  var listeners = [];
  var OTP_KEY = STORAGE_KEY + '-email-verification';
  var RECOVERY_KEY = STORAGE_KEY + '-recovery-session';
  var pendingMemory = null, recoveryMemory = null, verificationVersion = 0;
  var EMAIL_CODE_TTL = 60 * 60 * 1000;

  function authError(code) { var error = new Error(code); error.code = code; return error; }
  function emailValue(email) {
    email = String(email || '').trim();
    if (email.length > 240 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw authError('invalid-email');
    return email;
  }
  function readTemporary(key, fallback) {
    try { var raw = sessionStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function writeTemporary(key, value) {
    try { if (value) sessionStorage.setItem(key, JSON.stringify(value)); else sessionStorage.removeItem(key); } catch (_) {}
  }
  function clearPending() { pendingMemory = null; writeTemporary(OTP_KEY, null); }
  function cancelEmailVerification() { verificationVersion++; clearPending(); }
  function cancelRecovery() { recoveryMemory = null; writeTemporary(RECOVERY_KEY, null); try { sessionStorage.removeItem('checkats_recovery'); } catch (_) {} }
  function getPendingEmailVerification() {
    var p = readTemporary(OTP_KEY, pendingMemory);
    if (!p || !['signup','recovery'].includes(p.purpose) || typeof p.email !== 'string' || !Number.isFinite(p.expiresAt) || p.expiresAt <= Date.now()) { clearPending(); return null; }
    return {email:p.email,purpose:p.purpose,requestedAt:p.requestedAt,resendAt:p.resendAt,expiresAt:p.expiresAt};
  }
  function savePending(email, purpose) {
    pendingMemory = {email:email,purpose:purpose,requestedAt:Date.now(),resendAt:Date.now()+60000,expiresAt:Date.now()+EMAIL_CODE_TTL};
    writeTemporary(OTP_KEY,pendingMemory);
  }
  function recoverySession() {
    var s = readTemporary(RECOVERY_KEY,recoveryMemory);
    if (!s || !s.access_token || isExpired(s)) { cancelRecovery(); return null; }
    return s;
  }
  function saveRecovery(s) { recoveryMemory=s; writeTemporary(RECOVERY_KEY,s); }
  async function authPost(path, body) {
    var response = await fetch(SUPABASE_URL+'/auth/v1/'+path,{method:'POST',headers:baseHeaders(),body:JSON.stringify(body)});
    var data = await response.json().catch(function(){return {};});
    if (!response.ok) {
      var error = authError(data.error_code || data.code || 'auth-request-failed');
      error.status=response.status;
      throw error;
    }
    return data;
  }
  async function resendEmailCode() {
    var pending=getPendingEmailVerification();
    if (!pending) throw authError('verification-expired');
    if (pending.resendAt>Date.now()) throw authError('resend-too-soon');
    var version=++verificationVersion;
    await authPost(pending.purpose==='recovery'?'recover':'resend',pending.purpose==='recovery'?{email:pending.email}:{email:pending.email,type:'signup'});
    if (version!==verificationVersion) throw authError('verification-cancelled');
    savePending(pending.email,pending.purpose);
    return getPendingEmailVerification();
  }
  async function verifyEmailCode(code) {
    var pending=getPendingEmailVerification(), version=verificationVersion;
    if (!pending) throw authError('verification-expired');
    code=String(code||'').trim();
    if (!/^\d{6,10}$/.test(code)) throw authError('invalid-code');
    var data=await authPost('verify',{email:pending.email,token:code,type:pending.purpose==='recovery'?'recovery':'email'});
    if (version!==verificationVersion) throw authError('verification-cancelled');
    var s=toSession(data);
    if (!s || !s.user || s.user.email.toLowerCase()!==pending.email.toLowerCase()) throw authError('bad-session');
    cancelEmailVerification();
    if (pending.purpose==='recovery') { saveRecovery(s); emit('PASSWORD_RECOVERY',null); }
    else { cancelRecovery(); saveSession(s); emit('SIGNED_IN',s); }
    return {purpose:pending.purpose,session:pending.purpose==='signup'?s:null};
  }

  function emit(event, session) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](event, session); } catch (e) {}
    }
  }

  function loadSession() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.access_token) return null;
      return s;
    } catch (e) { return null; }
  }

  function saveSession(s) {
    try {
      if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  function isExpired(s) {
    if (!s || !Number.isFinite(s.expires_at)) return true;
    return s.expires_at * 1000 - 60000 <= Date.now(); // 60s clock-skew buffer
  }

  function baseHeaders(extra) {
    var h = { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  function randomString(len) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    var rnd = new Uint8Array(len);
    (window.crypto || {}).getRandomValues
      ? window.crypto.getRandomValues(rnd)
      : Array.prototype.forEach.call(rnd, function (_, i) { rnd[i] = Math.floor(Math.random() * 256); });
    var out = "";
    for (var i = 0; i < len; i++) out += chars[rnd[i] % chars.length];
    return out;
  }

  function sha256base64url(str) {
    var data = new TextEncoder().encode(str);
    return crypto.subtle.digest("SHA-256", data).then(function (digest) {
      var bin = "";
      var bytes = new Uint8Array(digest);
      for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    });
  }

  function toSession(data) {
    if (!data || !data.access_token) return null;
    var expiresAt = Math.floor(Date.now() / 1000) + (data.expires_in || 3600);
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || null,
      expires_at: expiresAt,
      token_type: data.token_type || "bearer",
      user: data.user ? { id: data.user.id, email: data.user.email || "" } : null
    };
  }

  // Send a magic-link login email. Resolves when the email is accepted.
  async function signInWithEmail(email) {
    email = String(email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      var err = new Error("invalid-email");
      err.code = "invalid-email";
      throw err;
    }
    // PKCE: verifier is stored now, exchanged after the redirect back.
    var verifier = randomString(64);
    var challenge = await sha256base64url(verifier);
    try { localStorage.setItem(PKCE_KEY, verifier); } catch (e) {}
    var url = SUPABASE_URL + "/auth/v1/otp" +
      "?redirect_to=" + encodeURIComponent(REDIRECT_TO) +
      "&code_challenge=" + encodeURIComponent(challenge) +
      "&code_challenge_method=s256";
    var r = await fetch(url, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify({ email: email, data: {}, create_user: true })
    });
    if (!r.ok) {
      var msg = "";
      try { var j = await r.json(); msg = j.msg || j.message || j.error || ""; } catch (e) {}
      var e2 = new Error(msg || ("otp-failed-" + r.status));
      e2.code = "otp-failed";
      e2.status = r.status;
      throw e2;
    }
    return true;
  }

  function validateEmailPassword(email, password) {
    email = String(email || "").trim();
    password = String(password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      var err = new Error("invalid-email");
      err.code = "invalid-email";
      throw err;
    }
    if (password.length < 6) {
      var err2 = new Error("password-too-short");
      err2.code = "password-too-short";
      throw err2;
    }
    return { email: email, password: password };
  }

  // Email+password sign up. Supabase hashes the password server-side (bcrypt);
  // the plaintext never leaves the user's browser except over TLS to Supabase.
  async function signUp(email, password) {
    var creds = validateEmailPassword(email, password);
    var version=++verificationVersion;
    var r = await fetch(SUPABASE_URL + "/auth/v1/signup", {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify({ email: creds.email, password: creds.password, data: {} })
    });
    var data = null;
    try { data = await r.json(); } catch (e) {}
    if (!r.ok) {
      var msg = (data && (data.msg || data.message || data.error)) || ("signup-failed-" + r.status);
      var e2 = new Error(msg);
      e2.code = data && (data.error_code || data.code) || "signup-failed";
      e2.status = r.status;
      throw e2;
    }
    // If email confirmation is on, there's no session yet — user must click the link.
    var s = toSession(data);
    if (version!==verificationVersion) throw authError('verification-cancelled');
    if (s) {
      clearPending();cancelRecovery();
      saveSession(s);
      emit("SIGNED_IN", s);
    } else savePending(creds.email,'signup');
    return { session: s, needsConfirmation: !s };
  }

  // Email+password sign in. Works on any device — no device-mismatch issue.
  async function signInWithPassword(email, password) {
    var creds = validateEmailPassword(email, password);
    var r = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify({ email: creds.email, password: creds.password })
    });
    var data = null;
    try { data = await r.json(); } catch (e) {}
    if (!r.ok) {
      var msg = (data && (data.msg || data.message || data.error_description || data.error)) || ("login-failed-" + r.status);
      var e3 = new Error(msg);
      e3.code = data && (data.error_code || data.code) || "login-failed";
      e3.status = r.status;
      throw e3;
    }
    var s = toSession(data);
    if (!s) throw new Error("bad-session");
    cancelEmailVerification();cancelRecovery();
    saveSession(s);
    emit("SIGNED_IN", s);
    return s;
  }

  async function exchangeCodeForSession(code) {
    var verifier = null;
    try { verifier = localStorage.getItem(PKCE_KEY); } catch (e) {}
    if (!verifier) {
      var err = new Error("pkce-verifier-missing");
      err.code = "pkce-verifier-missing";
      throw err;
    }
    var r = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=pkce", {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify({ auth_code: code, code_verifier: verifier })
    });
    try { localStorage.removeItem(PKCE_KEY); } catch (e) {}
    if (!r.ok) {
      var e3 = new Error("code-exchange-failed-" + r.status);
      e3.code = "code-exchange-failed";
      throw e3;
    }
    var data = await r.json();
    var s = toSession(data);
    if (!s) throw new Error("bad-session");
    saveSession(s);
    emit("SIGNED_IN", s);
    return s;
  }

  // Implicit-flow fallback: tokens arrive in the URL hash.
  function sessionFromHash() {
    var hash = (location.hash || "").replace(/^#/, "");
    if (!hash || hash.indexOf("access_token=") === -1) return null;
    var params = {};
    hash.split("&").forEach(function (pair) {
      var kv = pair.split("=");
      if (kv[0]) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || "");
    });
    if (!params.access_token) return null;
    var s = {
      access_token: params.access_token,
      refresh_token: params.refresh_token || null,
      expires_at: Math.floor(Date.now() / 1000) + (parseInt(params.expires_in || "3600", 10) || 3600),
      token_type: params.token_type || "bearer",
      user: null
    };
    if (params.type === "recovery") {
      saveRecovery(s);
      emit('PASSWORD_RECOVERY',null);
      return s;
    }
    saveSession(s);
    emit("SIGNED_IN", s);
    return s;
  }

  function cleanAuthParamsFromUrl() {
    try {
      var url = new URL(location.href);
      var changed = false;
      if (url.searchParams.has("code")) { url.searchParams.delete("code"); changed = true; }
      if (location.hash && location.hash.indexOf("access_token=") !== -1) changed = true;
      if (changed) {
        history.replaceState(null, "", url.pathname + url.search + (location.hash.indexOf("access_token=") !== -1 ? "" : location.hash));
      }
    } catch (e) {}
  }

  // Call once on page load: completes a pending magic-link redirect.
  async function handleRedirectCallback() {
    var params = new URLSearchParams(location.search || "");
    var code = params.get("code");
    if (code) {
      try {
        var s = await exchangeCodeForSession(code);
        cleanAuthParamsFromUrl();
        return s;
      } catch (e) {
        cleanAuthParamsFromUrl();
        throw e;
      }
    }
    var hs = sessionFromHash();
    if (hs) cleanAuthParamsFromUrl();
    return hs;
  }

  async function refreshSession() {
    var s = loadSession();
    if (!s || !s.refresh_token) return null;
    try {
      var r = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        headers: baseHeaders(),
        body: JSON.stringify({ refresh_token: s.refresh_token })
      });
      if (!r.ok) { saveSession(null); emit("SIGNED_OUT", null); return null; }
      var data = await r.json();
      var ns = toSession(data);
      if (!ns) { saveSession(null); return null; }
      if (!ns.user) ns.user = s.user;
      saveSession(ns);
      return ns;
    } catch (e) { return s; } // network hiccup: keep old session, let API call decide
  }

  function getSession() {
    var s = loadSession();
    if (!s) return null;
    if (isExpired(s)) return null; // use getAccessToken() for auto-refresh
    return s;
  }

  async function getAccessToken() {
    var s = loadSession();
    if (!s) return null;
    if (!isExpired(s)) return s.access_token;
    var ns = await refreshSession();
    return ns ? ns.access_token : null;
  }

  async function resetPasswordForEmail(email) {
    email=emailValue(email);
    var pending=getPendingEmailVerification();
    if(pending&&pending.email.toLowerCase()===email.toLowerCase()&&pending.purpose==='recovery'&&pending.resendAt>Date.now())throw authError('resend-too-soon');
    var version=++verificationVersion;
    await authPost('recover',{email:email});
    if(version!==verificationVersion)throw authError('verification-cancelled');
    cancelRecovery();savePending(email,'recovery');
    return getPendingEmailVerification();
  }

  async function updatePassword(newPassword) {
    if (!newPassword || newPassword.length < 6) {
      var e = new Error("Password must be at least 6 characters.");
      e.code = "password-too-short";
      throw e;
    }
    var recovery = recoverySession();
    if (!recovery) throw authError('recovery-verification-required');
    var token = recovery.access_token;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.msg || data.error_description || "Failed to update password");
    }
    var user = await res.json().catch(function(){return null;});
    if(user&&user.id)recovery.user={id:user.id,email:user.email||''};
    cancelRecovery();cancelEmailVerification();
    saveSession(recovery);emit('SIGNED_IN',recovery);
    return true;
  }

  function isRecoverySession() {
    return !!recoverySession();
  }

  async function signOut() {
    cancelEmailVerification();cancelRecovery();
    try { sessionStorage.removeItem("checkats_recovery"); } catch (e) {}
    var s = loadSession();
    if (s && s.access_token) {
      try {
        await fetch(SUPABASE_URL + "/auth/v1/logout", {
          method: "POST",
          headers: baseHeaders({ "Authorization": "Bearer " + s.access_token })
        });
      } catch (e) {}
    }
    saveSession(null);
    try { localStorage.removeItem(PKCE_KEY); } catch (e) {}
    emit("SIGNED_OUT", null);
  }

  function onAuthStateChange(cb) {
    if (typeof cb === "function") listeners.push(cb);
    return function () {
      var i = listeners.indexOf(cb);
      if (i !== -1) listeners.splice(i, 1);
    };
  }

  // Public API
  window.CheckATSAuth = {
    signInWithEmail: signInWithEmail,
    signUp: signUp,
    signInWithPassword: signInWithPassword,
    resetPasswordForEmail: resetPasswordForEmail,
    getPendingEmailVerification: getPendingEmailVerification,
    verifyEmailCode: verifyEmailCode,
    resendEmailCode: resendEmailCode,
    cancelEmailVerification: cancelEmailVerification,
    cancelRecovery: cancelRecovery,
    updatePassword: updatePassword,
    isRecoverySession: isRecoverySession,
    signOut: signOut,
    getSession: getSession,
    getAccessToken: getAccessToken,
    onAuthStateChange: onAuthStateChange,
    handleRedirectCallback: handleRedirectCallback,
    configured: function () {
      return SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.indexOf("PASTE_") !== 0;
    }
  };
})();
