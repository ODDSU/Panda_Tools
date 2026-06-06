let jugadores = JSON.parse(localStorage.getItem('commander_jugadores')) || [];
let historial = JSON.parse(localStorage.getItem('commander_historial')) || [];
let contadorManual = 0; 
const puntosGlobales = [4, 3, 2, 1, 0]; 

let ventanaTV = null;
let ultimasMesasGeneradas = []; 

let mostrarTodosJugadores = false;
let isModoEdicionExcel = false; 
const jornadasLista = ['J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7', 'J8', 'Semifinal', 'Final'];
let indiceJornadaActual = 0;

// --- SISTEMA DE PESTAÑAS (TABS) ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).style.display = 'block';
    // Buscamos el botón correspondiente para activarlo visualmente
    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(tabId));
    if (btn) btn.classList.add('active');
}

// --- SISTEMA DE NOTIFICACIONES (TOASTS) ---
function mostrarToast(mensaje, tipo = 'success') {
    const contenedor = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    
    let icono = '✅';
    if (tipo === 'danger') icono = '❌';
    if (tipo === 'warning') icono = '⚠️';
    
    toast.innerHTML = `<span>${icono}</span> <span>${mensaje}</span>`;
    contenedor.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        toast.style.opacity = '0';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- SISTEMA DE MODAL INTEGRADO ---
function abrirModal(titulo, htmlContenido, alConfirmar) {
    document.getElementById('modal-title').innerText = titulo;
    document.getElementById('modal-body').innerHTML = htmlContenido;
    const btnSubmit = document.getElementById('modal-submit-btn');
    
    const nuevoBtn = btnSubmit.cloneNode(true);
    btnSubmit.parentNode.replaceChild(nuevoBtn, btnSubmit);
    
    nuevoBtn.onclick = function() {
        if (alConfirmar()) cerrarModal();
    };
    document.getElementById('modal-overlay').style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('modal-overlay').style.display = 'none';
}

// --- FUNCIONES CORE MODIFICADAS ---
function cambiarJornada(direccion) {
    indiceJornadaActual += direccion;
    if (indiceJornadaActual < 0) indiceJornadaActual = 0;
    if (indiceJornadaActual >= jornadasLista.length) indiceJornadaActual = jornadasLista.length - 1;
    document.getElementById('display-jornada').innerText = jornadasLista[indiceJornadaActual];
    localStorage.setItem('commander_jornada_activa', indiceJornadaActual);
}

function toggleMostrarTodos() {
    mostrarTodosJugadores = !mostrarTodosJugadores;
    renderizarClasificacion();
}

function toggleFullscreen() {
    const card = document.getElementById('tab-clasificacion');
    const btn = document.getElementById('btn-fullscreen');
    card.classList.toggle('fullscreen-card');
    if(card.classList.contains('fullscreen-card')) {
        btn.innerHTML = "↙️ Salir Pantalla Completa";
        mostrarTodosJugadores = true; 
    } else {
        btn.innerHTML = "🔲 Pantalla Completa";
        mostrarTodosJugadores = false;
    }
    renderizarClasificacion();
}

function guardarDatos() {
    localStorage.setItem('commander_jugadores', JSON.stringify(jugadores));
    localStorage.setItem('commander_historial', JSON.stringify(historial));
    actualizarUI();
}

// BUSCADOR INTELIGENTE EN CHECKIN
function filtrarCheckin() {
    const textoBusqueda = document.getElementById('buscador-checkin').value.toLowerCase();
    const contenedor = document.getElementById('jugadores-presentes');
    const etiquetas = contenedor.getElementsByTagName('label');

    Array.from(etiquetas).forEach(label => {
        const nombreJugador = label.textContent.toLowerCase();
        if (nombreJugador.includes(textoBusqueda)) {
            label.style.display = ''; 
        } else {
            label.style.display = 'none'; 
        }
    });
}

// REGISTRO LIMPIO POR LOTES (WHATSAPP PARSER)
function agregarJugadoresLote() {
    const textarea = document.getElementById('nuevos-jugadores');
    const texto = textarea.value;
    if (!texto.trim()) return;

    const nombres = texto.split(/[\n,]/);
    let añadidos = 0;

    nombres.forEach(nombreBruto => {
        let nombre = nombreBruto.replace(/^[\d.)\-*•\s\u2060]+/, '').trim();
        nombre = nombre.replace(/[.\s]+$/, '').trim();

        if (nombre !== "" && !jugadores.some(j => j.nombre.toLowerCase() === nombre.toLowerCase())) {
            jugadores.push({ id: Date.now() + Math.floor(Math.random() * 1000), nombre: nombre, puntos: 0, partidas: 0 });
            añadidos++;
        }
    });

    if (añadidos > 0) {
        textarea.value = ''; 
        guardarDatos(); 
        mostrarToast(`Registrados ${añadidos} jugadores correctamente.`);
    } else {
        mostrarToast("No se encontraron nombres nuevos válidos.", "warning");
    }
}

