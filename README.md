# Romantic Interactive Experience

## Project purpose

This project is the frontend foundation for a premium, interactive romantic experience delivered through a unique link. The recipient journey will eventually use full-screen scenes and personalized interactions rather than a conventional scrolling website.

## Technology stack

- Vanilla HTML5
- CSS3
- Vanilla JavaScript (ES6 modules)
- Bootstrap 5, used only as a supporting layout and responsive utility framework

No build system, backend, database, authentication, payment integration, or external animation library is included at this stage.

## Current development stage

**S1.1 — Initial project foundation**

This stage provides only the scalable project structure, module boundaries, shared style foundation, and a minimal development placeholder. It intentionally contains no proposal or recipient experience UI.

## Run locally

1. Open this folder in Visual Studio Code.
2. Install the Live Server extension if it is not already available.
3. Right-click `index.html` and choose **Open with Live Server**.
4. Open the provided local address in a modern browser.

Because JavaScript uses ES6 modules, serve the files over a local server instead of opening `index.html` directly from the filesystem.

## Folder structure

```text
project-root/
├── index.html
├── css/
│   ├── style.css
│   ├── responsive.css
│   └── animations.css
├── js/
│   ├── app.js
│   ├── experience.js
│   ├── animations.js
│   ├── theme.js
│   └── data.js
├── assets/
│   ├── images/
│   ├── illustrations/
│   ├── icons/
│   ├── fonts/
│   └── sounds/
└── README.md
```

## Important development rules

- Keep the recipient experience scene-based, not as a long scrolling page.
- Keep application bootstrap, experience logic, animation utilities, themes, and data access in separate modules.
- Keep presentation code independent from the future data source so the data layer can later be replaced by Supabase.
- Use Bootstrap only for layout and responsive utilities; do not rely on its default component appearance.
- Add external libraries only when a current interaction specifically requires them.
- Do not use inline CSS or inline JavaScript.
