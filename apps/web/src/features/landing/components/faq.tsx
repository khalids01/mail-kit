import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Is Mail Kit a complete mail server?",
    answer:
      "Not in the first version. Mail Kit is the TypeScript SaaS layer for domains, API keys, sending workflows, inbox UI, logs, webhooks, and admin controls. Real SMTP/IMAP handling should use proven mail infrastructure.",
  },
  {
    question: "How do I test email locally?",
    answer:
      "Use Mailpit. The local flow is Mail Kit to Nodemailer to Mailpit SMTP on port 1025, then inspect messages in the Mailpit web UI on port 8025.",
  },
  {
    question: "What DNS records are required?",
    answer:
      "The domain setup flow should guide users through MX for receiving, SPF for sender policy, DKIM for signing, DMARC for domain policy, and an optional tracking CNAME later.",
  },
  {
    question: "Can this be a public email provider?",
    answer:
      "Eventually, but not first. Deliverability, spam prevention, abuse controls, port 25, bounce handling, and IP reputation are hard problems, so the MVP should stay private and self-hosted.",
  },
  {
    question: "What comes after branding?",
    answer:
      "The next product work is projects, domains, DNS verification, API keys, POST /emails/send, Mailpit-backed sending, and an email logs page.",
  },
];

export const FAQ = () => {
  return (
    <section id="faq" className="border-b py-24">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="mb-14 text-center">
          <h2 className="mb-4 text-3xl font-semibold tracking-tight md:text-5xl">
            Questions before the first send
          </h2>
          <p className="text-lg text-muted-foreground">
            The MVP keeps mail transport realistic and lets the TypeScript app
            focus on the product layer.
          </p>
        </div>

        <Accordion className="w-full space-y-3">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={faq.question}
              value={`item-${index}`}
              className="rounded-lg border px-5"
            >
              <AccordionTrigger className="text-left font-semibold hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="leading-7 text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
