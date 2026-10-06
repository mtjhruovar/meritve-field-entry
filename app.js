const STORAGE = "eim-current-job";

const VISUAL = {
  groups: [
    { id: "board_inspection", title: "El. razdelilnik - pregled", items: [
      { id: "diagrams", text: "Enopolne sheme, načrti, tablice, izjave o skladnosti" },
      { id: "labelling", text: "Tokokrogi, varovalke, stikala in označbe so prepoznavni" },
      { id: "board_marked", text: "Razdelilniki so predpisano označeni" },
      { id: "working_space", text: "Pred razdelilnikom je 0,8 m prostora" },
      { id: "conductor_marking", text: "Preseki, označbe in barve vodnikov ustrezajo" },
      { id: "terminations", text: "Povezave in priklopi vodnikov so ustrezni" },
    ]},
    { id: "installation_inspection", title: "Električna inštalacija - pregled", items: [
      { id: "earthing_matches_project", text: "Sistem ozemljitve skladen s projektom" },
      { id: "ip_rating", text: "IP zaščita opreme ustreza" },
      { id: "main_bonding", text: "Glavna izenačitev potencialov" },
      { id: "supplementary_bonding", text: "Dodatna izenačitev potencialov" },
      { id: "n_pe_identifiable", text: "N in PE vodniki so prepoznavni" },
      { id: "overcurrent", text: "Zaščita pred prevelikimi tokovi" },
      { id: "shock_protection", text: "Zaščita pred električnim udarom" },
      { id: "direct_contact", text: "Zaščita pred neposrednim dotikom" },
      { id: "indirect_contact", text: "Zaščita pri posrednem dotiku" },
      { id: "auto_disconnect", text: "Samodejni odklop napajanja" },
    ]},
    { id: "surge", title: "Prenapetostna zaščita", items: [
      { id: "spd_installed", text: "SPD pravilno nameščeni" },
      { id: "spd_undamaged", text: "Ni poškodb SPD / varovalk" },
      { id: "spd_coordination", text: "Koordinacija SPD" },
    ]},
  ],
};

function emptyJob() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    meta: {
      report_type: "installation",
      report_number: "",
      object_class: "manj_zahteven",
      inspection_kind: "periodic",
      date: today,
      place: "",
      next_inspection_years: 16,
    },
    site: { name: "", address: "", building_permit: "/", documentation: "/" },
    client: { name: "" },
    contractor: {
      company: "»SENEL« Hrušovar Mojca s.p.",
      person: "Matija Hrušovar",
      certificate: "8765865031-180-2022-93137/8765865031",
      catalog_less_demanding: "8765865021",
      catalog_demanding: "6533273021",
      tax_id: "28562208",
      phone: "041-600-063",
      email: "",
    },
    supply: {
      earthing_system: "TN-C-S",
      rpe_ohm: "",
      r_combined_ohm: "",
      measure_point: "GIP",
      protection: { overcurrent: true, rcd: true, voltage_device: false, other: "" },
      phases: 3,
      main_fuse: "",
      feed: "underground",
      extras: { transformer: false, genset: false, ups: false, pv: false },
    },
    earthing: { potential_ring: false, type: "strip", material: "FeZn", cross_section: "" },
    weather: "sunny",
    ground: "dry",
    instrument: {
      name: "Eurotest XA MI 3105",
      manufacturer: "Metrel d.d.",
      type: "MI 3105",
      serial: "",
      calibration_valid_to: "",
    },
    positive_opinion: true,
    deficiencies: [],
    comment: "",
    buildings: [{ name: "", switchboards: [] }],
    billing: {
      base_eur: 180,
      included_circuits: 20,
      per_extra_eur: 5,
      discount_eur: 0,
      note: "",
    },
  };
}