// --- VALIDACIÓN DE MESAS GLOBAL (FIX CRISTIAN DUPLICADOS) ---
function actualizarDesplegables() {
    const contenedor = document.getElementById('mesas-generadas');
    if (!contenedor) return;

    // Buscamos absolutamente todos los selects de las mesas mostradas en pantalla
    const todosLosSelects = contenedor.querySelectorAll('select');
    const idsSeleccionados = Array.from(todosLosSelects).map(s => s.value).filter(v => v !== "");

    todosLosSelects.forEach(select => {
        const valorActual = select.value;
        Array.from(select.options).forEach(opt => {
            if (opt.value === "") return;
            
            // Si el jugador ya está en uso en CUALQUIER desplegable de la ronda
            if (idsSeleccionados.includes(opt.value) && opt.value !== valorActual) {
                opt.disabled = true;
                if (!opt.text.includes(" (Asignado)")) {
                    opt.text = opt.text.replace(" (Ya asignado)", "") + " (Asignado)";
                }
            } else {
                opt.disabled = false;
                opt.text = opt.text.replace(" (Asignado)", "").replace(" (Ya asignado)", "");
            }
        });
    });
}

// --- EDICIÓN EXCEL ---
function activarEdicionExcel() {
    isModoEdicionExcel = true;
    mostrarTodosJugadores = true; 
    switchTab('tab-clasificacion');
    document.getElementById('modo-clasificacion').style.display = 'none';
    document.getElementById('excel-controls').style.display = 'flex';
    renderizarClasificacion();
}

function cancelarEdicionExcel() {
    isModoEdicionExcel = false;
    document.getElementById('modo-clasificacion').style.display = 'block';
    document.getElementById('excel-controls').style.display = 'none';
    document.getElementById('modo-clasificacion').value = 'general';
    actualizarUI();
}

function actualizarFilaExcel(inputEl) {
    let tr = inputEl.closest('tr');
    let inputs = tr.querySelectorAll('.excel-cell');
    let total = 0;
    inputs.forEach(inp => {
        let val = parseInt(inp.value);
        if (!isNaN(val)) total += val;
    });
    let celdaTotal = tr.querySelector('.excel-total');
    if(celdaTotal) celdaTotal.innerText = total;
}

function guardarEdicionExcel() {
    let inputs = document.querySelectorAll('.excel-cell');
    let cambiosGuardados = false;

    inputs.forEach(inp => {
        let idJugador = parseInt(inp.getAttribute('data-jid'));
        let jornada = inp.getAttribute('data-jor');
        let valorNuevo = parseInt(inp.value) || 0;
        let valorViejo = parseInt(inp.defaultValue) || 0; 

        if (valorNuevo !== valorViejo) {
            let diferencia = valorNuevo - valorViejo;
            let jugador = jugadores.find(j => j.id === idJugador);

            if (jugador) {
                jugador.puntos += diferencia;
                let etiquetaGuardado = jornada === "BASE" ? "Ajuste Manual" : jornada;

                historial.unshift({
                    id: Date.now() + Math.floor(Math.random() * 10000), 
                    fecha: etiquetaGuardado,
                    resultados: [{ idJugador: jugador.id, nombre: jugador.nombre, puntos: diferencia, posicion: "-" }]
                });
                cambiosGuardados = true;
            }
        }
    });

    if (cambiosGuardados) {
        mostrarToast("Puntuaciones guardadas con éxito.");
        guardarDatos();
    }
    
    isModoEdicionExcel = false;
    document.getElementById('modo-clasificacion').style.display = 'block';
    document.getElementById('excel-controls').style.display = 'none';
    document.getElementById('modo-clasificacion').value = 'general';
    actualizarUI();
}

function eliminarJugador(id) {
    const jugador = jugadores.find(j => j.id === id);
    abrirModal("🗑️ Borrar Jugador", `<p>¿Estás seguro de que deseas eliminar a <b>${jugador.nombre}</b>? Se perderá todo su historial de puntos.</p>`, () => {
        jugadores = jugadores.filter(j => j.id !== id);
        guardarDatos();
        mostrarToast("Jugador eliminado correctamente.", "danger");
        return true;
    });
}

function anularResultado(idHistorial) {
    abrirModal("⚠️ Anular Mesa", "<p>¿Seguro que quieres anular esta mesa? Se recalcularán y restarán las puntuaciones correspondientes.</p>", () => {
        const index = historial.findIndex(h => h.id === idHistorial);
        if(index === -1) return false;
        
        historial[index].resultados.forEach(detalle => {
            let jugador = jugadores.find(j => j.id == detalle.idJugador);
            if(jugador) {
                jugador.puntos = Math.max(0, jugador.puntos - detalle.puntos);
                jugador.partidas = Math.max(0, jugador.partidas - 1);
            }
        });
        historial.splice(index, 1);
        guardarDatos();
        mostrarToast("Mesa anulada con éxito.", "warning");
        return true;
    });
}

