const eventForm = document.getElementById('event-form');
const attendeeForm = document.getElementById('attendee-form');
const searchInput = document.getElementById('search-input');
const eventsList = document.getElementById('events-list');
const attendeesList = document.getElementById('attendees-list');
const eventSelect = document.getElementById('event-select');
const statsEvents = document.getElementById('stats-events');
const statsAttendees = document.getElementById('stats-attendees');
const statsSearch = document.getElementById('stats-search');

const state = {
  events: [],
  attendees: [],
};

function renderStats() {
  if (!statsEvents || !statsAttendees || !statsSearch) return;

  const eventCount = state.events.length;
  const attendeeCount = state.attendees.length;

  statsEvents.textContent = eventCount;
  statsAttendees.textContent = attendeeCount;
  statsSearch.textContent = state.attendees.length ? 'Active' : 'Ready';
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }

  return data;
}

function renderEventOptions() {
  if (!eventSelect) return;

  const options = ['<option value="">Select an event</option>'];

  state.events.forEach((event) => {
    options.push(`<option value="${event.id}">${event.name} (${event.date})</option>`);
  });

  eventSelect.innerHTML = options.join('');
}

function renderEvents() {
  renderStats();

  if (!eventsList) return;

  if (!state.events.length) {
    eventsList.innerHTML = '<div class="empty-state">No events available yet.</div>';
    return;
  }

  eventsList.className = 'event-list';
  eventsList.innerHTML = state.events
    .map(
      (event) => `
        <article class="event-card">
          <div class="meta-row">
            <h3>${event.name}</h3>
            <span class="badge">${event.attendee_count || 0} attendees</span>
          </div>
          <p><strong>Date:</strong> ${event.date}</p>
          <p><strong>Venue:</strong> ${event.venue}</p>
          <div class="event-actions">
            <button class="secondary-btn" data-event-id="${event.id}" data-action="edit" type="button">Edit</button>
            <button class="secondary-btn" data-event-id="${event.id}" data-action="export" type="button">Export CSV</button>
            <button class="secondary-btn" data-event-id="${event.id}" data-action="badges" type="button">Print Badges</button>
            <button class="danger-btn" data-event-id="${event.id}" data-action="delete" type="button">Delete Event</button>
          </div>
        </article>
      `
    )
    .join('');
}

