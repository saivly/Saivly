import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import { LegalPage, List, Mail, Section } from "../legal-page";

export const metadata: Metadata = { title: "Terms of Service · Saivly" };

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ back?: string }>;
}) {
  const { back } = await searchParams;
  // Keep the way back when hopping over to the Privacy Policy.
  const privacyHref = back ? `/privacy?back=${encodeURIComponent(back)}` : "/privacy";

  return (
    <LegalPage title="Terms of Service" back={back}>
      <Section title="1. Who we are">
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the Saivly platform, website and
          related services (the &ldquo;Services&rdquo;), provided by {LEGAL.entity}, registered with the Dutch
          Chamber of Commerce under number {LEGAL.kvk}, with its registered office at {LEGAL.address}
          (&ldquo;Saivly&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
        </p>
        <p>
          By creating an account or using the Services, you agree to these Terms on behalf of yourself and the
          business you represent (&ldquo;you&rdquo;). If you do not agree, do not use the Services.
        </p>
      </Section>

      <Section title="2. Business use only">
        <p>
          The Services are intended exclusively for businesses and professionals. By using them you confirm that
          you act in the course of your trade, business or profession, that you are at least 18 years old, and
          that you are authorised to bind the business you register. Consumer protection rules that apply only to
          consumers do not apply to these Terms, to the extent permitted by law.
        </p>
      </Section>

      <Section title="3. Payment services and partners">
        <p>
          Saivly is not a bank. Payment accounts, IBANs, cards and payment processing are provided by our
          licensed payment partner Adyen N.V. and, where applicable, other regulated partners. Their terms and
          conditions also apply to those services, and you accept them when you use these features. Funds held
          in your account are held by our partner, not by Saivly.
        </p>
        <p>
          Features such as interest on balances, card limits and payment schedules depend on our partners and may
          change or be withdrawn if a partner changes its offering.
        </p>
      </Section>

      <Section title="4. Verification and compliance">
        <p>
          We and our partners are legally required to verify the identity of businesses and the people behind
          them (&ldquo;know your customer&rdquo;) and to prevent money laundering, terrorist financing and fraud.
          You agree to provide complete, accurate and up-to-date information and documents when asked.
        </p>
        <p>
          We may refuse, delay or block onboarding, transactions or access to the Services, without giving a
          reason where the law prevents us from doing so, if verification is incomplete or if we suspect unlawful
          activity, fraud or a breach of these Terms.
        </p>
      </Section>

      <Section title="5. Your account and security">
        <List
          items={[
            "You are responsible for all activity under your account and the accounts of users you invite.",
            "Keep your login details, passkeys and authentication devices secret and secure.",
            "Tell us immediately at the address below if you suspect unauthorised access to your account.",
            "You are responsible for the access rights you give to team members, accountants and bookkeepers.",
          ]}
        />
      </Section>

      <Section title="6. Acceptable use">
        <p>You must not use the Services to:</p>
        <List
          items={[
            "break any law or regulation, including sanctions and anti-money-laundering rules;",
            "process payments for illegal, prohibited or high-risk activities as defined by us or our partners;",
            "provide false information or impersonate another person or business;",
            "interfere with, reverse engineer, overload or attempt to gain unauthorised access to the Services.",
          ]}
        />
      </Section>

      <Section title="7. Subscriptions, free trial and fees">
        <p>
          Paid plans are billed monthly or yearly in advance, as chosen when you subscribe. Prices are in euros
          and exclude VAT unless stated otherwise. Your first month is free; unless you cancel before the trial
          ends, your subscription starts automatically at the end of the trial.
        </p>
        <p>
          Subscriptions renew automatically for the same period until cancelled. You can cancel or change your
          plan at any time from your dashboard; cancellation takes effect at the end of the current billing
          period. Fees already paid are not refunded, except where required by law.
        </p>
        <p>
          We may change our prices with at least 30 days&rsquo; notice. A price change applies from your next
          billing period. If you do not agree, you can cancel before the change takes effect.
        </p>
        <p>
          If a payment fails, we may suspend paid features until the outstanding amount is paid.
        </p>
      </Section>

      <Section title="8. Availability and changes to the Services">
        <p>
          We aim to keep the Services available and secure, but we do not guarantee uninterrupted or error-free
          operation. We may carry out maintenance, and we may change, add or remove features. We will give
          reasonable notice of material changes where possible.
        </p>
      </Section>

      <Section title="9. Intellectual property">
        <p>
          All rights in the Services, including software, design, trademarks and content, remain with Saivly or
          its licensors. We grant you a limited, non-exclusive, non-transferable right to use the Services for
          your business during your subscription. You keep all rights to the data you upload.
        </p>
      </Section>

      <Section title="10. Disclaimer">
        <p>
          The Services, including reports, statements and categorisations, are provided &ldquo;as is&rdquo; and
          &ldquo;as available&rdquo;. They are tools to help you manage your finances and do not constitute
          financial, tax, legal or accounting advice. You remain responsible for your bookkeeping, tax filings and
          business decisions.
        </p>
      </Section>

      <Section title="11. Limitation of liability">
        <p>To the maximum extent permitted by law:</p>
        <List
          items={[
            "Saivly is not liable for indirect or consequential damage, including lost profits, lost revenue, lost savings, loss of data or business interruption.",
            "Saivly is not liable for acts or omissions of our payment partners, banks, card schemes or other third parties, or for events outside our reasonable control (force majeure).",
            "Saivly's total liability for any claim arising out of or relating to the Services is limited to the subscription fees you paid us in the 12 months before the event giving rise to the claim.",
            "Any claim must be reported to us in writing within 12 months after you became aware, or should reasonably have become aware, of the event.",
          ]}
        />
        <p>
          These limitations do not apply to damage caused by our intent or deliberate recklessness (opzet of
          bewuste roekeloosheid).
        </p>
      </Section>

      <Section title="12. Indemnity">
        <p>
          You will indemnify Saivly against claims by third parties, fines and reasonable costs resulting from
          your breach of these Terms, your unlawful use of the Services, or incorrect information you provided.
        </p>
      </Section>

      <Section title="13. Suspension and termination">
        <p>
          You can stop using the Services and close your account at any time. We may suspend or terminate your
          access, with immediate effect where needed, if you breach these Terms, if required by law or by our
          partners, or if we reasonably suspect fraud or other unlawful activity. Otherwise we may terminate with
          30 days&rsquo; notice. After termination we will keep your data only as long as required by law, as
          described in our{" "}
          <Link href={privacyHref} className="font-medium text-ink underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </Section>

      <Section title="14. Personal data">
        <p>
          We process personal data as described in our{" "}
          <Link href={privacyHref} className="font-medium text-ink underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </Section>

      <Section title="15. Changes to these Terms">
        <p>
          We may update these Terms. We will notify you of material changes at least 30 days before they take
          effect. If you keep using the Services after that date, you accept the updated Terms. If you do not
          agree, you can cancel before the changes take effect.
        </p>
      </Section>

      <Section title="16. General">
        <List
          items={[
            "If any provision of these Terms is invalid, the remaining provisions remain in force.",
            "You may not transfer your rights or obligations under these Terms without our written consent. We may transfer them to a group company or successor.",
            "If a translation of these Terms differs from the English version, the English version prevails.",
          ]}
        />
      </Section>

      <Section title="17. Governing law and disputes">
        <p>
          These Terms are governed by Dutch law. Disputes will be submitted exclusively to the competent court in
          Amsterdam, the Netherlands, unless mandatory law provides otherwise.
        </p>
      </Section>

      <Section title="18. Contact">
        <p>
          Questions about these Terms? Contact us at <Mail />.
        </p>
      </Section>
    </LegalPage>
  );
}