function solicitarReiniciarApp() {
    abrirModal("⚠️ BORRADO COMPLETO", `
        <p>Esta acción eliminará de forma irreversible todos los jugadores e historial de la base de datos.</p>
        <p>Escribe <b>BORRAR</b> abajo para confirmar:</p>
        <input type="text" id="confirm-delete-input" autocomplete="off">
    `, () => {
        const val = document.getElementById('confirm-delete-input').value;
        if (val === "BORRAR") {
            jugadores = []; historial = [];
            localStorage.removeItem('commander_jugadores');
            localStorage.removeItem('commander_historial');
            document.getElementById('mesas-generadas').innerHTML = '';
            actualizarUI();
            mostrarToast("Base de datos completamente formateada.", "danger");
            return true;
        } else {
            mostrarToast("Confirmación errónea. No se borró nada.", "warning");
            return false;
        }
    });
}

// --- REPARTO DE JUEGO Y SUIZO ---
function generarMesas(modo = 'aleatorio') {
    const checkboxes = document.querySelectorAll('.check-jugador:checked');
    let presentes = Array.from(checkboxes).map(cb => jugadores.find(j => j.id == cb.value));
    const P = presentes.length;

    if (P < 3) { mostrarToast("Hacen falta al menos 3 jugadores para abrir mesa.", "warning"); return; }

    let nombreJornada = jornadasLista[indiceJornadaActual];
    let puntosHoy = {};
    let partidasHoy = {}; 
    let sumatorioPuntosHoy = 0; 

    presentes.forEach(j => { puntosHoy[j.id] = 0; partidasHoy[j.id] = 0; });
    
    historial.forEach(h => {
        let fechaPartida = h.fecha.split(',')[0].trim();
        if (fechaPartida === nombreJornada) {
            h.resultados.forEach(r => {
                if (puntosHoy[r.idJugador] !== undefined) {
                    puntosHoy[r.idJugador] += r.puntos;
                    partidasHoy[r.idJugador] += 1; 
                    sumatorioPuntosHoy += r.puntos;
                }
            });
        }
    });

    let rondaActual = Math.max(...Object.values(partidasHoy)) + 1;

    for (let i = P - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [presentes[i], presentes[j]] = [presentes[j], presentes[i]];
    }

    if (modo === 'suizo') {
        if (sumatorioPuntosHoy === 0) {
            mostrarToast("1ª Ronda: Mesas configuradas aleatoriamente (Suizo puro inicia en Ronda 2).", "warning");
        } else {
            presentes.sort((a, b) => {
                if (puntosHoy[b.id] !== puntosHoy[a.id]) return puntosHoy[b.id] - puntosHoy[a.id];
                return b.puntos - a.puntos;
            });
        }
    }

    let mesas_de_4 = Math.floor(P / 4);
    let mesas_de_3 = 0; let mesas_de_5 = 0; let resto = P % 4;

    if (resto === 1) {
        if (mesas_de_4 === 1) { mesas_de_4 = 0; mesas_de_5 = 1; } 
        else { mesas_de_4 -= 2; mesas_de_3 += 3; }
    } else if (resto === 2) { mesas_de_4 -= 1; mesas_de_3 += 2;
    } else if (resto === 3) { mesas_de_3 += 1; }

    let mesas = []; let indexJugador = 0;
    for (let i = 0; i < mesas_de_4; i++) { mesas.push(presentes.slice(indexJugador, indexJugador + 4)); indexJugador += 4; }
    for (let i = 0; i < mesas_de_3; i++) { mesas.push(presentes.slice(indexJugador, indexJugador + 3)); indexJugador += 3; }
    for (let i = 0; i < mesas_de_5; i++) { mesas.push(presentes.slice(indexJugador, indexJugador + 5)); indexJugador += 5; }

    ultimasMesasGeneradas = mesas;
    mostrarMesas(mesas, modo, puntosHoy, rondaActual);
}

