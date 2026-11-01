export function safeWebsite(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export function normalizeCard(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('This card is invalid.');
  const card = {name:clean(raw.name,70),role:clean(raw.role,90),company:clean(raw.company,80),email:clean(raw.email,120),website:clean(raw.website,180),bio:clean(raw.bio || raw.tagline,250),phone:clean(raw.phone,40)};
  if (!card.name) throw new Error('Add your name.');
  if (card.website && !safeWebsite(card.website)) throw new Error('Use a website starting with https:// or http://.');
  return card;
}
export function encodeSnapshot(raw) {
  const bytes = new TextEncoder().encode(JSON.stringify(normalizeCard(raw)));
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function decodeSnapshot(value) {
  if (!value || value.length > 6000 || !/^[A-Za-z0-9_-]+={0,2}$/.test(value)) throw new Error('This profile link is invalid or damaged.');
  const binary = atob(value.replace(/-/g,'+').replace(/_/g,'/'));
  return normalizeCard(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(binary, c=>c.charCodeAt(0)))));
}
export function cardSlug(name, suffix) {
  const stem=String(name).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30) || 'profile';
  return `${stem}-${String(suffix).replace(/[^a-z0-9]/g,'').slice(0,6) || 'card'}`;
}
export const validSlug = value => /^[a-z0-9][a-z0-9-]{2,39}$/.test(value);
export function contactFile(raw) {
  const card = normalizeCard(raw);
  const value = s => String(s || '').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  return ['BEGIN:VCARD','VERSION:3.0',`FN:${value(card.name)}`,`N:;${value(card.name)};;;`,card.role && `TITLE:${value(card.role)}`,card.company && `ORG:${value(card.company)}`,card.email && `EMAIL:${value(card.email)}`,card.phone && `TEL:${value(card.phone)}`,card.website && `URL:${value(safeWebsite(card.website))}`,card.bio && `NOTE:${value(card.bio)}`,'END:VCARD'].filter(Boolean).join('\r\n')+'\r\n';
}
export function helpAnswer(question) {
  const q=String(question||'').toLowerCase();
  if (/refund|support|paid twice|wrong amount/.test(q)) return 'Open My account → Orders & payments, select your order and use “Need help or want to request a refund?”. The owner’s reply will appear in your account. A support request does not automatically issue a refund.';
  if (/upi|pay|subscription|renew|pro|plan/.test(q)) return 'Open Digital subscriptions to see the current plans. Pro supports up to five saved cards. When checkout is open, pay using the displayed UPI QR or app link and submit your 12-digit transaction reference. Access starts after the owner checks the payment. Renewals are manual; there is no automatic debit.';
  if (/nfc|tap|tag/.test(q)) return 'Save your card while signed in, copy its permanent profile link, and write that URL to a compatible NFC tag with your phone’s NFC-writing app. Visitors can tap the tag to open your card without signing in. An NFC tag is not included in a digital subscription.';
  if (/scan|camera/.test(q)) return 'Choose QR scanner and press Start scanner. Allow camera access when your browser asks. You can stop the camera at any time. After a scan, check the address before choosing Open scanned link. You can also paste a profile URL.';
  if (/edit|update|private|publish|delete/.test(q)) return 'Sign in and open My account, then Edit card. Saved account cards keep the same address when you update them. Uncheck Publish and save to hide a card. Guest snapshot links contain their original details and cannot be edited or recalled.';
  if (/login|log in|sign|password|account/.test(q)) return 'Use Sign up to create an email account, confirm the email if requested, then sign in. Forgot your password? Use the reset link on the login page. Only the signed-in owner can edit their cards; the owner dashboard requires separate administrator permissions.';
  if (/qr|share|contact|download/.test(q)) return 'Fill in Card details and generate your card. You can copy its link, download the QR code, or open the public card and download the contact file. Sign in before saving if you want a permanent address you can update later.';
  return 'I’m the built-in SmartConnect guide. Ask about creating or editing a card, QR scanning, NFC setup, sign-in, UPI payments or subscriptions. For an order issue, open that order’s support form.';
}
