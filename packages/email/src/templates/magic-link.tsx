import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

import { renderEmailTemplate } from "../render.server";

type MagicLinkEmailProps = {
  url: string;
};

export function MagicLinkEmail({ url }: MagicLinkEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Sign in to Mail Kit</Preview>
      <Tailwind>
        <Body className="m-0 bg-gray-100 p-0 text-gray-800">
          <Container className="my-10 rounded-lg border border-gray-200 bg-white px-10 py-10">
            <Text className="m-0 mb-6 text-center text-2xl font-bold text-black">
              Mail Kit
            </Text>

            <Section className="mb-4">
              <Text className="m-0 mb-3 text-base leading-[1.6] text-gray-800">
                Hello,
              </Text>
              <Text className="m-0 mb-3 text-base leading-[1.6] text-gray-800">
                Click the button below to sign in to your account. This link will
                expire in 10 minutes.
              </Text>
            </Section>

            <Section className="my-5 mb-8 text-center">
              <Button
                href={url}
                className="rounded-md bg-black px-6 py-3 text-sm font-semibold text-white no-underline"
              >
                Sign In
              </Button>
            </Section>

            <Section className="mb-4">
              <Text className="m-0 mb-3 text-base leading-[1.6] text-gray-800">
                Or copy and paste this link into your browser:
              </Text>
              <Text className="m-0 break-all text-sm leading-[1.5] text-gray-600">
                {url}
              </Text>
            </Section>

            <Section className="mt-6 text-center">
              <Text className="m-0 mb-1.5 text-xs leading-[1.4] text-gray-500">
                If you didn&apos;t request this email, you can safely ignore it.
              </Text>
              <Text className="m-0 mb-1.5 text-xs leading-[1.4] text-gray-500">
                {`© ${new Date().getFullYear()} Mail Kit. All rights reserved.`}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

MagicLinkEmail.PreviewProps = {
  url: "https://example.com/auth/magic-link?token=example",
} satisfies MagicLinkEmailProps;

export const magicLinkTemplate = async (url: string) =>
  renderEmailTemplate(<MagicLinkEmail url={url} />);

export default MagicLinkEmail;