function mostrarMesas(mesas, modo = 'aleatorio', puntosHoy = {}, rondaActual = 1) {
    const contenedor = document.getElementById('mesas-generadas');
    contenedor.innerHTML = '';

    if(mesas.length > 0) {
        contenedor.innerHTML += `<button class="btn-tv" onclick="abrirModoTV()">📺 PROYECTAR EN TV DE LA TIENDA</button>`;
    }

    let tituloMesa = modo === 'suizo' ? `🏆 Suizo (R1) - Mesa` : `🔮 Aleatorio (R1) - Mesa`;
    let colorTitulo = modo === 'suizo' ? '#ef4444' : '#a855f7';

    mesas.forEach((mesa, index) => {
        let html = `<div class="pod" id="pod-${index}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <h3 style="color: ${colorTitulo}; margin: 0;">Mesa ${index + 1} <span id="span-count-${index}" style="font-size:12px; color:#94a3b8; font-weight:normal;">(${mesa.length} Jugadores)</span></h3>
                <button class="btn-header" style="padding: 4px 10px; font-size: 11px;" onclick="forzarJugadorEnMesa(${index})">➕ Añadir Tarde</button>
            </div>`;
        
        const nombresMesa = mesa.map(j => {
            let textoPuntos = modo === 'suizo' ? ` <span style="color:#fcd34d; font-size:11px;">(${puntosHoy[j.id]}p)</span>` : '';
            return `${j.nombre}${textoPuntos}`;
        }).join(' <span style="color:#64748b;">•</span> ');
        
        html += `<div class="nombres-mesa" style="margin-top: 10px;">⚡ ${nombresMesa}</div>`;
        html += `<div id="selects-pod-${index}">`;
        
        for(let i=0; i < mesa.length; i++) {
            html += `<div class="puesto-row" id="pod-${index}-puesto-${i}">
                     <label>${i+1}º PUESTO (+${puntosGlobales[i]} PTS):</label>
                     <select id="sel-pod-${index}-pos-${i}" onchange="actualizarDesplegables()">
                        <option value="">-- Elige el ganador/puesto --</option>`;
            mesa.forEach(jugador => { html += `<option value="${jugador.id}">${jugador.nombre}</option>`; });
            html += `</select></div>`;
        }
        html += `</div>`;

        html += `<div id="btns-pod-${index}" style="display: flex; gap: 10px; margin-top: 15px;">
                    <button class="btn-primary btn-green" style="flex: 2; padding:10px;" onclick="guardarResultadoMesa('pod-${index}', ${mesa.length})">💾 Confirmar</button>
                    <button class="btn-secondary" style="flex: 1.5; padding:10px;" onclick="declararEmpate('pod-${index}', ${mesa.length})">⏱️ Empate</button>
                 </div></div>`;
                 
        contenedor.innerHTML += html;
    });
    // Forzamos un refresco inicial por si hay algún autocompletado del navegador
    setTimeout(actualizarDesplegables, 100);
}

function forzarJugadorEnMesa(index) {
    const contenedorSelects = document.getElementById(`selects-pod-${index}`);
    let numJugadores = contenedorSelects.querySelectorAll('.puesto-row').length;
    if (numJugadores >= 5) { mostrarToast("Límite crítico: Máximo 5 jugadores.", "warning"); return; }

    let i = numJugadores;
    let puntos = puntosGlobales[i] !== undefined ? puntosGlobales[i] : 0;

    let htmlNuevoSelect = `<div class="puesto-row" id="pod-${index}-puesto-${i}">
        <label>${i+1}º PUESTO (+${puntos} PTS):</label>
        <select id="sel-pod-${index}-pos-${i}" onchange="actualizarDesplegables()">
            <option value="">-- Elige jugador que llegó tarde --</option>`;
    
    jugadores.forEach(jugador => { htmlNuevoSelect += `<option value="${jugador.id}">${jugador.nombre}</option>`; });
    htmlNuevoSelect += `</select></div>`;
    
    contenedorSelects.insertAdjacentHTML('beforeend', htmlNuevoSelect);
    document.getElementById(`span-count-${index}`).innerText = `(${numJugadores + 1} Jugadores)`;

    const contenedorBtns = document.getElementById(`btns-pod-${index}`);
    contenedorBtns.innerHTML = `
        <button class="btn-primary btn-green" style="flex: 2; padding:10px;" onclick="guardarResultadoMesa('pod-${index}', ${numJugadores + 1})">💾 Confirmar</button>
        <button class="btn-secondary" style="flex: 1.5; padding:10px;" onclick="declararEmpate('pod-${index}', ${numJugadores + 1})">⏱️ Empate</button>
    `;
    actualizarDesplegables();
}

function guardarResultadoMesa(prefijoMesa, numJugadores) {
    let idsSeleccionados = new Set();
    let detallesMesa = [];

    for(let i=0; i < numJugadores; i++) {
        const selectEl = document.getElementById(`sel-${prefijoMesa}-pos-${i}`);
        if(!selectEl) continue;

        const idJugador = selectEl.value;
        if(!idJugador) {
            if (i < 3) { mostrarToast(`Asigna los puestos del podio (mínimo 3 obligatorios).`, "warning"); return; } 
            else continue;
        }

        if(idsSeleccionados.has(idJugador)) { mostrarToast("¡Jugador repetido detectado en la mesa!", "danger"); return; }
        idsSeleccionados.add(idJugador);

        const nombreLimpio = selectEl.options[selectEl.selectedIndex].text.replace(" (Asignado)", "");
        detallesMesa.push({ idJugador: idJugador, nombre: nombreLimpio, puntos: puntosGlobales[i], posicion: i + 1 });
    }
    
    procesarGuardado(detallesMesa, prefijoMesa);
    mostrarToast("Resultado de mesa guardado e indexado.");
}

