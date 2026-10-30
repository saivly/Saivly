import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";
import { LegalPage, List, Mail, Section } from "../legal-page";

export const metadata: Metadata = { title: "Privacy Policy · Saivly" };

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ back?: string }>;
}) {
  const { back } = await searchParams;

  return (
    <LegalPage title="Privacy Policy" back={back}>
      <Section title="1. Who is responsible">
        <p>
          {LEGAL.entity}, registered with the Dutch Chamber of Commerce under number {LEGAL.kvk}, with its
          registered office at {LEGAL.address} (&ldquo;Saivly&rdquo;, &ldquo;we&rdquo;), is the controller
          for the personal data described in this Privacy Policy, in line with the EU General Data Protection
          Regulation (GDPR).
        </p>
        <p>
          Our payment partner Adyen N.V. processes certain data as an independent controller for its own legal
          obligations; its privacy statement applies to that processing.
        </p>
      </Section>

      <Section title="2. What data we collect">
        <List
          items={[
            "Account data: name, email address, phone number, password hash, passkeys and two-factor settings.",
            "Identity and verification data: date of birth, nationality, address, ID documents and your role in the business, as required for know-your-customer checks.",
            "Business data: company name, registration number, address, business activities, ownership structure and authorised representatives.",
            "Financial data: IBANs, balances, transactions, cards, receipts and invoices you upload.",
            "Subscription data: chosen plan, billing interval and payment history.",
            "Technical data: IP address, browser and device information, log files and security events.",
            "Communication: messages you send to our support team.",
          ]}
        />
      </Section>

      <Section title="3. Why we use it and on what legal basis">
        <List
          items={[
            "To provide the Services and manage your account and subscription (performance of a contract).",
            "To verify identities and prevent money laundering, terrorist financing, sanctions breaches and fraud (legal obligation).",
            "To keep the Services and your account secure, for example by detecting suspicious logins (legitimate interest).",
            "To meet tax, accounting and regulatory requirements (legal obligation).",
            "To improve the Services and provide support (legitimate interest).",
            "To send service messages, such as security alerts and changes to our terms (performance of a contract and legitimate interest). We only send marketing with your consent, which you can withdraw at any time.",
          ]}
        />
      </Section>

      <Section title="4. Who we share it with">
        <p>We do not sell your personal data. We only share it with:</p>
        <List
          items={[
            "Payment and banking partners, such as Adyen N.V., to provide payment accounts, cards and transactions and to perform verification checks.",
            "Service providers that process data on our behalf, such as hosting and database providers and email delivery services, under a data processing agreement.",
            "Team members, accountants or bookkeepers you invite to your organisation, within the access rights you give them.",
            "Authorities, regulators, courts and law enforcement where we are legally required to.",
            "A buyer or successor in the event of a merger or acquisition, under the same protections.",
          ]}
        />
      </Section>

      <Section title="5. International transfers">
        <p>
          We aim to store your data within the European Economic Area. Where a provider processes data outside
          the EEA, we make sure appropriate safeguards are in place, such as the European Commission&rsquo;s
          Standard Contractual Clauses or an adequacy decision.
        </p>
      </Section>

      <Section title="6. How long we keep it">
        <p>
          We keep personal data only as long as needed for the purposes above. Verification and transaction data
          must by law be kept for at least five years after our relationship ends (Dutch Anti-Money Laundering
          and Anti-Terrorist Financing Act, Wwft), and financial records for seven years (Dutch tax law). Other
          account data is deleted or anonymised within a reasonable period after you close your account.
        </p>
      </Section>

      <Section title="7. Security">
        <p>
          We use appropriate technical and organisational measures to protect your data, including encryption in
          transit, access controls, two-factor authentication and limited session lifetimes. No system is
          completely secure, so please keep your login details safe and tell us right away if you suspect misuse.
        </p>
      </Section>

      <Section title="8. Cookies">
        <p>
          We only use cookies that are strictly necessary for the Services to work, such as cookies that keep you
          signed in, secure your session and remember your language and theme. These do not require consent. If
          we add analytics or marketing cookies in the future, we will ask for your consent first.
        </p>
      </Section>

      <Section title="9. Your rights">
        <p>Under the GDPR you have the right to:</p>
        <List
          items={[
            "access the personal data we hold about you;",
            "have incorrect data corrected;",
            "have your data deleted, where we are not legally required to keep it;",
            "restrict or object to certain processing;",
            "receive your data in a portable format;",
            "withdraw consent at any time, where processing is based on consent.",
          ]}
        />
        <p>
          To exercise your rights, email us at <Mail />. We may ask you to verify your identity, and we will
          respond within one month. You also have the right to lodge a complaint with the Dutch Data Protection
          Authority (Autoriteit Persoonsgegevens).
        </p>
      </Section>

      <Section title="10. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. We will notify you of material changes by email or
          in the Services. The date at the top shows when it was last updated.
        </p>
      </Section>

      <Section title="11. Contact">
        <p>
          Questions about your privacy? Contact us at <Mail />.
        </p>
      </Section>
    </LegalPage>
  );
}