function normalizeJob(raw) {
  if (!raw || typeof raw !== "object") return emptyJob();
  const data = raw.job && typeof raw.job === "object" ? raw.job : raw;
  const base = emptyJob();
  const supply = data.supply || {};
  const normalized = {
    ...base,
    ...data,
    meta: { ...base.meta, ...(data.meta || {}) },
    site: { ...base.site, ...(data.site || {}) },
    client: { ...base.client, ...(data.client || {}) },
    contractor: { ...base.contractor, ...(data.contractor || {}) },
    supply: {
      ...base.supply,
      ...supply,
      protection: { ...base.supply.protection, ...(supply.protection || {}) },
      extras: { ...base.supply.extras, ...(supply.extras || {}) },
    },
    earthing: { ...base.earthing, ...(data.earthing || {}) },
    instrument: { ...base.instrument, ...(data.instrument || {}) },
    billing: { ...base.billing, ...(data.billing || {}) },
  };
  if (!Array.isArray(normalized.buildings) || !normalized.buildings.length) {
    normalized.buildings = [{ name: "", switchboards: [] }];
  }
  const buildingName = normalized.buildings[0] && normalized.buildings[0].name;
  if (!normalized.site.name && buildingName) normalized.site.name = buildingName;
  if (!normalized.buildings[0].name && normalized.site.name) {
    normalized.buildings[0].name = normalized.site.name;
  }
  return normalized;
}

let job = loadJob();
let selectedBoardId = null;
let editingCircuit = null;
let editingRcd = null;

function loadJob() {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) return normalizeJob(JSON.parse(raw));
  } catch (err) {
    console.warn(err);
  }
  return emptyJob();
}

function saveJob() {
  readFormIntoJob();
  persistJob();
}

function persistJob() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(job));
  } catch (err) {
    console.error(err);
    toast("Shranjevanje na telefonu ni uspelo — preveč podatkov");
  }
}

function $(id) { return document.getElementById(id); }

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 2200);
}

function boards() {
  if (!job.buildings.length) job.buildings = [{ name: job.site.name || "Objekt", switchboards: [] }];
  job.buildings[0].name = job.site.name || job.buildings[0].name || "Objekt";
  return job.buildings[0].switchboards;
}

function currentBoard() {
  return boards().find((b) => b.id === selectedBoardId) || boards()[0];
}

