// Outgoing email. No provider is wired up yet, so messages are written to the
// server log; replace the body of sendEmail with a call to your provider
// (Resend, Postmark, SES...) and keep the signature.

export type Email = {
  to: string
  subject: string
  text: string
}

export async function sendEmail(email: Email) {
  console.info(
    ["[email]", `To: ${email.to}`, `Subject: ${email.subject}`, "", email.text, ""].join("\n")
  )
}
