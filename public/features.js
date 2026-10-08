const featureRoot = document.getElementById('feature-sections');
const related = { events: [], attendees: [] };
const configs = [
  {
    key: 'venues',
    title: 'Venue management',
    intro: 'Find the right space and keep its details close.',
    fields: [
      { key: 'name', label: 'Venue name', required: true },
      { key: 'location', label: 'Location', required: true },
      { key: 'capacity', label: 'Capacity', type: 'number', min: 1, required: true },
      { key: 'equipment', label: 'Available equipment', placeholder: 'Projector, microphones' },
      { key: 'availabilityStatus', label: 'Availability', type: 'select', options: ['Available', 'Unavailable'], required: true },
    ],
    columns: [['name', 'Venue'], ['location', 'Location'], ['capacity', 'Capacity'], ['equipment', 'Equipment'], ['availabilityStatus', 'Availability']],
  },
  {
    key: 'feedback',
    title: 'Event feedback',
    intro: 'Hear from attendees and keep satisfaction visible.',
    fields: [
      { key: 'attendeeId', label: 'Attendee', type: 'attendee', required: true },
      { key: 'eventId', label: 'Event', type: 'event', required: true },
      { key: 'rating', label: 'Rating (1–5)', type: 'number', min: 1, max: 5, required: true },
      { key: 'satisfaction', label: 'Overall satisfaction (1–5)', type: 'number', min: 1, max: 5, required: true },
      { key: 'comments', label: 'Comments', placeholder: 'Share their feedback' },
    ],
    columns: [['attendeeName', 'Attendee'], ['eventName', 'Event'], ['rating', 'Rating'], ['satisfaction', 'Satisfaction'], ['comments', 'Comments']],
  },
  {
    key: 'payments',
    title: 'Payments',
    intro: 'Record payment amounts, methods, and status.',
    fields: [
      { key: 'attendeeId', label: 'Attendee', type: 'attendee', required: true },
      { key: 'eventId', label: 'Event', type: 'event', required: true },
      { key: 'amount', label: 'Amount', type: 'number', min: 0, step: '0.01', required: true },
      { key: 'status', label: 'Payment status', type: 'select', options: ['Pending', 'Paid', 'Failed', 'Refunded'], required: true },
      { key: 'method', label: 'Payment method', type: 'select', options: ['Cash', 'Card', 'Bank transfer', 'Online'], required: true },
    ],
    columns: [['attendeeName', 'Attendee'], ['eventName', 'Event'], ['amount', 'Amount'], ['status', 'Status'], ['method', 'Method']],
  },
  {
    key: 'volunteers',
    title: 'Volunteers',
    intro: 'Coordinate people and responsibilities across events.',
    fields: [
      { key: 'name', label: 'Volunteer name', required: true },
      { key: 'contact', label: 'Contact', required: true },
      { key: 'eventId', label: 'Assigned event', type: 'event', required: true },
      { key: 'responsibility', label: 'Assigned responsibility', required: true },
    ],
    columns: [['name', 'Volunteer'], ['contact', 'Contact'], ['eventName', 'Event'], ['responsibility', 'Responsibility']],
  },
  {
    key: 'certificates',
    title: 'Certificates',
    intro: 'Keep issued attendee certificates on record.',
    fields: [
      { key: 'attendeeId', label: 'Attendee', type: 'attendee', required: true },
      { key: 'eventId', label: 'Event', type: 'event', required: true },
      { key: 'type', label: 'Certificate type', required: true },
      { key: 'issueDate', label: 'Issue date', type: 'date', required: true },
    ],
    columns: [['attendeeName', 'Attendee'], ['eventName', 'Event'], ['type', 'Certificate'], ['issueDate', 'Issue date']],
  },
];

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

async function api(url, options) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

function optionsFor(field) {
  if (field.type === 'event') {
    return related.events.map((item) => [item.id, `${item.name} (${item.date})`]);
  }
  return related.attendees.map((item) => [item.id, `${item.name} — ${item.eventName}`]);
}

