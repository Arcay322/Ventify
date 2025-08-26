require('dotenv').config({ path: './.env.local' });
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents?pageSize=1&key=${apiKey}`;
(async () => {
  console.log('Testing Firestore REST endpoint:', url);
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log('Status', res.status);
    console.log('Body:', text.slice(0, 1000));
  } catch (err) {
    console.error('Fetch error', err);
  }
})();