function renderAttendees() {
  renderStats();

  if (!attendeesList) return;

  if (!state.attendees.length) {
    attendeesList.innerHTML = '<div class="empty-state">No attendee records found.</div>';
    return;
  }

  attendeesList.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Ticket</th>
            <th>Event</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${state.attendees
            .map(
              (attendee) => `
                <tr>
                  <td>${attendee.name}</td>
                  <td>${attendee.email}</td>
                  <td>${attendee.ticketType}</td>
                  <td>${attendee.eventName}</td>
                  <td class="action-cell">
                    <button class="secondary-btn" data-attendee-id="${attendee.id}" data-action="edit" type="button">Edit</button>
                    <button class="danger-btn" data-attendee-id="${attendee.id}" type="button">Delete</button>
                  </td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function fetchEvents() {
  const events = await request('/api/events');
  state.events = events;
  renderEventOptions();
  renderEvents();
}

async function fetchAttendees(searchValue = '') {
  const query = searchValue.trim();
  const data = query
    ? await request(`/api/search?q=${encodeURIComponent(query)}`)
    : await request('/api/attendees');

  state.attendees = data;
  renderAttendees();
}

async function addEvent(event) {
  const payload = {
    name: document.getElementById('event-name').value,
    date: document.getElementById('event-date').value,
    venue: document.getElementById('event-venue').value,
  };

  await request('/api/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  eventForm.reset();
  await fetchEvents();
  await fetchAttendees(searchInput.value);
}

async function addAttendee(event) {
  const payload = {
    name: document.getElementById('attendee-name').value,
    email: document.getElementById('attendee-email').value,
    ticketType: document.getElementById('ticket-type').value,
    eventId: document.getElementById('event-select').value,
  };

  await request('/api/attendees', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  attendeeForm.reset();
  await fetchEvents();
  await fetchAttendees(searchInput.value);
}

async function deleteEvent(eventId) {
  await request(`/api/events/${eventId}`, { method: 'DELETE' });
  await fetchEvents();
  await fetchAttendees(searchInput.value);
}

async function updateEvent(eventId, payload) {
  await request(`/api/events/${eventId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  await fetchEvents();
  await fetchAttendees(searchInput.value);
}

async function deleteAttendee(attendeeId) {
  await request(`/api/attendees/${attendeeId}`, { method: 'DELETE' });
  await fetchEvents();
  await fetchAttendees(searchInput.value);
}

async function updateAttendee(attendeeId, payload) {
  await request(`/api/attendees/${attendeeId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  await fetchEvents();
  await fetchAttendees(searchInput.value);
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  window.setTimeout(() => {
    toast.classList.remove('show');
    window.setTimeout(() => toast.remove(), 260);
  }, 2200);
}

function showConfirmationDialog({ title, message, confirmText = 'Confirm', cancelText = 'Cancel' }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div class="dialog-icon">!</div>
        <h3 id="dialog-title">${title}</h3>
        <p>${message}</p>
        <div class="dialog-actions">
          <button type="button" class="secondary-btn dialog-cancel">${cancelText}</button>
          <button type="button" class="danger-btn dialog-confirm">${confirmText}</button>
        </div>
      </div>
    `;

    const close = (result) => {
      backdrop.remove();
      resolve(result);
    };

    backdrop.querySelector('.dialog-cancel').addEventListener('click', () => close(false));
    backdrop.querySelector('.dialog-confirm').addEventListener('click', () => close(true));
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close(false);
    });

    document.body.appendChild(backdrop);
  });
}

function openEventEditor(event) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="event-edit-title">
      <div class="modal-header">
        <h3 id="event-edit-title">Edit Event</h3>
        <button class="close-btn" type="button" aria-label="Close">×</button>
      </div>
      <form class="modal-form" id="event-edit-form">
        <div class="field-group">
          <label for="edit-event-name">Event Name</label>
          <input id="edit-event-name" name="name" type="text" value="${event.name}" required />
        </div>
        <div class="field-group">
          <label for="edit-event-date">Date</label>
          <input id="edit-event-date" name="date" type="date" value="${event.date}" required />
        </div>
        <div class="field-group">
          <label for="edit-event-venue">Venue</label>
          <input id="edit-event-venue" name="venue" type="text" value="${event.venue}" required />
        </div>
        <div class="modal-actions">
          <button type="button" class="secondary-btn close-btn-inline">Cancel</button>
          <button type="submit" class="primary-btn">Save Changes</button>
        </div>
      </form>
    </div>
  `;

  const close = () => modal.remove();
  modal.querySelector('.close-btn').addEventListener('click', close);
  modal.querySelector('.close-btn-inline').addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  modal.querySelector('#event-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('edit-event-name').value,
      date: document.getElementById('edit-event-date').value,
      venue: document.getElementById('edit-event-venue').value,
    };

    try {
      await updateEvent(event.id, payload);
      close();
      showToast('Event updated successfully.');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  document.body.appendChild(modal);
}

function openAttendeeEditor(attendee) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="attendee-edit-title">
      <div class="modal-header">
        <h3 id="attendee-edit-title">Edit Attendee</h3>
        <button class="close-btn" type="button" aria-label="Close">×</button>
      </div>
      <form class="modal-form" id="attendee-edit-form">
        <div class="field-group">
          <label for="edit-attendee-name">Name</label>
          <input id="edit-attendee-name" name="name" type="text" value="${attendee.name}" required />
        </div>
        <div class="field-group">
          <label for="edit-attendee-email">Email</label>
          <input id="edit-attendee-email" name="email" type="email" value="${attendee.email}" required />
        </div>
        <div class="field-group">
          <label for="edit-attendee-ticket">Ticket Type</label>
          <select id="edit-attendee-ticket" name="ticketType" required>
            <option value="VIP" ${attendee.ticketType === 'VIP' ? 'selected' : ''}>VIP</option>
            <option value="Standard" ${attendee.ticketType === 'Standard' ? 'selected' : ''}>Standard</option>
            <option value="Student" ${attendee.ticketType === 'Student' ? 'selected' : ''}>Student</option>
          </select>
        </div>
        <div class="field-group">
          <label for="edit-attendee-event">Event</label>
          <select id="edit-attendee-event" name="eventId" required>
            <option value="">Select an event</option>
            ${state.events
              .map(
                (event) =>
                  `<option value="${event.id}" ${String(attendee.eventId) === String(event.id) ? 'selected' : ''}>${event.name} (${event.date})</option>`
              )
              .join('')}
          </select>
        </div>
        <div class="modal-actions">
          <button type="button" class="secondary-btn close-btn-inline">Cancel</button>
          <button type="submit" class="primary-btn">Save Changes</button>
        </div>
      </form>
    </div>
  `;

  const close = () => modal.remove();
  modal.querySelector('.close-btn').addEventListener('click', close);
  modal.querySelector('.close-btn-inline').addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  modal.querySelector('#attendee-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('edit-attendee-name').value,
      email: document.getElementById('edit-attendee-email').value,
      ticketType: document.getElementById('edit-attendee-ticket').value,
      eventId: document.getElementById('edit-attendee-event').value,
    };

    try {
      await updateAttendee(attendee.id, payload);
      close();
      showToast('Attendee updated successfully.');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  document.body.appendChild(modal);
}

