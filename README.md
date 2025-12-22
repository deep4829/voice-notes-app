# Voice Notes App 🎤

A modern voice transcription app built with Expo and React Native that allows users to record, transcribe, and manage voice notes with powerful search and filtering capabilities.

## ✨ Features

- 🎤 **Record Audio** - High-quality audio recording
- 📝 **Auto Transcription** - Automatic speech-to-text conversion
- 💾 **Custom Titles** - Name each recording for easy identification
- ⭐ **Favorites** - Mark important recordings as favorites
- 🔍 **Smart Search** - Search by title, transcription, or date
- 📊 **Filter** - View All, Recent (24h), or Favorites only
- 📱 **Expand/Collapse** - See more or less of long transcriptions

## 🛠️ Tech Stack

- **Framework:** Expo Router with React Native
- **State Management:** React Context API & TanStack React Query
- **Audio:** expo-av for recording and playback
- **Icons:** lucide-react-native
- **Language:** TypeScript
- **Styling:** React Native StyleSheet

## 🚀 Getting Started

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/voice-notes-app.git
   cd voice-notes-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open in your browser:
   - Press `w` for web
   - Or navigate to `http://localhost:8081`

## 📖 Usage

### Recording a Note
1. Tap the blue **microphone button** to start recording
2. Speak clearly into your device
3. Tap the red **stop button** to finish
4. Enter a **title** for your recording
5. Tap **Save** to store it

### Managing Notes
- **⭐ Star** - Mark as favorite
- **▶️ Play** - Listen to recording
- **🗑️ Delete** - Remove recording
- **See More/Less** - Expand/collapse transcriptions

### Searching & Filtering
- Use the **search bar** to find notes by title or content
- Use **tabs** to filter:
  - **All** - All recordings
  - **Recent** - Last 24 hours
  - **Favorites** - Starred recordings

## 📂 Project Structure

```
MyExpoApp/
├── app/
│   ├── index.tsx              # Main app screen
│   ├── _layout.tsx            # Router layout
│   └── +not-found.tsx         # 404 page
├── components/
│   ├── RecordingScreen.tsx
│   └── TranscriptionListScreen.tsx
├── contexts/
│   └── NotesContext.tsx       # Global state
├── types/
│   └── note.ts                # TypeScript types
├── hooks/
├── constants/
└── .gitignore
```

## 💾 Data Structure

```typescript
interface Note {
  id: string;
  title: string;
  audioUri: string;
  transcription: string;
  duration: number;
  language?: string;
  createdAt: number;
  updatedAt?: number;
  isFavorite?: boolean;
}
```

## 🔌 API Integration

Uses transcription API:
- **Endpoint:** `https://toolkit.rork.com/stt/transcribe/`
- **Method:** POST (multipart/form-data)
- **Response:** Transcribed text + detected language

### Gemini (Optional) — Remote Summarization
To enable remote summarization with Gemini, set the following environment variables in your development environment or in EAS secrets:

- `EXPO_PUBLIC_GEMINI_MODEL` — (Optional) set a Gemini model name (e.g. `gemini-2.5-flash`). When set, the app will call the Google GenAI endpoint by default.
- `EXPO_PUBLIC_GEMINI_API_KEY` — API key for Gemini (for Google GenAI use your Google API key and it will be sent in `x-goog-api-key`).
- `EXPO_PUBLIC_GEMINI_API_URL` — (Optional) full custom endpoint URL if you use a non-Google Gemini endpoint that expects `Authorization: Bearer <key>` (uncomment to use)

The app uses these values to request a 3-line summary when saving a note. If either value is missing, the app falls back to the local summarizer.

Example cURL (replace values):

```bash
curl -X POST "https://your.gemini.endpoint/summarize" \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Summarize the following text in 3 short sentences:\n\n<YOUR TRANSCRIPT HERE>","max_tokens":256}'
```

If your Gemini endpoint uses a different request/response shape, update `utils/gemini.ts` accordingly.

## 🧠 State Management

The app uses React Context for global state management through `NotesContext`:

```typescript
const { notes, addNote, deleteNote, updateNote, updateTitle, updateFavorite } = useNotes();
```

## 🔨 Development

### Building for Production

Web:
```bash
npm run build
```

iOS/Android (requires EAS):
```bash
eas build --platform ios
eas build --platform android
```

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Created with ❤️ using Expo and React Native
