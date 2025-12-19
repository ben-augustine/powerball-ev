// POST to your Worker. Keep using workers.dev (works fine even with your domain on Pages).
const CONTACT_ENDPOINT = "https://powerball-ev-data.ben-augustine319.workers.dev/contact";

function $(id) { return document.getElementById(id); }

$("contactForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const status = $("status");
  const btn = $("sendBtn");
  status.textContent = "Sending…";
  btn.disabled = true;

  const payload = {
    website: $("website").value || "",         // honeypot
    fromEmail: $("fromEmail").value || "",
    subject: $("subject").value || "",
    message: $("message").value || "",
  };

  try {
    const r = await fetch(CONTACT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || "Send failed");

    status.textContent = "Sent. Thanks!";
    $("message").value = "";
  } catch (err) {
    status.textContent = "Couldn’t send. Try again later.";
  } finally {
    btn.disabled = false;
  }
});