function declararEmpate(prefijoMesa, numJugadores) {
    let idsAsignados = new Set();
    let detallesMesa = [];
    let puntosUsados = 0;
    let selectBase = null;

    for(let i=0; i < numJugadores; i++) {
        const selectEl = document.getElementById(`sel-${prefijoMesa}-pos-${i}`);
        if(!selectBase && selectEl) selectBase = selectEl; 
        if(selectEl && selectEl.value) {
            idsAsignados.add(selectEl.value);
            const nombreLimpio = selectEl.options[selectEl.selectedIndex].text.replace(" (Asignado)", "");
            detallesMesa.push({ idJugador: selectEl.value, nombre: nombreLimpio, puntos: puntosGlobales[i], posicion: i + 1 });
            puntosUsados += puntosGlobales[i];
        }
    }

    let todosIds = []; let todosNombres = {};
    Array.from(selectBase.options).forEach(opt => {
        if(opt.value !== "") {
            todosIds.push(opt.value);
            todosNombres[opt.value] = opt.text.replace(" (Asignado)", "");
        }
    });

    let idsRestantes = todosIds.filter(id => !idsAsignados.has(id));
    if (idsRestantes.length < 2) { mostrarToast("Deja vacíos al menos 2 puestos para empatar entre ellos.", "warning"); return; }

    let puntosTotalesMesa = 0;
    for(let i=0; i < numJugadores; i++) puntosTotalesMesa += puntosGlobales[i];
    
    let puntosRestantes = puntosTotalesMesa - puntosUsados;
    let puntosPorEmpate = Math.floor(puntosRestantes / idsRestantes.length);

    idsRestantes.forEach(id => {
        detallesMesa.push({ idJugador: id, nombre: todosNombres[id], puntos: puntosPorEmpate, posicion: "Empate" });
    });

    let htmlMensaje = "<ul>";
    detallesMesa.forEach(d => { htmlMensaje += `<li><b>${d.posicion}:</b> ${d.nombre} (+${d.puntos} pts)</li>`; });
    htmlMensaje += "</ul>";

    abrirModal("⏱️ ¿Confirmar Empate de Mesa?", htmlMensaje, () => {
        procesarGuardado(detallesMesa, prefijoMesa);
        mostrarToast("Empate registrado.");
        return true;
    });
}

function procesarGuardado(detallesMesa, idElemento) {
    detallesMesa.forEach(detalle => {
        let jugador = jugadores.find(j => j.id == detalle.idJugador);
        if(jugador) { jugador.puntos += detalle.puntos; jugador.partidas += 1; }
    });

    let nombreJornada = jornadasLista[indiceJornadaActual] || "J1";
    let fechaGuardado = `${nombreJornada}, ${new Date().toLocaleTimeString()}`;
    historial.unshift({ id: Date.now(), fecha: fechaGuardado, resultados: detallesMesa });
    
    const mesaGuardada = document.getElementById(idElemento);
    if(mesaGuardada) {
        mesaGuardada.style.opacity = '0';
        setTimeout(() => { mesaGuardada.style.display = 'none'; actualizarDesplegables(); }, 300);
    }
    guardarDatos(); 
}

