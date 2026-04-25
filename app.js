/* ═══════════════════════════════════════════════════════
   TalentLens — app.js
   All application logic: data, auth, admin CRUD,
   recruiter priority filters, line chart engine.
═══════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────
   FIELD DEFINITIONS  (your exact 16 headers)
───────────────────────────────────────── */
const FIELDS = [
  { key: 'candidateName',       label: 'Candidate Name',           aliases: ['candidate name', 'name', 'full name', 'candidate'] },
  { key: 'linkedinProfile',     label: 'LinkedIn Profile',         aliases: ['linkedin profile', 'linkedin', 'linkedin url', 'profile url', 'profile link'] },
  { key: 'industry',            label: 'Industry',                 aliases: ['industry', 'sector'] },
  { key: 'gender',              label: 'Gender',                   aliases: ['gender', 'sex'] },
  { key: 'currentEmployer',     label: 'Current Employer',         aliases: ['current employer', 'employer', 'company', 'current company', 'organization', 'organisation'] },
  { key: 'totalExperience',     label: 'Total Experience (Years)', aliases: ['total experience (years)', 'total experience (yrs)', 'total experience', 'experience', 'exp', 'years of experience', 'yoe'] },
  { key: 'title',               label: 'Title',                    aliases: ['title', 'job title', 'designation', 'current title', 'position'] },
  { key: 'currentLocation',     label: 'Current Location',         aliases: ['current location', 'location', 'address', 'current address'] },
  { key: 'city',                label: 'City',                     aliases: ['city', 'town'] },
  { key: 'state',               label: 'State',                    aliases: ['state', 'province', 'region'] },
  { key: 'primaryVertical',     label: 'Primary Vertical',         aliases: ['primary vertical', 'primary_vertical', 'vertical', 'vertical 1'] },
  { key: 'secondaryVertical',   label: 'Secondary Vertical',       aliases: ['secondary vertical', 'secondary_vertical', 'vertical 2'] },
  { key: 'primaryHorizontal',   label: 'Primary Horizontal',       aliases: ['primary horizontal', 'primary_horizontal', 'horizontal', 'horizontal 1'] },
  { key: 'secondaryHorizontal', label: 'Secondary Horizontal',     aliases: ['secondary horizontal', 'secondary_horizontal', 'horizontal 2'] },
  { key: 'role',                label: 'Role',                     aliases: ['role', 'job role', 'function', 'role type'] },
  { key: 'roleFocus',           label: 'Role Focus',               aliases: ['role focus', 'role_focus', 'focus', 'focus area', 'specialty'] },
];

// All fields except LinkedIn URL are filterable
const FILTER_FIELDS = FIELDS.filter(f => f.key !== 'linkedinProfile');

// Fields that accept a numeric range instead of a dropdown
const RANGE_FIELDS = new Set(['totalExperience']);

/* ─────────────────────────────────────────
   CREDENTIALS
───────────────────────────────────────── */
const CREDENTIALS = {
  admin:     { password: 'admin123', role: 'admin' },
  recruiter: { password: 'rec123',   role: 'recruiter' },
};

/* ─────────────────────────────────────────
   GLOBAL STATE
───────────────────────────────────────── */
let currentRole     = null;
let selectedUserType = 'admin';

// Shared dataset — admin writes, recruiter reads
let masterData = [];
let colMap     = {};

// Admin state
let adminFiltered = [];
let adminPage     = 1;
let adminSortCol  = null;
let adminSortDir  = 1;

// Recruiter state
let recFiltered    = [];
let recPage        = 1;
let recSortCol     = null;
let recSortDir     = 1;
let recVisibleCols = [
  'candidateName', 'gender', 'industry', 'currentEmployer',
  'totalExperience', 'title', 'city', 'state', 'primaryVertical', 'role'
];
let rCharts = {};

// Priority filter state (one object per priority level)
let priorityState = {
  1: { field: '', value: '', valueMin: '', valueMax: '' },
  2: { field: '', value: '', valueMin: '', valueMax: '' },
  3: { field: '', value: '', valueMin: '', valueMax: '' },
};

// Modal state — null = Add mode, number = Edit index
let editingIdx = null;

/* ─────────────────────────────────────────
   LOGIN
───────────────────────────────────────── */
function selectUserType(type) {
  selectedUserType = type;
  document.getElementById('btnAdmin').classList.toggle('selected', type === 'admin');
  document.getElementById('btnRecruiter').classList.toggle('selected', type === 'recruiter');
}

function doLogin() {
  const u    = document.getElementById('loginUsername').value.trim().toLowerCase();
  const p    = document.getElementById('loginPassword').value;
  const err  = document.getElementById('loginError');
  const cred = CREDENTIALS[u];

  if (!cred || cred.password !== p || cred.role !== selectedUserType) {
    err.classList.add('show');
    document.getElementById('loginPassword').value = '';
    return;
  }

  err.classList.remove('show');
  currentRole = cred.role;
  document.getElementById('loginPage').classList.remove('active');

  if (currentRole === 'admin') {
    document.getElementById('adminPage').classList.add('active');
    adminRender();
  } else {
    document.getElementById('recruiterPage').classList.add('active');
    recSyncFromAdmin();
  }
}

// Allow Enter key to submit the login form or save candidate modal
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (document.getElementById('loginPage').classList.contains('active')) doLogin();
  else if (document.getElementById('candidateModal').classList.contains('active')) saveCandidate();
});

function logout() {
  currentRole = null;
  document.getElementById('adminPage').classList.remove('active');
  document.getElementById('recruiterPage').classList.remove('active');
  document.getElementById('loginPage').classList.add('active');
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
}

