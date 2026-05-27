export const content: Record<string, string> = {
  en: `# Cookie Policy of CandidAI

**Latest update:** May 27, 2026

---

## Table of Contents

- Introduction
- Owner and Data Controller
- How this Application uses Trackers
- How to manage preferences
- Definitions and legal references

---

## Introduction

This document informs Users about the technologies that help this Application to achieve the purposes described below. Such technologies allow the Owner to access and store information (for example by using a Cookie) or use resources (for example by running a script) on a User's device as they interact with this Application.

For simplicity, all such technologies are defined as "Trackers" within this document – unless there is a reason to differentiate. For example, while Cookies can be used on both web and mobile browsers, it would be inaccurate to talk about Cookies in the context of mobile apps as they are a browser-based Tracker. For this reason, within this document, the term Cookies is only used where it is specifically meant to indicate that particular type of Tracker.

Some of the purposes for which Trackers are used may also require the User's consent. Whenever consent is given, it can be freely withdrawn at any time following the instructions provided in this document.

This Application uses Trackers managed directly by the Owner (so-called "first-party" Trackers) and Trackers that enable services provided by a third-party (so-called "third-party" Trackers). Unless otherwise specified within this document, third-party providers may access the Trackers managed by them.

The validity and expiration periods of Cookies and other similar Trackers may vary depending on the lifetime set by the Owner or the relevant provider. Some of them expire upon termination of the User's browsing session.

In addition to what's specified in the descriptions within each of the categories below, Users may find more precise and updated information regarding lifetime specification as well as any other relevant information — such as the presence of other Trackers — in the linked privacy policies of the respective third-party providers or by contacting the Owner.

---

## Owner and Data Controller

**ANTONUCCI ALESSIO**
Via delle Orchidee 2, Cisterna di Latina, LT, 04012, Italy

**Owner contact email:** hello@candidai.tech

---

## How this Application uses Trackers

### Necessary

This Application uses so-called "technical" Cookies and other similar Trackers to carry out activities that are strictly necessary for the operation or delivery of the Service.

#### Trackers managed directly by this Application (first-party)

The following first-party cookies and similar technologies are set directly by this Application and are essential to its operation:

- **\`_ca_sid\`** (sessionStorage, expires when tab closes): an opaque session identifier used to group analytics events from the same browsing session.
- **\`_ca_uid\`** (sessionStorage, expires when tab closes): the authenticated user's ID, cached so analytics events written after sign-in are correctly attributed even when client-side auth state lags behind cookie-based authentication.
- **\`_ca_feedback_shown\`** (localStorage, persistent): a flag preventing the same user from being shown the in-app feedback prompt multiple times after they have responded or dismissed it.
- **\`analytics_session\`** (HttpOnly cookie, 30 days): administrator-only session for the internal analytics dashboard at /analytics. Not set for regular Users.

#### Trackers managed by third parties

##### Stripe

**Company:** Stripe, Inc.

**Place of processing:** United States

**Personal Data processed:**
- email address
- first name
- last name
- Trackers
- Usage Data

Stripe is a payment service provided by Stripe, Inc.

**Service provided by:** Stripe, Inc. (United States) – [Privacy Policy](https://stripe.com/privacy)

**Trackers duration:**
- 1: indefinite
- __Host-LinkSession: 2 years
- __stripe_mid: 1 year
- __stripe_sid: 30 minutes
- _mf: indefinite
- dashboard.banner-dismissals: duration of the session
- link.auth_session_client_secret: duration of the session
- m: 2 years
- pay_sid: 1 year

##### Vimeo video

**Company:** Vimeo, LLC

**Place of processing:** United States

**Personal Data processed:**
- Trackers
- Usage Data

Vimeo is a video content visualization service provided by Vimeo, LLC that allows this Application to incorporate content of this kind on its pages.

**Service provided by:** Vimeo, LLC (United States) – [Privacy Policy](https://vimeo.com/privacy)

**Trackers duration:**
- player: 1 year
- sync_active: duration of the session
- vuid: 2 years

### Marketing and attribution

This Application uses Trackers to attribute new sign-ups and conversions to the marketing campaigns or referral sources that brought the User to the site.

#### Trackers managed directly by this Application (first-party)

- **\`_ca_first_touch\`** (cookie, 90 days): a JSON payload capturing the UTM parameters (\`utm_source\`, \`utm_medium\`, \`utm_campaign\`, \`utm_content\`, \`utm_term\`), HTTP referrer and landing page recorded the first time the User visited the site from an attributable source. Read at sign-up time and stored on the User's profile to attribute their account to its originating marketing channel.
- **\`_ca_last_touch\`** (cookie, 90 days): the same payload as above but overwritten on every visit that carries new UTM parameters or arrives from an external referrer. Read at checkout to attribute the conversion to the most recent campaign.
- **\`_ca_utm\`** (sessionStorage, expires when tab closes): a transient copy of the current visit's UTM parameters, used to enrich analytics events from the same session.
- **\`referral\`** (cookie, 30 days): captures the value of the \`?ref=…\` URL parameter when the User arrives via a referral link, so the referring User can be credited if a purchase occurs.
- **\`discount\`** (cookie, 30 days): captures the value of the \`?discount=…\` URL parameter so a promotion code linked from an email or campaign is automatically applied at checkout.

### Measurement

This Application uses Trackers to measure traffic and analyze User behavior to improve the Service.

#### Trackers managed by third parties

##### Microsoft Clarity

**Company:** Microsoft Corporation

**Place of processing:** United States

**Personal Data processed:**
- Trackers
- Usage Data
- Session recordings (mouse movement, scroll behavior, click events, page transitions)
- Aggregated heatmaps

Microsoft Clarity is a behavior-analytics service that records anonymous Users' interactions with the site (mouse position, scrolls, clicks, page transitions) and produces aggregated heatmaps. Sensitive form fields are masked by default. Clarity does not collect text typed into input fields unless explicitly unmasked by the Owner (this Application does not unmask any field).

**Service provided by:** Microsoft Corporation (United States) – [Privacy Policy](https://privacy.microsoft.com/privacystatement)

**Trackers duration:**
- _clck: 1 year
- _clsk: 1 day
- MUID: 1 year
- ANONCHK: 10 minutes
- SM: duration of the session

##### Google Analytics for Firebase (for apps)

**Company:** Google LLC

**Place of processing:** United States

Google Analytics for Firebase (for apps) or Firebase Analytics is an analytics service provided by Google LLC. In order to understand Google's use of Data, consult [Google's partner policy](https://www.google.com/policies/privacy/partners/).

Firebase Analytics may share Data with other tools provided by Firebase, such as Crash Reporting, Authentication, Remote Config or Notifications. The User may check this privacy policy to find a detailed explanation about the other tools used by the Owner.

This Application uses identifiers for mobile devices and technologies similar to cookies to run the Firebase Analytics service.

Users may opt-out of certain Firebase features through applicable device settings, such as the device advertising settings for mobile phones or by following the instructions in other Firebase related sections of this privacy policy, if available.

**Personal Data processed:**
- device information
- number of sessions
- operating systems
- session duration
- Trackers
- Usage Data

**Service provided by:** Google LLC (United States) – [Privacy Policy](https://business.safety.google/privacy/)

---

## How to manage preferences and provide or withdraw consent on this Application

Whenever the use of Trackers is based on consent, users can provide or withdraw such consent by setting or updating their preferences via the relevant privacy choices panel available on this Application.

With regard to any third-party Trackers, Users can manage their preferences via the related opt-out link (where provided), by using the means indicated in the third party's privacy policy, or by contacting the third party.

### How to control or delete Cookies and similar technologies via your device settings

Users may use their own browser settings to:
- See what Cookies or other similar technologies have been set on the device
- Block Cookies or similar technologies
- Clear Cookies or similar technologies from the browser

The browser settings, however, do not allow granular control of consent by category.

Users can, for example, find information about how to manage Cookies in the most commonly used browsers at the following addresses:

- [Google Chrome](https://support.google.com/chrome/answer/95647?hl=en&p=cpn_cookies)
- [Mozilla Firefox](https://support.mozilla.org/en-US/kb/enable-and-disable-cookies-website-preferences)
- [Apple Safari](https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/)
- [Microsoft Internet Explorer](http://windows.microsoft.com/en-us/windows-vista/block-or-allow-cookies)
- [Microsoft Edge](https://support.microsoft.com/en-us/help/4027947)
- [Brave](https://support.brave.com/hc/en-us/articles/360022806212-How-do-I-use-Shields-while-browsing)
- [Opera](https://help.opera.com/en/latest/web-preferences/#cookies)

Users may also manage certain categories of Trackers used on mobile apps by opting out through relevant device settings such as the device advertising settings for mobile devices, or tracking settings in general (Users may open the device settings and look for the relevant setting).

### Consequences of denying the use of Trackers

Users are free to decide whether or not to allow the use of Trackers. However, please note that Trackers help this Application to provide a better experience and advanced functionalities to Users (in line with the purposes outlined in this document). Therefore, if the User chooses to block the use of Trackers, the Owner may be unable to provide related features.

---

## Definitions and legal references

### Personal Data (or Data)

Any information that directly, indirectly, or in connection with other information — including a personal identification number — allows for the identification or identifiability of a natural person.

### Usage Data

Information collected automatically through this Application (or third-party services employed in this Application), which can include: the IP addresses or domain names of the computers utilized by the Users who use this Application, the URI addresses (Uniform Resource Identifier), the time of the request, the method utilized to submit the request to the server, the size of the file received in response, the numerical code indicating the status of the server's answer (successful outcome, error, etc.), the country of origin, the features of the browser and the operating system utilized by the User, the various time details per visit (e.g., the time spent on each page within the Application) and the details about the path followed within the Application with special reference to the sequence of pages visited, and other parameters about the device operating system and/or the User's IT environment.

### User

The individual using this Application who, unless otherwise specified, coincides with the Data Subject.

### Data Subject

The natural person to whom the Personal Data refers.

### Data Processor (or Processor)

The natural or legal person, public authority, agency or other body which processes Personal Data on behalf of the Controller, as described in this privacy policy.

### Data Controller (or Owner)

The natural or legal person, public authority, agency or other body which, alone or jointly with others, determines the purposes and means of the processing of Personal Data, including the security measures concerning the operation and use of this Application. The Data Controller, unless otherwise specified, is the Owner of this Application.

### This Application

The means by which the Personal Data of the User is collected and processed.

### Service

The service provided by this Application as described in the relative terms (if available) and on this site/application.

### European Union (or EU)

Unless otherwise specified, all references made within this document to the European Union include all current member states to the European Union and the European Economic Area.

### Cookie

Cookies are Trackers consisting of small sets of data stored in the User's browser.

### Tracker

Tracker indicates any technology - e.g Cookies, unique identifiers, web beacons, embedded scripts, e-tags and fingerprinting - that enables the tracking of Users, for example by accessing or storing information on the User's device.

---

## Legal Information

This policy relates solely to this Application, if not stated otherwise within this document.

---

## How can we help?

### Your data

You may contact hello@candidai.tech to:

- **Request access:** Ask to know and access the information held about you
- **Request correction:** Ask to correct inaccurate information
- **Request deletion:** Ask to be forgotten and have information deleted
- **Request portability:** Ask to port your data to another service

### In case of issues

While we strive to create a positive user experience, we understand that issues may occasionally arise between us and our users. If this is the case, please feel free to contact us.

**Contact:** hello@candidai.tech
`,
};