// --- RENDERS DE CLASIFICACIÓN RESPONSIVA ---
function renderizarClasificacion() {
    const modo = isModoEdicionExcel ? 'excel' : document.getElementById('modo-clasificacion').value;
    const bodyClasificacion = document.getElementById('body-clasificacion');
    const theadClasificacion = document.querySelector('#tabla-clasificacion thead');
    let datosClasificacion = [];

    if (modo === 'excel') {
        let jornadasUnicas = [];
        historial.forEach(h => {
            let fecha = h.fecha.split(',')[0].trim();
            if (!jornadasUnicas.includes(fecha)) { jornadasUnicas.push(fecha); }
        });
        
        jornadasUnicas.sort((a, b) => {
            let numA = a.match(/\d+/) ? parseInt(a.match(/\d+/)[0]) : NaN;
            let numB = b.match(/\d+/) ? parseInt(b.match(/\d+/)[0]) : NaN;
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b);
        });

        let statsTemp = {};
        jugadores.forEach(j => {
            statsTemp[j.id] = { id: j.id, nombre: j.nombre, totalGuardado: j.puntos, sumaHistorial: 0, previo: 0, jornadas: {} };
            jornadasUnicas.forEach(jor => statsTemp[j.id].jornadas[jor] = 0);
        });

        historial.forEach(h => {
            let fechaPartida = h.fecha.split(',')[0].trim();
            h.resultados.forEach(r => {
                if (statsTemp[r.idJugador]) {
                    statsTemp[r.idJugador].jornadas[fechaPartida] += r.puntos;
                    statsTemp[r.idJugador].sumaHistorial += r.puntos;
                }
            });
        });

        let mostrarPrevio = false;
        Object.values(statsTemp).forEach(st => {
            st.previo = st.totalGuardado - st.sumaHistorial;
            if (st.previo !== 0) mostrarPrevio = true;
        });

        let theadHTML = `<tr><th>Pos</th><th style="text-align:left;">Jugador</th>`;
        if (mostrarPrevio || isModoEdicionExcel) theadHTML += `<th style="color: #94a3b8;">Base</th>`;
        jornadasUnicas.forEach(j => { theadHTML += `<th>${j}</th>`; });
        theadHTML += `<th style="color: var(--primary);">Total</th></tr>`;
        theadClasificacion.innerHTML = theadHTML;

        datosClasificacion = Object.values(statsTemp).filter(j => isModoEdicionExcel || j.totalGuardado !== 0 || j.sumaHistorial !== 0 || j.previo !== 0);
        datosClasificacion.sort((a, b) => b.totalGuardado - a.totalGuardado);

        if(datosClasificacion.length === 0) {
            bodyClasificacion.innerHTML = `<tr><td colspan="100%" style="color:#64748b; font-style:italic; padding: 25px;">No hay datos para la cuadrícula.</td></tr>`;
            return;
        }

        let limite = mostrarTodosJugadores ? datosClasificacion.length : 15;
        let filasHTML = datosClasificacion.slice(0, limite).map((j, i) => {
            let medalla = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "";
            let claseFila = i === 0 ? "rango-1" : i === 1 ? "rango-2" : i === 2 ? "rango-3" : "";
            
            let row = `<tr class="${claseFila}">
                <td data-label="Pos" style="color:#64748b; font-weight:700;">${i + 1}</td>
                <td data-label="Jugador" style="text-align: left;"><span style="margin-right:8px;">${medalla}</span> ${j.nombre}</td>`;
            
            if (mostrarPrevio || isModoEdicionExcel) {
                if (isModoEdicionExcel) {
                    row += `<td data-label="Base"><input type="number" class="excel-cell" data-jid="${j.id}" data-jor="BASE" value="${j.previo}" oninput="actualizarFilaExcel(this)"></td>`;
                } else {
                    row += `<td data-label="Base" style="color:#94a3b8;">${j.previo !== 0 ? j.previo : '-'}</td>`;
                }
            }

            jornadasUnicas.forEach(jor => {
                let pts = j.jornadas[jor];
                if (isModoEdicionExcel) {
                    row += `<td data-label="${jor}"><input type="number" class="excel-cell" data-jid="${j.id}" data-jor="${jor}" value="${pts}" oninput="actualizarFilaExcel(this)"></td>`;
                } else {
                    row += `<td data-label="${jor}" style="color:#cbd5e1;">${pts !== 0 ? pts : '-'}</td>`;
                }
            });

            row += `<td data-label="Total" class="puntos-destacados excel-total" style="font-weight:700; background: rgba(139, 92, 246, 0.1);">${j.totalGuardado}</td></tr>`;
            return row;
        }).join('');
        
        bodyClasificacion.innerHTML = filasHTML;

    } else {
        theadClasificacion.innerHTML = `<tr><th>Pos</th><th style="text-align:left;">Jugador</th><th>Puntos</th><th>Partidas</th></tr>`;

        if (modo === 'general') {
            datosClasificacion = [...jugadores];
        } else {
            let statsTemp = {};
            jugadores.forEach(j => statsTemp[j.id] = { ...j, puntos: 0, partidas: 0 });

            historial.forEach(h => {
                let fechaPartida = h.fecha.split(',')[0].trim();
                if (fechaPartida === modo) {
                    h.resultados.forEach(r => {
                        if (statsTemp[r.idJugador]) {
                            statsTemp[r.idJugador].puntos += r.puntos;
                            if(r.posicion !== "-") { statsTemp[r.idJugador].partidas += 1; }
                        }
                    });
                }
            });
            datosClasificacion = Object.values(statsTemp).filter(j => j.puntos !== 0 || j.partidas > 0);
        }

        let ordenados = datosClasificacion.sort((a, b) => b.puntos - a.puntos);

        if(ordenados.length === 0) {
            bodyClasificacion.innerHTML = `<tr><td colspan="4" style="color:#64748b; font-style:italic; padding: 25px;">No hay registros cargados.</td></tr>`;
            return;
        }

        let limite = mostrarTodosJugadores ? ordenados.length : 15;
        let filasHTML = ordenados.slice(0, limite).map((j, i) => {
            let medalla = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "";
            let claseFila = i === 0 ? "rango-1" : i === 1 ? "rango-2" : i === 2 ? "rango-3" : "";
            
            return `<tr class="${claseFila}">
                <td data-label="Pos" style="color:#64748b; font-weight:700;">${i + 1}</td>
                <td data-label="Jugador" style="text-align: left;"><span style="margin-right:8px;">${medalla}</span> ${j.nombre}</td>
                <td data-label="Puntos" class="puntos-destacados" style="font-weight:700;">${j.puntos}</td>
                <td data-label="Partidas" style="color:#64748b;">${j.partidas} jugadas</td>
            </tr>`;
        }).join('');

        if (ordenados.length > 15) {
            let textBtn = mostrarTodosJugadores ? "Ocultar Excedente" : `Ver los ${ordenados.length - 15} jugadores restantes ▼`;
            filasHTML += `<tr><td colspan="100%" style="padding:0;"><button class="btn-ver-mas" onclick="toggleMostrarTodos()">${textBtn}</button></td></tr>`;
        }
        bodyClasificacion.innerHTML = filasHTML;
    }
}

