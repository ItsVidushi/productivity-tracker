// ---------- Constants ----------
const STORAGE_KEY = 'productivity_entries_v1';
const NUM_TASKS = 10;

// ---------- Helper functions ----------
function todayISO() {
  const t = new Date();
  return t.toISOString().slice(0,10);
}

function loadEntries() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch(e) { console.error(e); return []; }
}

function saveEntries(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ---------- Build UI ----------
const tasksGrid = document.getElementById('tasks-grid');
// ---- CUSTOMIZE YOUR TASK NAMES HERE ----
const TASK_NAMES = [
  "10k Steps",
  "100g of Protein",
  "3l of Water",
  "DSA Practice",
  "Study",
  "Content Creation",
  "Read Book",
  "Workout",
  "Body Care",
  "Supplements"
];
// ---------------------------------------

for (let i = 0; i < TASK_NAMES.length; i++) {
  const row = document.createElement('div');
  row.className = 'task-row';
  row.innerHTML = `
    <label style="min-width:180px">${TASK_NAMES[i]}</label>
    <input type="number" min="0" max="10" step="1" value="0" data-task="${i + 1}" />
  `;
  tasksGrid.appendChild(row);
}


const dateInput = document.getElementById('entry-date');
dateInput.value = todayISO();

const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-form-btn');
const statusP = document.getElementById('status');
const exportBtn = document.getElementById('export-csv');
const importFileInput = document.getElementById('import-file');
const importBtn = document.getElementById('import-csv');
const resetBtn = document.getElementById('reset-all');

let entries = loadEntries();

// ---------- Chart setup ----------
const ctx = document.getElementById('prodChart').getContext('2d');
let chart = new Chart(ctx, {
  type: 'line',
  data: { labels: [], datasets: [{ label: 'Productivity %', data: [], fill:false, tension:0.2 }] },
  options: { scales: { y: { beginAtZero: true, max:100 } }, responsive:true }
});

function computePercent(scores) {
  const sum = scores.reduce((a,b)=>a+(Number(b)||0),0);
  return Math.round(sum); // already out of 100
}

function renderTable() {
  const tbody = document.querySelector('#entries-table tbody');
  tbody.innerHTML = '';
  // sort by date ascending
  const sorted = [...entries].sort((a,b)=>a.date.localeCompare(b.date));
  sorted.forEach(e=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.date}</td>
      <td>${e.percent}%</td>
      <td>
        <button class="action-btn" data-date="${e.date}" data-action="edit">Edit</button>
        <button class="action-btn" data-date="${e.date}" data-action="delete">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', (ev)=>{
      const action = ev.target.dataset.action;
      const dt = ev.target.dataset.date;
      if (action === 'delete') {
        if (!confirm(`Delete entry for ${dt}?`)) return;
        entries = entries.filter(x=>x.date!==dt);
        saveEntries(entries);
        renderAll();
      } else if (action === 'edit') {
        // populate form with that entry
        const ent = entries.find(x=>x.date===dt);
        if (!ent) return;
        dateInput.value = ent.date;
        for (let i=1;i<=NUM_TASKS;i++){
          const inp = document.querySelector(`input[data-task="${i}"]`);
          inp.value = ent.scores[i-1];
        }
      }
    });
  });
}

function renderChart() {
  const sorted = [...entries].sort((a,b)=>a.date.localeCompare(b.date));
  chart.data.labels = sorted.map(s=>s.date);
  chart.data.datasets[0].data = sorted.map(s=>s.percent);
  chart.update();
}

function renderAll() {
  renderTable();
  renderChart();
}

saveBtn.addEventListener('click', ()=>{
  const date = dateInput.value;
  if (!date) { statusP.textContent = 'Please pick a date.'; return; }
  // collect scores
  const scores = [];
  for (let i=1;i<=NUM_TASKS;i++){
    const v = Number(document.querySelector(`input[data-task="${i}"]`).value) || 0;
    if (v < 0 || v > 10) { statusP.textContent = `Task ${i} must be 0-10.`; return; }
    scores.push(v);
  }
  const percent = computePercent(scores);
  // if entry exists, replace
  entries = entries.filter(x=>x.date !== date);
  entries.push({ date, scores, percent });
  saveEntries(entries);
  statusP.textContent = `Saved ${date} — ${percent}%`;
  renderAll();
});

clearBtn.addEventListener('click', ()=>{
  dateInput.value = todayISO();
  for (let i=1;i<=NUM_TASKS;i++) document.querySelector(`input[data-task="${i}"]`).value = 0;
  statusP.textContent = '';
});

// Export CSV
function entriesToCSV(list) {
  // Header: date,percent,task1,...task10
  const head = ['date','percent',...Array.from({length:NUM_TASKS},(_,i)=>`task${i+1}`)];
  const rows = [head.join(',')];
  list.forEach(e=>{
    const row = [e.date, e.percent, ...e.scores].join(',');
    rows.push(row);
  });
  return rows.join('\n');
}

exportBtn.addEventListener('click', ()=>{
  if (!entries.length) { statusP.textContent = 'No entries to export.'; return; }
  const csv = entriesToCSV(entries);
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'productivity_entries.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  statusP.textContent = 'CSV exported.';
});

// Import CSV
importBtn.addEventListener('click', ()=>{
  const file = importFileInput.files[0];
  if (!file) { statusP.textContent = 'Select a CSV file first.'; return; }
  const reader = new FileReader();
  reader.onload = (e)=>{
    const text = e.target.result;
    const lines = text.trim().split(/\r?\n/);
    const header = lines.shift().split(',').map(h=>h.trim().toLowerCase());
    // expect at least date + percent + 10 tasks
    const newEntries = [];
    lines.forEach(line=>{
      if (!line.trim()) return;
      const cols = line.split(',').map(c=>c.trim());
      const date = cols[0];
      const percent = Number(cols[1]) || 0;
      const scores = cols.slice(2,2+NUM_TASKS).map(v=>Number(v)||0);
      if (date) newEntries.push({date, percent, scores});
    });
    // merge: replace same date, and append others
    const map = {};
    entries.forEach(e=>map[e.date]=e);
    newEntries.forEach(e=>map[e.date]=e);
    entries = Object.values(map);
    saveEntries(entries);
    renderAll();
    statusP.textContent = 'CSV imported.';
  };
  reader.readAsText(file);
});

// Reset all
resetBtn.addEventListener('click', ()=>{
  if (!confirm('Delete ALL saved entries? This cannot be undone.')) return;
  entries = [];
  saveEntries(entries);
  renderAll();
  statusP.textContent = 'All data cleared.';
});

// Initial render
renderAll();