if (eventForm) {
  eventForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      await addEvent(event);
      alert('Event added successfully.');
    } catch (error) {
      alert(error.message);
    }
  });
}

if (attendeeForm) {
  attendeeForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      await addAttendee(event);
      alert('Attendee registered successfully.');
    } catch (error) {
      alert(error.message);
    }
  });
}

if (searchInput) {
  searchInput.addEventListener('input', async (event) => {
    await fetchAttendees(event.target.value);
  });
}

if (eventsList) {
  eventsList.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-event-id]');
    if (!button) return;

    const action = button.dataset.action || 'delete';

    try {
      if (action === 'edit') {
        const eventDetails = state.events.find((currentEvent) => String(currentEvent.id) === String(button.dataset.eventId));
        if (eventDetails) {
          openEventEditor(eventDetails);
        }
        return;
      }

      if (action === 'delete') {
        const confirmed = await showConfirmationDialog({
          title: 'Delete event?',
          message: 'This will remove the event and all its attendee data. This action cannot be undone.',
          confirmText: 'Delete',
        });

        if (!confirmed) return;

        await deleteEvent(button.dataset.eventId);
        showToast('Event deleted successfully.');
      } else if (action === 'export') {
        const url = `/api/events/${button.dataset.eventId}/attendees/export`;
        const a = document.createElement('a');
        a.href = url;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else if (action === 'badges') {
        const url = `/api/events/${button.dataset.eventId}/attendees/badges`;
        window.open(url, '_blank');
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

if (attendeesList) {
  attendeesList.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-attendee-id]');
    if (!button) return;

    const action = button.dataset.action || 'delete';

    try {
      if (action === 'edit') {
        const attendee = state.attendees.find((currentAttendee) => String(currentAttendee.id) === String(button.dataset.attendeeId));
        if (attendee) {
          openAttendeeEditor(attendee);
        }
        return;
      }

      const confirmed = await showConfirmationDialog({
        title: 'Delete attendee?',
        message: 'This will permanently remove this attendee record.',
        confirmText: 'Delete',
      });

      if (!confirmed) return;

      await deleteAttendee(button.dataset.attendeeId);
      showToast('Attendee deleted successfully.');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

if (eventsList || eventSelect) {
  fetchEvents().catch((error) => {
    alert(error.message);
  });
}

if (attendeesList || searchInput) {
  fetchAttendees(searchInput ? searchInput.value : '').catch((error) => {
    alert(error.message);
  });
}