function actualizarFiltroFechas() {
    const select = document.getElementById('modo-clasificacion');
    if (isModoEdicionExcel || !select) return; 
    const valorActual = select.value;

    let fechasUnicas = new Set();
    historial.forEach(h => { fechasUnicas.add(h.fecha.split(',')[0].trim()); });

    let opcionesHTML = `<option value="general">🌟 Clasificación General</option>`;
    opcionesHTML += `<option value="excel">📊 Vista Detallada (Excel)</option>`; 
    
    let jornadasOrdenadas = Array.from(fechasUnicas).sort((a, b) => {
        let numA = a.match(/\d+/) ? parseInt(a.match(/\d+/)[0]) : NaN;
        let numB = b.match(/\d+/) ? parseInt(b.match(/\d+/)[0]) : NaN;
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
    });

    jornadasOrdenadas.forEach(fecha => { opcionesHTML += `<option value="${fecha}">📅 ${fecha}</option>`; });
    select.innerHTML = opcionesHTML;
    select.value = Array.from(select.options).some(opt => opt.value === valorActual) ? valorActual : 'general';
}

function actualizarUI() {
    // Lista de borrar de jugadores
    document.getElementById('lista-jugadores').innerHTML = jugadores.map(j => 
        `<li>
            <div><strong style="font-size: 15px;">${j.nombre}</strong></div>
            <button class="btn-delete" onclick="eliminarJugador(${j.id})">ELIMINAR</button>
        </li>`
    ).join('');

    // Checkboxes del Generador de asistencia
    const checkboxesActivos = document.querySelectorAll('.check-jugador:checked');
    const idsActivos = new Set(Array.from(checkboxesActivos).map(cb => parseInt(cb.value)));

    document.getElementById('jugadores-presentes').innerHTML = jugadores.map(j => {
        let marcado = idsActivos.has(j.id) ? 'checked' : '';
        return `<label onclick="setTimeout(() => { document.getElementById('buscador-checkin').value = ''; filtrarCheckin(); document.getElementById('buscador-checkin').focus(); }, 50);"><input type="checkbox" class="check-jugador" value="${j.id}" ${marcado}> ${j.nombre}</label>`;
    }).join('');

    let guardadoJornada = localStorage.getItem('commander_jornada_activa');
    if(guardadoJornada !== null) {
        indiceJornadaActual = parseInt(guardadoJornada);
        if(isNaN(indiceJornadaActual) || indiceJornadaActual >= jornadasLista.length) indiceJornadaActual = 0;
    }
    document.getElementById('display-jornada').innerText = jornadasLista[indiceJornadaActual];

    actualizarFiltroFechas();
    renderizarClasificacion();

    // Historial
    const listaHistorial = document.getElementById('lista-historial');
    if(historial.length === 0) {
        listaHistorial.innerHTML = '<p style="color:#64748b; font-style:italic; padding: 10px;">Esperando la primera batalla de la liga...</p>';
    } else {
        let gruposPorFecha = {}; let fechasOrdenadas = [];
        historial.forEach(h => {
            let fecha = h.fecha.split(',')[0].trim();
            if (!gruposPorFecha[fecha]) { gruposPorFecha[fecha] = []; fechasOrdenadas.push(fecha); }
            gruposPorFecha[fecha].push(h);
        });

        let htmlHistorial = '';
        fechasOrdenadas.forEach((fecha, index) => {
            let openAttr = index === 0 ? 'open' : '';
            htmlHistorial += `<details class="historial-jornada" ${openAttr}><summary>📅 Jornada: ${fecha}</summary><div>`;
            gruposPorFecha[fecha].forEach(h => {
                let hora = h.fecha.split(',')[1] ? h.fecha.split(',')[1].trim() : '';
                let horaHtml = hora ? `<span class="historial-date">🕒 ${hora}</span>` : '';
                htmlHistorial += `
                    <div class="historial-item">
                        ${horaHtml}
                        <p>${h.resultados.map(r => `<strong style="color:var(--primary);">${r.posicion}${typeof r.posicion === 'number'?'º':''}</strong> ${r.nombre} <span style="color:var(--success); font-size:12px;">(+${r.puntos} pts)</span>`).join(' <span style="color:rgba(255,255,255,0.05); margin: 0 5px;">|</span> ')}</p>
                        <div style="text-align:right; margin-top: 5px;">
                            <button class="btn-delete" style="background:transparent; border:1px solid rgba(239, 68, 68, 0.3);" onclick="anularResultado(${h.id})">Anular Mesa</button>
                        </div>
                    </div>`;
            });
            htmlHistorial += `</div></details>`;
        });
        listaHistorial.innerHTML = htmlHistorial;
    }
}

