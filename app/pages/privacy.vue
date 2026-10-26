<template>
  <IonPage>
    <IonContent class="privacy-content">
      <article class="privacy">
        <header class="privacy__hero">
          <button type="button" class="privacy__back" aria-label="Go back" @click="goBack">
            <ChevronLeft :size="22" :stroke-width="2.25" />
          </button>
          <div class="privacy__title">
            <h1>Privacy policy</h1>
            <p class="privacy__date">13 October 2026</p>
          </div>
        </header>

        <p class="privacy__lead">
          This notice explains how KapéDoko handles personal information. It follows the
          Data Privacy Act of 2012 (Republic Act No. 10173) and its implementing rules, and it
          describes this app as it works today across the Philippines.
        </p>

        <section aria-labelledby="privacy-controller">
          <h2 id="privacy-controller">Who is responsible</h2>
          <p>
            KapéDoko is the personal information controller for this app. We decide why account,
            café, and analytics information is processed.
          </p>
          <p>
            A data protection officer, office address, and privacy email are not listed in the app
            yet. You can still use the controls in
            <NuxtLink to="/app/profile">Profile</NuxtLink>,
            and you can complain to the
            <a href="https://privacy.gov.ph" target="_blank" rel="noopener noreferrer">National Privacy Commission</a>.
          </p>
        </section>

        <section aria-labelledby="privacy-purpose">
          <h2 id="privacy-purpose">What the app is for</h2>
          <p>
            KapéDoko helps you choose a café you can work from. You can search, filter for Wi‑Fi
            and outlets, check hours, open a map, save cafés, write a review, or submit a café.
            Browsing does not need an account. An account is for checking in, keeping saves and
            reviews under your name, submitting a café, reporting a listing, or claiming a shop
            you operate.
          </p>
        </section>

        <section aria-labelledby="privacy-data">
          <h2 id="privacy-data">Information we process</h2>
          <p>We collect this from you, or from your device when you allow it.</p>

          <h3>Account</h3>
          <ul>
            <li>Your email address.</li>
            <li>Your password, stored by our sign-in host as a credential. We do not read it back as plain text.</li>
            <li>The name you choose to show on reviews, if you set one.</li>
            <li>Your role on the account, such as a regular account, café owner, or admin.</li>
            <li>A sign-in session so you stay signed in.</li>
          </ul>

          <h3>On this device, before you sign in</h3>
          <ul>
            <li>Cafés you save.</li>
            <li>Whether you finished the short introduction.</li>
            <li>The Near You distance you pick. The default is 5 km.</li>
            <li>Your choice to allow or stop usage analytics.</li>
            <li>A random analytics identifier, only after you allow analytics.</li>
          </ul>
          <p>
            Those stay on the device. Saved cafés sync to your account after you sign in. We do
            not receive a guest’s saved list before that.
          </p>

          <h3>Check-ins</h3>
          <p>
            A check-in stores your account, the café, how packed it felt, and the time. The public
            café page only shows a rolled-up crowd level and how many KapéBeans checked in recently.
            It does not show who checked in. Check-ins are not sent to analytics as a completed
            event; staff can see a 30-day count.
          </p>

          <h3>Reviews</h3>
          <p>
            A review stores your account, the café, your answers on Wi‑Fi, outlets, matcha, noise,
            and how long a stay fits, whether you recommend the café and would go back, an optional
            comment, and the time. On an approved café, the comment and your review name are
            public. If you have not set a name, the review is shown as KapéBean. Staff can hide a
            review that is reported. The words of the comment are not sent to analytics.
          </p>

          <h3>Cafés you submit</h3>
          <p>
            A submission stores the café details you enter, the map pin, and your account as the
            person who sent it. Public pins have to be in the Philippines. An admin approves the
            café before it appears in Home and Search.
          </p>

          <h3>Ownership claims</h3>
          <p>
            A claim stores a short note about why the shop is yours, a contact email or phone
            number, the café, and your account. An admin uses that to decide the claim. Verification
            lets you edit that café’s name, hours, contact, and logo. It leaves publishing, paid
            placements, and other shops with the admins. Claim contact details stay off the public
            café page.
          </p>

          <h3>Reports</h3>
          <p>
            If you report a review, photo, or listing, we store your account, what you reported,
            an optional reason, and whether the report is still open.
          </p>
        </section>

        <section aria-labelledby="privacy-location">
          <h2 id="privacy-location">Location</h2>
          <p>
            If you allow location, the app reads your position on the device to list cafés within
            the distance you set and to center the map. We do not keep a history of your
            coordinates on your account, and we do not send exact coordinates to analytics.
          </p>
          <p>
            A nearby or map search asks our database for cafés inside the map area on screen, so
            that request can show an approximate area. If location is off, the map can fall back
            to a Metro Manila center that is not your position.
          </p>
          <p>
            Map tiles come from OpenStreetMap, unless the app is configured to use another tile
            host. A tile request can reveal the map area, and your connection’s network address,
            to that host. If you tap directions or call, your maps app or phone dialer opens. We
            do not receive the contents of that call.
          </p>
          <p>
            If you allow analytics, we record only whether location was granted, denied, or
            unavailable.
          </p>
        </section>

        <section aria-labelledby="privacy-analytics">
          <h2 id="privacy-analytics">Usage analytics</h2>
          <p>
            Analytics stays off until you tap Allow on the first-launch notice or turn Usage
            analytics on in <NuxtLink to="/app/profile">Profile</NuxtLink>. The rest of the app
            works if you decline.
          </p>
          <p>
            We use PostHog, hosted in the European Union, to see how the app is used nationwide:
            whether cafés are easy to find, and whether people come back. Events
            can include app opens, the introduction, screens, filters, café cards and café pages,
            directions, calls, and photo taps, map opens, the location permission result, sign-in
            prompts, starting a review, and promotion views or taps. Details are categories and
            counts, such as a known area name or how many results came back, not the words you
            typed.
          </p>
          <p>We do not send analytics your:</p>
          <ul>
            <li>Email address or review name.</li>
            <li>Review text, café submission notes, or claim notes.</li>
            <li>Wi‑Fi network names.</li>
            <li>Exact map coordinates.</li>
            <li>Words you type into search.</li>
          </ul>
          <p>
            If you are not signed in, events are stored under a random identifier on this device.
            After you sign in, that identifier is replaced with your account id so we can see
            whether signed-in people return. We do not attach your email or name to those events.
            The random id can still recognize the same device while it remains on the device.
          </p>
          <p>
            You can turn analytics off in Profile. We then stop sending events and forget the
            analytics identifier on this device. Events already sent stay until the retention
            period ends.
          </p>
          <p>
            Session recordings, heatmaps, and advertising profiles are not used. Analytics data is
            kept for PostHog’s free-tier retention, currently one year, and is not sold.
          </p>
        </section>

        <section aria-labelledby="privacy-basis">
          <h2 id="privacy-basis">Why this is allowed</h2>
          <p>The Act allows processing on specific grounds. We use these:</p>
          <ul>
            <li>
              <strong>Consent.</strong>
              Usage analytics runs only if you allow it. You can refuse, and you can withdraw
              consent in Profile. Withdrawing consent does not undo events sent before you stopped.
            </li>
            <li>
              <strong>A service you asked for.</strong>
              Your account, synced saves, reviews, submissions, and claims exist because you
              asked for those features.
            </li>
            <li>
              <strong>Legitimate interests.</strong>
              We secure the app, check ownership claims, and moderate reports. Those interests are
              limited to running a trustworthy café guide. You can object where the Act gives you
              that right.
            </li>
          </ul>
          <p>
            We do not ask for sensitive personal information under the Act, such as government ID
            numbers, health information, religion, race, or political opinions. We do not use your
            personal information as the sole basis for a decision that significantly affects you.
            We do not sell personal information.
          </p>
        </section>

        <section aria-labelledby="privacy-sharing">
          <h2 id="privacy-sharing">Who else receives it</h2>
          <ul>
            <li>
              <strong>Supabase</strong>
              hosts accounts, reviews, saves, submissions, claims, and reports. People using the
              app see public café listings and public reviews. Admins can read what they need to
              approve a café, verify a claim, or handle a report.
            </li>
            <li>
              <strong>PostHog, in the European Union,</strong>
              receives usage events only if you allow analytics.
            </li>
            <li>
              <strong>The map-tile host</strong>
              receives tile requests when a map is on screen.
            </li>
            <li>
              <strong>Cloudflare R2</strong>
              may store café logos and photos. Those are listing images, not a photo of you.
            </li>
          </ul>
          <p>
            These hosts process information for the purposes in this notice. Analytics, when you
            allow them, are stored in the European Union. Our database and file hosts may sit
            outside the Philippines. We use them to run the app, not to build advertising profiles.
          </p>
        </section>

        <section aria-labelledby="privacy-retention">
          <h2 id="privacy-retention">How long we keep it</h2>
          <ul>
            <li>Account and profile information stays while the account exists.</li>
            <li>Saved cafés on an account stay until you remove them or the account is removed.</li>
            <li>Guest saves, the Near You distance, the introduction flag, and your analytics choice stay on your device until you clear them or turn analytics off.</li>
            <li>On the website, a sign-in cookie can last up to about 400 days, and it ends when you sign out. In the phone app, the session is stored on the device.</li>
            <li>Reviews can remain on a café page so the Wi‑Fi and outlet record stays useful. There is no delete-account button in the app yet.</li>
            <li>Claims and reports stay while we need them to finish the check or the moderation.</li>
            <li>Analytics events stay for the current one-year PostHog retention, then that host deletes them.</li>
          </ul>
        </section>

        <section aria-labelledby="privacy-rights">
          <h2 id="privacy-rights">Your rights</h2>
          <p>Under the Data Privacy Act you can:</p>
          <ul>
            <li>
              <strong>Be informed</strong>
              whether your personal information is being processed, and why. This page is that notice.
            </li>
            <li>
              <strong>Object</strong>
              to processing based on consent or on legitimate interests, including usage analytics.
            </li>
            <li>
              <strong>Access</strong>
              personal information we hold about you, including where it came from and who received it, as the Act describes.
            </li>
            <li>
              <strong>Correct</strong>
              information that is inaccurate. You can change the name on your reviews in Profile.
            </li>
            <li>
              <strong>Erase or block</strong>
              personal information when it is incomplete, outdated, false, unlawfully obtained, used for an unauthorized purpose, or no longer needed.
            </li>
            <li>
              <strong>Data portability,</strong>
              where it applies: a copy of personal information you provided, in an electronic form you can reuse, when processing is based on your consent or on a contract and is done by automated means.
            </li>
            <li>
              <strong>Damages</strong>
              if you are harmed by inaccurate, incomplete, outdated, false, unlawfully obtained, or unauthorized use of your personal information.
            </li>
            <li>
              <strong>Complain</strong>
              to the National Privacy Commission. Rights that the Act says pass to your heirs can be exercised as the law provides.
            </li>
          </ul>
          <p>
            These rights have limits. We may refuse a request the law allows us to refuse, for
            example if it would expose someone else’s information or if we must keep a record for
            a legal claim. If we refuse, we will tell you why.
          </p>
          <h3>How to use a right</h3>
          <ul>
            <li>Analytics: open Profile, then Usage analytics, and choose Stop. Or choose Not now on the first-launch notice.</li>
            <li>Name on reviews: open Profile while you are signed in.</li>
            <li>Location: turn it off in your phone or browser settings. The app still opens if you decline.</li>
            <li>Sign out: use Profile. Signing out ends the session on this device. It does not delete the account.</li>
          </ul>
          <p>
            Access, a portable copy, correction you cannot do in Profile, and erasure or blocking
            are not buttons in the app yet. Because a privacy email is not listed here, those
            requests cannot be sent from this page. A complaint to the
            <a href="https://privacy.gov.ph" target="_blank" rel="noopener noreferrer">National Privacy Commission</a>
            does not wait on that mailbox.
          </p>
        </section>

        <section aria-labelledby="privacy-security">
          <h2 id="privacy-security">Security</h2>
          <p>
            Account data is limited to you and to staff who need it for approval, claims, and
            reports. Passwords are handled by the sign-in host. On the production website the
            sign-in cookie is only sent over a secure connection. Analytics does not include your
            email or your exact location.
          </p>
          <p>
            No system can promise that a breach is impossible. If a breach meets the test in the
            Act, we will notify the National Privacy Commission and the people affected, as the
            law requires.
          </p>
        </section>

        <section aria-labelledby="privacy-children">
          <h2 id="privacy-children">Children</h2>
          <p>
            KapéDoko is a café guide for people looking for a place to work. We do not knowingly
            create accounts for children. If you are a parent or guardian and believe a child gave
            us personal information, complain to the National Privacy Commission or write to us
            once a privacy contact is listed, and we will delete what we are not allowed to keep.
          </p>
        </section>

        <section aria-labelledby="privacy-changes">
          <h2 id="privacy-changes">Changes</h2>
          <p>
            If this notice changes, the date at the top of the page changes with it. If a new use
            needs fresh consent, including a new use of analytics, we will ask before we start.
          </p>
        </section>
      </article>
    </IonContent>
  </IonPage>
