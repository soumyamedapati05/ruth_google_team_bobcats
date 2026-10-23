# [Site name]

A voice-first scholarship matcher. Students say who they are out loud, answer a couple of follow-ups, and get a short list of scholarships that fit them.

## Pages

- `index.html` is the home page. Click the bar at the bottom or press Space to start.
- `talk.html` is the conversation. Hold Space (or press the button) to talk, then let go. The light around the circle follows your voice.

## Run it

It's plain HTML, CSS and JavaScript, so there's no build step.

```
python3 -m http.server 8000
```

Then open http://localhost:8000. The microphone only works over `localhost` or `https`, not when you open the file directly.

## What's real and what's placeholder

- **Real:** the microphone and the voice-reactive light (Web Audio), plus live transcription in Chrome and Edge (Web Speech API).
- **Fallback:** if there's no mic access, the page plays a sample answer so the flow still works.
- **Placeholder:** matching. `js/match.js` returns sample results. That's where the backend plugs in: send the answers to an API that pulls out a profile, checks it against a scholarship database, and returns the best fits with a reason for each.

## Files

```
index.html          home page
talk.html           voice conversation
css/talk.css        conversation styles
js/cursor-light.js  cursor light + Space shortcut on the home page
js/talk.js          conversation flow, mic, transcript, light
js/match.js         matching stub (swap for your API)
```