/* ─────────────────────────────────────────
   DEMO DATA GENERATOR
   (80 realistic candidates matching all 16 fields)
───────────────────────────────────────── */
function generateDemoData() {
  const names    = ['Aarav Singh','Priya Sharma','Rohan Mehta','Ananya Patel','Vikram Nair','Sneha Kapoor','Arjun Gupta','Meera Iyer','Kavya Reddy','Aditya Kumar','Riya Joshi','Siddharth Rao','Tanvi Shah','Kiran Malhotra','Pooja Verma','Rahul Bose','Divya Pillai','Nikhil Choudhary','Aishwarya Trivedi','Manish Pandey','Sunita Yadav','Deepak Bhatt','Anjali Mishra','Gaurav Saxena','Swati Aggarwal','Kunal Desai','Nisha Bhatia','Rohit Tyagi','Lavanya Krishnan','Sachin Garg'];
  const inds     = ['Technology','Financial Services','Healthcare','Retail & E-Commerce','Manufacturing','Consulting','Media & Entertainment','Telecom','Education','Logistics'];
  const emps     = ['Infosys','TCS','Wipro','Accenture','HCL Technologies','Cognizant','IBM India','Capgemini','Deloitte','KPMG','Amazon India','Flipkart','Zomato','HDFC Bank','ICICI Bank'];
  const titles   = ['Senior Manager','Vice President','Director','Associate Director','Manager','Senior Analyst','Principal Consultant','AVP','GM','Senior Consultant'];
  const cities   = ['Mumbai','Delhi','Bangalore','Hyderabad','Chennai','Pune','Kolkata','Ahmedabad','Jaipur','Lucknow','Chandigarh','Noida','Gurugram'];
  const states   = ['Maharashtra','Delhi','Karnataka','Telangana','Tamil Nadu','Haryana','West Bengal','Gujarat','Rajasthan','Uttar Pradesh','Punjab'];
  const pVerts   = ['Banking & Insurance','Retail Technology','Healthcare IT','EdTech','FinTech','Supply Chain','Digital Media','Cloud Infrastructure','CyberSecurity','AI/ML'];
  const sVerts   = ['Wealth Management','D2C Commerce','Hospital Management','Corporate Training','Payments','Warehousing','AdTech','DevOps','Data Security','NLP'];
  const pHorizs  = ['Sales & BD','Operations','Technology','Finance','Human Resources','Marketing','Strategy','Product Management','Analytics'];
  const sHorizs  = ['Key Accounts','Process Excellence','Software Engineering','Financial Planning','Talent Acquisition','Digital Marketing','Corporate Strategy','Business Intelligence'];
  const roles    = ['Individual Contributor','People Manager','Senior Leader','Executive','Specialist'];
  const focuses  = ['Revenue Generation','Cost Optimization','Growth & Expansion','Transformation','Governance','Innovation','Customer Experience','Digital Enablement'];

  const data = [];
  for (let i = 0; i < 80; i++) {
    const baseName = names[i % names.length];
    const name     = i >= names.length ? baseName + ' ' + (Math.floor(i / names.length) + 1) : baseName;
    const gender   = i % 3 === 0 ? 'Female' : i % 11 === 0 ? 'Other' : 'Male';
    const exp      = Math.floor(Math.random() * 28) + 1;
    const cIdx     = Math.floor(Math.random() * cities.length);
    const stIdx    = Math.floor(Math.random() * states.length);

    data.push({
      candidateName:       name,
      linkedinProfile:     'https://linkedin.com/in/' + name.toLowerCase().replace(/\s+/g, '-'),
      industry:            inds[Math.floor(Math.random() * inds.length)],
      gender,
      currentEmployer:     emps[Math.floor(Math.random() * emps.length)],
      totalExperience:     exp,
      title:               titles[Math.floor(Math.random() * titles.length)],
      currentLocation:     cities[cIdx] + ', ' + states[stIdx],
      city:                cities[cIdx],
      state:               states[stIdx],
      primaryVertical:     pVerts[Math.floor(Math.random() * pVerts.length)],
      secondaryVertical:   sVerts[Math.floor(Math.random() * sVerts.length)],
      primaryHorizontal:   pHorizs[Math.floor(Math.random() * pHorizs.length)],
      secondaryHorizontal: sHorizs[Math.floor(Math.random() * sHorizs.length)],
      role:                roles[Math.floor(Math.random() * roles.length)],
      roleFocus:           focuses[Math.floor(Math.random() * focuses.length)],
    });
  }
  return data;
}

/* ─────────────────────────────────────────
   FILE PARSING  (shared by Admin upload)
───────────────────────────────────────── */
function parseFile(file, onDone) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      let raw;
      if (file.name.endsWith('.csv')) {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      } else {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      }
      if (!raw.length) { showToast('error', '⚠️', 'File is empty.'); return; }
      const cols = Object.keys(raw[0]);
      const map  = autoMap(cols);
      onDone(normalizeRaw(raw, map), file.name, raw.length);
    } catch (err) {
      showToast('error', '❌', 'Error reading file: ' + err.message);
    }
  };
  if (file.name.endsWith('.csv')) reader.readAsBinaryString(file);
  else reader.readAsArrayBuffer(file);
}

// Auto-detect which Excel column maps to which FIELD key
function autoMap(cols) {
  const map = {};
  const cl  = cols.map(c => c.toLowerCase().trim());
  FIELDS.forEach(f => {
    let idx = cl.findIndex(c => c === f.label.toLowerCase());
    if (idx === -1) idx = cl.findIndex(c => f.aliases.includes(c));
    if (idx === -1) idx = cl.findIndex(c => f.aliases.some(a => c.includes(a)));
    if (idx !== -1) map[f.key] = cols[idx];
  });
  return map;
}

// Convert raw Excel rows into normalized candidate objects
function normalizeRaw(raw, map) {
  return raw.map(row => {
    const obj = {};
    FIELDS.forEach(f => {
      if (map[f.key]) {
        let v = row[map[f.key]];
        if (f.key === 'totalExperience') v = parseFloat(v) || 0;
        else v = (v !== undefined && v !== null) ? String(v).trim() : '';
        obj[f.key] = v;
      } else {
        obj[f.key] = f.key === 'totalExperience' ? 0 : '';
      }
    });
    return obj;
  });
}

