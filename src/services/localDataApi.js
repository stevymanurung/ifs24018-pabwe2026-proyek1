import { DAY_NAMES, dayIndex, toDateString, toMinutes } from '../lib/time.js';
import { getLocalUser, isLocalToken } from './localAuth.js';

export const LOCAL_DATA_KEY = 'study-planner-local-data';

function localApiError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function dateOffset(days, baseDate = new Date()) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

function initialData() {
  return {
    sessions: [],
    tasks: [],
    alarms: [],
    settings: { reminderLead: 10 },
  };
}

function loadData(storageKey) {
  const saved = globalThis.localStorage.getItem(storageKey);
  if (!saved) return initialData();
  try {
    return { ...initialData(), ...JSON.parse(saved) };
  } catch (error) {
    throw localApiError(500, 'LOCAL_STORAGE_ERROR', `Data lokal tidak dapat dibaca: ${error.message}`);
  }
}

function saveData(data, storageKey) {
  globalThis.localStorage.setItem(storageKey, JSON.stringify(data));
}

function nextId(items) {
  return Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1;
}

function buildDashboard(data, nowText) {
  const now = nowText ? new Date(`${nowText}:00`) : new Date();
  const todayIndex = dayIndex(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const minutesPerDay = DAY_NAMES.map((_, day) => data.sessions
    .filter((session) => session.day === day)
    .reduce((sum, session) => sum + toMinutes(session.end) - toMinutes(session.start), 0));
  const done = data.tasks.filter((task) => task.done).length;
  const overdue = data.tasks.filter((task) => !task.done && task.dueDate && task.dueDate < toDateString(now)).length;
  const active = data.tasks.length - done - overdue;
  const upcomingTasks = data.tasks
    .filter((task) => !task.done && task.dueDate >= toDateString(now) && task.dueDate <= dateOffset(7, now))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  let nextSession = null;
  for (let ahead = 0; ahead <= 7 && !nextSession; ahead += 1) {
    const day = (todayIndex + ahead) % 7;
    const session = data.sessions
      .filter((item) => item.day === day && (ahead > 0 || toMinutes(item.start) > nowMinutes))
      .sort((a, b) => a.start.localeCompare(b.start))[0];
    if (session) nextSession = { session, daysAhead: ahead };
  }

  return {
    date: toDateString(now),
    totals: {
      pending: data.tasks.filter((task) => !task.done).length,
      done,
      overdue,
      weeklyHours: Math.round(minutesPerDay.reduce((sum, value) => sum + value, 0) / 60 * 100) / 100,
    },
    hoursPerDay: DAY_NAMES.map((name, day) => ({
      day,
      name,
      hours: Math.round(minutesPerDay[day] / 60 * 100) / 100,
    })),
    taskStatus: [
      { key: 'done', label: 'Selesai', value: done },
      { key: 'active', label: 'Aktif', value: active },
      { key: 'overdue', label: 'Terlambat', value: overdue },
    ],
    tasksPerCourse: Object.values(data.tasks.reduce((courses, task) => {
      const course = task.course || 'Tanpa mata kuliah';
      courses[course] = courses[course] || { course, done: 0, pending: 0 };
      if (task.done) courses[course].done += 1;
      else courses[course].pending += 1;
      return courses;
    }, {})).sort((a, b) => (b.done + b.pending) - (a.done + a.pending) || a.course.localeCompare(b.course, 'id')),
    today: {
      dayIndex: todayIndex,
      dayName: DAY_NAMES[todayIndex],
      sessions: data.sessions
        .filter((session) => session.day === todayIndex)
        .sort((a, b) => a.start.localeCompare(b.start)),
    },
    upcomingTasks,
    nextSession,
  };
}

export function requestLocalApi(path, { method = 'GET', body } = {}) {
  const [pathname, query = ''] = path.split('?');
  const token = globalThis.localStorage.getItem('study-planner-token');
  const user = getLocalUser(token);
  if (!isLocalToken(token) || !user) throw localApiError(401, 'UNAUTHENTICATED', 'Sesi lokal tidak valid. Silakan login kembali.');
  if (pathname === '/auth/me' && method === 'GET') return { user };
  if (pathname === '/auth/logout' && method === 'POST') return null;

  const storageKey = `${LOCAL_DATA_KEY}:${user.id}`;
  const data = loadData(storageKey);
  const collectionMatch = /^\/(sessions|tasks|alarms)(?:\/(\d+))?$/.exec(pathname);
  if (collectionMatch) {
    const [, collection, id] = collectionMatch;
    const items = data[collection];
    if (method === 'GET' && !id) {
      const status = new URLSearchParams(query).get('status');
      const result = collection === 'tasks' && status === 'active'
        ? items.filter((item) => !item.done)
        : collection === 'tasks' && status === 'done'
          ? items.filter((item) => item.done)
          : [...items];
      return collection === 'sessions'
        ? result.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))
        : collection === 'alarms'
          ? result.sort((a, b) => a.time.localeCompare(b.time))
          : result;
    }
    if (method === 'POST' && !id) {
      const item = { ...body, id: nextId(items) };
      if (collection === 'tasks') Object.assign(item, { course: item.course || '', dueDate: item.dueDate || '', remindAt: item.remindAt || '', done: false });
      if (collection === 'sessions') Object.assign(item, { room: item.room || '' });
      if (collection === 'alarms') Object.assign(item, { enabled: true, days: [...new Set(item.days)].sort((a, b) => a - b) });
      if (collection === 'sessions') {
        const conflict = items.find((session) => session.day === item.day
          && toMinutes(item.start) < toMinutes(session.end)
          && toMinutes(item.end) > toMinutes(session.start));
        if (conflict) throw localApiError(409, 'SESSION_CONFLICT', `Bentrok dengan "${conflict.course}" (${conflict.start} - ${conflict.end})`);
      }
      items.push(item);
      saveData(data, storageKey);
      return item;
    }
    const index = items.findIndex((item) => item.id === Number(id));
    if (index < 0) throw localApiError(404, 'NOT_FOUND', 'Data tidak ditemukan.');
    if (method === 'DELETE') {
      items.splice(index, 1);
      saveData(data, storageKey);
      return null;
    }
    if (method === 'PATCH' && collection === 'tasks') {
      items[index] = { ...items[index], done: Boolean(body.done) };
      saveData(data, storageKey);
      return items[index];
    }
    if (method === 'PATCH' && collection === 'alarms') {
      items[index] = { ...items[index], enabled: Boolean(body.enabled) };
      saveData(data, storageKey);
      return items[index];
    }
  }

  if (pathname === '/settings' && method === 'GET') return data.settings;
  if (pathname === '/settings' && method === 'PUT') {
    data.settings = { ...data.settings, ...body };
    saveData(data, storageKey);
    return data.settings;
  }
  if (pathname === '/dashboard' && method === 'GET') {
    return buildDashboard(data, new URLSearchParams(query).get('now'));
  }
  throw localApiError(404, 'NOT_FOUND', `Endpoint lokal ${method} ${pathname} tidak ditemukan.`);
}
