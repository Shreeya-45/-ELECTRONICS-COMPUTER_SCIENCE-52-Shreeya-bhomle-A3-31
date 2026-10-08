const express = require('express');
const path = require('path');
const { run, get, all } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

app.get('/api/events', async (req, res) => {
  try {
    const events = await all(`
      SELECT e.id, e.name, e.date, e.venue,
             COUNT(a.id) AS attendee_count
      FROM events e
      LEFT JOIN attendees a ON a.event_id = e.id
      GROUP BY e.id, e.name, e.date, e.venue
      ORDER BY e.date DESC, e.name ASC
    `);

    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to fetch events.' });
  }
});

app.post('/api/events', async (req, res) => {
  const { name, date, venue } = req.body;

  if (!isValidText(name) || !isValidText(date) || !isValidText(venue)) {
    return res.status(400).json({ error: 'Event name, date, and venue are required.' });
  }

  try {
    const result = await run(
      'INSERT INTO events (name, date, venue) VALUES (?, ?, ?)',
      [name.trim(), date, venue.trim()]
    );

    const createdEvent = await get('SELECT * FROM events WHERE id = ?', [result.id]);
    res.status(201).json(createdEvent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to create event.' });
  }
});

app.get('/api/attendees', async (req, res) => {
  try {
    const attendees = await all(`
      SELECT a.id, a.name, a.email, a.ticket_type AS ticketType, a.event_id AS eventId,
             e.name AS eventName, e.date AS eventDate, e.venue AS eventVenue
      FROM attendees a
      INNER JOIN events e ON e.id = a.event_id
      ORDER BY e.date DESC, a.name ASC
    `);

    res.json(attendees);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to fetch attendees.' });
  }
});

app.post('/api/attendees', async (req, res) => {
  const { name, email, ticketType, eventId } = req.body;

  if (!isValidText(name) || !isValidText(email) || !isValidText(ticketType) || !eventId) {
    return res.status(400).json({ error: 'Name, email, ticket type, and event are required.' });
  }

  if (!emailPattern.test(email.trim())) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    const event = await get('SELECT id FROM events WHERE id = ?', [parseInt(eventId, 10)]);
    if (!event) {
      return res.status(404).json({ error: 'Selected event does not exist.' });
    }

    const existing = await get(
      'SELECT id FROM attendees WHERE event_id = ? AND LOWER(email) = LOWER(?)',
      [event.id, email.trim()]
    );

    if (existing) {
      return res.status(409).json({ error: 'This attendee is already registered for the selected event.' });
    }

    const result = await run(
      'INSERT INTO attendees (name, email, ticket_type, event_id) VALUES (?, ?, ?, ?)',
      [name.trim(), email.trim(), ticketType.trim(), event.id]
    );

    const createdAttendee = await get(
      `
        SELECT a.id, a.name, a.email, a.ticket_type AS ticketType, a.event_id AS eventId,
               e.name AS eventName, e.date AS eventDate, e.venue AS eventVenue
        FROM attendees a
        INNER JOIN events e ON e.id = a.event_id
        WHERE a.id = ?
      `,
      [result.id]
    );

    res.status(201).json(createdAttendee);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to register attendee.' });
  }
});

app.get('/api/search', async (req, res) => {
  const query = String(req.query.q || '').trim();

  if (!query) {
    return res.json([]);
  }

  try {
    const results = await all(
      `
        SELECT a.id, a.name, a.email, a.ticket_type AS ticketType, a.event_id AS eventId,
               e.name AS eventName, e.date AS eventDate, e.venue AS eventVenue
        FROM attendees a
        INNER JOIN events e ON e.id = a.event_id
        WHERE LOWER(a.name) LIKE LOWER(?)
           OR LOWER(e.name) LIKE LOWER(?)
           OR LOWER(a.email) LIKE LOWER(?)
        ORDER BY a.name ASC
      `,
      [`%${query}%`, `%${query}%`, `%${query}%`]
    );

    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to search attendees.' });
  }
});