function renderField(field) {
  const choices = field.type === 'select'
    ? field.options.map((option) => [option, option])
    : optionsFor(field);
  const id = `feature-${field.key}`;
  const required = field.required ? 'required' : '';

  if (field.type === 'select' || field.type === 'event' || field.type === 'attendee') {
    return `<div class="field-group"><label for="${id}">${escapeHtml(field.label)}</label><select id="${id}" name="${field.key}" ${required}><option value="">Choose ${escapeHtml(field.label.toLowerCase())}</option>${choices.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('')}</select></div>`;
  }
  const type = field.type || 'text';
  return `<div class="field-group"><label for="${id}">${escapeHtml(field.label)}</label><input id="${id}" name="${field.key}" type="${type}" ${field.min != null ? `min="${field.min}"` : ''} ${field.max != null ? `max="${field.max}"` : ''} ${field.step ? `step="${field.step}"` : ''} ${field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : ''} ${required} /></div>`;
}

function renderFeature(config) {
  return `<section class="panel feature-panel" id="${config.key}"><div class="panel-title-row"><div><p class="panel-kicker">Event operations</p><h2>${config.title}</h2><p class="feature-description">${config.intro}</p></div></div><form class="feature-form" data-resource="${config.key}"><div class="feature-form-fields">${config.fields.map(renderField).join('')}</div><button class="primary-btn" type="submit">Add ${config.key === 'feedback' ? 'feedback' : config.key.slice(0, -1)}</button></form><div class="table-wrap feature-table" id="${config.key}-list"></div></section>`;
}

function renderRows(config, rows) {
  const target = document.getElementById(`${config.key}-list`);
  if (!rows.length) {
    target.innerHTML = '<div class="empty-state">Nothing here yet. Add the first record above.</div>';
    return;
  }
  target.innerHTML = `<table><thead><tr>${config.columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join('')}<th>Actions</th></tr></thead><tbody>${rows.map((row) => `<tr>${config.columns.map(([key]) => `<td>${escapeHtml(config.key === 'payments' && key === 'amount' ? Number(row[key]).toFixed(2) : row[key])}</td>`).join('')}<td class="action-cell"><button class="secondary-btn" type="button" data-edit="${row.id}">Edit</button><button class="danger-btn" type="button" data-delete="${row.id}">Delete</button></td></tr>`).join('')}</tbody></table>`;
  target.querySelectorAll('[data-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const row = rows.find((item) => String(item.id) === button.dataset.edit);
      const form = document.querySelector(`form[data-resource="${config.key}"]`);
      config.fields.forEach((field) => { form.elements[field.key].value = row[field.key] ?? ''; });
      form.dataset.editId = row.id;
      form.querySelector('[type="submit"]').textContent = 'Save changes';
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
  target.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Delete this record?')) return;
      try {
        await api(`/api/${config.key}/${button.dataset.delete}`, { method: 'DELETE' });
        await loadFeature(config);
        showToast('Record deleted.');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  });
}

async function loadFeature(config) {
  renderRows(config, await api(`/api/${config.key}`));
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type} show`;
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2800);
}

async function startFeatures() {
  [related.events, related.attendees] = await Promise.all([
    api('/api/events'),
    api('/api/attendees'),
  ]);
  featureRoot.innerHTML = configs.map(renderFeature).join('');
  configs.forEach((config) => {
    const form = document.querySelector(`form[data-resource="${config.key}"]`);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(config.fields.map((field) => [field.key, form.elements[field.key].value.trim()]));
      try {
        const editId = form.dataset.editId;
        await api(editId ? `/api/${config.key}/${editId}` : `/api/${config.key}`, {
          method: editId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        });
        form.reset();
        delete form.dataset.editId;
        form.querySelector('[type="submit"]').textContent = `Add ${config.key === 'feedback' ? 'feedback' : config.key.slice(0, -1)}`;
        await loadFeature(config);
        showToast('Record saved.');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
    loadFeature(config).catch((error) => showToast(error.message, 'error'));
  });
}

startFeatures().catch((error) => showToast(error.message, 'error'));
