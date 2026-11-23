const STORAGE_KEYS = {
  session: "serenia_session",
  citas: "serenia_demo_citas",
  habitos: "serenia_demo_habitos",
  metas: "serenia_demo_metas"
};

const state = {
  citas: [
    { idCita: 1, modalidad: "VIRTUAL", estado: "PENDIENTE", tipo: "PSICOLOGIA", motivo: "Sesión inicial", fechaCita: "2026-11-26T10:00:00", idUsuario: 1, idTerapeuta: 1 },
    { idCita: 2, modalidad: "PRESENCIAL", estado: "REALIZADA", tipo: "TERAPIA", motivo: "Seguimiento", fechaCita: "2026-11-20T15:30:00", idUsuario: 1, idTerapeuta: 2 }
  ],
  habitos: [
    { idHabito: 1, nombre: "Respiración consciente", descripcion: "10 minutos antes de dormir", frecuencia: "DIARIA", metaDiaria: "1 sesión", idCategoria: 1 },
    { idHabito: 2, nombre: "Caminata al aire libre", descripcion: "Paseo sin celular", frecuencia: "SEMANAL", metaDiaria: "30 minutos", idCategoria: 2 }
  ],
  metas: [
    { idMeta: 1, titulo: "Dormir 7 horas diarias", descripcion: "Mantener horario constante", estado: "EN_CURSO" },
    { idMeta: 2, titulo: "Registrar estado de ánimo", descripcion: "Completar el diario cada noche", estado: "PROGRAMADA" }
  ]
};

const $ = (id) => document.getElementById(id);

function isDemoMode() {
  return $("demoModeToggle").checked;
}

function getBaseUrl() {
  return $("apiUrlInput").value.trim().replace(/\/+$/, "");
}

function showBanner(message, type = "ok") {
  const banner = $("feedbackBanner");
  banner.textContent = message;
  banner.className = `banner ${type}`;
  setTimeout(() => {
    banner.className = "banner hidden";
  }, 4500);
}

function getSession() {
  const raw = localStorage.getItem(STORAGE_KEYS.session);
  return raw ? JSON.parse(raw) : null;
}

function setSession(session) {
  if (session) {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEYS.session);
  }
  syncAuthView();
}

function syncAuthView() {
  const session = getSession();
  if (session) {
    $("authSection").classList.add("hidden");
    $("appSection").classList.remove("hidden");
    $("btnLogout").classList.remove("hidden");
    $("userBadge").textContent = `${session.nombre || session.email}`;
    loadCitas();
    loadHabitos();
    loadMetas();
  } else {
    $("authSection").classList.remove("hidden");
    $("appSection").classList.add("hidden");
    $("btnLogout").classList.add("hidden");
    $("userBadge").textContent = "Invitado";
  }
}

async function apiRequest(path, options = {}) {
  const session = getSession();
  const headers = {
    "Content-Type": "application/json",
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const errMsg = data?.mensaje || data?.error || `Error HTTP ${response.status}`;
    throw new Error(errMsg);
  }
  return data;
}

// --- AUTENTICACIÓN ---
$("tabLogin").addEventListener("click", () => {
  $("tabLogin").classList.add("active");
  $("tabRegister").classList.remove("active");
  $("loginForm").classList.remove("hidden");
  $("registerForm").classList.add("hidden");
});

$("tabRegister").addEventListener("click", () => {
  $("tabRegister").classList.add("active");
  $("tabLogin").classList.remove("active");
  $("registerForm").classList.remove("hidden");
  $("loginForm").classList.add("hidden");
});

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  if (isDemoMode()) {
    setSession({ email, nombre: email.split("@")[0], token: "demo-token" });
    showBanner("Sesión iniciada en modo demo.");
    return;
  }

  try {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    setSession({
      email,
      nombre: data?.nombre || email.split("@")[0],
      token: data?.token || ""
    });
    showBanner("Sesión iniciada con el backend.");
  } catch (err) {
    showBanner(`No se pudo iniciar sesión: ${err.message}`, "err");
  }
});

$("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nombre = $("regNombre").value.trim();
  const email = $("regEmail").value.trim();
  const password = $("regPassword").value;

  if (isDemoMode()) {
    setSession({ email, nombre, token: "demo-token" });
    showBanner("Cuenta registrada en modo demo.");
    return;
  }

  try {
    const data = await apiRequest("/auth/registro", {
      method: "POST",
      body: JSON.stringify({ nombre, email, password })
    });
    setSession({
      email,
      nombre: data?.nombre || nombre,
      token: data?.token || ""
    });
    showBanner("Registro exitoso en el backend.");
  } catch (err) {
    showBanner(`Error en registro: ${err.message}`, "err");
  }
});

$("btnLogout").addEventListener("click", () => {
  setSession(null);
});

// --- NAVEGACIÓN ENTRE MÓDULOS ---
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const target = btn.dataset.module;
    document.querySelectorAll(".module-panel").forEach((panel) => {
      panel.classList.toggle("hidden", panel.id !== `module-${target}`);
    });
  });
});

// --- CITAS ---
async function loadCitas() {
  const estado = $("filtroEstadoCita").value;
  let items = [];

  if (isDemoMode()) {
    items = estado ? state.citas.filter((c) => c.estado === estado) : state.citas;
    renderCitas(items);
    return;
  }

  try {
    const query = estado ? `?estado=${encodeURIComponent(estado)}` : "";
    const data = await apiRequest(`/citas/listar${query}`);
    items = Array.isArray(data) ? data : [];
    renderCitas(items);
  } catch (err) {
    showBanner(`Error cargando citas: ${err.message}`, "err");
  }
}

