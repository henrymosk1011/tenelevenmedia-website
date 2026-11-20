// The Unsubscribe page: as soon as it opens, it sends the link's code (?t=) to the
// unsubscribe function, which stops emailing that lead for good. One click on the link in
// the email is all it takes. If it can't reach the function, "Try again" sends it again.
(function () {
  var API = "https://onpdkqzcgnoepwiqcgtv.supabase.co/functions/v1/unsubscribe";
  var REPLY = "You can also reply \"unsubscribe\" to any of our emails and we'll take you off.";
  var t = new URLSearchParams(location.search).get("t") || "";
  var title = document.getElementById("title");
  var lead = document.getElementById("lead");
  var go = document.getElementById("go");
  var status = document.getElementById("status");

  function say(text, bad) {
    status.textContent = text;
    status.className = bad ? "status bad" : "status";
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) {
    title.textContent = "Unsubscribe from our emails";
    lead.textContent = "This link is missing part of its address, so it can't unsubscribe you on its own. " + REPLY;
    return;
  }

  function run() {
    go.hidden = true;
    say("");
    fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: t }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (body) { return { ok: r.ok, body: body }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error((res.body && res.body.error) || "Something went wrong.");
        title.textContent = "You're unsubscribed";
        lead.textContent = "You won't get any more emails from us. Sorry for the bother.";
        lead.hidden = false;
        title.focus();
      })
      .catch(function (e) {
        title.textContent = "We couldn't unsubscribe you yet";
        lead.hidden = true;
        go.hidden = false;
        say((e && e.message ? e.message + " " : "") + REPLY, true);
      });
  }

  go.addEventListener("click", run);
  run();
})();
