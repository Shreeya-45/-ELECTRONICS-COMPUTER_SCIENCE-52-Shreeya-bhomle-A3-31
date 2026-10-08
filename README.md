# Eventora

Eventora is a web-based event management application for planning events and keeping attendee information and related event operations in one place. It uses a static HTML, CSS, and JavaScript frontend, an Express API, and a SQLite database.

## Features

- Create, edit, list, and delete events.
- Register, edit, search, and remove attendees; prevent duplicate attendee registrations for the same event.
- View event attendee counts and export an event's attendee list as CSV.
- Generate printable attendee badges for an event.
- Manage venues, feedback, payments, volunteers, and certificates.
- Store application data locally in SQLite.

## Requirements

- Node.js with npm

## Getting started

1. Install dependencies:

   ```sh
   npm install
   ```

2. Start the application:

   ```sh
   npm start
   ```

3. Open [http://localhost:3000](http://localhost:3000) in a browser.

For development with Node's watch mode, run:

```sh
npm run dev
```

The SQLite database is created automatically at `data/event_management.db` when the server starts. The `data/` directory is excluded from Git, so each local installation keeps its own database.

## Application pages

- `index.html` — dashboard, event creation, attendee registration, and attendee search.
- `events.html` — event management.
- `attendees.html` — attendee management.
- `features.html` — additional event operations.

## API

All API endpoints are served from the same origin as the web application and accept and return JSON unless stated otherwise.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET`, `POST` | `/api/events` | List or create events. |
| `PUT`, `DELETE` | `/api/events/:id` | Update or delete an event. |
| `GET`, `POST` | `/api/attendees` | List or register attendees. |
| `PUT`, `DELETE` | `/api/attendees/:id` | Update or delete an attendee. |
| `GET` | `/api/search?q=...` | Search attendees by name, email, or event name. |
| `GET`, `POST` | `/api/venues` | List or create venues. |
| `PUT`, `DELETE` | `/api/venues/:id` | Update or delete a venue. |
| `GET`, `POST` | `/api/feedback` | List or create attendee feedback. |
| `PUT`, `DELETE` | `/api/feedback/:id` | Update or delete feedback. |
| `GET`, `POST` | `/api/payments` | List or create attendee payments. |
| `PUT`, `DELETE` | `/api/payments/:id` | Update or delete a payment. |
| `GET`, `POST` | `/api/volunteers` | List or create event volunteers. |
| `PUT`, `DELETE` | `/api/volunteers/:id` | Update or delete a volunteer. |
| `GET`, `POST` | `/api/certificates` | List or create attendee certificates. |
| `PUT`, `DELETE` | `/api/certificates/:id` | Update or delete a certificate. |
| `GET` | `/api/events/:id/attendees/export` | Download an event's attendee list as CSV. |
| `GET` | `/api/events/:id/attendees/badges` | Open printable attendee badges for an event. |

## Project structure

```text
.
├── db.js                 # SQLite connection, schema, and query helpers
├── server.js             # Express server and API routes
├── package.json          # Scripts and dependencies
├── data/                 # Generated local SQLite database (not tracked)
└── public/
    ├── index.html        # Dashboard
    ├── events.html       # Event management page
    ├── attendees.html    # Attendee management page
    ├── features.html     # Additional event tools
    ├── app.js            # Dashboard and CRUD interactions
    ├── features.js       # Additional feature interactions
    └── styles.css        # Application styles
```
