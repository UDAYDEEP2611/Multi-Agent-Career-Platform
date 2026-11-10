// The demo's Contact Us form and newsletter sign-up, kept as JSON in
// Workers KV (the full app keeps them in MongoDB). The same checks as the
// server's controllers/contactController.js.
//   contact:<time>:<id>  { type: "contact", name, email, phone, message, at }
//   subscriber:<email>   { type: "subscriber", email, at }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+\d\s().-]{7,25}$/;
const textOf = (value) => (typeof value === "string" ? value.trim() : "");

// { values } with the cleaned form, or { error }
export function cleanMessage(body) {
  const values = {
    name: textOf(body?.name).replace(/\s+/g, " "),
    email: textOf(body?.email),
    phone: textOf(body?.phone),
    message: textOf(body?.message)
  };
  if (!values.name) return { error: "Please enter your name" };
  if (values.name.length > 100) return { error: "Name can be at most 100 characters" };
  if (values.email.length > 254 || !EMAIL.test(values.email)) return { error: "Please enter a valid email address" };
  if (values.phone && (!PHONE.test(values.phone) || values.phone.replace(/\D/g, "").length < 7)) return { error: "Please enter a valid phone number" };
  if (values.message.length < 10) return { error: "Please tell us a little more about what you need" };
  if (values.message.length > 2000) return { error: "Your message can be at most 2000 characters" };
  return { values };
}

// { status, body } for POST /contact or /subscribe
export async function formReply(pathname, body, env) {
  const at = new Date().toISOString();
  if (pathname === "/contact") {
    const received = { success: true, message: "Message received" };
    // A hidden field only bots fill in: they get the same reply, and nothing is kept
    if (body?.website) return { status: 201, body: received };
    const { values, error } = cleanMessage(body);
    if (error) return { status: 400, body: { success: false, message: error } };
    await env.SUBMISSIONS.put(`contact:${at}:${crypto.randomUUID().slice(0, 8)}`, JSON.stringify({ type: "contact", ...values, at }));
    return { status: 201, body: received };
  }
  // Signing up twice gets the same reply, so nobody can check who's subscribed
  const received = { success: true, message: "You're subscribed" };
  if (body?.website) return { status: 201, body: received };
  const email = textOf(body?.email).toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return { status: 400, body: { success: false, message: "Please enter a valid email address" } };
  const key = `subscriber:${email}`;
  if (!(await env.SUBMISSIONS.get(key))) await env.SUBMISSIONS.put(key, JSON.stringify({ type: "subscriber", email, at }));
  return { status: 201, body: received };
}
