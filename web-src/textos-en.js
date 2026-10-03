/** Website texts in English. Same keys as textos-es.js and textos-de.js. */
module.exports = {
  lang: 'en',
  nombreIdioma: 'English',
  meta: {
    titulo: 'Neighborhub · Neighbors helping neighbors',
    descripcion: 'Neighborhub is the app where neighbors help each other: as a favor or for a fair price agreed upfront, paid securely and released when the job is done.',
    og: 'Ask for help, offer yours and meet the people next door.',
  },
  nav: { como: 'How it works', confianza: 'Trust', preguntas: 'FAQ', soporte: 'Support', contacto: 'Contact', idioma: 'Language' },
  portada: {
    antetitulo: 'The app for your neighborhood',
    titulo: 'Neighbors helping neighbors, as a favor or for a fair price',
    intro: 'Painting a wall, walking the dog, carrying a sofa upstairs or shopping for someone who can’t. On Neighborhub you ask for help and offer yours: for free, or for a price agreed upfront that we hold safely until the job is done.',
    appStore: ' Coming soon to the App Store',
    como: 'How it works',
    nota: 'Available for iPhone. Starting in Zurich.',
    tarjeta: 'Lukas offers to help you',
    tarjetaDatos: '4.7 · 9 helps',
  },
  pasos: {
    antetitulo: 'How it works',
    titulo: 'From “I need a hand” to “thanks, neighbor!” in four steps',
    lista: [
      { etiqueta: '1 · Ask for help', titulo: 'Need a hand?', alt: 'A neighbor among moving boxes', texto: 'Post your request with a photo, what needs doing and when. We save the location so the neighbors next door can find you. We review it before it appears on the wall and the map. Free, or with a price you pay when posting: we hold it safely until the job is done.' },
      { etiqueta: '2 · Offer to help', titulo: 'Help the people around you', alt: 'A neighbor walking a dog', texto: 'Find requests on the wall or the map and offer to help with a comment: when you can and what you’re good at. Several people can offer to help with the same request.' },
      { etiqueta: '3 · Choose', titulo: 'Pick your neighbor', alt: 'Two neighbors chatting on the steps', texto: 'You see every offer with the helper’s profile: ratings, helps, badges and bio. Choose one and a private chat opens so you can arrange the details.' },
      { etiqueta: '4 · Rate', titulo: 'Rate and build your reputation', alt: 'Three people giving each other a high five', texto: 'When it’s done, you mark it as completed: if it had a price, the helper receives it in full right away. Then you rate from 1 to 5 stars and leave a comment. Every help counts and unlocks badges: Amateur, Veteran and Exemplary.' },
    ],
  },
  confianza: {
    antetitulo: 'Why Neighborhub',
    titulo: 'Built so you can trust whoever knocks on your door',
    intro: 'Everything you see about a neighbor was earned by helping: nobody can give themselves stars.',
    lista: [
      { icono: '📍', titulo: 'Close to you', texto: 'The wall and the map show you what’s needed a few streets away, with the real distance.' },
      { icono: '⭐', titulo: 'Real reputation', texto: 'Ratings can only be left by the person who received the help, once per request.' },
      { icono: '✅', titulo: 'Reviewed requests', texto: 'Every request is reviewed before it’s published. Only approved ones receive offers.' },
      { icono: '💬', titulo: 'Private chat', texto: 'Only the two people involved in a request can talk, and only once an offer has been chosen.' },
      { icono: '🚩', titulo: 'Report in one tap', texto: 'If something isn’t right, report a request or a profile from the app. We review it within 24 hours.' },
      { icono: '💳', titulo: 'Safe payments', texto: 'Paid requests are paid when they’re posted and the money is held until the job is done. Helpers get the full price.' },
    ],
  },
  faq: {
    antetitulo: 'Frequently asked questions',
    titulo: 'What people ask us most',
    lista: [
      ['Does it cost money?', 'Using Neighborhub is free. Favors cost nothing. For paid requests, the person who asks pays the price plus an 8% service fee (at least CHF 1) when posting; the helper receives the full price when the job is marked as done.'],
      ['Who can see my request?', 'Any neighbor with an account, once we’ve approved it. While it’s under review only you can see it, and you can edit it until you choose someone.'],
      ['How do I choose who helps me?', 'On your request you see all offers with each neighbor’s profile. You choose one, the others are declined and a chat opens so you can arrange the details.'],
      ['How do I report a request or a user?', 'From the request details or the neighbor’s profile, or by writing to us with the contact form. We remove content that breaks the rules and block anyone who abuses the service.'],
      ['Which languages is it available in?', 'English, German and Spanish. The app uses your iPhone’s language and you can change it on the welcome screen or in Profile → ⚙️ → Language.'],
      ['How do I delete my account?', 'In the app: Profile → ⚙️ → “Delete account”. Your account and profile are deleted, together with your open requests and offers. If you can’t sign in, ask us through the contact form.'],
    ],
  },
  contacto: {
    antetitulo: 'Contact and support',
    titulo: 'Something not working? Let us know',
    intro: 'We answer questions, look into problems with the app and handle reports about content or users. We reply by email.',
    puntos: [
      ['🛟', 'Problems with the app:', 'what happened, on which screen and your iPhone model.'],
      ['🚩', 'Reports:', 'the request or the profile, and what happened.'],
      ['🗑️', 'Deleting data:', 'the email of your account.'],
    ],
    tipo: 'How can we help?',
    tipos: {
      pregunta: 'I have a question',
      problema: 'I want to report a problem with the app',
      reportar: 'I want to report a request or a user',
      'borrar-cuenta': 'I want to delete my account or my data',
      otro: 'Something else',
    },
    nombre: 'Name',
    email: 'Email',
    mensaje: 'Message',
    ejemplo: 'Tell us what you need or what happened',
    enviar: 'Send message',
    enviando: 'Sending…',
    aviso: 'By sending this you agree that we use this data to reply to you, as described in the <a href="{privacidad}">privacy policy</a>.',
    ok: 'Thank you! We’ve received your message and will reply by email as soon as possible.',
    errorEmail: 'Please check your email: we need it to reply to you.',
    errorCorto: 'Tell us a bit more (at least 10 characters).',
    errorLargo: 'The message is too long (3000 characters max).',
    errorEnvio: 'It couldn’t be sent right now. Please try again in a few minutes.',
  },
  llamada: {
    titulo: 'Your neighborhood, closer',
    texto: 'Neighborhub is coming soon to the App Store. In the meantime, write to us if you’d like to try it first.',
    boton: 'I want to try it',
    alt: 'Neighborhub icon',
  },
  pie: { lugar: '© 2026 Neighborhub · Zurich', soporte: 'Support', privacidad: 'Privacy', terminos: 'Terms of use', contacto: 'Contact' },
  soporte: {
    titulo: 'Support',
    descripcion: 'Help, frequently asked questions and contact for Neighborhub.',
    antetitulo: 'Support',
    h1: 'How can we help?',
    intro: 'Quick answers to the most common questions. If you can’t find yours, write to us below and we’ll reply by email.',
    lista: [
      ['I can’t sign in to my account', 'On the sign-in screen tap “Forgot your password?” and we’ll send you an email to create a new one. If you signed up with Apple or Google, use the same button as the first time.'],
      ['My request says “Pending review”', 'We review every request before publishing it, usually within 24 hours. Meanwhile you can edit it; once approved, neighbors can offer to help.'],
      ['I can’t offer to help with a request', 'You can only offer help on approved requests that aren’t yours. If you already offered, you’ll see it in Activity → My offers.'],
      ['When does the chat open?', 'When the person who posted the request chooses an offer. From then on, both of you can talk from the request or from Activity.'],
      ['How do I rate the person who helped me?', 'On your request, tap “Mark as completed” and choose 1 to 5 stars. You can leave a comment. The rating can’t be changed afterwards.'],
      ['How do payments work?', 'If your request has a price, you pay it (plus an 8% service fee, at least CHF 1) when you post it, on Stripe’s secure page. We hold the money and, when you mark the job as done, the full price goes to the person who helped you. You can see every payment and payout in Profile → ⚙️ → Payments.'],
      ['Can I cancel and get my money back?', 'Yes, until you choose someone: open your request and tap “Cancel request”. You get the full amount back, fee included. Once you’ve chosen an offer it can’t be cancelled from the app; if something went wrong, write to us with the form.'],
      ['How do I get paid for helping?', 'In Profile, tap “Set up payouts” once: Stripe asks for your ID and bank account (IBAN) on its secure page. When the person you helped marks the job as done, the full price is sent to your bank account.'],
      ['How do I change the language?', 'On the welcome screen (EN · DE · ES) or in Profile → ⚙️ → Language.'],
      ['I want to report a request or a user', 'From the request details or the neighbor’s profile, or with this form choosing “I want to report a request or a user”. We review it within 24 hours.'],
      ['I want to delete my account', 'In the app: Profile → ⚙️ → “Delete account”. If you can’t sign in, ask us with the form, including the email of your account.'],
    ],
    contactoAntetitulo: 'Contact',
    contactoTitulo: 'Write to us',
    contactoIntro: 'Questions, problems with the app, reports or requests about your data. We reply by email.',
  },
  noEncontrada: { titulo: 'Page not found', h1: 'We couldn’t find this page', texto: 'The link may be wrong or the page may no longer exist.', volver: 'Back to the home page' },
  privacidad: {
    titulo: 'Privacy policy',
    descripcion: 'What data Neighborhub processes, why, and how to exercise your rights.',
    actualizado: 'Last updated: 3 October 2026',
    html: `
<p>Neighborhub is an app for neighbors to help each other. This policy explains what data we process, why, and what you can do about it. It applies to the iPhone app and to this website. We comply with the Swiss Federal Act on Data Protection (FADP) and, where applicable, the EU General Data Protection Regulation (GDPR).</p>
<h2>1. Controller</h2>
<p>Neighborhub, Zurich (Switzerland). You can write to us at any time using the <a href="{contacto}">contact form</a>.</p>
<h2>2. What data we process</h2>
<ul>
<li><strong>Account:</strong> name, email and how you sign in (email and password, Apple or Google). If you use Apple’s “Hide My Email”, we only receive the relay address.</li>
<li><strong>Profile:</strong> photo, bio, languages, city, postal code and, if you provide it, date of birth.</li>
<li><strong>Requests you post:</strong> title, description, category, photos, duration, availability and the location where help is needed.</li>
<li><strong>Activity:</strong> offers you make or receive, the chat messages of each request, ratings and reviews, your helps and badges.</li>
<li><strong>Payments:</strong> for paid requests, the amounts, status and dates of what you pay or receive, and Stripe’s references for them. You enter your card on Stripe’s page and it never reaches us. If you set up payouts, Stripe collects your identity and bank details; we only keep the identifier of your Stripe account and whether it can receive payments.</li>
<li><strong>Notifications:</strong> if you allow them, your device’s push token and the app’s language, to tell you about offers, messages and payments.</li>
<li><strong>Location:</strong> only while you use the app and with your permission, to calculate how far away requests are and to save the location of the ones you post. We don’t track your location in the background.</li>
<li><strong>Camera and photos:</strong> only for the photos you choose to upload (profile and requests).</li>
<li><strong>Contact:</strong> what you send us with the form (type of enquiry, name, email, message and language).</li>
<li><strong>Preferences:</strong> the language you choose in the app, stored only on your iPhone.</li>
<li><strong>Technical data:</strong> identifiers and logs generated by our infrastructure (Firebase) so the service works and stays secure.</li>
</ul>
<h2>3. What we use it for</h2>
<ul>
<li>Creating and maintaining your account and profile.</li>
<li>Showing nearby requests and handling offers, chat and ratings.</li>
<li>Reviewing requests before publishing them, handling reports and keeping the community safe.</li>
<li>Answering your questions and requests.</li>
<li>Processing payments, refunds and payouts for paid requests, and keeping the accounting records required by law.</li>
<li>Sending you the notifications you’ve allowed.</li>
</ul>
<p>The legal basis is providing the service you ask for when you use the app, and our legitimate interest in keeping it safe. We don’t sell your data, we don’t show ads and we don’t track you across other apps or websites.</p>
<h2>4. Who sees your data</h2>
<ul>
<li><strong>Other neighbors with an account</strong> see your public profile: name, photo, bio, languages, city, ratings, reviews, helps and badges. Your email is not shown in the app.</li>
<li>Your <strong>approved requests</strong> are visible to neighbors with an account, with their location on the map.</li>
<li>The <strong>chat</strong> of a request can only be seen by the two people taking part in it.</li>
<li><strong>Providers</strong> that help us run the service: Google (Firebase Authentication, Cloud Firestore, Cloud Storage and Hosting), Apple and Google for sign-in, and Apple Maps or Google Maps for the map. They may process data outside Switzerland or the EU, with the safeguards required by law (for example, standard contractual clauses). Payments and payouts are handled by Stripe, which processes the data it needs for them (including identity checks for helpers) as an independent controller under its own privacy policy. Push notifications are delivered through Expo.</li>
</ul>
<h2>5. How long we keep it</h2>
<p>As long as you have an account. If you delete it, we delete your account, your profile, your photos and your open requests and offers. Requests already completed with other neighbors and the reviews you left may be kept because they are part of their history; if you want us to delete them too, just ask. Messages sent through the contact form are kept for up to 12 months. Payment records are kept for 10 years, as required by Swiss accounting law.</p>
<h2>6. Your rights</h2>
<p>You can access your data, correct it, take it with you, object to its processing or ask us to delete it. You can do almost everything from the app (Profile → ⚙️). For anything else, write to us using the <a href="{contacto}">contact form</a>. If you believe we haven’t handled your data properly, you can complain to the Swiss Federal Data Protection and Information Commissioner (FDPIC) or to the authority in your country.</p>
<h2>7. How to delete your account</h2>
<p>From the app: <strong>Profile → ⚙️ → Delete account</strong>. If you can’t sign in to the app, ask us through the <a href="{borrar}">contact form</a> with the email of your account.</p>
<h2>8. Children</h2>
<p>Neighborhub is not intended for anyone under 16 and we don’t knowingly collect data from children under that age.</p>
<h2>9. Security</h2>
<p>Data is encrypted in transit and access is limited by security rules: for example, nobody can read a chat they’re not part of or change someone else’s ratings.</p>
<h2>10. Changes</h2>
<p>If we change this policy we’ll let you know in the app or on this website, with the date of the last update at the top.</p>`,
  },
  terminos: {
    titulo: 'Terms of use',
    descripcion: 'Terms of use and community rules of Neighborhub.',
    actualizado: 'Last updated: 3 October 2026',
    html: `
<p>By creating an account or using Neighborhub you accept these terms. If you don’t agree, please don’t use the app.</p>
<h2>1. What Neighborhub is</h2>
<p>A platform for neighbors to ask for and offer help to each other. Neighborhub puts people in touch, but it doesn’t provide the services and isn’t a party to the arrangements you make with each other.</p>
<h2>2. Your account</h2>
<ul><li>You must be at least 16 years old.</li><li>Your account and profile details must be real, and you are responsible for what is done with your account.</li><li>One person, one account.</li></ul>
<h2>3. Prices, payments and fees</h2>
<p>A request can be a free favor or have a price between CHF 5 and CHF 1,000, set by the person who asks. For paid requests:</p>
<ul>
<li>The person who asks pays the price plus a service fee of 8% (at least CHF 1) when posting the request. Payments are processed by Stripe: Neighborhub never sees your card details.</li>
<li>Advertising, spam, soliciting customers for a business, or asking to be paid outside Neighborhub for a request posted here.</li>
<li>Until an offer is chosen, the person who asked can cancel the request and gets the full amount back, price and fee. Requests we don’t approve are refunded in full too. Once an offer is chosen the request can no longer be cancelled from the app; if something goes wrong, contact us and we’ll look into it.</li>
<li>To get paid, helpers set up payouts once with Stripe, which verifies their identity and bank account (IBAN). Payment services for helpers are provided by Stripe and are subject to the <a href="https://stripe.com/connect-account/legal" rel="noopener">Stripe Connected Account Agreement</a>, which includes the Stripe Terms of Service.</li>
<li>Helpers are responsible for declaring their income and for any taxes or social security contributions that apply.</li>
<li>If the person who asked doesn’t mark a completed request as done, we may do it after checking with both people.</li>
</ul>
<p>Ratings and badges recognize help within the community: they have no monetary value and can’t be bought, sold or exchanged.</p>
<h2>4. Community rules: zero tolerance</h2>
<p>The following is not allowed in requests, profiles, photos, offers, chats or reviews:</p>
<ul>
<li>Offensive, sexual, violent or discriminatory content, or content that incites hatred.</li>
<li>Harassment, threats, impersonating someone else or sharing other people’s personal data.</li>
<li>Illegal or dangerous services, or services that require a professional license (for example electrical or gas installations, or healthcare).</li>
<li>Asking for or offering money, advertising, spam or soliciting customers for a business.</li>
<li>Fake ratings or manipulating your own or someone else’s reputation.</li>
</ul>
<h2>5. Moderation and reports</h2>
<p>We review requests before publishing them. You can report a request or a profile from the app or through the <a href="{reportar}">contact form</a>. We review reports within 24 hours, remove content that breaks these rules and may suspend or delete the accounts of those who break them, without prior notice in serious cases.</p>
<h2>6. Your content</h2>
<p>What you post remains yours. You allow us to show it within Neighborhub while it’s published. You must have the right to publish the photos and texts you upload.</p>
<h2>7. Safety and liability</h2>
<p>Meet in a visible place when possible, tell someone you trust when you’re going to give or receive help, and use common sense. The arrangements, the help and whatever happens during it are the responsibility of the people taking part. To the extent permitted by law, Neighborhub is not liable for damages arising from services arranged between users.</p>
<h2>8. Leaving</h2>
<p>You can delete your account at any time from the app (Profile → ⚙️ → Delete account). We may close accounts that break these terms.</p>
<h2>9. Changes and governing law</h2>
<p>We may update these terms and will notify you of important changes. They are governed by Swiss law; the courts of Zurich have jurisdiction, unless the consumer law of your country says otherwise.</p>
<h2>10. Contact</h2>
<p>For any questions, use the <a href="{contacto}">contact form</a>.</p>`,
  },
};