function suggestCircuitPath(board) {
  let max = 0;
  (board.circuits || []).forEach((c) => {
    const m = String(c.path || "").match(/\/F(\d+)$/i);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return `${board.id}/F${max + 1}`;
}

function updateCircuitPathHint() {
  const board = currentBoard();
  const el = $("c_path");
  if (!el || !board) return;
  el.placeholder = suggestCircuitPath(board);
}

function circuitCount() {
  return boards().reduce((sum, board) => sum + (board.circuits || []).length, 0);
}

function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function computeBilling(source = job) {
  const b = (source && source.billing) || {};
  const base = money(b.base_eur != null ? b.base_eur : 180);
  const included = Math.max(0, Number(b.included_circuits != null ? b.included_circuits : 20) || 0);
  const perExtra = money(b.per_extra_eur != null ? b.per_extra_eur : 5);
  const discount = money(b.discount_eur != null ? b.discount_eur : 0);
  const note = b.note || "";
  const count = (source.buildings || []).reduce(
    (sum, building) => sum + (building.switchboards || []).reduce(
      (s, board) => s + (board.circuits || []).length, 0
    ), 0
  );
  const extras = Math.max(0, count - included);
  const extrasTotal = money(extras * perExtra);
  const subtotal = money(base + extrasTotal);
  const total = money(Math.max(0, subtotal - discount));
  return {
    base_eur: base,
    included_circuits: included,
    per_extra_eur: perExtra,
    discount_eur: discount,
    note,
    circuit_count: count,
    extra_circuits: extras,
    extras_total_eur: extrasTotal,
    subtotal_eur: subtotal,
    total_eur: total,
  };
}

function applyBillingSnapshot() {
  job.billing = computeBilling(job);
}

// Extra job fields edited directly on the "Objekt" tab: [element id, job path, kind].
const OBJECT_FIELDS = [
  ["building_permit", "site.building_permit"],
  ["documentation", "site.documentation"],
  ["object_class", "meta.object_class"],
  ["next_inspection_years", "meta.next_inspection_years", "int"],
  ["r_combined_ohm", "supply.r_combined_ohm"],
  ["measure_point", "supply.measure_point"],
  ["feed", "supply.feed"],
  ["prot_overcurrent", "supply.protection.overcurrent", "bool"],
  ["prot_rcd", "supply.protection.rcd", "bool"],
  ["prot_voltage", "supply.protection.voltage_device", "bool"],
  ["prot_other", "supply.protection.other"],
  ["extra_transformer", "supply.extras.transformer", "bool"],
  ["extra_genset", "supply.extras.genset", "bool"],
  ["extra_ups", "supply.extras.ups", "bool"],
  ["extra_pv", "supply.extras.pv", "bool"],
  ["potential_ring", "earthing.potential_ring", "bool"],
  ["earth_type", "earthing.type"],
  ["earth_material", "earthing.material"],
  ["earth_cross_section", "earthing.cross_section"],
  ["weather", "weather"],
  ["ground", "ground"],
  ["instrument_serial", "instrument.serial"],
  ["calibration_valid_to", "instrument.calibration_valid_to"],
];

function getPath(obj, path) {
  return path.split(".").reduce((o, key) => (o == null ? undefined : o[key]), obj);
}

function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((o, key) => (o[key] = o[key] || {}), obj);
  target[last] = value;
}

function fillObjectFields() {
  OBJECT_FIELDS.forEach(([id, path, kind]) => {
    const el = $(id);
    if (!el) return;
    const value = getPath(job, path);
    if (kind === "bool") el.checked = Boolean(value);
    else setValue(id, value);
  });
}

function readObjectFields() {
  OBJECT_FIELDS.forEach(([id, path, kind]) => {
    const el = $(id);
    if (!el) return;
    let value = el.value;
    if (kind === "bool") value = el.checked;
    else if (kind === "int") value = parseInt(value, 10) || getPath(emptyJob(), path);
    setPath(job, path, value);
  });
}

function setValue(id, value) {
  const el = $(id);
  if (!el) return;
  const text = value == null ? "" : String(value);
  el.value = text;
}

function syncKindPhases() {
  const opt = $("c_kind").selectedOptions[0];
  if (opt && opt.dataset.phases) $("c_phases").value = opt.dataset.phases;
  toggleThreePhase();
}

function toggleThreePhase() {
  const three = $("c_phases").value === "3";
  $("iso_3f").style.display = three ? "block" : "none";
}

function fillFormFromJob() {
  setValue("date", job.meta.date);
  setValue("report_number", job.meta.report_number);
  setValue("inspection_kind", job.meta.inspection_kind || "periodic");
  setValue("place", job.meta.place);
  setValue("site_name", job.site.name);
  setValue("site_address", job.site.address);
  setValue("client_name", job.client.name);
  setValue("earthing_system", job.supply.earthing_system || "TN-C-S");
  setValue("rpe_ohm", job.supply.rpe_ohm ?? "");
  setValue("phases", String(job.supply.phases || 3));
  setValue("main_fuse", job.supply.main_fuse);
  fillObjectFields();
  fillBillingForm();
  updateSubtitle();
  renderBoards();
  renderCircuits();
  renderRcds();
  renderVisual();
  updateCircuitPathHint();
  refreshBilling();
  if (boards().length) {
    $("rcd_card").hidden = false;
    $("rcd_list_card").hidden = false;
    const board = currentBoard();
    if (board) $("rcd_board_name").textContent = board.id;
  }
}

function fillBillingForm() {
  const b = job.billing || {};
  setValue("bill_base", b.base_eur != null ? b.base_eur : 180);
  setValue("bill_included", b.included_circuits != null ? b.included_circuits : 20);
  setValue("bill_extra", b.per_extra_eur != null ? b.per_extra_eur : 5);
  setValue("bill_discount", b.discount_eur != null ? b.discount_eur : 0);
  setValue("bill_note", b.note || "");
}

function readBillingFromForm() {
  job.billing = job.billing || {};
  job.billing.base_eur = money($("bill_base") ? $("bill_base").value : job.billing.base_eur);
  job.billing.included_circuits = Math.max(0, Number($("bill_included") ? $("bill_included").value : job.billing.included_circuits) || 0);
  job.billing.per_extra_eur = money($("bill_extra") ? $("bill_extra").value : job.billing.per_extra_eur);
  job.billing.discount_eur = money($("bill_discount") ? $("bill_discount").value : job.billing.discount_eur);
  job.billing.note = $("bill_note") ? $("bill_note").value : (job.billing.note || "");
}

function formatEur(n) {
  return `${money(n).toFixed(2).replace(".", ",")} €`;
}

function refreshBilling() {
  const summary = $("bill_summary");
  if (!summary) return;
  const b = computeBilling(job);
  const lines = [
    `<div class="bill-row"><span>Tokokrogov</span><strong>${b.circuit_count}</strong></div>`,
    `<div class="bill-row"><span>Osnova (do ${b.included_circuits})</span><strong>${formatEur(b.base_eur)}</strong></div>`,
  ];
  if (b.extra_circuits) {
    lines.push(
      `<div class="bill-row"><span>${b.extra_circuits} × dodatek (${formatEur(b.per_extra_eur)})</span><strong>${formatEur(b.extras_total_eur)}</strong></div>`
    );
  }
  if (b.discount_eur) {
    lines.push(
      `<div class="bill-row"><span>Popust</span><strong>− ${formatEur(b.discount_eur)}</strong></div>`
    );
  }
  lines.push(
    `<div class="bill-row total"><span>Skupaj (brez DDV)</span><strong>${formatEur(b.total_eur)}</strong></div>`
  );
  summary.innerHTML = lines.join("");
}

function readFormIntoJob() {
  job.meta.date = $("date").value;
  job.meta.report_number = $("report_number").value;
  job.meta.inspection_kind = $("inspection_kind").value;
  job.meta.place = $("place").value;
  job.site.name = $("site_name").value;
  job.site.address = $("site_address").value;
  job.client.name = $("client_name").value;
  job.supply.earthing_system = $("earthing_system").value;
  job.supply.rpe_ohm = $("rpe_ohm").value;
  job.supply.phases = Number($("phases").value);
  job.supply.main_fuse = $("main_fuse").value;
  readObjectFields();
  readBillingFromForm();
}

function renderBoards() {
  const list = $("board_list");
  list.innerHTML = "";
  const boardSelects = [$("circuit_board"), $("visual_board")];
  boardSelects.forEach((sel) => { sel.innerHTML = ""; });
  boards().forEach((board) => {
    const btn = document.createElement("button");
    btn.className = "item btn";
    btn.innerHTML = `<strong>${board.id}</strong><small>${(board.rcds || []).length} RCD, ${(board.circuits || []).length} tokokrogov</small>`;
    btn.onclick = () => selectBoard(board.id);
    list.appendChild(btn);
    boardSelects.forEach((sel) => {
      const opt = document.createElement("option");
      opt.value = board.id;
      opt.textContent = board.id;
      sel.appendChild(opt);
    });
  });
  if (selectedBoardId) {
    $("circuit_board").value = selectedBoardId;
    $("visual_board").value = selectedBoardId;
  }
}

function selectBoard(id) {
  selectedBoardId = id;
  $("rcd_card").hidden = false;
  $("rcd_list_card").hidden = false;
  $("rcd_board_name").textContent = id;
  $("circuit_board").value = id;
  $("visual_board").value = id;
  renderRcds();
  renderVisual();
  updateCircuitPathHint();
  toast("Razdelilnik " + id);
}

function setRcdEditMode(ref) {
  editingRcd = ref;
  const editing = Boolean(ref);
  $("add_rcd").textContent = editing ? "Posodobi RCD" : "Shrani RCD";
  $("edit_hint_rcd").hidden = !editing;
  renderRcds();
}

function clearRcdForm() {
  ["rcd_id","rcd_brand","rcd_idn","rcd_uc","rcd_idm","rcd_t1","rcd_t5","rcd_zin"].forEach((id) => setValue(id, ""));
  setValue("rcd_in", "");
  setRcdEditMode(null);
}

function loadRcd(boardId, index) {
  const board = boards().find((b) => b.id === boardId);
  const rcd = board && board.rcds && board.rcds[index];
  if (!rcd) return;
  selectedBoardId = boardId;
  $("rcd_card").hidden = false;
  $("rcd_list_card").hidden = false;
  $("rcd_board_name").textContent = boardId;
  setValue("rcd_id", rcd.id);
  setValue("rcd_brand", rcd.brand);
  setValue("rcd_in", rcd.in_a);
  setValue("rcd_idn", rcd.idn_a);
  setValue("rcd_phases", rcd.phases || 1);
  setValue("rcd_type", rcd.type_current || "A");
  setValue("rcd_delay", rcd.type_delay || "G");
  setValue("rcd_uc", rcd.uc_v);
  setValue("rcd_idm", rcd.id_measured_ma);
  setValue("rcd_t1", rcd.t1x_ms);
  setValue("rcd_t5", rcd.t5x_ms);
  setValue("rcd_zin", rcd.z_in_ohm);
  setRcdEditMode({ boardId, index });
  toast("Urejanje RCD");
  $("rcd_id").scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteRcd(boardId, index) {
  const board = boards().find((b) => b.id === boardId);
  if (!board || !board.rcds || !board.rcds[index]) return;
  const rcd = board.rcds[index];
  if (!confirm(`Izbrišem ${rcd.id || "RCD"}?`)) return;
  board.rcds.splice(index, 1);
  if (editingRcd && editingRcd.boardId === boardId && editingRcd.index === index) {
    clearRcdForm();
  } else if (editingRcd && editingRcd.boardId === boardId && editingRcd.index > index) {
    editingRcd = { boardId, index: editingRcd.index - 1 };
  }
  saveJob();
  renderBoards();
  renderRcds();
  toast("RCD izbrisan");
}

function renderRcds() {
  const list = $("rcd_list");
  if (!list) return;
  list.innerHTML = "";
  const board = currentBoard();
  if (!board) return;
  (board.rcds || []).forEach((rcd, idx) => {
    const row = document.createElement("div");
    row.className = "circuit-row";
    const btn = document.createElement("button");
    btn.className = "item btn";
    const active = editingRcd && editingRcd.boardId === board.id && editingRcd.index === idx;
    if (active) btn.classList.add("editing");
    btn.innerHTML = `<strong>${rcd.id || "RCD"}</strong><small>${rcd.brand || ""} In ${rcd.in_a || "—"} A · IΔn ${rcd.idn_a || "—"} · ${rcd.phases == 3 ? "3f" : "1f"}</small>`;
    btn.onclick = () => loadRcd(board.id, idx);
    const del = document.createElement("button");
    del.className = "btn danger";
    del.textContent = "Briši";
    del.onclick = (ev) => {
      ev.stopPropagation();
      deleteRcd(board.id, idx);
    };
    row.appendChild(btn);
    row.appendChild(del);
    list.appendChild(row);
  });
}

function setEditMode(ref) {
  editingCircuit = ref;
  const editing = Boolean(ref);
  $("save_circuit").textContent = editing ? "Posodobi tokokrog" : "Shrani tokokrog";
  $("edit_hint").hidden = !editing;
  renderCircuits();
}

function clearCircuitForm() {
  ["c_no","c_desc","c_path","c_r","c_zin","c_ik","c_zipe","c_ikpe","c_uc","c_xy","c_trip",
   "i_npe","i_l1pe","i_l1n","i_l2pe","i_l2n","i_l3pe","i_l3n","i_l1l2","i_l1l3","i_l2l3"]
    .forEach((id) => setValue(id, ""));
  setEditMode(null);
  updateCircuitPathHint();
}

function loadCircuit(boardId, index) {
  const board = boards().find((b) => b.id === boardId);
  const circuit = board && board.circuits && board.circuits[index];
  if (!circuit) return;
  selectedBoardId = boardId;
  $("circuit_board").value = boardId;
  setValue("c_room", circuit.room);
  setValue("c_no", circuit.number);
  setValue("c_kind", circuit.kind || "other");
  setValue("c_phases", circuit.phases || 1);
  setValue("c_desc", circuit.description);
  setValue("c_path", circuit.path);
  setValue("c_r", circuit.r_bonding_ohm);
  setValue("c_zin", circuit.z_in_ohm);
  setValue("c_ik", circuit.ik_a);
  setValue("c_zipe", circuit.z_ipe_ohm);
  setValue("c_ikpe", circuit.ik_pe_a);
  setValue("c_uc", circuit.uc_v);
  setValue("c_mm", circuit.cross_section);
  setValue("c_prot", circuit.protection);
  setValue("c_in", circuit.in_a);
  setValue("c_trip", circuit.trip_s);
  setValue("c_xy", circuit.consumers);
  const ins = circuit.insulation || {};
  setValue("i_npe", ins.n_pe);
  setValue("i_l1pe", ins.l1_pe);
  setValue("i_l1n", ins.l1_n);
  setValue("i_l2pe", ins.l2_pe);
  setValue("i_l2n", ins.l2_n);
  setValue("i_l3pe", ins.l3_pe);
  setValue("i_l3n", ins.l3_n);
  setValue("i_l1l2", ins.l1_l2);
  setValue("i_l1l3", ins.l1_l3);
  setValue("i_l2l3", ins.l2_l3);
  toggleThreePhase();
  setEditMode({ boardId, index });
  toast("Urejanje tokokroga");
  $("c_room").scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteCircuit(boardId, index) {
  const board = boards().find((b) => b.id === boardId);
  if (!board || !board.circuits || !board.circuits[index]) return;
  const c = board.circuits[index];
  const label = c.path || c.kind_label || c.description || `#${index + 1}`;
  if (!confirm(`Izbrišem tokokrog ${label}?`)) return;
  board.circuits.splice(index, 1);
  if (editingCircuit && editingCircuit.boardId === boardId && editingCircuit.index === index) {
    clearCircuitForm();
  } else if (editingCircuit && editingCircuit.boardId === boardId && editingCircuit.index > index) {
    editingCircuit = { boardId, index: editingCircuit.index - 1 };
  }
  saveJob();
  renderBoards();
  renderCircuits();
  refreshBilling();
  toast("Tokokrog izbrisan");
}

function renderCircuits() {
  const list = $("circuit_list");
  list.innerHTML = "";
  const total = circuitCount();
  if (total) {
    const heading = document.createElement("p");
    heading.className = "muted";
    heading.textContent = `${total} shranjenih tokokrogov`;
    list.appendChild(heading);
  }
  boards().forEach((board) => {
    (board.circuits || []).forEach((c, idx) => {
      const row = document.createElement("div");
      row.className = "circuit-row";
      const btn = document.createElement("button");
      btn.className = "item btn";
      const active = editingCircuit && editingCircuit.boardId === board.id && editingCircuit.index === idx;
      if (active) btn.classList.add("editing");
      btn.innerHTML = `<strong>${board.id} · ${c.path || c.kind_label || c.description || "#" + (idx + 1)}</strong><small>${c.room || ""} ${c.kind_label || ""} ${c.phases == 3 ? "3f" : "1f"} ${c.in_a ? "In " + c.in_a + " A" : ""}</small>`;
      btn.onclick = () => loadCircuit(board.id, idx);
      const del = document.createElement("button");
      del.className = "btn danger";
      del.textContent = "Briši";
      del.onclick = (ev) => {
        ev.stopPropagation();
        deleteCircuit(board.id, idx);
      };
      row.appendChild(btn);
      row.appendChild(del);
      list.appendChild(row);
    });
  });
}

function renderVisual() {
  const board = currentBoard();
  const wrap = $("visual_list");
  wrap.innerHTML = "";
  if (!board) {
    wrap.innerHTML = "<p class='muted'>Najprej dodaj razdelilnik.</p>";
    return;
  }
  board.visual = board.visual || {};
  VISUAL.groups.forEach((group) => {
    const h = document.createElement("h2");
    h.textContent = group.title;
    wrap.appendChild(h);
    group.items.forEach((item) => {
      const box = document.createElement("div");
      box.className = "visual-item";
      const val = board.visual[item.id] || "/";
      box.innerHTML = `<p>${item.text}</p><div class="seg">
        <button data-v="DA">DA</button>
        <button data-v="NE">NE</button>
        <button data-v="/">/</button>
      </div>`;
      box.querySelectorAll("button").forEach((b) => {
        if (b.dataset.v === val) b.classList.add(val === "DA" ? "on-da" : val === "NE" ? "on-ne" : "on-slash");
        b.onclick = () => {
          board.visual[item.id] = b.dataset.v;
          saveJob();
          renderVisual();
        };
      });
      wrap.appendChild(box);
    });
  });
}

function updateSubtitle() {
  const el = $("subtitle");
  if (!el) return;
  const parts = [job.site.name, job.meta.place].filter(Boolean);
  el.textContent = parts.length
    ? parts.join(" · ")
    : "Vnos na terenu — deluje tudi brez računalnika in Wi‑Fi";
}

function activateTab(tabId, { save = true } = {}) {
  if (save) saveJob();
  document.querySelectorAll("nav button").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tabId);
  });
  document.querySelectorAll("main > section").forEach((s) => {
    s.classList.toggle("active", s.id === tabId);
  });
  if (tabId === "io") refreshBilling();
}

