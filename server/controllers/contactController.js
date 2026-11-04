const ContactMessage = require("../models/ContactMessage");
const Subscriber = require("../models/Subscriber");
const { sendMail } = require("../services/mailer");

const DEFAULT_CONTACT_EMAIL = "rajprasadverse@gmail.com";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+\d\s().-]{7,25}$/;

const textOf = (value) => (typeof value === "string" ? value.trim() : "");

// { values } with the cleaned form, or { error }
function cleanMessage(body) {
  const values = {
    name: textOf(body?.name).replace(/\s+/g, " "),
    email: textOf(body?.email),
    phone: textOf(body?.phone),
    message: textOf(body?.message)
  };

  if (!values.name) return { error: "Please enter your name" };
  if (values.name.length > 100) return { error: "Name can be at most 100 characters" };
  if (values.email.length > 254 || !EMAIL.test(values.email)) return { error: "Please enter a valid email address" };
  if (values.phone && (!PHONE.test(values.phone) || values.phone.replace(/\D/g, "").length < 7)) {
    return { error: "Please enter a valid phone number" };
  }
  if (values.message.length < 10) return { error: "Please tell us a little more about what you need" };
  if (values.message.length > 2000) return { error: "Your message can be at most 2000 characters" };
  return { values };
}

// POST /api/contact  { name, email, phone?, message }
const sendContactMessage = async (req, res) => {
  const received = { success: true, message: "Message received" };

  // A hidden field only bots fill in: they see the same reply, and nothing is kept
  if (req.body?.website) return res.status(201).json(received);

  const { values, error } = cleanMessage(req.body);
  if (error) return res.status(400).json({ success: false, message: error });

  try {
    const saved = await ContactMessage.create(values);

    // The message is safe in the database, so a mail problem doesn't fail the form
    try {
      await sendMail({
        to: process.env.CONTACT_EMAIL || DEFAULT_CONTACT_EMAIL,
        replyTo: values.email,
        subject: `New Contact Us message from ${values.name}`,
        text: [`Name: ${values.name}`, `Email: ${values.email}`, `Phone: ${values.phone || "Not given"}`, "", values.message].join("\n")
      });
      saved.emailed = Boolean(process.env.SMTP_HOST);
      await saved.save();
    } catch (mailError) {
      console.error("Contact email error:", mailError);
    }

    return res.status(201).json(received);
  } catch (saveError) {
    console.error("Contact message error:", saveError);
    return res.status(500).json({ success: false, message: "We couldn't send your message. Please try again." });
  }
};

// POST /api/contact/subscribe  { email }
// Signing up twice gets the same reply, so nobody can check who's subscribed
const subscribe = async (req, res) => {
  const received = { success: true, message: "You're subscribed" };

  if (req.body?.website) return res.status(201).json(received);

  const email = textOf(req.body?.email).toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) {
    return res.status(400).json({ success: false, message: "Please enter a valid email address" });
  }

  try {
    const { upsertedCount } = await Subscriber.updateOne({ email }, { $setOnInsert: { email } }, { upsert: true });

    if (upsertedCount) {
      try {
        await sendMail({
          to: process.env.CONTACT_EMAIL || DEFAULT_CONTACT_EMAIL,
          subject: "New subscriber",
          text: `${email} subscribed from the website footer.`
        });
      } catch (mailError) {
        console.error("Subscriber email error:", mailError);
      }
    }

    return res.status(201).json(received);
  } catch (saveError) {
    console.error("Subscribe error:", saveError);
    return res.status(500).json({ success: false, message: "We couldn't subscribe you. Please try again." });
  }
};

module.exports = { sendContactMessage, subscribe };