function renderCitas(items) {
  const container = $("citasList");
  if (!items.length) {
    container.innerHTML = `<p class="item-meta">No hay citas registradas.</p>`;
    return;
  }
  container.innerHTML = items.map((c) => `
    <div class="item">
      <div class="item-title">#${c.idCita ?? "-"} · ${c.tipo || "Cita"} (${c.modalidad || "-"})</div>
      <div class="item-meta">Estado: <strong>${c.estado || "PENDIENTE"}</strong> · Motivo: ${c.motivo || "-"}</div>
      <div class="item-meta">Fecha: ${c.fechaCita || "-"} · Usuario ID: ${c.idUsuario ?? "-"}</div>
    </div>
  `).join("");
}

$("citaForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    modalidad: $("citaModalidad").value,
    estado: "PENDIENTE",
    tipo: $("citaTipo").value.trim(),
    motivo: $("citaMotivo").value.trim(),
    fechaCita: $("citaFecha").value.length === 16 ? `${$("citaFecha").value}:00` : $("citaFecha").value,
    idUsuario: Number($("citaIdUsuario").value),
    idTerapeuta: $("citaIdTerapeuta").value ? Number($("citaIdTerapeuta").value) : null
  };

  if (isDemoMode()) {
    const nextId = state.citas.length ? Math.max(...state.citas.map((x) => x.idCita || 0)) + 1 : 1;
    state.citas.unshift({ idCita: nextId, ...payload });
    e.target.reset();
    $("citaIdUsuario").value = "1";
    $("citaIdTerapeuta").value = "1";
    loadCitas();
    showBanner("Cita agendada en modo demo.");
    return;
  }

  try {
    await apiRequest("/citas/nuevo", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    e.target.reset();
    loadCitas();
    showBanner("Cita creada correctamente.");
  } catch (err) {
    showBanner(`No se pudo crear la cita: ${err.message}`, "err");
  }
});

$("btnReloadCitas").addEventListener("click", loadCitas);
$("filtroEstadoCita").addEventListener("change", loadCitas);

// --- HÁBITOS ---
async function loadHabitos() {
  if (isDemoMode()) {
    renderHabitos(state.habitos);
    return;
  }

  try {
    const data = await apiRequest("/habitos/listar");
    renderHabitos(Array.isArray(data) ? data : []);
  } catch (err) {
    showBanner(`Error cargando hábitos: ${err.message}`, "err");
  }
}

function renderHabitos(items) {
  const container = $("habitosList");
  if (!items.length) {
    container.innerHTML = `<p class="item-meta">No hay hábitos registrados.</p>`;
    return;
  }
  container.innerHTML = items.map((h) => `
    <div class="item">
      <div class="item-title">#${h.idHabito ?? "-"} · ${h.nombre}</div>
      <div class="item-meta">${h.descripcion || "-"}</div>
      <div class="item-meta">Frecuencia: ${h.frecuencia} · Meta diaria: ${h.metaDiaria} · Cat ID: ${h.idCategoria}</div>
    </div>
  `).join("");
}

$("habitoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    nombre: $("habitoNombre").value.trim(),
    descripcion: $("habitoDescripcion").value.trim(),
    frecuencia: $("habitoFrecuencia").value,
    metaDiaria: $("habitoMetaDiaria").value.trim(),
    idCategoria: Number($("habitoIdCategoria").value)
  };

  if (isDemoMode()) {
    const nextId = state.habitos.length ? Math.max(...state.habitos.map((x) => x.idHabito || 0)) + 1 : 1;
    state.habitos.unshift({ idHabito: nextId, ...payload });
    e.target.reset();
    $("habitoIdCategoria").value = "1";
    loadHabitos();
    showBanner("Hábito registrado en modo demo.");
    return;
  }

  try {
    await apiRequest("/habitos/nueva", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    e.target.reset();
    loadHabitos();
    showBanner("Hábito registrado correctamente.");
  } catch (err) {
    showBanner(`No se pudo registrar el hábito: ${err.message}`, "err");
  }
});

$("btnReloadHabitos").addEventListener("click", loadHabitos);

// --- METAS ---
async function loadMetas() {
  if (isDemoMode()) {
    renderMetas(state.metas);
    return;
  }

  try {
    const data = await apiRequest("/metas/listar");
    renderMetas(Array.isArray(data) ? data : []);
  } catch (err) {
    showBanner(`Error cargando metas: ${err.message}`, "err");
  }
}

function renderMetas(items) {
  const container = $("metasList");
  if (!items.length) {
    container.innerHTML = `<p class="item-meta">No hay metas registradas.</p>`;
    return;
  }
  container.innerHTML = items.map((m) => `
    <div class="item">
      <div class="item-title">#${m.idMeta ?? "-"} · ${m.titulo}</div>
      <div class="item-meta">${m.descripcion || "-"} · Estado: <strong>${m.estado}</strong></div>
    </div>
  `).join("");
}

$("metaForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    titulo: $("metaTitulo").value.trim(),
    descripcion: $("metaDescripcion").value.trim(),
    estado: $("metaEstado").value
  };

  if (isDemoMode()) {
    const nextId = state.metas.length ? Math.max(...state.metas.map((x) => x.idMeta || 0)) + 1 : 1;
    state.metas.unshift({ idMeta: nextId, ...payload });
    e.target.reset();
    loadMetas();
    showBanner("Meta creada en modo demo.");
    return;
  }

  try {
    await apiRequest("/metas/nueva", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    e.target.reset();
    loadMetas();
    showBanner("Meta creada correctamente.");
  } catch (err) {
    showBanner(`No se pudo crear la meta: ${err.message}`, "err");
  }
});

$("btnReloadMetas").addEventListener("click", loadMetas);

// Inicializar vista
syncAuthView();