document.querySelectorAll("nav button").forEach((btn) => {
  btn.onclick = () => activateTab(btn.dataset.tab);
});

$("add_board").onclick = () => {
  const id = $("new_board").value.trim().toUpperCase();
  if (!id) return;
  if (boards().some((b) => b.id === id)) { toast("Razdelilnik že obstaja"); return; }
  boards().push({ id, name: id, visual: {}, rcds: [], spd: [], circuits: [] });
  $("new_board").value = "";
  selectBoard(id);
  saveJob();
  renderBoards();
};

$("add_rcd").onclick = () => {
  const board = currentBoard();
  if (!board) return toast("Izberi razdelilnik");
  const rcd = {
    id: $("rcd_id").value.trim() || `RCD-${(board.rcds.length || 0) + 1}`,
    in_a: $("rcd_in").value,
    idn_a: $("rcd_idn").value,
    type_current: $("rcd_type").value,
    type_delay: $("rcd_delay").value,
    phases: Number($("rcd_phases").value),
    brand: $("rcd_brand").value,
    z_in_ohm: $("rcd_zin").value,
    uc_v: $("rcd_uc").value,
    id_measured_ma: $("rcd_idm").value,
    t1x_ms: $("rcd_t1").value,
    t5x_ms: $("rcd_t5").value,
  };
  board.rcds = board.rcds || [];
  if (editingRcd && editingRcd.boardId === board.id && board.rcds[editingRcd.index]) {
    board.rcds[editingRcd.index] = rcd;
  } else {
    const existing = board.rcds.findIndex((r) => r.id === rcd.id);
    if (existing >= 0) board.rcds[existing] = rcd;
    else board.rcds.push(rcd);
  }
  clearRcdForm();
  saveJob();
  renderBoards();
  renderRcds();
  toast("RCD shranjen");
};

