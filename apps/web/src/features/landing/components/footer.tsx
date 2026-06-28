import { Link } from "@tanstack/react-router";
import { Code2, ExternalLink, Mail } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="border-t bg-background py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div>
            <Link
              to="/"
              className="mb-4 flex items-center gap-2 text-lg font-semibold"
            >
              <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Mail className="size-4" />
              </span>
              Mail Kit
            </Link>
            <p className="max-w-xs text-sm leading-6 text-muted-foreground">
              A self-hostable email SaaS layer for sending, receiving, domains,
              logs, and developer workflows.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <a
                href="#"
                className="rounded-md border p-2 text-muted-foreground hover:text-foreground"
                aria-label="Mail Kit website"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="rounded-md border p-2 text-muted-foreground hover:text-foreground"
                aria-label="Mail Kit source"
              >
                <Code2 className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Platform</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <a href="#features" className="hover:text-foreground">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-foreground">
                  Private alpha
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-foreground">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Build</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>API sending</li>
              <li>SMTP relay</li>
              <li>Inbound inbox</li>
              <li>Webhook events</li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Local ports</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>Server: 5005</li>
              <li>Web: 5006</li>
              <li>Mailpit SMTP: 1025</li>
              <li>Mailpit UI: 8025</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t pt-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Mail Kit. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-foreground">
              Privacy
            </a>
            <a href="#" className="hover:text-foreground">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
