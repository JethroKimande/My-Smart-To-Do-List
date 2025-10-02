# My Smart To-Do List

A browser-based task manager focused on accessibility, intelligent assistance, and performant rendering. The app lets you add, edit, filter, and complete tasks while an AI assistant ("Shani") helps with natural-language task management.

## ✨ Key Features
- **Accessible UI** – Skip links, ARIA labels, live regions, keyboard navigation, and busy-state indicators ensure screen-reader friendliness.
- **Virtualized Task List** – Automatically enables virtual scrolling for large task collections while falling back gracefully on browsers without required APIs.
- **Smart Task Handling** – Natural-language parsing, duplicate detection, and validation for priorities and due dates.
- **AI Chat Assistant** – Optional OpenRouter-powered Kimi K2 assistant for conversational task management with local fallback logic.
- **Persistent Storage** – Tasks are saved to `localStorage`, with import/export helpers for backups.

## 🧭 Project Structure
```
.
├── app.js                # Core application and AI assistant logic
├── index.html            # Tailwind-styled UI with accessibility landmarks
├── style.css             # Custom styles (skip link, task cards, animations)
├── tests/edgeCases.test.js # Node test suite covering edge-case scenarios
├── package.json          # npm metadata and test script
├── package-lock.json     # Dependency lockfile
└── images/shani_img.png  # Assistant avatar
```

## 🚀 Getting Started
1. **Clone the repository**
   ```powershell
   git clone https://github.com/JethroKimande/My-Smart-To-Do-List.git
   cd My-Smart-To-Do-List
   ```
2. **Install dev dependencies** (used for tests and tooling)
   ```powershell
   npm install
   ```
3. **Run locally**
   - Open `index.html` directly in your browser **or**
   - Serve the project:
     ```powershell
     python -m http.server 8000
     ```
   Then visit `http://localhost:8000`.

   ## 🔑 OpenRouter Setup
   The hosted Kimi experience now routes through [OpenRouter](https://openrouter.ai/). To enable remote AI responses:

   1. Create an OpenRouter account and generate an API key with access to the `moonshot/kimi-k2` model.
   2. Expose the key to the browser **before** `app.js` loads. A quick way is to add the snippet below to `index.html` (replace the placeholder value):
       ```html
       <script>
          window.OPENROUTER_API_KEY = "sk-or-v1-...";
       </script>
       <script src="app.js"></script>
       ```
       The app also falls back to a legacy `window.KIMI_API_KEY` variable if you already have that in place.
   3. Optional: edit `app.js` if you want to override the automatically derived `HTTP-Referer` or `X-Title` headers that OpenRouter recommends for rate-limit protection.

   If no key is provided, Shani gracefully falls back to the local NLP routines you enhanced earlier.

## 🧪 Testing
Automated tests exercise empty states, invalid date handling, and the concurrency guard around task mutations.
```powershell
npm test
```

## ♿ Accessibility Highlights
- Skip-to-content link and clear semantic landmarks (`header`, `main`, `role="feed"`).
- Live announcements for task updates and busy indicators for the task list container.
- Keyboard-friendly task navigation (arrow keys, Enter/Space/Deletion shortcuts).
- Visual focus indicators for invalid inputs via ARIA attributes.

## 🌐 Browser Considerations
On initialization the app detects support for features such as passive events, `requestIdleCallback`, and `ResizeObserver`. Virtual scrolling and animations adapt automatically when support is limited or when the user prefers reduced motion.

## 🧰 Available Scripts
- `npm test` – Run the Node.js test suite (requires Node 18+ recommended).

## 🤝 Contributing
Feel free to open issues or pull requests. When adding UI-facing changes, please maintain the accessibility helpers and update `tests/edgeCases.test.js` (or add new tests) to cover new edge cases.

## 📄 License
Released under the MIT License. See `LICENSE` (add one if needed for your use case).
