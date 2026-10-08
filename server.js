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

function parsePositiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseRating(value) {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
}

async function validateAttendeeEvent(attendeeValue, eventValue) {
  const attendeeId = parsePositiveId(attendeeValue);
  const eventId = parsePositiveId(eventValue);

  if (!attendeeId || !eventId) {
    return { error: 'Select a valid attendee and event.' };
  }

  const attendee = await get(
    'SELECT id FROM attendees WHERE id = ? AND event_id = ?',
    [attendeeId, eventId]
  );

  if (!attendee) {
    return { error: 'The selected attendee is not registered for this event.' };
  }

  return { attendeeId, eventId };
}

const featureResources = {
  venues: {
    table: 'venues',
    select: `
      SELECT id, name, location, capacity, equipment,
             availability_status AS availabilityStatus
      FROM venues
      ORDER BY name ASC
    `,
    selectOne: `
      SELECT id, name, location, capacity, equipment,
             availability_status AS availabilityStatus
      FROM venues WHERE id = ?
    `,
    insert: `
      INSERT INTO venues (name, location, capacity, equipment, availability_status)
      VALUES (?, ?, ?, ?, ?)
    `,
    update: `
      UPDATE venues
      SET name = ?, location = ?, capacity = ?, equipment = ?, availability_status = ?
      WHERE id = ?
    `,
    validate: async (body) => {
      const capacity = Number(body.capacity);
      const availabilityStatus = body.availabilityStatus;
      if (!isValidText(body.name) || !isValidText(body.location)) {
        return { error: 'Venue name and location are required.' };
      }
      if (!Number.isSafeInteger(capacity) || capacity < 1) {
        return { error: 'Venue capacity must be a positive whole number.' };
      }
      if (!['Available', 'Unavailable'].includes(availabilityStatus)) {
        return { error: 'Select a valid venue availability status.' };
      }
      if (body.equipment != null && typeof body.equipment !== 'string') {
        return { error: 'Available equipment must be text.' };
      }
      return {
        params: [
          body.name.trim(),
          body.location.trim(),
          capacity,
          String(body.equipment || '').trim(),
          availabilityStatus,
        ],
      };
    },
  },
  feedback: {
    table: 'feedback',
    select: `
      SELECT f.id, f.attendee_id AS attendeeId, f.event_id AS eventId,
             f.rating, f.comments, f.satisfaction,
             a.name AS attendeeName, e.name AS eventName
      FROM feedback f
      INNER JOIN attendees a ON a.id = f.attendee_id
      INNER JOIN events e ON e.id = f.event_id
      ORDER BY f.id DESC
    `,
    selectOne: `
      SELECT f.id, f.attendee_id AS attendeeId, f.event_id AS eventId,
             f.rating, f.comments, f.satisfaction,
             a.name AS attendeeName, e.name AS eventName
      FROM feedback f
      INNER JOIN attendees a ON a.id = f.attendee_id
      INNER JOIN events e ON e.id = f.event_id
      WHERE f.id = ?
    `,
    insert: `
      INSERT INTO feedback (attendee_id, event_id, rating, comments, satisfaction)
      VALUES (?, ?, ?, ?, ?)
    `,
    update: `
      UPDATE feedback
      SET attendee_id = ?, event_id = ?, rating = ?, comments = ?, satisfaction = ?
      WHERE id = ?
    `,
    validate: async (body) => {
      const relation = await validateAttendeeEvent(body.attendeeId, body.eventId);
      if (relation.error) return relation;
      const rating = parseRating(body.rating);
      const satisfaction = parseRating(body.satisfaction);
      if (!rating || !satisfaction) {
        return { error: 'Rating and overall satisfaction must each be between 1 and 5.' };
      }
      if (body.comments != null && typeof body.comments !== 'string') {
        return { error: 'Feedback comments must be text.' };
      }
      return {
        params: [
          relation.attendeeId,
          relation.eventId,
          rating,
          String(body.comments || '').trim(),
          satisfaction,
        ],
      };
    },
  },
  payments: {
    table: 'payments',
    select: `
      SELECT p.id, p.attendee_id AS attendeeId, p.event_id AS eventId,
             p.amount, p.status, p.method,
             a.name AS attendeeName, e.name AS eventName
      FROM payments p
      INNER JOIN attendees a ON a.id = p.attendee_id
      INNER JOIN events e ON e.id = p.event_id
      ORDER BY p.id DESC
    `,
    selectOne: `
      SELECT p.id, p.attendee_id AS attendeeId, p.event_id AS eventId,
             p.amount, p.status, p.method,
             a.name AS attendeeName, e.name AS eventName
      FROM payments p
      INNER JOIN attendees a ON a.id = p.attendee_id
      INNER JOIN events e ON e.id = p.event_id
      WHERE p.id = ?
    `,
    insert: `
      INSERT INTO payments (attendee_id, event_id, amount, status, method)
      VALUES (?, ?, ?, ?, ?)
    `,
    update: `
      UPDATE payments
      SET attendee_id = ?, event_id = ?, amount = ?, status = ?, method = ?
      WHERE id = ?
    `,
    validate: async (body) => {
      const relation = await validateAttendeeEvent(body.attendeeId, body.eventId);
      if (relation.error) return relation;
      const amount = Number(body.amount);
      const statuses = ['Pending', 'Paid', 'Failed', 'Refunded'];
      const methods = ['Cash', 'Card', 'Bank transfer', 'Online'];
      if (!Number.isFinite(amount) || amount < 0) {
        return { error: 'Payment amount must be a non-negative number.' };
      }
      if (!statuses.includes(body.status) || !methods.includes(body.method)) {
        return { error: 'Select a valid payment status and method.' };
      }
      return {
        params: [relation.attendeeId, relation.eventId, amount, body.status, body.method],
      };
    },
  },
  volunteers: {
    table: 'volunteers',
    select: `
      SELECT v.id, v.name, v.contact, v.event_id AS eventId,
             v.responsibility, e.name AS eventName
      FROM volunteers v
      INNER JOIN events e ON e.id = v.event_id
      ORDER BY v.name ASC
    `,
    selectOne: `
      SELECT v.id, v.name, v.contact, v.event_id AS eventId,
             v.responsibility, e.name AS eventName
      FROM volunteers v
      INNER JOIN events e ON e.id = v.event_id
      WHERE v.id = ?
    `,
    insert: `
      INSERT INTO volunteers (name, contact, event_id, responsibility)
      VALUES (?, ?, ?, ?)
    `,
    update: `
      UPDATE volunteers
      SET name = ?, contact = ?, event_id = ?, responsibility = ?
      WHERE id = ?
    `,
    validate: async (body) => {
      const eventId = parsePositiveId(body.eventId);
      if (!isValidText(body.name) || !isValidText(body.contact) || !isValidText(body.responsibility)) {
        return { error: 'Volunteer name, contact, and assigned responsibility are required.' };
      }
      if (!eventId || !(await get('SELECT id FROM events WHERE id = ?', [eventId]))) {
        return { error: 'Select a valid event for this volunteer.' };
      }
      return {
        params: [body.name.trim(), body.contact.trim(), eventId, body.responsibility.trim()],
      };
    },
  },
  certificates: {
    table: 'certificates',
    select: `
      SELECT c.id, c.attendee_id AS attendeeId, c.event_id AS eventId,
             c.type, c.issue_date AS issueDate,
             a.name AS attendeeName, e.name AS eventName
      FROM certificates c
      INNER JOIN attendees a ON a.id = c.attendee_id
      INNER JOIN events e ON e.id = c.event_id
      ORDER BY c.issue_date DESC, c.id DESC
    `,
    selectOne: `
      SELECT c.id, c.attendee_id AS attendeeId, c.event_id AS eventId,
             c.type, c.issue_date AS issueDate,
             a.name AS attendeeName, e.name AS eventName
      FROM certificates c
      INNER JOIN attendees a ON a.id = c.attendee_id
      INNER JOIN events e ON e.id = c.event_id
      WHERE c.id = ?
    `,
    insert: `
      INSERT INTO certificates (attendee_id, event_id, type, issue_date)
      VALUES (?, ?, ?, ?)
    `,
    update: `
      UPDATE certificates
      SET attendee_id = ?, event_id = ?, type = ?, issue_date = ?
      WHERE id = ?
    `,
    validate: async (body) => {
      const relation = await validateAttendeeEvent(body.attendeeId, body.eventId);
      if (relation.error) return relation;
      const issueDate = body.issueDate;
      const parsedDate = typeof issueDate === 'string' ? new Date(`${issueDate}T00:00:00Z`) : null;
      if (!isValidText(body.type)) {
        return { error: 'Certificate type is required.' };
      }
      if (
        !issueDate ||
        !/^\d{4}-\d{2}-\d{2}$/.test(issueDate) ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== issueDate
      ) {
        return { error: 'Enter a valid certificate issue date.' };
      }
      return {
        params: [relation.attendeeId, relation.eventId, body.type.trim(), issueDate],
      };
    },
  },
};

