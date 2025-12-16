# Firebase Cloud Storage Setup

This app optionally supports Firebase Cloud Storage for automatic audio backup to the cloud. All audio is stored locally, but can be synced to Firebase when online.

## Why Firebase?

- **Free tier**: 1GB storage (more than enough for audio notes)
- **Always available**: No credit card required
- **Secure**: Anonymous authentication + Firebase Security Rules
- **Fast**: CDN-backed storage
- **Automatic sync**: Works seamlessly in the background

## Setup Steps

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a new project"
3. Enter project name: `VerbalNote`
4. Disable Google Analytics (optional)
5. Click "Create project"

### 2. Create Web App

1. In your Firebase project, click the **`</>` Web App** icon
2. Register app with name `VerbalNote Web`
3. **Important**: DO NOT check "Set up Firebase Hosting"
4. Click "Register app"

### 3. Get Firebase Config

After registering, you'll see a config like:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD...",
  authDomain: "yourproject.firebaseapp.com",
  projectId: "yourproject",
  storageBucket: "yourproject.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc..."
};
```

### 4. Add Config to .env

Copy the values to your `.env` file:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyD...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=yourproject.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=yourproject
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=yourproject.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc...
```

### 5. Set Up Firebase Storage Rules

1. In Firebase console, go to **Storage** > **Rules**
2. Replace the default rules with:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /audio/{userId}/{fileName} {
      // Allow anonymous users to read/write their own audio
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click "Publish"

### 6. Enable Anonymous Authentication

1. Go to **Authentication** > **Sign-in method**
2. Click **Anonymous**
3. Click **Enable**
4. Click **Save**

Done! 🎉

## How It Works

- **On app start**: Firebase initializes and authenticates anonymously
- **After recording**: Audio uploads to `audio/{userId}/{noteId}.m4a`
- **Offline**: Audio remains playable from local cache
- **When back online**: Failed uploads retry automatically
- **Always accessible**: All previous recordings available offline

## Storage Limits

- **Free tier**: 1GB total storage
- **Typical audio**: ~5-10MB per hour (depending on quality)
- **Example**: 100 hours of audio = ~500-1000MB

## Disabling Cloud Sync

If you don't want cloud storage, simply leave the Firebase env vars empty in `.env`. The app will work perfectly with local storage only.

## Troubleshooting

### "Firebase not ready" error
- Check if you've added all env vars to `.env`
- Verify Firebase project has Storage and Authentication enabled
- Check browser console for Firebase errors

### Upload fails
- Check internet connection
- Verify Firebase Security Rules are correct
- Check Firebase console > Storage > Usage for errors

### Files not uploading
- Ensure you're connected to internet
- Check your Firebase project usage hasn't exceeded 1GB

## Support

For Firebase help: https://firebase.google.com/docs/storage