// --- MODO TV POPUP MANTENIDO ---
function abrirModoTV() {
    if(ultimasMesasGeneradas.length === 0) { mostrarToast("Genera las mesas primero.", "warning"); return; }
    let ventanaEmergente = window.open("", "VentanaTVCommander", "width=1280,height=720");
    if (!ventanaEmergente) { mostrarToast("Pop-ups bloqueados por el navegador.", "warning"); return; }

    let numMesas = ultimasMesasGeneradas.length;
    let cols = 1; let rows = 1;
    if (numMesas === 2) { cols = 2; rows = 1; }
    else if (numMesas <= 4) { cols = 2; rows = 2; } 
    else if (numMesas <= 6) { cols = 3; rows = 2; }
    else if (numMesas <= 8) { cols = 4; rows = 2; }
    else { cols = 3; rows = Math.ceil(numMesas / 3); }

    let htmlPods = "";
    ultimasMesasGeneradas.forEach((mesa, index) => {
        htmlPods += `<div class="tv-pod"><h3>MESA ${index + 1}</h3>`;
        mesa.forEach(jugador => { htmlPods += `<div class="tv-player"><span class="tv-icon">⚡</span> ${jugador.nombre}</div>`; });
        htmlPods += `</div>`;
    });

    const htmlPantallaTV = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>TV</title><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700;900&display=swap" rel="stylesheet"><style>body{background:#09090e;color:white;font-family:'Poppins',sans-serif;margin:0;padding:2vh;box-sizing:border-box;height:100vh;display:flex;flex-direction:column;overflow:hidden;}.tv-title{font-size:4vh;font-weight:900;text-align:center;margin-bottom:2vh;background:linear-gradient(to right,#c084fc,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:4px;}.tv-grid{display:grid;grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rows},1fr);gap:2vh;flex-grow:1;}.tv-pod{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:20px;padding:20px;display:flex;flex-direction:column;justify-content:center;align-items:center;box-shadow:inset 0 0 20px rgba(139,92,246,0.1);position:relative;} .tv-pod::before{content:'';position:absolute;top:0;left:0;width:100%;height:4px;background:#f59e0b;border-radius:4px 4px 0 0;} h3{color:#f59e0b;margin:0 0 15px 0;font-size:3vh;font-weight:900;}.tv-player{font-size:2.5vh;font-weight:700;margin:4px 0;display:flex;align-items:center;gap:10px;}.tv-icon{color:#8b5cf6;}</style></head><body><div class="tv-title">EMPAREJAMIENTOS DE LA RONDA</div><div class="tv-grid">${htmlPods}</div></body></html>`;
    ventanaEmergente.document.open(); ventanaEmergente.document.write(htmlPantallaTV); ventanaEmergente.document.close();
    ventanaTV = ventanaEmergente; ventanaTV.focus();
}

// --- DATOS ---
function exportarDatos() {
    const blob = new Blob([JSON.stringify({ jugadores, historial }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Liga_Commander_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
    a.click();
    mostrarToast("Copia de seguridad descargada.");
}

function importarDatos(event) {
    const archivo = event.target.files[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = function(e) {
        try {
            const datos = JSON.parse(e.target.result);
            if (datos.jugadores && datos.historial) {
                abrirModal("📤 Importar Respaldo", "<p>¿Estás seguro? Esto sobreescribirá por completo todos los datos actuales de la liga.</p>", () => {
                    jugadores = datos.jugadores; historial = datos.historial;
                    guardarDatos(); 
                    mostrarToast("Base de datos restaurada.");
                    return true;
                });
            }
        } catch (error) { mostrarToast("Archivo JSON corrupto o no válido.", "danger"); }
        event.target.value = '';
    };
    lector.readAsText(archivo);
}

document.addEventListener("DOMContentLoaded", actualizarUI);