Object.entries(featureResources).forEach(([resource, config]) => {
  const endpoint = `/api/${resource}`;

  app.get(endpoint, async (req, res) => {
    try {
      res.json(await all(config.select));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: `Unable to fetch ${resource}.` });
    }
  });

  app.post(endpoint, async (req, res) => {
    try {
      const result = await config.validate(req.body);
      if (result.error) return res.status(400).json({ error: result.error });
      const created = await run(config.insert, result.params);
      res.status(201).json(await get(config.selectOne, [created.id]));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: `Unable to create ${resource.slice(0, -1)}.` });
    }
  });

  app.put(`${endpoint}/:id`, async (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ error: `A valid ${resource.slice(0, -1)} ID is required.` });

    try {
      const existing = await get(`SELECT id FROM ${config.table} WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: `${resource.slice(0, -1)} not found.` });

      const result = await config.validate(req.body);
      if (result.error) return res.status(400).json({ error: result.error });
      await run(config.update, [...result.params, id]);
      res.json(await get(config.selectOne, [id]));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: `Unable to update ${resource.slice(0, -1)}.` });
    }
  });

  app.delete(`${endpoint}/:id`, async (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ error: `A valid ${resource.slice(0, -1)} ID is required.` });

    try {
      const result = await run(`DELETE FROM ${config.table} WHERE id = ?`, [id]);
      if (result.changes === 0) {
        return res.status(404).json({ error: `${resource.slice(0, -1)} not found.` });
      }
      res.json({ message: `${resource.slice(0, -1)} deleted successfully.` });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: `Unable to delete ${resource.slice(0, -1)}.` });
    }
  });
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