$("new_rcd").onclick = () => {
  clearRcdForm();
  toast("Nov RCD");
};

$("save_circuit").onclick = () => {
  selectedBoardId = $("circuit_board").value;
  const board = currentBoard();
  if (!board) return toast("Dodaj razdelilnik");
  let path = $("c_path").value.trim();
  if (!path) {
    const editingExisting = editingCircuit && editingCircuit.boardId === board.id
      && board.circuits[editingCircuit.index];
    path = editingExisting
      ? (board.circuits[editingCircuit.index].path || suggestCircuitPath(board))
      : suggestCircuitPath(board);
  }
  const circuit = {
    room: $("c_room").value,
    number: $("c_no").value,
    kind: $("c_kind").value,
    kind_label: $("c_kind").selectedOptions[0] ? $("c_kind").selectedOptions[0].textContent : "",
    phases: Number($("c_phases").value),
    description: $("c_desc").value,
    consumers: $("c_xy").value,
    r_bonding_ohm: $("c_r").value,
    z_in_ohm: $("c_zin").value,
    ik_a: $("c_ik").value,
    z_ipe_ohm: $("c_zipe").value,
    ik_pe_a: $("c_ikpe").value,
    uc_v: $("c_uc").value,
    path,
    cross_section: $("c_mm").value,
    protection: $("c_prot").value,
    in_a: $("c_in").value,
    trip_s: $("c_trip").value,
    zm_ohm: "",
    insulation: {
      n_pe: $("i_npe").value,
      l1_pe: $("i_l1pe").value,
      l1_n: $("i_l1n").value,
      l2_pe: $("c_phases").value === "3" ? $("i_l2pe").value : "",
      l2_n: $("c_phases").value === "3" ? $("i_l2n").value : "",
      l3_pe: $("c_phases").value === "3" ? $("i_l3pe").value : "",
      l3_n: $("c_phases").value === "3" ? $("i_l3n").value : "",
      l1_l2: $("c_phases").value === "3" ? $("i_l1l2").value : "",
      l1_l3: $("c_phases").value === "3" ? $("i_l1l3").value : "",
      l2_l3: $("c_phases").value === "3" ? $("i_l2l3").value : "",
    },
  };
  board.circuits = board.circuits || [];
  const editing = editingCircuit && editingCircuit.boardId === board.id
    && board.circuits[editingCircuit.index] != null;
  if (editing) {
    board.circuits[editingCircuit.index] = circuit;
  } else {
    board.circuits.push(circuit);
  }
  clearCircuitForm();
  saveJob();
  renderBoards();
  renderCircuits();
  refreshBilling();
  toast(`Tokokrog shranjen (${circuitCount()})`);
};

