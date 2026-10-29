// Dutch translations, keyed by the exact English text used in the code
// (see createT in ../i18n.ts). Keys must match character for character,
// including ’ vs ' and … vs ... — a missing or mismatched key just shows
// the English text.

export const NL: Record<string, string> = {
  // Header + sidebar
  "Language": "Taal",
  "Log out": "Uitloggen",
  "Switch to light mode": "Lichte modus",
  "Switch to dark mode": "Donkere modus",
  "Onboarding": "Onboarding",
  "Personal info": "Persoonlijke gegevens",
  "Organisation info": "Organisatiegegevens",
  "New organisation": "Nieuwe organisatie",
  "Company information": "Bedrijfsinformatie",
  "Business activity": "Bedrijfsactiviteit",
  "Contact details": "Contactgegevens",
  "Adyen verification": "Adyen-verificatie",
  "Subscription": "Abonnement",

  // Shared
  "Saving…": "Opslaan…",
  "Continue": "Doorgaan",
  "Back": "Terug",
  "Select…": "Selecteer…",
  "Postal code": "Postcode",
  "Street address": "Straat en huisnummer",
  "City": "Plaats",
  "Invalid input.": "Ongeldige invoer.",

  // Personal information
  "Personal information": "Persoonlijke gegevens",
  "Step 1 of 4 — a few details we're required to collect about you.":
    "Stap 1 van 4 — een paar gegevens die we verplicht over je moeten vastleggen.",
  "Date of birth": "Geboortedatum",
  "Day": "Dag",
  "Month": "Maand",
  "Year": "Jaar",
  "Date of birth is required.": "Geboortedatum is verplicht.",
  "That date doesn't exist.": "Die datum bestaat niet.",
  "Date of birth can’t be in the future.": "Geboortedatum kan niet in de toekomst liggen.",
  "You must be at least 18 years old.": "Je moet minimaal 18 jaar oud zijn.",
  "Country of residence": "Woonland",
  "Nationality": "Nationaliteit",
  "Phone number": "Telefoonnummer",
  "House number": "Huisnummer",
  "12 or 41-2": "12 of 41-2",
  "Looking up address…": "Adres opzoeken…",
  "No address found for that postcode + house number — fill it in by hand.":
    "Geen adres gevonden voor deze postcode en dit huisnummer — vul het zelf in.",
  "Address lookup is temporarily unavailable — fill it in by hand.":
    "Adres opzoeken is tijdelijk niet beschikbaar — vul het zelf in.",
  "Fill in the postcode and house number above — we'll look this up for you.":
    "Vul hierboven je postcode en huisnummer in — wij zoeken dit voor je op.",
  "Province": "Provincie",
  "Province / region": "Provincie / regio",
  "England": "Engeland",
  "Scotland": "Schotland",
  "Wales": "Wales",
  "Northern Ireland": "Noord-Ierland",

  // Organisation choice + join
  "Do you want to create a new organisation?": "Wil je een nieuwe organisatie aanmaken?",
  "Step 2 of 4 — every account belongs to an organisation. Start one, or join an existing one!":
    "Stap 2 van 4 — elk account hoort bij een organisatie. Maak er een aan, of sluit je aan bij een bestaande!",
  "Yes, I want to create a new organisation": "Ja, ik wil een nieuwe organisatie aanmaken",
  "No, I want to join an existing organisation": "Nee, ik wil me aansluiten bij een bestaande organisatie",
  "Set up your company details and subscription from scratch — you'll be its owner.":
    "Stel je bedrijfsgegevens en abonnement helemaal zelf in — jij wordt de eigenaar.",
  "Join a team that's already set up — this isn't available quite yet.":
    "Sluit je aan bij een team dat al is ingericht — dit is nog niet beschikbaar.",
  "Joining an organisation isn't available yet": "Aansluiten bij een organisatie is nog niet beschikbaar",
  "We're still building this. In the meantime, please contact your organisation's admin and ask them to add you directly.":
    "We werken hier nog aan. Neem in de tussentijd contact op met de beheerder van je organisatie en vraag of die je direct toevoegt.",

  // Company information
  "Step 2 of 4 — tell us about the business you're setting up.":
    "Stap 2 van 4 — vertel ons over het bedrijf dat je aanmeldt.",
  "Country of registration": "Land van vestiging",
  "Your relationship to the company (multiple options possible)":
    "Jouw relatie tot het bedrijf (meerdere opties mogelijk)",
  "Authorized company signatory": "Tekenbevoegd voor het bedrijf",
  "Owner via shares": "Eigenaar via aandelen",
  "Owner via control": "Eigenaar via zeggenschap",
  "Find your company in the KVK register": "Zoek je bedrijf in het KVK-register",
  "Dev mode: searching KVK's sandbox test data (fictional companies), not the live register. Set KVK_API_KEY to search real companies.":
    "Ontwikkelmodus: er wordt gezocht in de testgegevens van KVK (fictieve bedrijven), niet in het echte register. Stel KVK_API_KEY in om echte bedrijven te zoeken.",
  "Company name or KVK number": "Bedrijfsnaam of KVK-nummer",
  "Searching…": "Zoeken…",
  "Search": "Zoeken",
  "No matches. Try the KVK number instead.": "Geen resultaten. Probeer het KVK-nummer.",
  "KVK lookup is temporarily unavailable — try again in a moment.":
    "Zoeken in het KVK-register is tijdelijk niet beschikbaar — probeer het zo opnieuw.",
  "Couldn't load that company's details — try again.":
    "De gegevens van dit bedrijf konden niet worden geladen — probeer het opnieuw.",
  "Company details": "Bedrijfsgegevens",
  "KVK number": "KVK-nummer",
  "Legal form": "Rechtsvorm",
  "Address": "Adres",
  "Main activity": "Hoofdactiviteit",
  "Change company": "Ander bedrijf kiezen",
  "Company name": "Bedrijfsnaam",

  // Business activity
  "Step 2 of 4 — a few more details about {name}.": "Stap 2 van 4 — nog een paar gegevens over {name}.",
  "Industry": "Branche",
  "Home Association": "Vereniging van Eigenaars",
  "Fixed for homeowners' associations.": "Vast voor verenigingen van eigenaars.",
  "Adyen's own classification, closest to what the organisation actually does day to day.":
    "De indeling van Adyen — kies wat het best past bij wat de organisatie dagelijks doet.",
  "Expected monthly contribution": "Verwachte maandelijkse bijdrage",
  "Estimated annual reserve fund contributions": "Geschatte jaarlijkse bijdragen aan het reservefonds",
  "Expected Monthly contribution for this account": "Verwachte maandelijkse bijdrage voor deze rekening",
  "Give your best estimate": "Geef je beste schatting",
  "Less than {amount}": "Minder dan {amount}",
  "More than {amount}": "Meer dan {amount}",
  "Between {min} and {max}": "Tussen {min} en {max}",
  "Expected monthly amount": "Verwacht maandbedrag",
  "Expected annual amount": "Verwacht jaarbedrag",
  "VAT number": "Btw-nummer",
  "Homeowners’ associations are VAT-exempt.": "Verenigingen van eigenaars zijn vrijgesteld van btw.",
  "Leave blank if the organisation doesn’t have one — most don’t.":
    "Laat leeg als de organisatie er geen heeft — de meeste hebben er geen.",
  "VAT exemption reason": "Reden voor btw-vrijstelling",
  "Not exempt": "Niet vrijgesteld",
  "Revenue below tax threshold": "Omzet onder de belastinggrens",
  "Industry exemption": "Vrijstelling voor de branche",
  "Only relevant if the organisation has no VAT number.": "Alleen van toepassing als de organisatie geen btw-nummer heeft.",
  "Business description": "Omschrijving van het bedrijf",
  "A short description of what the organisation does.": "Een korte omschrijving van wat de organisatie doet.",
  "A Homeowners’ Association (HOA) manages and maintains the common areas of an apartment building. The HOA collects contributions from the owners, arranges maintenance and repairs, and ensures that shared expenses and agreements are properly managed.":
    "Een Vereniging van Eigenaars (VvE) beheert en onderhoudt de gemeenschappelijke delen van een appartementencomplex. De VvE int bijdragen van de eigenaren, regelt onderhoud en reparaties en zorgt dat gedeelde kosten en afspraken goed worden beheerd.",

  // Contact details
  "Step 2 of 4 — how customers and Adyen can reach {name}.":
    "Stap 2 van 4 — hoe klanten en Adyen {name} kunnen bereiken.",
  "Website (if applicable)": "Website (indien van toepassing)",
  "Company email address": "E-mailadres van het bedrijf",
  "Company phone number": "Telefoonnummer van het bedrijf",

  // Adyen verification
  "Verify your identity with Adyen": "Verifieer je identiteit bij Adyen",
  "Step 3 of 4 — you've completed this step.": "Stap 3 van 4 — je hebt deze stap afgerond.",
  "You're verified with Adyen": "Je bent geverifieerd bij Adyen",
  "Your organisation went through Adyen's hosted verification. If Adyen needs anything else from you, they'll ask — otherwise there's nothing more to do here.":
    "Je organisatie heeft de verificatie van Adyen doorlopen. Als Adyen nog iets van je nodig heeft, laten ze het weten — verder hoef je hier niets meer te doen.",
  "Review with Adyen again": "Opnieuw controleren bij Adyen",
  "Redirecting…": "Doorsturen…",
  "Continue to Adyen": "Doorgaan naar Adyen",
  "Step 3 of 4 — to complete onboarding, we partner with Adyen — the payments infrastructure used by platforms like eBay, Uber, and Spotify — to verify your organisation and keep payouts secure.":
    "Stap 3 van 4 — om de onboarding af te ronden werken we samen met Adyen — het betaalplatform achter onder meer eBay, Uber en Spotify — om je organisatie te verifiëren en uitbetalingen veilig te houden.",
  "What to expect": "Wat kun je verwachten",
  "You'll be redirected to a secure page hosted by Adyen, then brought straight back here when you're done.":
    "Je wordt doorgestuurd naar een beveiligde pagina van Adyen en komt daarna direct hier terug.",
  "Confirm your organisation's and your own personal details": "Bevestig de gegevens van je organisatie en je eigen persoonsgegevens",
  "Upload a photo ID or business document, if asked": "Upload een identiteitsbewijs of bedrijfsdocument, als daarom wordt gevraagd",
  "Add the bank account you'd like payouts sent to": "Voeg de bankrekening toe waarop je uitbetalingen wilt ontvangen",
  "Takes most people just a few minutes": "Voor de meeste mensen duurt dit maar een paar minuten",
  "Adyen only shares your verification status with us — never your documents or bank details directly.":
    "Adyen deelt alleen je verificatiestatus met ons — nooit rechtstreeks je documenten of bankgegevens.",

  // Subscription
  "Choose the plan that fits your business": "Kies het abonnement dat het best bij je bedrijf past",
  "Step 4 of 4 — you can change your plan anytime from your dashboard.":
    "Stap 4 van 4 — je kunt je abonnement altijd wijzigen vanuit je dashboard.",
  "Your first month is free": "Je eerste maand is gratis",
  "Try any plan free for 30 days. Cancel anytime.": "Probeer elk abonnement 30 dagen gratis. Altijd opzegbaar.",
  "Billing": "Facturering",
  "Monthly": "Maandelijks",
  "Yearly": "Jaarlijks",
  "Save up to {percent}%": "Bespaar tot {percent}%",
  "Plans": "Abonnementen",
  "Most popular": "Meest gekozen",
  "per year": "per jaar",
  "per month": "per maand",
  "You save {amount} compared to monthly billing": "Je bespaart {amount} ten opzichte van maandelijks betalen",
  "Billed monthly. Switch to yearly and save {amount}.": "Maandelijks gefactureerd. Kies jaarlijks en bespaar {amount}.",
  "Everything in {plan}, plus": "Alles van {plan}, plus",
  "1 month free of charge": "1 maand gratis",
  "Try any plan free for 30 days": "Probeer elk abonnement 30 dagen gratis",
  "Your business finances, simplified. Manage payments, receipts, and everyday banking in one place.":
    "Je bedrijfsfinanciën, eenvoudig geregeld. Beheer betalingen, bonnen en je dagelijkse bankzaken op één plek.",
  "Give your team the tools to spend smarter, automate admin, and stay in control of every transaction.":
    "Geef je team de tools om slimmer uit te geven, administratie te automatiseren en grip te houden op elke transactie.",
  "Run the finances of multiple legal entities on one platform, with one login. Switch between entities instantly and see everything in one consolidated view.":
    "Beheer de financiën van meerdere rechtspersonen op één platform, met één login. Wissel direct tussen entiteiten en zie alles in één geconsolideerd overzicht.",
  "One business IBAN": "Eén zakelijke IBAN",
  "Invite your accountant or bookkeeper": "Nodig je accountant of boekhouder uit",
  "Scan and organize receipts": "Bonnen scannen en ordenen",
  "Set up 4 recurring payments": "Stel 4 terugkerende betalingen in",
  "Financial reporting and statements": "Financiële rapportages en afschriften",
  "Up to 4 team members": "Tot 4 teamleden",
  "1% interest on overnight balances": "1% rente op saldo's",
  "1 physical and 5 virtual cards": "1 fysieke en 5 virtuele kaarten",
  "Approval workflows for payments": "Goedkeuringsflows voor betalingen",
  "Schedule payments in advance": "Betalingen vooruit inplannen",
  "Unlimited team members": "Onbeperkt teamleden",
  "multiple physical and virtual cards": "Meerdere fysieke en virtuele kaarten",
  "Manage multiple legal entities": "Beheer meerdere rechtspersonen",
  "Multi-level payment approval workflows": "Goedkeuringsflows voor betalingen met meerdere niveaus",
  "Priority customer support": "Klantenservice met voorrang",
  "I agree to the": "Ik ga akkoord met de",
  "Terms of Service": "Algemene voorwaarden",
  "and": "en het",
  "Privacy Policy": "Privacybeleid",
  "Continue with {plan}": "Doorgaan met {plan}",

  // Validation messages (src/lib/zod.ts)
  "First name is required": "Voornaam is verplicht",
  "Last name is required": "Achternaam is verplicht",
  "Invalid email address": "Ongeldig e-mailadres",
  "Please provide a valid password.": "Vul een geldig wachtwoord in.",
  "Select a country.": "Selecteer een land.",
  "We only support organisations from the Netherlands, United Kingdom, or United States right now.":
    "We ondersteunen op dit moment alleen organisaties uit Nederland, het Verenigd Koninkrijk of de Verenigde Staten.",
  "Enter a valid date.": "Vul een geldige datum in.",
  "Phone number is required.": "Telefoonnummer is verplicht.",
  "Enter a valid phone number.": "Vul een geldig telefoonnummer in.",
  "Street address is required.": "Straat en huisnummer zijn verplicht.",
  "City is required.": "Plaats is verplicht.",
  "Province is too long.": "Provincie is te lang.",
  "Postal code is required.": "Postcode is verplicht.",
  "Postal code is too long.": "Postcode is te lang.",
  "Select a province.": "Selecteer een provincie.",
  "Select at least one relationship to the company.": "Selecteer minimaal één relatie tot het bedrijf.",
  "A KVK number is 8 digits.": "Een KVK-nummer bestaat uit 8 cijfers.",
  "Company name is required.": "Bedrijfsnaam is verplicht.",
  "KVK number is required for Dutch companies.": "Een KVK-nummer is verplicht voor Nederlandse bedrijven.",
  "Select the industry your business is in.": "Selecteer de branche van je bedrijf.",
  "Choose the option closest to your estimate.": "Kies de optie die het dichtst bij je schatting ligt.",
  "VAT number is too long.": "Btw-nummer is te lang.",
  "Keep the description under 500 characters.": "Houd de omschrijving onder de 500 tekens.",
  "Enter the amount.": "Vul het bedrag in.",
  "Enter a whole number.": "Vul een heel getal in.",
  "Enter an amount above 100,000.": "Vul een bedrag boven 100.000 in.",
  "Enter a valid website URL, e.g. https://example.com.": "Vul een geldige website in, bijvoorbeeld https://example.com.",
  "Enter a valid support email address.": "Vul een geldig e-mailadres in.",
  "Support phone number is required.": "Telefoonnummer is verplicht.",
  "Choose a plan.": "Kies een abonnement.",
  "Choose monthly or yearly billing.": "Kies maandelijkse of jaarlijkse facturering.",
  "Please accept the Terms of Service to continue.": "Ga akkoord met de algemene voorwaarden om door te gaan.",

  // Server errors (shown via ?error=)
  "We couldn't complete identity verification with our payment provider. Your details were saved — please try again, or contact support if this keeps happening.":
    "We konden de identiteitsverificatie bij onze betaalprovider niet afronden. Je gegevens zijn opgeslagen — probeer het opnieuw, of neem contact op met support als dit blijft gebeuren.",
  "We couldn't find your organisation's verification record. Go back to Company information and save it again, then retry.":
    "We konden het verificatiedossier van je organisatie niet vinden. Ga terug naar Bedrijfsinformatie, sla die opnieuw op en probeer het nog eens.",
  "We couldn't reach Adyen just now — try again in a moment.":
    "We konden Adyen op dit moment niet bereiken — probeer het zo opnieuw.",
  "Adyen still needs more information before verification can continue. Use “Review with Adyen again” below and go through every step this time.":
    "Adyen heeft nog meer informatie nodig voordat de verificatie verder kan. Gebruik hieronder “Opnieuw controleren bij Adyen” en doorloop deze keer alle stappen.",
  "We couldn't find an organisation with that exact name and ID. Double-check both with whoever invited you and try again.":
    "We konden geen organisatie vinden met precies die naam en dat ID. Controleer beide bij degene die je heeft uitgenodigd en probeer het opnieuw.",
  "We couldn't find your organisation. Please start again.":
    "We konden je organisatie niet vinden. Begin opnieuw.",
  "We couldn't register your organisation with our payment provider. Please try again.":
    "We konden je organisatie niet registreren bij onze betaalprovider. Probeer het opnieuw.",
  "Your organisation was registered, but we couldn't set up its payout account. Please try again.":
    "Je organisatie is geregistreerd, maar we konden de uitbetalingsrekening niet aanmaken. Probeer het opnieuw.",
  "Your organisation's payout account was created, but we couldn't finish setting it up. Please try again.":
    "De uitbetalingsrekening van je organisatie is aangemaakt, maar we konden de inrichting niet afronden. Probeer het opnieuw.",
  "Your organisation's payout account was set up, but we couldn't finish registering it for payments. Please try again.":
    "De uitbetalingsrekening van je organisatie is ingericht, maar we konden de registratie voor betalingen niet afronden. Probeer het opnieuw.",
  "Your organisation's payout account was set up, but we couldn't finish registering it for banking. Please try again.":
    "De uitbetalingsrekening van je organisatie is ingericht, maar we konden de registratie voor bankieren niet afronden. Probeer het opnieuw.",
  "Your organisation's payout account was set up, but we couldn't finish registering it for card issuing. Please try again.":
    "De uitbetalingsrekening van je organisatie is ingericht, maar we konden de registratie voor het uitgeven van kaarten niet afronden. Probeer het opnieuw.",
  "We couldn't find your identity verification record. Go back to Personal info and save it again, then retry.":
    "We konden je identiteitsverificatie niet vinden. Ga terug naar Persoonlijke gegevens, sla die opnieuw op en probeer het nog eens.",
};