app.put('/api/events/:id', async (req, res) => {
  const { id } = req.params;
  const { name, date, venue } = req.body;

  if (!isValidText(name) || !isValidText(date) || !isValidText(venue)) {
    return res.status(400).json({ error: 'Event name, date, and venue are required.' });
  }

  try {
    const existing = await get('SELECT id FROM events WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    await run(
      'UPDATE events SET name = ?, date = ?, venue = ? WHERE id = ?',
      [name.trim(), date, venue.trim(), id]
    );

    const updatedEvent = await get('SELECT * FROM events WHERE id = ?', [id]);
    res.json(updatedEvent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to update event.' });
  }
});

app.put('/api/attendees/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, ticketType, eventId } = req.body;

  if (!isValidText(name) || !isValidText(email) || !isValidText(ticketType) || !eventId) {
    return res.status(400).json({ error: 'Name, email, ticket type, and event are required.' });
  }

  if (!emailPattern.test(email.trim())) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    const existingAttendee = await get('SELECT * FROM attendees WHERE id = ?', [id]);
    if (!existingAttendee) {
      return res.status(404).json({ error: 'Attendee not found.' });
    }

    const targetEventId = parseInt(eventId, 10);
    const event = await get('SELECT id FROM events WHERE id = ?', [targetEventId]);
    if (!event) {
      return res.status(404).json({ error: 'Selected event does not exist.' });
    }

    const duplicate = await get(
      'SELECT id FROM attendees WHERE event_id = ? AND LOWER(email) = LOWER(?) AND id != ?',
      [targetEventId, email.trim(), id]
    );

    if (duplicate) {
      return res.status(409).json({ error: 'This attendee is already registered for the selected event.' });
    }

    await run(
      'UPDATE attendees SET name = ?, email = ?, ticket_type = ?, event_id = ? WHERE id = ?',
      [name.trim(), email.trim(), ticketType.trim(), targetEventId, id]
    );

    const updatedAttendee = await get(
      `
        SELECT a.id, a.name, a.email, a.ticket_type AS ticketType, a.event_id AS eventId,
               e.name AS eventName, e.date AS eventDate, e.venue AS eventVenue
        FROM attendees a
        INNER JOIN events e ON e.id = a.event_id
        WHERE a.id = ?
      `,
      [id]
    );

    res.json(updatedAttendee);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to update attendee.' });
  }
});

app.delete('/api/attendees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await run('DELETE FROM attendees WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Attendee not found.' });
    }

    res.json({ message: 'Attendee deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to delete attendee.' });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await run('DELETE FROM events WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    res.json({ message: 'Event deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to delete event.' });
  }
});

app.get('/api/events/:id/attendees/export', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    const attendees = await all(
      `
        SELECT a.name, a.email, a.ticket_type AS ticketType,
               e.name AS eventName, e.date AS eventDate, e.venue AS eventVenue
        FROM attendees a
        INNER JOIN events e ON e.id = a.event_id
        WHERE e.id = ?
        ORDER BY a.name ASC
      `,
      [id]
    );

    const fields = ['name', 'email', 'ticketType', 'eventName', 'eventDate', 'eventVenue'];

    const escape = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;

    const csvRows = [fields.join(',')];
    attendees.forEach((row) => {
      csvRows.push(fields.map((f) => escape(row[f])).join(','));
    });

    const csv = csvRows.join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendees_event_${id}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to export attendees.' });
  }
});

app.get('/api/events/:id/attendees/badges', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    const attendees = await all(
      `
        SELECT a.name, a.email, a.ticket_type AS ticketType,
               e.name AS eventName, e.date AS eventDate, e.venue AS eventVenue
        FROM attendees a
        INNER JOIN events e ON e.id = a.event_id
        WHERE e.id = ?
        ORDER BY a.name ASC
      `,
      [id]
    );

    const escapeHtml = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const eventName = attendees[0] ? escapeHtml(attendees[0].eventName) : `Event ${id}`;

    const html = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Badges - ${eventName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .badge-grid { display: flex; flex-wrap: wrap; gap: 12px; }
          .badge { width: 220px; height: 120px; border: 1px solid #ccc; border-radius: 6px; padding: 12px; box-sizing: border-box; background: #fff; }
          .badge .event { font-size: 12px; color: #666; }
          .badge .name { font-size: 18px; font-weight: 700; margin-top: 6px; }
          .badge .email { font-size: 12px; color: #333; margin-top: 6px; }
          @media print { .badge { page-break-inside: avoid; } }
        </style>
      </head>
      <body>
        <h1>Badges — ${eventName}</h1>
        <div class="badge-grid">
          ${attendees
            .map((a) => `
              <div class="badge">
                <div class="event">${escapeHtml(a.eventName)} — ${escapeHtml(a.eventDate)}</div>
                <div class="name">${escapeHtml(a.name)}</div>
                <div class="email">${escapeHtml(a.email)}</div>
                <div class="ticket">${escapeHtml(a.ticketType)}</div>
              </div>
            `)
            .join('\n')}
        </div>
        <script>window.print()</script>
      </body>
    </html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to generate badges.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