$("new_circuit").onclick = () => {
  clearCircuitForm();
  toast("Nov tokokrog");
};

$("circuit_board").onchange = () => {
  selectedBoardId = $("circuit_board").value;
  updateCircuitPathHint();
};

$("visual_board").onchange = () => {
  selectedBoardId = $("visual_board").value;
  renderVisual();
};

$("export_btn").onclick = () => {
  saveJob();
  applyBillingSnapshot();
  persistJob();
  const blob = new Blob([JSON.stringify(job, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  const slug = (job.site.name || job.meta.place || "meritev").replace(/\s+/g, "_");
  a.href = URL.createObjectURL(blob);
  a.download = `${slug}_${job.meta.date || "job"}.json`;
  a.click();
};

$("save_server").onclick = async () => {
  saveJob();
  applyBillingSnapshot();
  persistJob();
  const name = (job.site.name || job.meta.place || "job").replace(/\s+/g, "_");
  try {
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${name}_${job.meta.date}`, job }),
    });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    toast("Shranjeno: " + data.saved);
  } catch (err) {
    toast("Strežnik ni dosegljiv — uporabi Prenesi JSON");
  }
};

$("import_file").onchange = async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  try {
    job = normalizeJob(JSON.parse(await file.text()));
    editingCircuit = null;
    editingRcd = null;
    selectedBoardId = null;
    activateTab("job", { save: false });
    fillFormFromJob();
    setEditMode(null);
    setRcdEditMode(null);
    persistJob();
    toast("Uvoženo");
  } catch (err) {
    console.error(err);
    toast("Neveljavna JSON datoteka");
  }
  ev.target.value = "";
};

$("reset_job").onclick = () => {
  if (!confirm("Zavreči trenutni vnos na telefonu?")) return;
  job = emptyJob();
  selectedBoardId = null;
  editingCircuit = null;
  editingRcd = null;
  activateTab("job", { save: false });
  fillFormFromJob();
  setEditMode(null);
  setRcdEditMode(null);
  persistJob();
};

["date","report_number","inspection_kind","place","site_name","site_address","client_name","earthing_system","rpe_ohm","phases","main_fuse"]
  .forEach((id) => $(id).addEventListener("change", saveJob));
OBJECT_FIELDS.forEach(([id]) => $(id).addEventListener("change", saveJob));

["bill_base","bill_included","bill_extra","bill_discount","bill_note"]
  .forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("change", () => {
      saveJob();
      refreshBilling();
    });
    el.addEventListener("input", () => {
      readBillingFromForm();
      refreshBilling();
    });
  });

$("c_kind").addEventListener("change", syncKindPhases);
$("c_phases").addEventListener("change", toggleThreePhase);
toggleThreePhase();

fillFormFromJob();
