// Generate VAPID keypair for Web Push.
// Run: npx tsx scripts/gen-vapid.ts
// Copy output to .env.local + Vercel env.

import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("\n# Add to .env.local (and Vercel env in production):\n");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_SUBJECT=mailto:hr@anajak.local`);
console.log("");