/* ─────────────────────────────────────────
   ADMIN — File Upload
───────────────────────────────────────── */
function adminDragOver(e)  { e.preventDefault(); document.getElementById('adminUploadZone').classList.add('drag-over'); }
function adminDragLeave(e) { document.getElementById('adminUploadZone').classList.remove('drag-over'); }
function adminDrop(e) {
  e.preventDefault();
  document.getElementById('adminUploadZone').classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) parseFile(f, adminLoadData);
}
function adminFileSelect(e) {
  const f = e.target.files[0];
  if (f) parseFile(f, adminLoadData);
}

function adminLoadData(data, filename, count) {
  masterData = data;
  document.getElementById('adminUploadDefault').style.display = 'none';
  document.getElementById('adminUploadSuccess').style.display = 'flex';
  document.getElementById('adminFilename').textContent = filename;
  document.getElementById('adminMeta').textContent    = count + ' candidates loaded';
  document.getElementById('adminUploadZone').classList.add('has-data');
  adminPage = 1;
  adminRender();
  // Immediately make new data available to the recruiter
  recFiltered = [...masterData];
  showToast('success', '✅', count + ' candidates loaded · Recruiter portal updated automatically');
}

// ── Delete File ──────────────────────────────────────────
function confirmDeleteFile() {
  document.getElementById('confirmSubText').textContent =
    'This will permanently remove all uploaded candidate data. This cannot be undone.';
  document.getElementById('confirmDeleteBtn').textContent = '🗑️ Delete File';
  document.getElementById('confirmDeleteBtn').onclick = () => adminDeleteFile();
  openModal('confirmModal');
}

function adminDeleteFile() {
  // Clear all data
  masterData  = [];
  recFiltered = [];

  // Reset upload zone back to default state
  document.getElementById('adminUploadSuccess').style.display = 'none';
  document.getElementById('adminUploadDefault').style.display = 'block';
  document.getElementById('adminUploadZone').classList.remove('has-data');

  // Reset the file input so same file can be re-uploaded
  const fileInput = document.getElementById('adminFileInput');
  fileInput.value = '';

  // Re-render admin table (will show empty state)
  adminPage = 1;
  adminRender();

  // Sync recruiter — will show "no data" state
  if (document.getElementById('recruiterPage').classList.contains('active')) {
    recSyncFromAdmin();
  }

  closeModal('confirmModal');
  // Reset confirm button text for future use
  document.getElementById('confirmDeleteBtn').textContent = 'Delete';
  showToast('info', '🗑️', 'File deleted · All candidate data cleared.');
}

/* ─────────────────────────────────────────
   ADMIN — Render Table
───────────────────────────────────────── */
const ADMIN_COLS = ['candidateName', 'gender', 'industry', 'currentEmployer', 'totalExperience', 'title', 'city', 'state', 'role'];

