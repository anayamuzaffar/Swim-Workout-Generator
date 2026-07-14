# Set the Pace 🏊 — Swim Workout Generator

**[Live Demo](https://anayamuzaffar.github.io/Swim-Workout-Generator/)**

## Why I Built This

I swam competitively in high school and I'm part of my college's swim club now, so I'm still in the pool regularly. The problem is every time I wanted to swim on my own, I'd end up searching online for a decent set to do. It got old fast, and I kept cycling through the same handful of workouts I'd bookmarked or remembered, which got repetitive after a while.
 
I wanted easier access to a wider variety of sets without having to go hunting every time, so I built **Set the Pace**. You pick your yardage, stroke focus, course type, and difficulty, and it generates a full workout — warm-up through cool-down — from a set of real practice sets I put together myself.

## How It Works

- **Pick your parameters**: total yardage (under 1,000 up to 4,000), stroke focus (freestyle, stroke of your choice, or IM), course type (sprint or distance), and difficulty (easy, moderate, hard).
- **Generator assembles a workout**: a warm-up, one or more preset/main sets that match your filters, and a cool-down, all combined to land within your chosen yardage range.
- **Export it**: hit "Save as PDF" to print or save the generated workout to bring on deck.

Under the hood, it's vanilla JavaScript with no framework and no external workout API — the "API" is a JSON file of swim sets I built and tagged myself (stroke, course type, difficulty, and exact yardage breakdown for every rep), and the generation logic does its own filtering and yardage-matching to build a workout that fits what you asked for.

## Tech Stack

- HTML / CSS / vanilla JavaScript
- JSON as a local data store (`swim_sets.json`)
- No frameworks, no backend — deployed as a static site on GitHub Pages

## Future Development

- **Saved workouts** — let users save generated workouts they liked and revisit them later instead of re-rolling from scratch
- **More sets** — expand the underlying set database so the generator draws from a bigger, more varied pool, especially for combinations (like sprint-focused IM) that are thin right now

