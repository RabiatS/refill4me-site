// Landing page behaviour: the menu, the store badge, and the pilot form.
(function () {
  var cfg = window.REFILL_CONFIG || {};

  var toggle = document.querySelector("[data-nav-toggle]");
  var nav = document.querySelector("[data-nav]");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") nav.classList.remove("is-open");
    });
  }

  // The App Store badge points at the listing once there is one. Until then
  // it opens the web app, and says so.
  var badge = document.querySelector("[data-app-store]");
  if (badge) {
    if (cfg.appStoreUrl) {
      badge.href = cfg.appStoreUrl;
    } else {
      badge.querySelector("[data-app-store-small]").textContent = "iPhone app on TestFlight";
      badge.querySelector("[data-app-store-label]").textContent = "App Store listing soon";
      badge.title = "The iPhone app is in TestFlight for pilot users. Join the pilot to get access.";
      badge.href = "#pilot";
    }
  }

  // "Bring your store on board" preselects the store role.
  document.querySelectorAll('[data-role="store"]').forEach(function (a) {
    a.addEventListener("click", function () {
      var radio = document.querySelector('input[name="role"][value="store"]');
      if (radio) { radio.checked = true; radio.dispatchEvent(new Event("change", { bubbles: true })); }
    });
  });

  var form = document.querySelector("[data-pilot-form]");
  if (!form) return;
  var status = form.querySelector("[data-form-status]");
  var storeField = form.querySelector("[data-store-only]");
  form.addEventListener("change", function (e) {
    if (e.target.name === "role") storeField.hidden = e.target.value !== "store";
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var data = new FormData(form);
    var email = String(data.get("email") || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      status.className = "form-status err";
      status.textContent = "That email does not look right.";
      return;
    }
    var row = {
      email: email,
      role: data.get("role") === "store" ? "store" : "shopper",
      city: String(data.get("city") || "").trim() || null,
      store_name: String(data.get("store_name") || "").trim() || null,
      source: "website",
    };
    var button = form.querySelector("button[type=submit]");
    button.disabled = true;
    status.className = "form-status";
    status.textContent = "One moment.";
    try {
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error("not-configured");
      var res = await fetch(cfg.supabaseUrl + "/rest/v1/pilot_signups", {
        method: "POST",
        headers: {
          apikey: cfg.supabaseAnonKey,
          Authorization: "Bearer " + cfg.supabaseAnonKey,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(row),
      });
      if (res.status === 409) {
        status.className = "form-status ok";
        status.textContent = "You are already on the list. We will be in touch.";
      } else if (!res.ok) {
        throw new Error("http-" + res.status);
      } else {
        status.className = "form-status ok";
        status.textContent = row.role === "store"
          ? "Thank you. We will reach out about onboarding your store."
          : "You are in. We will email you when your spot opens.";
        form.reset();
        storeField.hidden = true;
      }
    } catch (err) {
      status.className = "form-status err";
      status.textContent = cfg.contactEmail
        ? "Sign up is not open just yet. Email " + cfg.contactEmail + " and we will add you by hand."
        : "Sign up is not open just yet. Please try again soon.";
    } finally {
      button.disabled = false;
    }
  });
})();