function adminRender() {
  const search = document.getElementById('adminSearch').value.toLowerCase().trim();
  adminFiltered = masterData.filter(d =>
    !search || Object.values(d).join(' ').toLowerCase().includes(search)
  );

  if (adminSortCol) {
    adminFiltered.sort((a, b) => {
      const av = a[adminSortCol], bv = b[adminSortCol];
      if (typeof av === 'number') return (av - bv) * adminSortDir;
      return String(av).localeCompare(String(bv)) * adminSortDir;
    });
  }

  const perPage    = parseInt(document.getElementById('adminPerPage').value);
  const totalPages = Math.max(1, Math.ceil(adminFiltered.length / perPage));
  adminPage = Math.min(adminPage, totalPages);
  const start    = (adminPage - 1) * perPage;
  const pageData = adminFiltered.slice(start, start + perPage);

  document.getElementById('adminCount').textContent = adminFiltered.length + ' / ' + masterData.length + ' entries';
  const container = document.getElementById('adminTableContainer');

  if (!adminFiltered.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${masterData.length ? '🔍' : '📋'}</div>
        <div class="empty-title">${masterData.length ? 'No Results' : 'No Candidates Yet'}</div>
        <div class="empty-sub">${masterData.length ? 'Try a different search.' : 'Upload an Excel file or click Add Candidate.'}</div>
      </div>`;
    document.getElementById('adminPagination').style.display = 'none';
    return;
  }

  let h = `<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th style="width:36px">#</th>`;
  ADMIN_COLS.forEach(k => {
    const f = FIELDS.find(x => x.key === k);
    const s = adminSortCol === k;
    h += `<th onclick="adminSort('${k}')" class="${s ? 'sorted' : ''}">${f.label}<span class="si">${s ? (adminSortDir > 0 ? '↑' : '↓') : '↕'}</span></th>`;
  });
  h += `<th style="width:120px;text-align:center">Actions</th></tr></thead><tbody>`;

  pageData.forEach((row, i) => {
    const realIdx = masterData.indexOf(row);
    const n       = start + i + 1;
    h += `<tr>
      <td style="color:var(--muted);font-size:11px">${n}</td>
      <td><strong>${row.candidateName || '—'}</strong></td>
      <td>${renderGenderTag(row.gender)}</td>
      <td><span class="td-clip" title="${row.industry}">${row.industry || '—'}</span></td>
      <td><span class="td-clip" title="${row.currentEmployer}">${row.currentEmployer || '—'}</span></td>
      <td>${renderExpTag(row.totalExperience)}</td>
      <td><span class="td-clip" title="${row.title}">${row.title || '—'}</span></td>
      <td>${row.city || '—'}</td>
      <td>${row.state || '—'}</td>
      <td><span class="tag tag-r">${row.role || '—'}</span></td>
      <td style="text-align:center">
        <button class="btn-edit"   onclick="openEditModal(${realIdx})">✏️ Edit</button>
        <button class="btn-danger" onclick="confirmDelete(${realIdx})" style="margin-left:4px">🗑️</button>
      </td>
    </tr>`;
  });
  h += `</tbody></table></div>`;
  container.innerHTML = h;

  document.getElementById('adminPagination').style.display = 'flex';
  document.getElementById('adminPageInfo').textContent =
    `Showing ${start + 1}–${Math.min(start + perPage, adminFiltered.length)} of ${adminFiltered.length}`;
  renderPageBtns('adminPageBtns', adminPage, totalPages, p => { adminPage = p; adminRender(); });
}

function adminSort(k) {
  if (adminSortCol === k) adminSortDir *= -1;
  else { adminSortCol = k; adminSortDir = 1; }
  adminRender();
}

/* ─────────────────────────────────────────
   ADMIN — Add / Edit Modal
───────────────────────────────────────── */
const MODAL_FIELDS = [
  'candidateName', 'linkedinProfile', 'industry', 'gender', 'currentEmployer',
  'totalExperience', 'title', 'currentLocation', 'city', 'state',
  'primaryVertical', 'secondaryVertical', 'primaryHorizontal', 'secondaryHorizontal',
  'role', 'roleFocus'
];

function openAddModal() {
  editingIdx = null;
  document.getElementById('modalTitle').textContent    = '➕ Add Candidate';
  document.getElementById('modalSaveBtn').textContent  = 'Add Candidate';
  MODAL_FIELDS.forEach(k => {
    const el = document.getElementById('m' + capitalize(k));
    if (el) el.value = '';
  });
  openModal('candidateModal');
}

function openEditModal(idx) {
  editingIdx = idx;
  document.getElementById('modalTitle').textContent   = '✏️ Edit Candidate';
  document.getElementById('modalSaveBtn').textContent = 'Save Changes';
  const row = masterData[idx];
  MODAL_FIELDS.forEach(k => {
    const el = document.getElementById('m' + capitalize(k));
    if (el) el.value = row[k] !== undefined ? row[k] : '';
  });
  openModal('candidateModal');
}

function saveCandidate() {
  const nameEl = document.getElementById('mCandidateName');
  if (!nameEl.value.trim()) {
    showToast('error', '⚠️', 'Candidate Name is required.');
    nameEl.focus();
    return;
  }

  const obj = {};
  FIELDS.forEach(f => {
    const el = document.getElementById('m' + capitalize(f.key));
    if (!el) { obj[f.key] = f.key === 'totalExperience' ? 0 : ''; return; }
    let v = el.value;
    if (f.key === 'totalExperience') v = parseFloat(v) || 0;
    else v = String(v).trim();
    obj[f.key] = v;
  });

  if (editingIdx === null) {
    masterData.push(obj);
    showToast('success', '✅', 'Candidate added successfully.');
  } else {
    masterData[editingIdx] = obj;
    showToast('success', '✅', 'Candidate updated successfully.');
  }

  closeModal('candidateModal');
  adminPage = 1;
  adminRender();
  // Keep recruiter in sync
  recFiltered = [...masterData];
  if (document.getElementById('recruiterPage').classList.contains('active')) {
    recSyncFromAdmin();
  }
}

/* ─────────────────────────────────────────
   ADMIN — Delete
───────────────────────────────────────── */
function confirmDelete(idx) {
  const row = masterData[idx];
  document.getElementById('confirmSubText').textContent =
    `Delete "${row.candidateName || 'this candidate'}"? This cannot be undone.`;
  document.getElementById('confirmDeleteBtn').onclick = () => doDelete(idx);
  openModal('confirmModal');
}

function doDelete(idx) {
  masterData.splice(idx, 1);
  closeModal('confirmModal');
  adminRender();
  recFiltered = [...masterData];
  if (document.getElementById('recruiterPage').classList.contains('active')) {
    recSyncFromAdmin();
  }
  showToast('info', '🗑️', 'Candidate deleted · Recruiter portal updated.');
}

/* ─────────────────────────────────────────
   ADMIN — Export CSV
───────────────────────────────────────── */
function adminExportCSV() {
  if (!adminFiltered.length) { showToast('error', '⚠️', 'Nothing to export.'); return; }
  exportToCSV(adminFiltered, 'admin_candidates.csv');
}

/* ─────────────────────────────────────────
   PRIORITY FILTER SYSTEM
───────────────────────────────────────── */
function initPrioritySelects() {
  [1, 2, 3].forEach(p => {
    populatePrioritySelect(p);
    renderPriorityValue(p);
  });
}

function getUsedFields() {
  return [1, 2, 3].map(p => priorityState[p].field).filter(Boolean);
}

function populatePrioritySelect(p) {
  const sel = document.getElementById('pf' + p + 'Field');
  const cur = priorityState[p].field;
  sel.innerHTML = '<option value="">— Select a filter field —</option>';
  FILTER_FIELDS.forEach(f => {
    // A field is available if it's not selected in any OTHER priority block
    const usedByOther = [1, 2, 3]
      .filter(x => x !== p)
      .map(x => priorityState[x].field)
      .includes(f.key);
    if (!usedByOther) {
      const opt = document.createElement('option');
      opt.value       = f.key;
      opt.textContent = f.label;
      if (f.key === cur) opt.selected = true;
      sel.appendChild(opt);
    }
  });
}

function onPriorityFieldChange(p) {
  const sel      = document.getElementById('pf' + p + 'Field');
  const newField = sel.value;
  priorityState[p].field    = newField;
  priorityState[p].value    = '';
  priorityState[p].valueMin = '';
  priorityState[p].valueMax = '';

  // Repopulate all selects so the chosen field is hidden from the other blocks
  [1, 2, 3].forEach(x => populatePrioritySelect(x));
  renderPriorityValue(p);
  document.getElementById('pClear' + p).style.display = newField ? 'inline' : 'none';
}

function renderPriorityValue(p) {
  const fieldKey  = priorityState[p].field;
  const container = document.getElementById('pf' + p + 'Value');
  if (!fieldKey) { container.innerHTML = ''; return; }

  const field   = FIELDS.find(f => f.key === fieldKey);
  const isRange = RANGE_FIELDS.has(fieldKey);

  if (isRange) {
    container.innerHTML = `
      <div class="pf-value-wrap">
        <div class="pf-value-label">Filter by ${field.label}</div>
        <div class="pf-range-row">
          <div class="pf-range-wrap">
            <input type="number" min="0" placeholder="Min" id="pf${p}Min"
              value="${priorityState[p].valueMin}"
              oninput="priorityState[${p}].valueMin=this.value">
            <span class="pf-range-unit">yr</span>
          </div>
          <div class="pf-range-wrap">
            <input type="number" min="0" placeholder="Max" id="pf${p}Max"
              value="${priorityState[p].valueMax}"
              oninput="priorityState[${p}].valueMax=this.value">
            <span class="pf-range-unit">yr</span>
          </div>
        </div>
      </div>`;
  } else {
    const vals = [...new Set(masterData.map(d => d[fieldKey]).filter(Boolean))].sort();
    const cur  = priorityState[p].value;
    const opts = '<option value="">All</option>' +
      vals.map(v => `<option value="${v}"${v === cur ? ' selected' : ''}>${v}</option>`).join('');
    container.innerHTML = `
      <div class="pf-value-wrap">
        <div class="pf-value-label">Filter by ${field.label}</div>
        <select class="pf-select" onchange="priorityState[${p}].value=this.value">${opts}</select>
      </div>`;
  }
}

function clearPriority(p) {
  priorityState[p] = { field: '', value: '', valueMin: '', valueMax: '' };
  document.getElementById('pf' + p + 'Field').value = '';
  document.getElementById('pf' + p + 'Value').innerHTML = '';
  document.getElementById('pClear' + p).style.display = 'none';
  [1, 2, 3].forEach(x => populatePrioritySelect(x));
}

function applyPriorityFilters() {
  const search = document.getElementById('recSearch').value.toLowerCase().trim();

  recFiltered = masterData.filter(d => {
    if (search && !Object.values(d).join(' ').toLowerCase().includes(search)) return false;
    for (let p = 1; p <= 3; p++) {
      const st = priorityState[p];
      if (!st.field) continue;
      if (RANGE_FIELDS.has(st.field)) {
        const v  = parseFloat(d[st.field]) || 0;
        const mn = parseFloat(st.valueMin) || 0;
        const mx = parseFloat(st.valueMax) || Infinity;
        if (v < mn || v > mx) return false;
      } else {
        if (st.value && d[st.field] !== st.value) return false;
      }
    }
    return true;
  });

  recPage = 1;
  updateFilterChips();
  recUpdateKPIs();
  recUpdateCharts();
  recRender();
  showToast('success', '⚡', recFiltered.length + ' candidates matched');
}

function resetPriorityFilters() {
  [1, 2, 3].forEach(p => clearPriority(p));
  document.getElementById('recSearch').value = '';
  recFiltered = [...masterData];
  document.getElementById('filterChips').style.display = 'none';
  recPage = 1;
  recUpdateKPIs();
  recUpdateCharts();
  recRender();
}

function updateFilterChips() {
  const chips  = document.getElementById('filterChips');
  const active = [1, 2, 3].filter(p => priorityState[p].field);
  if (!active.length) { chips.style.display = 'none'; return; }
  chips.style.display = 'flex';
  chips.innerHTML = active.map(p => {
    const st  = priorityState[p];
    const f   = FIELDS.find(x => x.key === st.field);
    const val = RANGE_FIELDS.has(st.field)
      ? `${st.valueMin || '0'}–${st.valueMax || '∞'} yrs`
      : (st.value || 'Any');
    return `<span class="chip p${p}">P${p}: ${f.label} = <strong>${val}</strong></span>`;
  }).join('');
}

/* ─────────────────────────────────────────
   RECRUITER — Sync from Admin
   (Recruiter has NO file upload; reads masterData)
───────────────────────────────────────── */
function recSyncFromAdmin() {
  recFiltered = [...masterData];

  const syncBar   = document.getElementById('recSyncBar');
  const syncIcon  = document.getElementById('recSyncIcon');
  const syncTitle = document.getElementById('recSyncTitle');
  const syncSub   = document.getElementById('recSyncSub');
  const syncBadge = document.getElementById('recSyncBadge');
  const syncCount = document.getElementById('recSyncCount');

  if (masterData.length > 0) {
    syncBar.classList.add('has-data');
    syncIcon.textContent  = '✅';
    syncTitle.textContent = 'Candidate Data Loaded';
    syncSub.textContent   = 'This data was uploaded by the Administrator and is read-only.';
    syncBadge.style.display = 'flex';
    syncCount.textContent   = masterData.length.toLocaleString();
    document.getElementById('recKpiStrip').style.display      = 'grid';
    document.getElementById('recChartsSection').style.display = 'flex';
    buildRecColToggles();
    initPrioritySelects();
    recUpdateKPIs();
    recUpdateCharts();
  } else {
    syncBar.classList.remove('has-data');
    syncIcon.textContent  = '📋';
    syncTitle.textContent = 'No Candidate Data Available';
    syncSub.textContent   = 'The Administrator has not uploaded any data yet. Please ask your admin to upload a file.';
    syncBadge.style.display = 'none';
    document.getElementById('recKpiStrip').style.display      = 'none';
    document.getElementById('recChartsSection').style.display = 'none';
  }
  recPage = 1;
  recRender();
}

/* ─────────────────────────────────────────
   RECRUITER — KPI Cards
───────────────────────────────────────── */
function recUpdateKPIs() {
  const f = recFiltered;
  document.getElementById('rKpiTotal').textContent    = masterData.length.toLocaleString();
  document.getElementById('rKpiFiltered').textContent = f.length.toLocaleString() + ' matching';
  document.getElementById('rKpiExp').textContent      = f.length
    ? (f.reduce((a, d) => a + d.totalExperience, 0) / f.length).toFixed(1) : 0;
  document.getElementById('rKpiInd').textContent      = new Set(f.map(d => d.industry).filter(Boolean)).size;
  document.getElementById('rKpiCities').textContent   = new Set(f.map(d => d.city).filter(Boolean)).size;
}

/* ─────────────────────────────────────────
   RECRUITER — Company-Wise Line Chart Engine
   ─────────────────────────────────────────
   LOGIC:
   • X-axis  = Top 15 companies sorted by matched-candidate count
   • Baseline line  = unfiltered total per company (dashed blue)
   • P1 line        = candidates at company passing P1 filter only  (red)
   • P2 line        = candidates at company passing P1 AND P2       (yellow)
   • P3 line        = candidates at company passing P1 AND P2 AND P3 (green)
   • Priority ORDER matters: swapping P1↔P2 changes intermediate
     Y-values → different line shape for different recruiters
───────────────────────────────────────── */
const LC_COLORS = {
  base: { border: '#3d7eff', bg: 'rgba(61,126,255,0.08)',  point: '#3d7eff' },
  p1:   { border: '#f72585', bg: 'rgba(247,37,133,0.08)', point: '#f72585' },
  p2:   { border: '#f8b500', bg: 'rgba(248,181,0,0.08)',  point: '#f8b500' },
  p3:   { border: '#06d6a0', bg: 'rgba(6,214,160,0.08)',  point: '#06d6a0' },
};

function fieldLabel(key) {
  return (FIELDS.find(f => f.key === key) || {}).label || key;
}

function recUpdateCharts() {
  // Destroy previous chart instance
  if (rCharts.line) { rCharts.line.destroy(); rCharts.line = null; }

  const activePriorities = [1, 2, 3].filter(n => !!priorityState[n].field);
  const hasAny           = activePriorities.length > 0;

  document.getElementById('lcNoFilter').style.display = hasAny ? 'none'  : 'block';
  document.getElementById('lcCard').style.display     = hasAny ? 'block' : 'none';
  if (!hasAny) return;

  // Helper: does a candidate pass the filter for one priority level?
  function passesPriority(d, pNum) {
    const st = priorityState[pNum];
    if (!st.field) return true;
    if (RANGE_FIELDS.has(st.field)) {
      const v  = parseFloat(d[st.field]) || 0;
      const mn = parseFloat(st.valueMin) || 0;
      const mx = parseFloat(st.valueMax) || Infinity;
      return v >= mn && v <= mx;
    }
    return !st.value || d[st.field] === st.value;
  }

  // Build a dataset for cumulative priority levels
  function layerData(pNums) {
    return masterData.filter(d => pNums.every(n => passesPriority(d, n)));
  }

  // X-axis: top 15 companies by count in the fully-filtered result
  const allMatched  = recFiltered;
  const companyCount = {};
  allMatched.forEach(d => {
    if (d.currentEmployer) companyCount[d.currentEmployer] = (companyCount[d.currentEmployer] || 0) + 1;
  });
  const topCompanies = Object.entries(companyCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(e => e[0]);

  if (!topCompanies.length) {
    document.getElementById('lcCard').style.display    = 'none';
    document.getElementById('lcNoFilter').style.display = 'block';
    document.getElementById('lcNoFilter').querySelector('.lc-no-filter-title').textContent =
      'No Candidates Match These Filters';
    return;
  }

  // Baseline dataset — all candidates, no filter
  const baseDataset = {
    label:              'All Candidates (No Filter)',
    data:               topCompanies.map(c => masterData.filter(d => d.currentEmployer === c).length),
    borderColor:        LC_COLORS.base.border,
    backgroundColor:    LC_COLORS.base.bg,
    pointBackgroundColor: LC_COLORS.base.point,
    pointBorderColor:   '#07090f',
    pointBorderWidth:   2,
    pointRadius:        4,
    pointHoverRadius:   7,
    borderWidth:        1.5,
    borderDash:         [5, 4],
    tension:            0.38,
    fill:               false,
  };

  // One dataset per active priority (cumulative)
  const priorityDatasets = [];
  const priorityMeta     = [];
  const cumulativePNums  = [];

  activePriorities.forEach(pNum => {
    cumulativePNums.push(pNum);
    const layer   = layerData([...cumulativePNums]);
    const yValues = topCompanies.map(c => layer.filter(d => d.currentEmployer === c).length);
    const col     = LC_COLORS['p' + pNum];
    const st      = priorityState[pNum];
    const fld     = fieldLabel(st.field);

    let filterDesc = '';
    if (RANGE_FIELDS.has(st.field)) {
      filterDesc = `${fld}: ${st.valueMin || '0'}–${st.valueMax || '∞'} yrs`;
    } else {
      filterDesc = st.value ? `${fld} = "${st.value}"` : `${fld} (any)`;
    }

    priorityDatasets.push({
      label:              `P${pNum}: ${filterDesc}`,
      data:               yValues,
      borderColor:        col.border,
      backgroundColor:    col.bg,
      pointBackgroundColor: col.point,
      pointBorderColor:   '#07090f',
      pointBorderWidth:   2,
      pointRadius:        5,
      pointHoverRadius:   8,
      borderWidth:        2.5,
      tension:            0.38,
      fill:               false,
    });

    priorityMeta.push({ pNum, filterDesc, total: layer.length, col });
  });

  // Render the chart
  const ctx = document.getElementById('rChartLine');
  rCharts.line = new Chart(ctx, {
    type: 'line',
    data: {
      labels:   topCompanies,
      datasets: [baseDataset, ...priorityDatasets],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction:         { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align:    'start',
          labels: {
            color:           '#8892aa',
            font:            { size: 11 },
            padding:         16,
            boxWidth:        28,
            usePointStyle:   true,
            pointStyleWidth: 20,
          },
        },
        tooltip: {
          backgroundColor: '#141820',
          borderColor:     'rgba(255,255,255,.1)',
          borderWidth:     1,
          titleColor:      '#dde4f0',
          bodyColor:       '#8892aa',
          padding:         12,
          titleFont:       { family: 'Syne', size: 12, weight: '700' },
          bodyFont:        { family: 'Epilogue', size: 12 },
          callbacks: {
            title: items  => `🏢 ${items[0].label}`,
            label: item   => ` ${item.dataset.label}: ${item.parsed.y} candidates`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#6b7590', font: { size: 10 }, maxRotation: 38, minRotation: 20 },
          grid:  { color: 'rgba(255,255,255,.04)' },
        },
        y: {
          beginAtZero: true,
          ticks:       { color: '#6b7590', font: { size: 10 }, stepSize: 1, precision: 0 },
          grid:        { color: 'rgba(255,255,255,.04)' },
          title:       { display: true, text: 'Number of Candidates', color: '#4a5568', font: { size: 10 } },
        },
      },
    },
  });

  // Update card header
  const filterSummary = activePriorities
    .map(n => `P${n}: ${priorityMeta[activePriorities.indexOf(n)].filterDesc}`)
    .join(' → ');
  document.getElementById('lcTitle').textContent    = 'Company-Wise Candidate Analysis';
  document.getElementById('lcSubtitle').textContent = `${topCompanies.length} companies · Filter chain: ${filterSummary}`;
  document.getElementById('lcTotalPill').textContent = `${allMatched.length} matched`;

  // Priority legend pills
  const legendRow = document.getElementById('lcLegendRow');
  legendRow.innerHTML = '<span class="lc-legend-label">Active:</span>';
  [1, 2, 3].forEach(n => {
    const st   = priorityState[n];
    if (st.field) {
      const meta = priorityMeta.find(m => m.pNum === n);
      legendRow.innerHTML += `
        <span class="lc-pill p${n}">
          <span class="lc-pill-dot" style="background:${LC_COLORS['p' + n].border}"></span>
          P${n} — ${meta.filterDesc}
        </span>`;
    } else {
      legendRow.innerHTML += `<span class="lc-pill-inactive">P${n} not set</span>`;
    }
  });

  // Insight cards
  const insightsEl       = document.getElementById('lcInsights');
  const topFinalCompany  = topCompanies.reduce((best, c) => {
    const cnt = allMatched.filter(d => d.currentEmployer === c).length;
    return cnt > (best.cnt || 0) ? { name: c, cnt } : best;
  }, {});
  const topBaseCompany   = topCompanies.reduce((best, c) => {
    const cnt = masterData.filter(d => d.currentEmployer === c).length;
    return cnt > (best.cnt || 0) ? { name: c, cnt } : best;
  }, {});

  let insHtml = `
    <div class="lc-insight-item">
      <div class="lc-insight-label">Top Company (All Filters)</div>
      <div class="lc-insight-val base">${topFinalCompany.name || '—'}</div>
      <div class="lc-insight-sub">${topFinalCompany.cnt || 0} matched candidates</div>
    </div>
    <div class="lc-insight-item">
      <div class="lc-insight-label">Top Company (No Filter)</div>
      <div class="lc-insight-val" style="color:var(--dim)">${topBaseCompany.name || '—'}</div>
      <div class="lc-insight-sub">${topBaseCompany.cnt || 0} total candidates</div>
    </div>`;

  priorityMeta.forEach((m, idx) => {
    const cls  = ['p1c', 'p2c', 'p3c'][idx] || 'base';
    const topC = topCompanies.reduce((best, c) => {
      const layer = layerData(activePriorities.slice(0, idx + 1));
      const cnt   = layer.filter(d => d.currentEmployer === c).length;
      return cnt > (best.cnt || 0) ? { name: c, cnt } : best;
    }, {});
    insHtml += `
      <div class="lc-insight-item">
        <div class="lc-insight-label">Top · P${m.pNum} Filter</div>
        <div class="lc-insight-val ${cls}">${topC.name || '—'}</div>
        <div class="lc-insight-sub">${m.filterDesc} · ${m.total} total</div>
      </div>`;
  });

  insHtml += `
    <div class="lc-insight-item">
      <div class="lc-insight-label">Filter Priority Order</div>
      <div class="lc-insight-val" style="font-size:12px;color:var(--acc)">
        ${activePriorities.map(n => `P${n}`).join(' → ')}
      </div>
      <div class="lc-insight-sub">Different order = different graph</div>
    </div>`;

  insightsEl.innerHTML = insHtml;
}

/* ─────────────────────────────────────────
   RECRUITER — Column Toggle Buttons
───────────────────────────────────────── */
function buildRecColToggles() {
  const wrap = document.getElementById('recColToggles');
  wrap.innerHTML = '';
  FIELDS.forEach(f => {
    const btn = document.createElement('button');
    btn.className  = 'col-tog ' + (recVisibleCols.includes(f.key) ? 'on' : '');
    btn.textContent = f.label;
    btn.onclick = () => {
      if (recVisibleCols.includes(f.key)) {
        if (recVisibleCols.length <= 2) return;
        recVisibleCols = recVisibleCols.filter(c => c !== f.key);
        btn.classList.remove('on');
      } else {
        recVisibleCols.push(f.key);
        btn.classList.add('on');
      }
      recRender();
    };
    wrap.appendChild(btn);
  });
}

/* ─────────────────────────────────────────
   RECRUITER — Render Table
───────────────────────────────────────── */
function recRender() {
  const search = document.getElementById('recSearch').value.toLowerCase().trim();
  let data = recFiltered.filter(d =>
    !search || Object.values(d).join(' ').toLowerCase().includes(search)
  );

  if (recSortCol) {
    data.sort((a, b) => {
      const av = a[recSortCol], bv = b[recSortCol];
      if (typeof av === 'number') return (av - bv) * recSortDir;
      return String(av).localeCompare(String(bv)) * recSortDir;
    });
  }

  const perPage    = parseInt(document.getElementById('recPerPage').value);
  const totalPages = Math.max(1, Math.ceil(data.length / perPage));
  recPage = Math.min(recPage, totalPages);
  const start    = (recPage - 1) * perPage;
  const pageData = data.slice(start, start + perPage);
  const body     = document.getElementById('recTableBody');

  document.getElementById('recTableCount').textContent = '(' + data.length.toLocaleString() + ' results)';

  if (!data.length) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${masterData.length ? '🔍' : '📋'}</div>
        <div class="empty-title">${masterData.length ? 'No Matches' : 'No Data'}</div>
        <div class="empty-sub">${masterData.length ? 'Adjust priority filters or reset.' : 'Upload a file to get started.'}</div>
      </div>`;
    document.getElementById('recPagination').style.display = 'none';
    return;
  }

  const colFields = FIELDS.filter(f => recVisibleCols.includes(f.key));
  let h = `<div style="overflow-x:auto"><table class="admin-table"><thead><tr>`;
  colFields.forEach(f => {
    const s = recSortCol === f.key;
    h += `<th onclick="recSort('${f.key}')" class="${s ? 'sorted' : ''}">${f.label}<span class="si">${s ? (recSortDir > 0 ? '↑' : '↓') : '↕'}</span></th>`;
  });
  h += `</tr></thead><tbody>`;
  pageData.forEach(row => {
    h += '<tr>';
    colFields.forEach(f => { h += `<td>${recCellVal(f, row)}</td>`; });
    h += '</tr>';
  });
  h += `</tbody></table></div>`;
  body.innerHTML = h;

  document.getElementById('recPagination').style.display = 'flex';
  document.getElementById('recPageInfo').textContent =
    `Showing ${start + 1}–${Math.min(start + perPage, data.length)} of ${data.length}`;
  renderPageBtns('recPageBtns', recPage, totalPages, p => { recPage = p; recRender(); });
}

function recSort(k) {
  if (recSortCol === k) recSortDir *= -1;
  else { recSortCol = k; recSortDir = 1; }
  recRender();
}

function recCellVal(f, row) {
  const v = row[f.key];
  if (f.key === 'candidateName')  return `<strong>${v || '—'}</strong>`;
  if (f.key === 'linkedinProfile') return v ? `<a class="li-btn" href="${v}" target="_blank">🔗 Profile</a>` : '—';
  if (f.key === 'gender')         return renderGenderTag(v);
  if (f.key === 'totalExperience') return renderExpTag(v);
  if (f.key === 'primaryVertical'  || f.key === 'secondaryVertical')   return v ? `<span class="tag tag-v">${v}</span>` : '—';
  if (f.key === 'primaryHorizontal'|| f.key === 'secondaryHorizontal') return v ? `<span class="tag tag-h">${v}</span>` : '—';
  if (f.key === 'role')           return v ? `<span class="tag tag-r">${v}</span>`  : '—';
  if (f.key === 'roleFocus')      return v ? `<span class="tag tag-rf">${v}</span>` : '—';
  return v ? `<span class="td-clip" title="${v}">${v}</span>` : '—';
}

function recExportCSV() {
  if (!recFiltered.length) { showToast('error', '⚠️', 'Nothing to export.'); return; }
  exportToCSV(recFiltered, 'recruiter_candidates.csv');
}

/* ─────────────────────────────────────────
   SHARED HELPERS
───────────────────────────────────────── */
function renderGenderTag(v) {
  if (!v) return '—';
  const cls = v.toLowerCase() === 'male'
    ? 'tag-gender-m'
    : v.toLowerCase() === 'female'
    ? 'tag-gender-f'
    : 'tag-gender-o';
  return `<span class="tag ${cls}">${v}</span>`;
}

function renderExpTag(v) {
  const n   = parseFloat(v) || 0;
  const cls = n >= 16 ? 'hi' : n >= 6 ? 'mid' : '';
  return `<span class="tag tag-exp ${cls}">${n} yr${n !== 1 ? 's' : ''}</span>`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// Click outside a modal overlay to close it
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('active'); });
});

function renderPageBtns(containerId, cur, total, onClick) {
  const el = document.getElementById(containerId);
  let h = `<button class="page-btn" id="${containerId}_prev" ${cur <= 1 ? 'disabled' : ''}>‹</button>`;
  let s = Math.max(1, cur - 2);
  let e = Math.min(total, s + 4);
  if (e - s < 4) s = Math.max(1, e - 4);
  for (let p = s; p <= e; p++) {
    h += `<button class="page-btn ${p === cur ? 'active' : ''}" data-p="${p}">${p}</button>`;
  }
  h += `<button class="page-btn" id="${containerId}_next" ${cur >= total ? 'disabled' : ''}>›</button>`;
  el.innerHTML = h;
  el.querySelector('[id$="_prev"]').onclick = () => { if (cur > 1)     onClick(cur - 1); };
  el.querySelector('[id$="_next"]').onclick = () => { if (cur < total) onClick(cur + 1); };
  el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => onClick(parseInt(b.dataset.p)));
}

function exportToCSV(data, filename) {
  const header = FIELDS.map(f => f.label).join(',');
  const rows   = data.map(row =>
    FIELDS.map(f => `"${(row[f.key] || '').toString().replace(/"/g, '""')}"`).join(',')
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

let toastTimer;
function showToast(type, icon, msg) {
  const t = document.getElementById('toast');
  t.className = 'toast show ' + type;
  document.getElementById('toastIcon').textContent = icon;
  document.getElementById('toastMsg').textContent  = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

/* ─────────────────────────────────────────
   INIT
   Auto-load demo data on page load so both
   Admin and Recruiter see data immediately.
───────────────────────────────────────── */
(function init() {
  masterData  = generateDemoData();
  recFiltered = [...masterData];
  adminRender();
})();
