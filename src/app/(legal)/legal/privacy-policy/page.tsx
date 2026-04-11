export default function PrivacyPolicyPage() {
  return (
    <article className="prose prose-slate max-w-none">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-slate-500">Last updated: April 11, 2026</p>

      <h2>1. Information We Collect</h2>
      <p>We collect the following types of information:</p>
      <ul>
        <li>
          <strong>Account information:</strong> name, email address, and
          password when you create an account.
        </li>
        <li>
          <strong>Social media data:</strong> publicly available content
          metrics (views, likes, comments, shares) from connected social media
          platforms (TikTok, Instagram) accessed through official APIs.
        </li>
        <li>
          <strong>Usage data:</strong> information about how you interact with
          the Service.
        </li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <p>We use collected information to:</p>
      <ul>
        <li>Provide and maintain the Service</li>
        <li>Track and display content performance analytics</li>
        <li>Generate reports and insights for campaign management</li>
        <li>Send notifications and weekly reports you have configured</li>
        <li>Improve and develop new features</li>
      </ul>

      <h2>3. Social Media Data</h2>
      <p>
        We access social media data through official platform APIs (TikTok for
        Developers, Instagram Graph API). We only collect publicly available
        content metrics. We do not access private messages, personal contacts,
        or non-public content. Users authorize data access through official
        platform OAuth flows.
      </p>

      <h2>4. Data Storage and Security</h2>
      <p>
        Your data is stored securely using industry-standard encryption. API
        credentials are stored encrypted. We implement appropriate technical and
        organizational measures to protect your data.
      </p>

      <h2>5. Data Sharing</h2>
      <p>
        We do not sell your personal information. We may share data only in
        these cases:
      </p>
      <ul>
        <li>With your consent</li>
        <li>To comply with legal obligations</li>
        <li>To protect our rights and safety</li>
      </ul>

      <h2>6. Data Retention</h2>
      <p>
        We retain your data for as long as your account is active. You may
        request deletion of your account and associated data at any time.
      </p>

      <h2>7. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Access and download your data</li>
        <li>Correct inaccurate information</li>
        <li>Delete your account and data</li>
        <li>Revoke social media platform access at any time</li>
      </ul>

      <h2>8. Third-Party Services</h2>
      <p>
        The Service integrates with third-party social media platforms. Your use
        of those platforms is governed by their respective privacy policies.
      </p>

      <h2>9. Changes to This Policy</h2>
      <p>
        We may update this policy from time to time. We will notify you of
        significant changes through the Service.
      </p>

      <h2>10. Contact</h2>
      <p>
        For privacy-related questions, please contact us through the
        application.
      </p>
    </article>
  );
}