</template>

<script lang="ts" setup>
import { ChevronLeft } from 'lucide-vue-next'
import { useIonRouter } from '@ionic/vue'

useHead({
  title: 'Privacy policy',
})

const ionRouter = useIonRouter()

const goBack = async () => {
  if (ionRouter.canGoBack()) {
    ionRouter.back()
    return
  }
  await navigateTo('/app/profile')
}
</script>

<style scoped>
.privacy-content {
  --background: #f2f2f2;
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

.privacy {
  max-width: 40rem;
  margin-inline: auto;
  padding: max(2.75rem, calc(env(safe-area-inset-top) + 16px)) 20px calc(2.5rem + env(safe-area-inset-bottom));
  color: var(--kd-ink, #1c1917);
  font-family: 'Kumbh Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.privacy__hero {
  display: flex;
  align-items: center;
  gap: 4px;
}

.privacy__back {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  margin-left: -10px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-ink, #1c1917);
  cursor: pointer;
}

.privacy__back:focus-visible {
  outline: 2px solid var(--kd-primary, #1f6f6b);
  outline-offset: 2px;
  border-radius: 8px;
}

.privacy__title {
  min-width: 0;
}

.privacy h1 {
  margin: 0;
  font-size: 1.325rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.privacy__date {
  margin: 2px 0 0;
  font-size: 0.8125rem;
  font-weight: 400;
  line-height: 1.3;
  color: var(--kd-ink, #1c1917);
}

.privacy__lead {
  margin: 20px 0 0;
  font-size: 1rem;
  line-height: 1.5;
}

.privacy section {
  margin-top: 28px;
  padding-top: 22px;
  border-top: 1px solid color-mix(in srgb, var(--kd-ink, #1c1917) 14%, transparent);
}

.privacy h2 {
  margin: 0 0 10px;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.privacy h3 {
  margin: 18px 0 8px;
  font-size: 0.9375rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.privacy p,
.privacy li {
  font-size: 1rem;
  line-height: 1.5;
}

.privacy p {
  margin: 0;
}

.privacy p + p,
.privacy ul + p,
.privacy p + ul {
  margin-top: 12px;
}

.privacy ul {
  margin: 10px 0 0;
  padding-left: 1.15rem;
}

.privacy li + li {
  margin-top: 8px;
}

.privacy a {
  color: var(--kd-primary, #1f6f6b);
  text-underline-offset: 0.18em;
}

.privacy a:hover {
  color: var(--kd-ink, #1c1917);
}

.privacy a:focus-visible {
  outline: 2px solid var(--kd-primary, #1f6f6b);
  outline-offset: 2px;
  border-radius: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .privacy a {
    transition: none;
  }
}
</style>
