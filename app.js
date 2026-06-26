// ==========================================
// VARIABLES GLOBALES Y ALMACENAMIENTO
// ==========================================
let jugadores = JSON.parse(localStorage.getItem('commander_jugadores')) || [];
let historial = JSON.parse(localStorage.getItem('commander_historial')) || [];
let finanzas = JSON.parse(localStorage.getItem('commander_finanzas')) || []; 
const puntosGlobales = [4, 3, 2, 1, 0]; 

let ventanaTV = null;
let ultimasMesasGeneradas = []; 
let ultimoModo = 'aleatorio';
let ultimosPuntosHoy = {};
let ultimaRonda = 1;

let mostrarTodosJugadores = false;
let isModoEdicionExcel = false; 
const jornadasLista = ['J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7', 'J8', 'Semifinal', 'Final'];
let indiceJornadaActual = 0;

let usarOMW = localStorage.getItem('commander_usar_omw') !== 'false';

// Función Global anti-glitch de decimales infinitos
const fEuro = (num) => {
    if (num === undefined || num === null) return '0€';
    let val = Math.round(num * 100) / 100;
    return Number.isInteger(val) ? `${val}€` : `${val.toFixed(2)}€`;
};

// ==========================================
// UTILIDADES E INTERFAZ BASE
// ==========================================
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes(tabId));
    if (btn) btn.classList.add('active');
}

function mostrarToast(mensaje, tipo = 'success') {
    const contenedor = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    let icono = tipo === 'danger' ? '❌' : (tipo === 'warning' ? '⚠️' : '✅');
    toast.innerHTML = `<span>${icono}</span> <span>${mensaje}</span>`;
    contenedor.appendChild(toast);
    setTimeout(() => { toast.style.transform = 'translateX(100%)'; toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// Modal blindado contra dobles clics
function abrirModal(titulo, htmlContenido, alConfirmar, mostrarBoton = true, isWide = false) {
    document.getElementById('modal-title').innerText = titulo;
    document.getElementById('modal-body').innerHTML = htmlContenido;
    
    const card = document.querySelector('.modal-card');
    if (isWide) card.classList.add('wide');
    else card.classList.remove('wide');

    const btnSubmit = document.getElementById('modal-submit-btn');
    const nuevoBtn = btnSubmit.cloneNode(true);
    btnSubmit.parentNode.replaceChild(nuevoBtn, btnSubmit);
    
    nuevoBtn.onclick = function() { 
        if (nuevoBtn.disabled) return;
        nuevoBtn.disabled = true;
        nuevoBtn.innerText = "Procesando...";
        
        try {
            if (alConfirmar()) cerrarModal();
        } catch (error) {
            console.error(error);
            mostrarToast("Error interno.", "danger");
        }
        
        setTimeout(() => { 
            nuevoBtn.disabled = false; 
            nuevoBtn.innerText = "Confirmar"; 
        }, 500);
    };
    
    nuevoBtn.style.display = mostrarBoton ? 'block' : 'none';
    nuevoBtn.innerText = "Confirmar"; 
    nuevoBtn.disabled = false; 
    document.getElementById('modal-overlay').style.display = 'flex';
}

function cerrarModal() { 
    document.getElementById('modal-overlay').style.display = 'none'; 
    document.querySelector('.modal-card').classList.remove('wide'); 
}

function guardarDatos() { 
    localStorage.setItem('commander_jugadores', JSON.stringify(jugadores)); 
    localStorage.setItem('commander_historial', JSON.stringify(historial)); 
    localStorage.setItem('commander_finanzas', JSON.stringify(finanzas)); 
    actualizarUI(); 
}

function cambiarJornada(direccion) {
    indiceJornadaActual += direccion;
    if (indiceJornadaActual < 0) indiceJornadaActual = 0;
    if (indiceJornadaActual >= jornadasLista.length) indiceJornadaActual = jornadasLista.length - 1;
    document.getElementById('display-jornada').innerText = jornadasLista[indiceJornadaActual];
    localStorage.setItem('commander_jornada_activa', indiceJornadaActual);
}

function toggleMostrarTodos() { mostrarTodosJugadores = !mostrarTodosJugadores; renderizarClasificacion(); }

function toggleFullscreen() {
    const card = document.getElementById('tab-clasificacion'); const btn = document.getElementById('btn-fullscreen'); const btnCompact = document.getElementById('btn-compact');
    card.classList.toggle('fullscreen-card');
    if(card.classList.contains('fullscreen-card')) {
        btn.innerHTML = "↙️ Salir Pantalla Completa"; btnCompact.style.display = 'inline-block'; mostrarTodosJugadores = true; 
    } else {
        btn.innerHTML = "🔲 Pantalla Completa"; btnCompact.style.display = 'none'; card.classList.remove('compact-mode'); btnCompact.innerHTML = "🔍 Vista Multicolumna"; mostrarTodosJugadores = false;
    }
    renderizarClasificacion();
}

function toggleCompactMode() {
    const card = document.getElementById('tab-clasificacion'); const btnCompact = document.getElementById('btn-compact');
    card.classList.toggle('compact-mode');
    if(card.classList.contains('compact-mode')) { btnCompact.innerHTML = "📄 Vista Normal"; mostrarToast("Modo Multicolumna activado"); } 
    else { btnCompact.innerHTML = "🔍 Vista Multicolumna"; mostrarToast("Modo Normal activado"); }
}

window.toggleOMW = function() {
    usarOMW = document.getElementById('toggle-omw').checked;
    localStorage.setItem('commander_usar_omw', usarOMW);
    renderizarClasificacion();
    mostrarToast(usarOMW ? "OMW% Activado para desempates" : "OMW% Desactivado (Orden por puntos puros)", "success");
}

// ==========================================
// GESTIÓN DE JUGADORES Y EXCEL
// ==========================================
function filtrarCheckin() {
    const textoBusqueda = document.getElementById('buscador-checkin').value.toLowerCase();
    const contenedor = document.getElementById('jugadores-presentes');
    Array.from(contenedor.getElementsByTagName('label')).forEach(label => {
        if (label.textContent.toLowerCase().includes(textoBusqueda)) label.style.display = ''; 
        else label.style.display = 'none'; 
    });
}

function agregarJugadoresLote() {
    const textarea = document.getElementById('nuevos-jugadores'); const texto = textarea.value; if (!texto.trim()) return;
    let añadidos = 0;
    texto.split(/[\n,]/).forEach(nombreBruto => {
        let nombre = nombreBruto.replace(/^[\d.)\-*•\s\u2060]+/, '').replace(/[.\s]+$/, '').trim();
        if (nombre !== "" && !jugadores.some(j => j.nombre.toLowerCase() === nombre.toLowerCase())) {
            jugadores.push({ id: Date.now() + Math.floor(Math.random() * 1000), nombre: nombre, puntos: 0, partidas: 0, credito: 0, transacciones: [] }); 
            añadidos++;
        }
    });
    if (añadidos > 0) { textarea.value = ''; guardarDatos(); mostrarToast(`Registrados ${añadidos} jugadores correctamente.`); } 
    else mostrarToast("No se encontraron nombres nuevos válidos.", "warning");
}

function eliminarJugador(id) {
    const jugador = jugadores.find(j => j.id === id);
    abrirModal("🗑️ Borrar Jugador", `<p>¿Estás seguro de que deseas eliminar a <b style="color:var(--danger)">${jugador.nombre}</b>? Se perderá todo su historial y su saldo no gastado.</p>`, () => {
        jugadores = jugadores.filter(j => j.id !== id); guardarDatos(); mostrarToast("Jugador eliminado.", "danger"); return true;
    });
}

// ==========================================
// SISTEMA DE BILLETERAS Y PREMIOS
// ==========================================
window.abrirBilletera = function(id) {
    let jugador = jugadores.find(j => j.id === id);
    if (!jugador) return;

    if(jugador.credito === undefined) jugador.credito = 0;
    if(jugador.transacciones === undefined) jugador.transacciones = [];

    let transaccionesHTML = `<div style="max-height: 200px; overflow-y: auto; background: rgba(0,0,0,0.4); border-radius: 8px; padding: 10px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.05);">`;
    
    if(jugador.transacciones.length === 0) {
        transaccionesHTML += `<div style="text-align:center; color:#64748b; font-size:12px; font-style:italic; padding: 15px;">No hay movimientos aún</div>`;
    } else {
        let transInversas = [...jugador.transacciones].reverse();
        transInversas.forEach(t => {
            let color = t.cantidad > 0 ? '#34d399' : '#f87171';
            let signo = t.cantidad > 0 ? '+' : '';
            transaccionesHTML += `
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 8px 0; font-size: 13px;">
                    <span style="color:#cbd5e1;">${t.fecha} - ${t.concepto}</span>
                    <strong style="color:${color}; font-size: 14px;">${signo}${fEuro(t.cantidad)}</strong>
                </div>
            `;
        });
    }
    transaccionesHTML += `</div>`;

    let html = `
        <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 13px; color: #94a3b8; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Saldo Acumulado en Tienda</span>
            <div style="font-size: 3.5rem; font-weight: 900; color: #fbbf24; text-shadow: 0 4px 15px rgba(251, 191, 36, 0.2);">${fEuro(jugador.credito)}</div>
        </div>
        
        ${transaccionesHTML}

        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
            <input type="text" id="wallet-concepto" placeholder="Ej: 1º Puesto - Jornada 2" style="flex: 2; background: rgba(0,0,0,0.5); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 12px; border-radius: 8px; font-size: 13px; outline: none;">
            <input type="number" id="wallet-cantidad" placeholder="Cant. (€)" style="flex: 1; background: rgba(0,0,0,0.5); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 12px; border-radius: 8px; font-size: 13px; text-align:center; outline: none;">
        </div>

        <div style="display: flex; gap: 10px;">
            <button class="btn-primary btn-green" style="flex: 1; font-size: 13px; padding: 14px;" onclick="modificarSaldo(${jugador.id}, 'add')">➕ Ingresar Premio</button>
            <button class="btn-primary btn-danger" style="flex: 1; font-size: 13px; padding: 14px;" onclick="modificarSaldo(${jugador.id}, 'sub')">➖ Gastar Saldo</button>
        </div>
    `;

    abrirModal(`💳 Cartera de ${jugador.nombre}`, html, () => { return true; }, false);
}

window.modificarSaldo = function(id, action) {
    let jugador = jugadores.find(j => j.id === id);
    if (!jugador) return;

    let concepto = document.getElementById('wallet-concepto').value.trim() || (action === 'add' ? 'Premio de Torneo' : 'Compra en tienda');
    let cantidad = parseFloat(document.getElementById('wallet-cantidad').value);

    if (isNaN(cantidad) || cantidad <= 0) {
        mostrarToast("Introduce una cantidad válida mayor que 0.", "warning");
        return;
    }

    if (action === 'sub') {
        if (jugador.credito < cantidad) {
            mostrarToast(`No tiene saldo suficiente (Le faltan ${fEuro(cantidad - jugador.credito)}).`, "danger");
            return;
        }
        cantidad = -cantidad;
    }

    jugador.credito = Math.round(((jugador.credito || 0) + cantidad) * 100) / 100;
    if (!jugador.transacciones) jugador.transacciones = [];

    let fechaStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    jugador.transacciones.push({ fecha: fechaStr, concepto: concepto, cantidad: Math.round(cantidad * 100) / 100 });

    guardarDatos();
    mostrarToast(`Billetera de ${jugador.nombre} actualizada correctamente.`);
    abrirBilletera(id); 
}

window.verPremiosJugadores = function() {
    let jugadoresConPremios = jugadores.filter(j => (j.transacciones && j.transacciones.length > 0) || (j.credito && j.credito > 0));

    let html = `<div style="max-height: 70vh; overflow-y: auto; padding-right: 5px;">`;
    
    if (jugadoresConPremios.length === 0) {
        html += `<p style="color:#64748b; font-style:italic; text-align:center; padding: 30px; font-size:16px;">Nadie ha recibido premios en su billetera aún.</p>`;
    } else {
        jugadoresConPremios.sort((a, b) => (b.credito || 0) - (a.credito || 0));

        jugadoresConPremios.forEach(j => {
            let transHtml = "";
            if (j.transacciones) {
                let premios = j.transacciones.filter(t => t.cantidad > 0);
                if (premios.length > 0) {
                    let premiosInversos = [...premios].reverse();
                    premiosInversos.forEach(t => {
                        transHtml += `
                        <div style="display:flex; justify-content:space-between; font-size:13px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05); color:#cbd5e1;">
                            <span>📅 ${t.fecha} - <em style="color:#f8fafc;">${t.concepto}</em></span>
                            <strong style="color:#34d399; font-size: 14px;">+${fEuro(t.cantidad)}</strong>
                        </div>`;
                    });
                } else {
                    transHtml += `<div style="font-size:13px; color:#64748b; font-style:italic; padding: 6px 0;">Solo tiene gastos registrados.</div>`;
                }
            }

            html += `
            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <strong style="color: var(--primary); font-size: 18px;">${j.nombre}</strong>
                    <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); padding: 8px 15px; border-radius: 8px;">
                        <span style="font-size: 12px; color: #fbbf24; text-transform: uppercase; font-weight: bold;">Saldo Disponible:</span>
                        <strong style="color: #fcd34d; font-size: 18px; margin-left: 8px;">${fEuro(j.credito)}</strong>
                    </div>
                </div>
                <div style="background: rgba(0,0,0,0.4); border-radius: 8px; padding: 15px;">
                    <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">🏆 Historial de Premios Ganados:</div>
                    ${transHtml}
                </div>
            </div>`;
        });
    }
    html += `</div>`;
    abrirModal("📋 Cuentas y Premios de Jugadores", html, () => true, false, true);
}


function activarEdicionExcel() { isModoEdicionExcel = true; mostrarTodosJugadores = true; switchTab('tab-clasificacion'); document.getElementById('modo-clasificacion').style.display = 'none'; document.getElementById('excel-controls').style.display = 'flex'; renderizarClasificacion(); }
function cancelarEdicionExcel() { isModoEdicionExcel = false; document.getElementById('modo-clasificacion').style.display = 'block'; document.getElementById('excel-controls').style.display = 'none'; document.getElementById('modo-clasificacion').value = 'general'; actualizarUI(); }
function actualizarFilaExcel(inputEl) { let total = 0; inputEl.closest('tr').querySelectorAll('.excel-cell').forEach(inp => { let val = parseInt(inp.value); if (!isNaN(val)) total += val; }); let celdaTotal = inputEl.closest('tr').querySelector('.excel-total'); if(celdaTotal) celdaTotal.innerText = total; }

function guardarEdicionExcel() {
    let cambiosGuardados = false;
    document.querySelectorAll('.excel-cell').forEach(inp => {
        let idJugador = parseInt(inp.getAttribute('data-jid')); let jornada = inp.getAttribute('data-jor'); let valorNuevo = parseInt(inp.value) || 0; let valorViejo = parseInt(inp.defaultValue) || 0; 
        if (valorNuevo !== valorViejo) {
            let diferencia = valorNuevo - valorViejo; let jugador = jugadores.find(j => j.id === idJugador);
            if (jugador) {
                jugador.puntos += diferencia;
                historial.unshift({ id: Date.now() + Math.floor(Math.random() * 10000), fecha: (jornada === "BASE" ? "Ajuste Manual" : jornada), resultados: [{ idJugador: jugador.id, nombre: jugador.nombre, puntos: diferencia, posicion: "-" }] });
                cambiosGuardados = true;
            }
        }
    });
    if (cambiosGuardados) { mostrarToast("Puntuaciones guardadas con éxito."); guardarDatos(); }
    isModoEdicionExcel = false; document.getElementById('modo-clasificacion').style.display = 'block'; document.getElementById('excel-controls').style.display = 'none'; document.getElementById('modo-clasificacion').value = 'general'; actualizarUI();
}

function anularResultado(idHistorial) {
    abrirModal("⚠️ Anular Mesa", "<p>¿Seguro que quieres anular esta mesa? Se recalcularán y restarán las puntuaciones correspondientes.</p>", () => {
        const index = historial.findIndex(h => h.id === idHistorial); if(index === -1) return false;
        historial[index].resultados.forEach(detalle => {
            let jugador = jugadores.find(j => j.id == detalle.idJugador);
            if(jugador) { jugador.puntos = Math.max(0, jugador.puntos - detalle.puntos); jugador.partidas = Math.max(0, jugador.partidas - 1); }
        });
        historial.splice(index, 1); guardarDatos(); mostrarToast("Mesa anulada con éxito.", "warning"); return true;
    });
}

function solicitarReiniciarApp() {
    abrirModal("⚠️ BORRADO COMPLETO", `<p>Escribe <b>BORRAR</b> abajo para confirmar:</p><input type="text" id="confirm-delete-input" autocomplete="off" style="width:100%; padding:10px; font-size:16px;">`, () => {
        if (document.getElementById('confirm-delete-input').value === "BORRAR") {
            jugadores = []; historial = []; finanzas = [];
            localStorage.removeItem('commander_jugadores'); localStorage.removeItem('commander_historial'); localStorage.removeItem('commander_finanzas');
            document.getElementById('mesas-generadas').innerHTML = ''; actualizarUI(); 
            mostrarToast("Base de datos borrada por completo.", "danger"); return true;
        } else { mostrarToast("Confirmación errónea.", "warning"); return false; }
    });
}

// ==========================================
// CALCULADORA INTELIGENTE DE PREMIOS (AUTO-REPARTO)
// ==========================================
window.abrirCalculadoraPremios = function() {
    let jornadasUnicas = new Set();
    historial.forEach(h => jornadasUnicas.add(h.fecha.split(',')[0].trim()));
    
    let opcionesJornadas = Array.from(jornadasUnicas).sort((a, b) => { 
        let numA = a.match(/\d+/) ? parseInt(a.match(/\d+/)[0]) : NaN; 
        let numB = b.match(/\d+/) ? parseInt(b.match(/\d+/)[0]) : NaN; 
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB; 
        return a.localeCompare(b); 
    }).map(j => `<option value="${j}">🏆 Evaluar y repartir: ${j}</option>`).join('');

    let html = `
        <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); padding: 15px; border-radius: 12px; margin-bottom: 20px;">
            <label style="font-size: 12px; color: #60a5fa; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 8px;">📅 Seleccionar Origen de Datos:</label>
            <select id="calc-jornada-select" onchange="cambiarJornadaPremios()" style="width: 100%; background: rgba(0,0,0,0.5); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 12px; border-radius: 6px; outline: none; font-size: 14px;">
                <option value="manual">✍️ Modo Manual (Sin Reparto Automático)</option>
                ${opcionesJornadas}
            </select>
        </div>

        <div style="background: rgba(0,0,0,0.3); padding: 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <label style="font-weight: 600; color: #cbd5e1; font-size:15px;">👥 Inscritos (5€/pax):</label>
                <input type="number" id="calc-jugadores" value="0" min="0" oninput="recalcularPremios()" style="width: 80px; background: rgba(0,0,0,0.5); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 8px; border-radius: 6px; text-align: center; font-size: 18px; font-weight: bold; outline: none;">
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color: #94a3b8; font-size:14px;">Bote Total Recaudado:</span>
                <strong id="calc-bote-total" style="font-size: 1.5rem; color: white;">0€</strong>
            </div>
        </div>

        <div style="display:flex; gap:15px; margin-bottom: 20px;">
            <div style="flex:1; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 15px; border-radius: 12px; text-align: center;">
                <div style="font-size: 12px; color: #10b981; font-weight: 700; text-transform: uppercase; margin-bottom: 5px;">🏦 Caja Tienda (60%)</div>
                <div id="calc-tienda" style="font-size: 1.8rem; font-weight: 900; color: #34d399;">0€</div>
            </div>
            <div style="flex:1; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); padding: 15px; border-radius: 12px; text-align: center;">
                <div style="font-size: 12px; color: #f59e0b; font-weight: 700; text-transform: uppercase; margin-bottom: 5px;">🏆 Premios (40%)</div>
                <div id="calc-premios" style="font-size: 1.8rem; font-weight: 900; color: #fbbf24;">0€</div>
            </div>
        </div>

        <div style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2); padding: 20px; border-radius: 12px;">
            <label style="font-size: 14px; color: #fbbf24; font-weight: 600; display: block; margin-bottom: 10px;">📊 Distribución del Fondo de Premios:</label>
            <select id="calc-reparto" onchange="recalcularPremios()" style="width: 100%; background: rgba(0,0,0,0.5); color: white; border: 1px solid rgba(255,255,255,0.1); padding: 12px; border-radius: 6px; margin-bottom: 15px; outline: none; font-size: 14px;">
                <option value="1">Todo para el Ganador (Top 1)</option>
                <option value="2">Reparto Top 2 (60% / 40%)</option>
                <option value="3">Reparto Top 3 (50% / 30% / 20%)</option>
                <option value="4">Reparto Top 4 Escalonado (40% / 30% / 20% / 10%)</option>
                <option value="4_flat">🤝 Pacto Top 4 (Partes Iguales: 25% c/u)</option>
                <option value="8">Reparto Top 8 Clásico (25 / 20 / 12.5 / 12.5 / 7.5x4)</option>
                <option value="8_flat">🤝 Pacto Top 8 (Partes Iguales: 12.5% c/u)</option>
            </select>
            <div id="calc-desglose" style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto; padding-right: 5px;"></div>
            
            <div id="calc-action-btn-container">
                <button class="btn-primary btn-green" style="width: 100%; padding: 14px; margin-top: 20px; font-size: 14px;" onclick="guardarRegistroFinanzas()">💾 Guardar Caja Manualmente (Solo Tienda)</button>
            </div>
        </div>
    `;

    abrirModal("💰 Calculadora Inteligente de Premios", html, () => { return true; }, false, true);
    
    setTimeout(() => {
        const checkboxesActivos = document.querySelectorAll('.check-jugador:checked').length;
        document.getElementById('calc-jugadores').value = checkboxesActivos > 0 ? checkboxesActivos : jugadores.length;
        recalcularPremios();
    }, 50);
}

function obtenerTopJornada(nombreJornada) {
    let statsTemp = {};
    let statsAvanzadas = calcularStatsAvanzadas(jugadores, historial);

    jugadores.forEach(j => statsTemp[j.id] = { ...j, puntosHoy: 0, partidasHoy: 0, omw: statsAvanzadas[j.id].omw });

    let countJugadores = 0;
    historial.forEach(h => {
        let fechaPartida = h.fecha.split(',')[0].trim();
        if (fechaPartida === nombreJornada) {
            h.resultados.forEach(r => {
                if (statsTemp[r.idJugador]) {
                    if (statsTemp[r.idJugador].partidasHoy === 0) countJugadores++; 
                    statsTemp[r.idJugador].puntosHoy += r.puntos;
                    if(r.posicion !== "-") statsTemp[r.idJugador].partidasHoy += 1;
                }
            });
        }
    });

    let datos = Object.values(statsTemp).filter(j => j.partidasHoy > 0);
    datos.sort((a, b) => {
        if (b.puntosHoy !== a.puntosHoy) return b.puntosHoy - a.puntosHoy;
        if (usarOMW) return b.omw - a.omw;
        return 0;
    });

    return { top: datos, totalJugadores: countJugadores };
}

window.cambiarJornadaPremios = function() {
    let selected = document.getElementById('calc-jornada-select').value;
    let inputJugadores = document.getElementById('calc-jugadores');
    let btnContainer = document.getElementById('calc-action-btn-container');

    if (selected === 'manual') {
        inputJugadores.readOnly = false;
        inputJugadores.style.opacity = '1';
        btnContainer.innerHTML = `<button class="btn-primary btn-green" style="width: 100%; padding: 14px; margin-top: 20px; font-size: 14px;" onclick="guardarRegistroFinanzas()">💾 Guardar Caja Manualmente (Solo Tienda)</button>`;
    } else {
        let data = obtenerTopJornada(selected);
        inputJugadores.value = data.totalJugadores;
        inputJugadores.readOnly = true; 
        inputJugadores.style.opacity = '0.5';
        
        btnContainer.innerHTML = `<button class="btn-primary btn-purple" style="width: 100%; padding: 16px; margin-top: 20px; font-size: 15px; font-weight: bold; background: linear-gradient(135deg, #8b5cf6, #ec4899); border: none; box-shadow: 0 10px 20px rgba(236, 72, 153, 0.3);" onclick="ejecutarRepartoAutomatico('${selected}')">💸 REPARTIR PREMIOS A BILLETERAS Y GUARDAR CAJA</button>`;
    }
    recalcularPremios();
}

window.recalcularPremios = function() {
    const inputJugadores = document.getElementById('calc-jugadores');
    if (!inputJugadores) return;

    let numJugadores = parseInt(inputJugadores.value) || 0;
    let boteTotal = numJugadores * 5;
    let boteTienda = boteTotal * 0.60;
    let botePremios = boteTotal * 0.40;

    document.getElementById('calc-bote-total').innerText = fEuro(boteTotal);
    document.getElementById('calc-tienda').innerText = fEuro(boteTienda);
    document.getElementById('calc-premios').innerText = fEuro(botePremios);

    const repartoOpt = document.getElementById('calc-reparto').value;
    const desgloseContenedor = document.getElementById('calc-desglose');
    let desgloseHTML = "";
    
    window.premiosCalculadosCache = [];

    if (botePremios > 0) {
        if (repartoOpt === "1") window.premiosCalculadosCache = [{ pos: "1º", valor: botePremios, color: "#fcd34d" }];
        else if (repartoOpt === "2") window.premiosCalculadosCache = [{ pos: "1º", valor: botePremios * 0.60, color: "#fcd34d" }, { pos: "2º", valor: botePremios * 0.40, color: "#cbd5e1" }];
        else if (repartoOpt === "3") window.premiosCalculadosCache = [{ pos: "1º", valor: botePremios * 0.50, color: "#fcd34d" }, { pos: "2º", valor: botePremios * 0.30, color: "#cbd5e1" }, { pos: "3º", valor: botePremios * 0.20, color: "#b45309" }];
        else if (repartoOpt === "4") window.premiosCalculadosCache = [{ pos: "1º", valor: botePremios * 0.40, color: "#fcd34d" }, { pos: "2º", valor: botePremios * 0.30, color: "#cbd5e1" }, { pos: "3º", valor: botePremios * 0.20, color: "#b45309" }, { pos: "4º", valor: botePremios * 0.10, color: "#94a3b8" }];
        else if (repartoOpt === "4_flat") window.premiosCalculadosCache = Array.from({length: 4}, () => ({ pos: "Top 4", valor: botePremios * 0.25, color: "#94a3b8" }));
        else if (repartoOpt === "8") window.premiosCalculadosCache = [{ pos: "1º", valor: botePremios * 0.25, color: "#fcd34d" }, { pos: "2º", valor: botePremios * 0.20, color: "#cbd5e1" }, { pos: "3º", valor: botePremios * 0.125, color: "#b45309" }, { pos: "4º", valor: botePremios * 0.125, color: "#b45309" }, { pos: "5º", valor: botePremios * 0.075, color: "#64748b" }, { pos: "6º", valor: botePremios * 0.075, color: "#64748b" }, { pos: "7º", valor: botePremios * 0.075, color: "#64748b" }, { pos: "8º", valor: botePremios * 0.075, color: "#64748b" }];
        else if (repartoOpt === "8_flat") window.premiosCalculadosCache = Array.from({length: 8}, () => ({ pos: "Top 8", valor: botePremios * 0.125, color: "#64748b" }));

        window.premiosCalculadosCache.forEach(p => { 
            desgloseHTML += `<div style="display: flex; justify-content: space-between; background: rgba(0,0,0,0.3); padding: 10px 15px; border-radius: 6px; border-left: 3px solid ${p.color};"><span style="font-weight: bold; color: #e2e8f0; font-size: 14px;">${p.pos}</span><strong style="color: ${p.color}; font-size: 15px;">${fEuro(p.valor)}</strong></div>`; 
        });
    } else desgloseHTML = `<div style="text-align: center; color: #64748b; font-size: 14px; font-style: italic; padding: 10px;">No hay bote para repartir</div>`;

    desgloseContenedor.innerHTML = desgloseHTML;
}

window.ejecutarRepartoAutomatico = function(jornada) {
    let inputCalc = document.getElementById('calc-jugadores');
    let numJugadores = inputCalc ? parseInt(inputCalc.value) || 0 : 0;
    
    let data = obtenerTopJornada(jornada);
    let topJugadores = data.top;

    if(topJugadores.length === 0) {
        mostrarToast("No hay registros de jugadores en esta jornada.", "danger");
        return;
    }

    let premiosConfigurados = window.premiosCalculadosCache || [];
    let mensajeConfirmacion = `<p style="font-size:14px;">Se va a registrar en contabilidad de la tienda y se ingresarán los saldos a los siguientes jugadores:</p><ul style="font-size: 14px; color: #cbd5e1; text-align: left; background: rgba(0,0,0,0.3); padding: 15px 25px; border-radius: 8px;">`;

    let premiosAPagar = [];
    for(let i=0; i < premiosConfigurados.length; i++) {
        if(topJugadores[i]) {
            let p = premiosConfigurados[i];
            let j = topJugadores[i];
            premiosAPagar.push({ idJugador: j.id, nombre: j.nombre, valor: p.valor, pos: p.pos });
            mensajeConfirmacion += `<li style="margin-bottom:6px;"><b>${p.pos}:</b> ${j.nombre} <strong style="color: #34d399;">(+${fEuro(p.valor)})</strong></li>`;
        }
    }
    mensajeConfirmacion += `</ul>`;

    cerrarModal(); 
    
    setTimeout(() => {
        abrirModal("💸 Confirmar Reparto Automático", mensajeConfirmacion, () => {
            
            let fechaStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
            premiosAPagar.forEach(premio => {
                let jDB = jugadores.find(j => j.id === premio.idJugador);
                if(jDB) {
                    jDB.credito = Math.round(((jDB.credito || 0) + premio.valor) * 100) / 100;
                    if (!jDB.transacciones) jDB.transacciones = [];
                    jDB.transacciones.push({ fecha: fechaStr, concepto: `Premio ${premio.pos} - ${jornada}`, cantidad: Math.round(premio.valor * 100) / 100 });
                }
            });

            let boteTotal = numJugadores * 5;
            let boteTienda = boteTotal * 0.60;
            let botePremios = boteTotal * 0.40;
            let fechaCajaStr = `${jornada} - ${new Date().toLocaleDateString()}`;

            finanzas.unshift({ 
                id: Date.now(), 
                fecha: fechaCajaStr, 
                jugadores: numJugadores, 
                total: Math.round(boteTotal*100)/100, 
                tienda: Math.round(boteTienda*100)/100, 
                premios: Math.round(botePremios*100)/100 
            });
            
            guardarDatos();
            mostrarToast(`¡Premios de ${jornada} repartidos y guardados con éxito!`);
            
            return true; 
        }, true, false);
    }, 200);
}

window.guardarRegistroFinanzas = function() {
    const inputJugadores = document.getElementById('calc-jugadores');
    if (!inputJugadores) return;
    
    let numJugadores = parseInt(inputJugadores.value) || 0;
    let boteTotal = numJugadores * 5;
    let boteTienda = boteTotal * 0.60;
    let botePremios = boteTotal * 0.40;
    let fechaStr = `Registro Manual - ${new Date().toLocaleDateString()}`;

    finanzas.unshift({ 
        id: Date.now(), 
        fecha: fechaStr, 
        jugadores: numJugadores, 
        total: Math.round(boteTotal*100)/100, 
        tienda: Math.round(boteTienda*100)/100, 
        premios: Math.round(botePremios*100)/100 
    });
    localStorage.setItem('commander_finanzas', JSON.stringify(finanzas));
    
    mostrarToast("Registro de caja guardado con éxito.");
    cerrarModal();
}

window.verRegistroFinanzas = function() {
    let html = `<div style="max-height: 70vh; overflow-y: auto; padding-right: 5px;">`;
    
    if (finanzas.length === 0) {
        html += `<p style="color:#64748b; font-style:italic; text-align:center; padding: 30px; font-size:16px;">No hay registros de caja aún.</p>`;
    } else {
        let totalTienda = finanzas.reduce((sum, f) => sum + f.tienda, 0);
        html += `
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 25px;">
                <div style="font-size: 14px; color: #10b981; font-weight: 700; text-transform: uppercase; margin-bottom: 5px;">Total Acumulado Tienda</div>
                <div style="font-size: 2.2rem; font-weight: 900; color: #34d399;">${fEuro(totalTienda)}</div>
            </div>
        `;

        finanzas.forEach(f => {
            html += `
            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; padding: 15px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: var(--primary); display: block; font-size: 16px; margin-bottom: 4px;">📅 ${f.fecha}</strong>
                    <span style="font-size: 13px; color: #94a3b8;">${f.jugadores} Inscritos (Bote Total: ${fEuro(f.total)})</span>
                </div>
                <div style="text-align: right; display: flex; gap: 20px; align-items: center;">
                    <div style="text-align: right;">
                        <div style="color: #34d399; font-weight: bold; font-size: 14px; margin-bottom: 2px;">🏪 Tienda: ${fEuro(f.tienda)}</div>
                        <div style="color: #fbbf24; font-weight: bold; font-size: 14px;">🏆 Premios: ${fEuro(f.premios)}</div>
                    </div>
                    <button class="btn-delete" style="padding: 8px 12px; font-size: 12px; margin: 0; height: auto;" onclick="borrarFinanza(${f.id})">❌</button>
                </div>
            </div>`;
        });
    }
    
    html += `</div>`;
    abrirModal("💼 Contabilidad de la Tienda", html, () => true, false, true);
}

window.borrarFinanza = function(id) {
    if(confirm("¿Seguro que quieres borrar este registro contable?")) {
        finanzas = finanzas.filter(f => f.id !== id);
        localStorage.setItem('commander_finanzas', JSON.stringify(finanzas));
        verRegistroFinanzas(); 
        mostrarToast("Registro eliminado.", "warning");
    }
}

// ==========================================
// MOTOR LÓGICO AVANZADO: OMW% 
// ==========================================
function calcularStatsAvanzadas(listaJugadores, historialDatos) {
    let stats = {};
    const maxPuntosPorPartida = puntosGlobales[0];
    
    listaJugadores.forEach(j => {
        let winPercentage = j.partidas > 0 ? (j.puntos / (j.partidas * maxPuntosPorPartida)) : 0;
        winPercentage = Math.max(0.3333, winPercentage);
        stats[j.id] = { ...j, mw: winPercentage, sumatorioOppMW: 0, totalOpponents: 0, omw: 0 };
    });

    historialDatos.forEach(h => {
        let idsEnMesa = h.resultados.map(r => parseInt(r.idJugador)); 
        idsEnMesa.forEach(id => {
            if(stats[id]) {
                let oponentes = idsEnMesa.filter(oppId => oppId !== id);
                oponentes.forEach(oppId => {
                    if(stats[oppId]) { stats[id].sumatorioOppMW += stats[oppId].mw; stats[id].totalOpponents++; }
                });
            }
        });
    });

    Object.values(stats).forEach(s => { s.omw = s.totalOpponents > 0 ? (s.sumatorioOppMW / s.totalOpponents) : 0; });
    return stats;
}

// ==========================================
// GENERACIÓN DE MESAS Y SUIZO
// ==========================================
function actualizarDesplegables() {
    const contenedor = document.getElementById('mesas-generadas'); if (!contenedor) return;
    const selects = contenedor.querySelectorAll('select');
    const idsSeleccionados = Array.from(selects).map(s => s.value).filter(v => v !== "");

    selects.forEach(select => {
        const valorActual = select.value;
        Array.from(select.options).forEach(opt => {
            if (opt.value === "") return;
            if (idsSeleccionados.includes(opt.value) && opt.value !== valorActual) {
                opt.disabled = true; if (!opt.text.includes(" (Asignado)")) opt.text = opt.text.replace(" (Ya asignado)", "") + " (Asignado)";
            } else { 
                opt.disabled = false; opt.text = opt.text.replace(" (Asignado)", "").replace(" (Ya asignado)", ""); 
            }
        });
    });
}

function generarMesas(modo = 'aleatorio') {
    const checkboxes = document.querySelectorAll('.check-jugador:checked');
    let presentes = Array.from(checkboxes).map(cb => jugadores.find(j => j.id == cb.value));
    const P = presentes.length;

    if (P < 3) { mostrarToast("Hacen falta al menos 3 jugadores para abrir mesa.", "warning"); return; }

    let nombreJornada = jornadasLista[indiceJornadaActual];
    let puntosHoy = {}; let partidasHoy = {}; let sumatorioPuntosHoy = 0; 
    
    presentes.forEach(j => { puntosHoy[j.id] = 0; partidasHoy[j.id] = 0; });
    
    historial.forEach(h => {
        let fechaPartida = h.fecha.split(',')[0].trim();
        if (fechaPartida === nombreJornada) {
            h.resultados.forEach(r => {
                if (puntosHoy[r.idJugador] !== undefined) { 
                    puntosHoy[r.idJugador] += r.puntos; partidasHoy[r.idJugador] += 1; sumatorioPuntosHoy += r.puntos; 
                }
            });
        }
    });

    let rondaActual = Math.max(...Object.values(partidasHoy)) + 1;
    let statsCalculados = calcularStatsAvanzadas(jugadores, historial);

    for (let i = P - 1; i > 0; i--) { 
        const j = Math.floor(Math.random() * (i + 1)); 
        [presentes[i], presentes[j]] = [presentes[j], presentes[i]]; 
    }

    if (modo === 'suizo') {
        if (sumatorioPuntosHoy === 0) {
            mostrarToast("1ª Ronda configurada aleatoriamente (Suizo puro inicia en Ronda 2).", "warning");
        } else {
            presentes.sort((a, b) => {
                if (puntosHoy[b.id] !== puntosHoy[a.id]) return puntosHoy[b.id] - puntosHoy[a.id];
                if (b.puntos !== a.puntos) return b.puntos - a.puntos;
                if (usarOMW) return statsCalculados[b.id].omw - statsCalculados[a.id].omw;
                return 0;
            });
        }
    }

    let mesas_de_4 = Math.floor(P / 4); let mesas_de_3 = 0; let mesas_de_5 = 0; let resto = P % 4;
    
    if (resto === 1) { if (mesas_de_4 === 1) { mesas_de_4 = 0; mesas_de_5 = 1; } else { mesas_de_4 -= 2; mesas_de_3 += 3; } } 
    else if (resto === 2) { mesas_de_4 -= 1; mesas_de_3 += 2; } 
    else if (resto === 3) { mesas_de_3 += 1; }

    let mesas = []; let indexJugador = 0;
    for (let i = 0; i < mesas_de_4; i++) { mesas.push(presentes.slice(indexJugador, indexJugador + 4)); indexJugador += 4; }
    for (let i = 0; i < mesas_de_3; i++) { mesas.push(presentes.slice(indexJugador, indexJugador + 3)); indexJugador += 3; }
    for (let i = 0; i < mesas_de_5; i++) { mesas.push(presentes.slice(indexJugador, indexJugador + 5)); indexJugador += 5; }

    ultimoModo = modo; ultimosPuntosHoy = puntosHoy; ultimaRonda = rondaActual; ultimasMesasGeneradas = mesas;
    mostrarMesas(ultimasMesasGeneradas, ultimoModo, ultimosPuntosHoy, ultimaRonda);
}

function mostrarMesas(mesas, modo, puntosHoy, rondaActual) {
    const contenedor = document.getElementById('mesas-generadas');
    if (!contenedor) return;
    contenedor.innerHTML = '';
    
    if(mesas.length > 0) contenedor.innerHTML += `<button class="btn-tv" onclick="abrirModoTV()">📺 PROYECTAR EN TV DE LA TIENDA</button>`;

    let tituloMesa = modo === 'suizo' ? `🏆 Suizo (R${rondaActual})` : `🔮 Aleatorio (R${rondaActual})`;
    let colorTitulo = modo === 'suizo' ? 'var(--danger)' : 'var(--primary)';
    let clasePod = modo === 'suizo' ? 'suizo' : 'aleatorio';

    mesas.forEach((mesa, index) => {
        let html = `
        <div class="pod ${clasePod}" id="pod-${index}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3 style="color: ${colorTitulo}; margin: 0;">${tituloMesa} - Mesa ${index + 1} <span id="span-count-${index}" style="font-size:12px; color:var(--text-muted); font-weight:normal;">(${mesa.length} Jugadores)</span></h3>
                <button class="btn-header" onclick="forzarJugadorEnMesa(${index})">➕ Añadir Tarde</button>
            </div>`;
        
        const nombresMesa = mesa.map(j => {
            let textoPuntos = modo === 'suizo' && puntosHoy[j.id] !== undefined ? ` <span style="color:#fcd34d; font-size:11px;">(${puntosHoy[j.id]}p)</span>` : '';
            return `<span class="jugador-pill" onclick="gestionarJugadorMesa(${index}, ${j.id})" title="Clic para Mover o Dropear a este jugador">⚡ ${j.nombre}${textoPuntos}</span>`;
        }).join(' ');
        
        html += `<div class="nombres-mesa">${nombresMesa}</div><div id="selects-pod-${index}">`;
        
        for(let i = 0; i < mesa.length; i++) {
            html += `
            <div class="puesto-row" id="pod-${index}-puesto-${i}">
                <label>${i+1}º PUESTO (+${puntosGlobales[i]} PTS):</label>
                <select id="sel-pod-${index}-pos-${i}" onchange="actualizarDesplegables()">
                    <option value="">-- Elige el ganador/puesto --</option>`;
            mesa.forEach(jugador => { html += `<option value="${jugador.id}">${jugador.nombre}</option>`; });
            html += `</select></div>`;
        }

        html += `
            </div>
            <div id="btns-pod-${index}" style="display: flex; gap: 10px; margin-top: 25px;">
                <button class="btn-primary btn-green" style="flex: 2; padding: 14px;" onclick="guardarResultadoMesa('pod-${index}', ${mesa.length})">💾 Confirmar Mesa</button>
                <button class="btn-secondary" style="flex: 1; padding: 14px;" onclick="declararEmpate('pod-${index}', ${mesa.length})">⏱️ Empate</button>
            </div>
        </div>`;
                 
        contenedor.innerHTML += html;
    });
    
    setTimeout(actualizarDesplegables, 100);
}

window.gestionarJugadorMesa = function(mesaIndex, jugadorId) {
    let jugador = jugadores.find(j => j.id == jugadorId);
    if(!jugador) return;
    let numMesas = ultimasMesasGeneradas.length;
    let opcionesMesa = '';
    
    for(let i=0; i<numMesas; i++) {
        if(i !== mesaIndex) opcionesMesa += `<option value="${i}">Mesa ${i+1}</option>`;
    }

    let selectorHTML = numMesas > 1 ? `
        <div style="background: rgba(59, 130, 246, 0.1); padding: 15px; border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
            <label style="font-size: 11px; color: #60a5fa; display: block; margin-bottom: 5px;">Mover a otra mesa:</label>
            <select id="select-mover-mesa" style="width: 100%; margin-bottom: 10px; background:rgba(0,0,0,0.5); color:white; border:1px solid rgba(255,255,255,0.1); padding:10px; border-radius:6px; outline:none;">
                ${opcionesMesa}
            </select>
            <button class="btn-primary btn-blue" style="width: 100%; padding:12px;" onclick="aplicarMover(${mesaIndex}, ${jugadorId})">⇆ MOVER JUGADOR</button>
        </div>
    ` : '';

    let html = `
        <p style="margin-top:0; color:var(--text-muted); font-size:13px;">Opciones para <b>${jugador.nombre}</b> (Mesa ${mesaIndex+1}):</p>
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:15px;">
            ${selectorHTML}
            <div style="background: rgba(239, 68, 68, 0.1); padding: 15px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3); margin-top: 5px;">
                <label style="font-size: 11px; color: #fca5a5; display: block; margin-bottom: 5px;">Eliminar de la mesa actual:</label>
                <button class="btn-primary btn-danger" style="width: 100%; padding:12px;" onclick="aplicarDrop(${mesaIndex}, ${jugadorId})">🏃‍♂️ HACER DROP (Quitar de la ronda)</button>
            </div>
        </div>
    `;
    
    abrirModal("🛠️ Reorganizar Mesa", html, () => { return true; }, false);
}

window.aplicarDrop = function(mesaIndex, jugadorId) {
    ultimasMesasGeneradas[mesaIndex] = ultimasMesasGeneradas[mesaIndex].filter(j => j.id !== jugadorId);
    ultimasMesasGeneradas = ultimasMesasGeneradas.filter(m => m.length > 0); 
    cerrarModal();
    mostrarMesas(ultimasMesasGeneradas, ultimoModo, ultimosPuntosHoy, ultimaRonda);
    mostrarToast("Jugador eliminado de la mesa.", "danger");
}

window.aplicarMover = function(mesaIndex, jugadorId) {
    let selectDestino = document.getElementById('select-mover-mesa');
    if(!selectDestino) return;
    
    let destinoIndex = parseInt(selectDestino.value);
    let jugadorObj = ultimasMesasGeneradas[mesaIndex].find(j => j.id === jugadorId);
    
    ultimasMesasGeneradas[mesaIndex] = ultimasMesasGeneradas[mesaIndex].filter(j => j.id !== jugadorId);
    ultimasMesasGeneradas[destinoIndex].push(jugadorObj);
    ultimasMesasGeneradas = ultimasMesasGeneradas.filter(m => m.length > 0);
    
    cerrarModal();
    mostrarMesas(ultimasMesasGeneradas, ultimoModo, ultimosPuntosHoy, ultimaRonda);
    mostrarToast("Jugador movido a la mesa " + (destinoIndex+1) + ".");
}

function forzarJugadorEnMesa(index) {
    const contenedorSelects = document.getElementById(`selects-pod-${index}`);
    let numJugadores = contenedorSelects.querySelectorAll('.puesto-row').length;
    
    if (numJugadores >= 5) { mostrarToast("Límite crítico: Máximo 5 jugadores.", "warning"); return; }
    
    let i = numJugadores; 
    let puntos = puntosGlobales[i] !== undefined ? puntosGlobales[i] : 0;

    let htmlNuevoSelect = `
        <div class="puesto-row" id="pod-${index}-puesto-${i}">
            <label>${i+1}º PUESTO (+${puntos} PTS):</label>
            <select id="sel-pod-${index}-pos-${i}" onchange="actualizarDesplegables()">
                <option value="">-- Elige jugador que llegó tarde --</option>`;
                
    jugadores.forEach(jugador => { htmlNuevoSelect += `<option value="${jugador.id}">${jugador.nombre}</option>`; });
    
    htmlNuevoSelect += `</select></div>`;
    contenedorSelects.insertAdjacentHTML('beforeend', htmlNuevoSelect);
    document.getElementById(`span-count-${index}`).innerText = `(${numJugadores + 1} Jugadores)`;
    
    document.getElementById(`btns-pod-${index}`).innerHTML = `
        <button class="btn-primary btn-green" style="flex: 2; padding: 14px;" onclick="guardarResultadoMesa('pod-${index}', ${numJugadores + 1})">💾 Confirmar Mesa</button>
        <button class="btn-secondary" style="flex: 1; padding: 14px;" onclick="declararEmpate('pod-${index}', ${numJugadores + 1})">⏱️ Empate</button>
    `;
    actualizarDesplegables();
}

function guardarResultadoMesa(prefijoMesa, numJugadores) {
    let idsSeleccionados = new Set(); let detallesMesa = [];
    
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
    let idsAsignados = new Set(); let detallesMesa = []; let puntosUsados = 0; let selectBase = null;
    
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
        if(opt.value !== "") { todosIds.push(opt.value); todosNombres[opt.value] = opt.text.replace(" (Asignado)", ""); } 
    });

    let idsRestantes = todosIds.filter(id => !idsAsignados.has(id));
    if (idsRestantes.length < 2) { mostrarToast("Deja vacíos al menos 2 puestos para empatar entre ellos.", "warning"); return; }

    let puntosTotalesMesa = 0; 
    for(let i=0; i < numJugadores; i++) puntosTotalesMesa += puntosGlobales[i];
    let puntosPorEmpate = Math.floor((puntosTotalesMesa - puntosUsados) / idsRestantes.length);

    idsRestantes.forEach(id => { detallesMesa.push({ idJugador: id, nombre: todosNombres[id], puntos: puntosPorEmpate, posicion: "Empate" }); });
    let htmlMensaje = "<ul>" + detallesMesa.map(d => `<li><b>${d.posicion}:</b> ${d.nombre} (+${d.puntos} pts)</li>`).join('') + "</ul>";

    abrirModal("⏱️ ¿Confirmar Empate de Mesa?", htmlMensaje, () => { procesarGuardado(detallesMesa, prefijoMesa); mostrarToast("Empate registrado."); return true; });
}

function procesarGuardado(detallesMesa, idElemento) {
    detallesMesa.forEach(detalle => { let jugador = jugadores.find(j => j.id == detalle.idJugador); if(jugador) { jugador.puntos += detalle.puntos; jugador.partidas += 1; } });
    let nombreJornada = jornadasLista[indiceJornadaActual] || "J1";
    historial.unshift({ id: Date.now(), fecha: `${nombreJornada}, ${new Date().toLocaleTimeString()}`, resultados: detallesMesa });
    
    const mesaGuardada = document.getElementById(idElemento);
    if(mesaGuardada) { mesaGuardada.style.opacity = '0'; setTimeout(() => { mesaGuardada.style.display = 'none'; actualizarDesplegables(); }, 300); }
    guardarDatos(); 
}

// ==========================================
// RENDERIZADO DE TABLAS
// ==========================================
function renderizarClasificacion() {
    const modoSelect = document.getElementById('modo-clasificacion');
    if (!modoSelect) return;
    
    const modo = isModoEdicionExcel ? 'excel' : modoSelect.value;
    const bodyClasificacion = document.getElementById('body-clasificacion');
    const theadClasificacion = document.querySelector('#tabla-clasificacion thead');
    let datosClasificacion = [];

    if (modo === 'excel') {
        let jornadasUnicas = []; 
        historial.forEach(h => { let fecha = h.fecha.split(',')[0].trim(); if (!jornadasUnicas.includes(fecha)) jornadasUnicas.push(fecha); });
        
        jornadasUnicas.sort((a, b) => { let numA = a.match(/\d+/) ? parseInt(a.match(/\d+/)[0]) : NaN; let numB = b.match(/\d+/) ? parseInt(b.match(/\d+/)[0]) : NaN; if (!isNaN(numA) && !isNaN(numB)) return numA - numB; return a.localeCompare(b); });

        let statsTemp = {};
        jugadores.forEach(j => { statsTemp[j.id] = { id: j.id, nombre: j.nombre, totalGuardado: j.puntos, sumaHistorial: 0, previo: 0, jornadas: {} }; jornadasUnicas.forEach(jor => statsTemp[j.id].jornadas[jor] = 0); });
        historial.forEach(h => { let fechaPartida = h.fecha.split(',')[0].trim(); h.resultados.forEach(r => { if (statsTemp[r.idJugador]) { statsTemp[r.idJugador].jornadas[fechaPartida] += r.puntos; statsTemp[r.idJugador].sumaHistorial += r.puntos; } }); });

        let mostrarPrevio = false; 
        Object.values(statsTemp).forEach(st => { st.previo = st.totalGuardado - st.sumaHistorial; if (st.previo !== 0) mostrarPrevio = true; });

        let theadHTML = `<tr><th>Pos</th><th style="text-align:left;">Jugador</th>`;
        if (mostrarPrevio || isModoEdicionExcel) theadHTML += `<th style="color: #94a3b8;">Base</th>`;
        jornadasUnicas.forEach(j => { theadHTML += `<th>${j}</th>`; });
        theadHTML += `<th style="color: var(--primary);">Total</th></tr>`; 
        theadClasificacion.innerHTML = theadHTML;

        datosClasificacion = Object.values(statsTemp).filter(j => isModoEdicionExcel || j.totalGuardado !== 0 || j.sumaHistorial !== 0 || j.previo !== 0);
        datosClasificacion.sort((a, b) => b.totalGuardado - a.totalGuardado);

        if(datosClasificacion.length === 0) { bodyClasificacion.innerHTML = `<tr><td colspan="100%" style="color:#64748b; font-style:italic; padding: 25px;">No hay datos para la cuadrícula.</td></tr>`; return; }

        let limite = mostrarTodosJugadores ? datosClasificacion.length : 15;
        let filasHTML = datosClasificacion.slice(0, limite).map((j, i) => {
            let row = `<tr class="${i === 0 ? "rango-1" : i === 1 ? "rango-2" : i === 2 ? "rango-3" : ""}">
                <td data-label="Pos" style="color:#64748b; font-weight:700;">${i + 1}</td>
                <td data-label="Jugador" style="text-align: left;"><span style="margin-right:8px;">${i===0?"🥇":i===1?"🥈":i===2?"🥉":""}</span> ${j.nombre}</td>`;
                
            if (mostrarPrevio || isModoEdicionExcel) {
                row += isModoEdicionExcel 
                    ? `<td data-label="Base"><input type="number" class="excel-cell" data-jid="${j.id}" data-jor="BASE" value="${j.previo}" oninput="actualizarFilaExcel(this)"></td>` 
                    : `<td data-label="Base" style="color:#94a3b8;">${j.previo !== 0 ? j.previo : '-'}</td>`;
            }
            
            jornadasUnicas.forEach(jor => { 
                row += isModoEdicionExcel 
                    ? `<td data-label="${jor}"><input type="number" class="excel-cell" data-jid="${j.id}" data-jor="${jor}" value="${j.jornadas[jor]}" oninput="actualizarFilaExcel(this)"></td>` 
                    : `<td data-label="${jor}" style="color:#cbd5e1;">${j.jornadas[jor] !== 0 ? j.jornadas[jor] : '-'}</td>`; 
            });
            
            return row + `<td data-label="Total" class="puntos-destacados excel-total" style="font-weight:700; background: rgba(139, 92, 246, 0.1);">${j.totalGuardado}</td></tr>`;
        }).join('');
        
        bodyClasificacion.innerHTML = filasHTML;

    } else {
        let thOMW = usarOMW ? `<th title="Opponents' Match Win % (Fuerza de Calendario)" style="color: var(--accent);">OMW%</th>` : ``;
        theadClasificacion.innerHTML = `<tr><th>Pos</th><th style="text-align:left;">Jugador</th><th>Puntos</th><th>Partidas</th>${thOMW}</tr>`;
        
        let statsCalculados = calcularStatsAvanzadas(jugadores, historial);

        if (modo === 'general') { 
            datosClasificacion = Object.values(statsCalculados); 
        } else {
            let statsTemp = {}; 
            jugadores.forEach(j => statsTemp[j.id] = { ...j, puntos: 0, partidas: 0, omw: statsCalculados[j.id].omw });
            historial.forEach(h => { 
                let fechaPartida = h.fecha.split(',')[0].trim(); 
                if (fechaPartida === modo) {
                    h.resultados.forEach(r => { if (statsTemp[r.idJugador]) { statsTemp[r.idJugador].puntos += r.puntos; if(r.posicion !== "-") statsTemp[r.idJugador].partidas += 1; } }); 
                }
            });
            datosClasificacion = Object.values(statsTemp).filter(j => j.puntos !== 0 || j.partidas > 0);
        }

        let ordenados = datosClasificacion.sort((a, b) => { 
            if (b.puntos !== a.puntos) return b.puntos - a.puntos; 
            if (usarOMW) return b.omw - a.omw; 
            return 0; 
        });
        
        let colSpanNum = usarOMW ? 5 : 4;
        if(ordenados.length === 0) { bodyClasificacion.innerHTML = `<tr><td colspan="${colSpanNum}" style="color:#64748b; font-style:italic; padding: 25px;">No hay registros cargados.</td></tr>`; return; }

        let limite = mostrarTodosJugadores ? ordenados.length : 15;
        let filasHTML = ordenados.slice(0, limite).map((j, i) => {
            let tdOMW = usarOMW ? `<td data-label="OMW%" style="color:var(--accent); font-weight:600; font-size:11px;">${j.omw > 0 ? (j.omw * 100).toFixed(1) + '%' : '-'}</td>` : ``;
            return `<tr class="${i === 0 ? "rango-1" : i === 1 ? "rango-2" : i === 2 ? "rango-3" : ""}">
                <td data-label="Pos" style="color:#64748b; font-weight:700;">${i + 1}</td>
                <td data-label="Jugador" style="text-align: left;"><span style="margin-right:8px;">${i===0?"🥇":i===1?"🥈":i===2?"🥉":""}</span> ${j.nombre}</td>
                <td data-label="Puntos" class="puntos-destacados" style="font-weight:700;">${j.puntos}</td>
                <td data-label="Partidas" style="color:#64748b;">${j.partidas} jugadas</td>
                ${tdOMW}
            </tr>`;
        }).join('');
        
        if (ordenados.length > 15) filasHTML += `<tr><td colspan="100%" style="padding:0;"><button class="btn-ver-mas" onclick="toggleMostrarTodos()">${mostrarTodosJugadores ? "Ocultar Excedente" : `Ver los ${ordenados.length - 15} jugadores restantes ▼`}</button></td></tr>`;
        
        bodyClasificacion.innerHTML = filasHTML;
    }
}

function actualizarFiltroFechas() {
    const select = document.getElementById('modo-clasificacion'); 
    const selectExport = document.getElementById('export-jornada-select');
    
    let fechasUnicas = new Set(); 
    historial.forEach(h => fechasUnicas.add(h.fecha.split(',')[0].trim()));
    
    let ordenadas = Array.from(fechasUnicas).sort((a, b) => { 
        let numA = a.match(/\d+/) ? parseInt(a.match(/\d+/)[0]) : NaN; 
        let numB = b.match(/\d+/) ? parseInt(b.match(/\d+/)[0]) : NaN; 
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB; 
        return a.localeCompare(b); 
    });

    if (select && !isModoEdicionExcel) {
        let valorActual = select.value; 
        let opcionesHTML = `<option value="general">🌟 Clasificación General</option><option value="excel">📊 Vista Detallada (Excel)</option>`; 
        ordenadas.forEach(fecha => { opcionesHTML += `<option value="${fecha}">📅 ${fecha}</option>`; });
        select.innerHTML = opcionesHTML; 
        select.value = Array.from(select.options).some(opt => opt.value === valorActual) ? valorActual : 'general';
    }

    if (selectExport) {
        let valorExport = selectExport.value;
        let opcionesExport = `<option value="global">🌍 Reporte Global (Toda la Liga)</option>`;
        ordenadas.forEach(fecha => { opcionesExport += `<option value="${fecha}">📑 Reporte Específico: ${fecha}</option>`; });
        selectExport.innerHTML = opcionesExport;
        selectExport.value = Array.from(selectExport.options).some(opt => opt.value === valorExport) ? valorExport : 'global';
    }
}

function actualizarUI() {
    const listaJugadores = document.getElementById('lista-jugadores');
    if (listaJugadores) {
        listaJugadores.innerHTML = jugadores.map(j => `
            <li>
                <div class="jugador-info">
                    <strong>${j.nombre}</strong>
                    <span class="jugador-saldo">💰 ${fEuro(j.credito)}</span>
                </div>
                <div class="btn-group">
                    <button class="btn-action btn-saldo" onclick="abrirBilletera(${j.id})">💳 BILLETERA</button>
                    <button class="btn-action btn-eliminar-jugador" onclick="eliminarJugador(${j.id})">❌</button>
                </div>
            </li>
        `).join('');
    }

    const checkboxesActivos = document.querySelectorAll('.check-jugador:checked');
    const idsActivos = new Set(Array.from(checkboxesActivos).map(cb => parseInt(cb.value)));
    const contenedorCheckin = document.getElementById('jugadores-presentes');
    
    if (contenedorCheckin) {
        contenedorCheckin.innerHTML = jugadores.map(j => {
            let marcado = idsActivos.has(j.id) ? 'checked' : '';
            return `<label onclick="setTimeout(() => { document.getElementById('buscador-checkin').value = ''; filtrarCheckin(); document.getElementById('buscador-checkin').focus(); }, 50);"><input type="checkbox" class="check-jugador" value="${j.id}" ${marcado}> ${j.nombre}</label>`;
        }).join('');
    }

    const toggleEl = document.getElementById('toggle-omw');
    if (toggleEl) toggleEl.checked = usarOMW;

    let guardadoJornada = localStorage.getItem('commander_jornada_activa');
    if(guardadoJornada !== null) { 
        indiceJornadaActual = parseInt(guardadoJornada); 
        if(isNaN(indiceJornadaActual) || indiceJornadaActual >= jornadasLista.length) indiceJornadaActual = 0; 
    }
    
    const displayJornada = document.getElementById('display-jornada');
    if (displayJornada) displayJornada.innerText = jornadasLista[indiceJornadaActual];

    actualizarFiltroFechas(); 
    renderizarClasificacion();

    const listaHistorial = document.getElementById('lista-historial');
    if (listaHistorial) {
        if(historial.length === 0) listaHistorial.innerHTML = '<p style="color:#64748b; font-style:italic; padding: 10px;">Esperando la primera batalla de la liga...</p>';
        else {
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
                    let horaParts = h.fecha.split(','); let hora = horaParts.length > 1 ? horaParts[1].trim() : '';
                    let horaHtml = hora ? `<span class="historial-date">🕒 ${hora}</span>` : '';
                    let resultadosHtml = h.resultados.map(r => `<strong style="color:var(--primary);">${r.posicion}${typeof r.posicion === 'number'?'º':''}</strong> ${r.nombre} <span style="color:var(--success); font-size:12px;">(+${r.puntos} pts)</span>`).join(' <span style="color:rgba(255,255,255,0.1); margin: 0 5px;">|</span> ');
                    
                    htmlHistorial += `<div class="historial-item"><div style="display:flex; justify-content:space-between; margin-bottom:10px; align-items:center;">${horaHtml}<button class="btn-delete" style="margin:0; padding:6px 12px; font-size:10px;" onclick="anularResultado(${h.id})">Anular Mesa</button></div><p>${resultadosHtml}</p></div>`;
                });
                htmlHistorial += `</div></details>`;
            });
            listaHistorial.innerHTML = htmlHistorial;
        }
    }
}

// ==========================================
// EXPORTACIÓN EXCEL AVANZADA E INTELIGENTE
// ==========================================
window.exportarExcelInteligente = function() {
    if (typeof XLSX === 'undefined') {
        mostrarToast("Cargando librería de Excel, espera 1 segundo...", "warning");
        return;
    }

    let select = document.getElementById('export-jornada-select');
    let filtro = select ? select.value : "global";
    let esGlobal = (filtro === "global");

    let wb = XLSX.utils.book_new();

    // HOJA 1: RESUMEN (Global o Filtrado)
    let ws1_data = [["Posición", "Jugador", "Puntos", "Partidas Jugadas", "OMW %", "Saldo Actual Cartera"]];
    
    if (esGlobal) {
        let statsCalculados = calcularStatsAvanzadas(jugadores, historial);
        let datosResumen = Object.values(statsCalculados).sort((a, b) => {
            if (b.puntos !== a.puntos) return b.puntos - a.puntos;
            return b.omw - a.omw;
        });
        datosResumen.forEach((j, i) => {
            ws1_data.push([i + 1, j.nombre, j.puntos, j.partidas, j.omw > 0 ? (j.omw * 100).toFixed(1) + "%" : "0%", j.credito || 0]);
        });
    } else {
        let data = obtenerTopJornada(filtro);
        let datosResumen = data.top;
        datosResumen.forEach((j, i) => {
            ws1_data.push([i + 1, j.nombre, j.puntosHoy, j.partidasHoy, j.omw > 0 ? (j.omw * 100).toFixed(1) + "%" : "0%", j.credito || 0]);
        });
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws1_data), esGlobal ? "Clasificación Global" : `Clasificación ${filtro}`);

    // HOJA 2: MATRIZ (Solo Global) O PARTIDAS (Solo Jornada)
    if (esGlobal) {
        let jornadasUnicas = [];
        historial.forEach(h => { let f = h.fecha.split(',')[0].trim(); if (!jornadasUnicas.includes(f)) jornadasUnicas.push(f); });
        jornadasUnicas.sort((a, b) => { let nA = a.match(/\d+/) ? parseInt(a.match(/\d+/)[0]) : NaN; let nB = b.match(/\d+/) ? parseInt(b.match(/\d+/)[0]) : NaN; if (!isNaN(nA) && !isNaN(nB)) return nA - nB; return a.localeCompare(b); });

        let headerMatriz = ["Jugador", "Puntos Base"];
        jornadasUnicas.forEach(j => headerMatriz.push(j));
        headerMatriz.push("Total Liga");
        let ws2_data = [headerMatriz];

        let statsTemp = {}; let sumaHistorial = {};
        jugadores.forEach(j => { statsTemp[j.id] = { nombre: j.nombre, total: j.puntos, previo: 0, jornadas: {} }; jornadasUnicas.forEach(jor => statsTemp[j.id].jornadas[jor] = 0); sumaHistorial[j.id] = 0; });
        historial.forEach(h => { let f = h.fecha.split(',')[0].trim(); h.resultados.forEach(r => { if (statsTemp[r.idJugador]) { statsTemp[r.idJugador].jornadas[f] += r.puntos; sumaHistorial[r.idJugador] += r.puntos; } }); });
        Object.keys(statsTemp).forEach(id => statsTemp[id].previo = statsTemp[id].total - sumaHistorial[id]);

        Object.values(statsTemp).sort((a, b) => b.total - a.total).forEach(j => {
            let fila = [j.nombre, j.previo];
            jornadasUnicas.forEach(jor => fila.push(j.jornadas[jor]));
            fila.push(j.total);
            ws2_data.push(fila);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws2_data), "Matriz de Puntos");
    } else {
        let ws_mesas_data = [["Fecha y Hora", "Mesa/ID", "Posición", "Jugador", "Puntos Ganados"]];
        historial.filter(h => h.fecha.startsWith(filtro)).forEach(h => {
            h.resultados.forEach(r => {
                ws_mesas_data.push([h.fecha, h.id, r.posicion, r.nombre, r.puntos]);
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws_mesas_data), `Partidas Jugadas`);
    }

    // HOJA 3: CAJA DE LA TIENDA
    let ws3_data = [["Fecha / Jornada", "Jugadores Inscritos", "Bote Total (€)", "Caja Tienda 60% (€)", "Bote Premios 40% (€)"]];
    let finanzasFiltradas = esGlobal ? finanzas : finanzas.filter(f => f.fecha.includes(filtro));
    finanzasFiltradas.forEach(f => ws3_data.push([f.fecha, f.jugadores, f.total, f.tienda, f.premios]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws3_data), "Caja de Tienda");

    // HOJA 4: MOVIMIENTOS Y PREMIOS
    let ws4_data = [["Fecha", "Jugador", "Concepto / Motivo", "Movimiento (€)"]];
    jugadores.forEach(j => {
        if(j.transacciones && j.transacciones.length > 0) {
            j.transacciones.forEach(t => {
                if (esGlobal || t.concepto.includes(filtro) || t.fecha === filtro) {
                    ws4_data.push([t.fecha, j.nombre, t.concepto, t.cantidad]);
                }
            });
        }
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws4_data), "Historial Premios");

    let fechaHoy = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
    let nombreArchivo = esGlobal ? `Reporte_Global_PandaTools_${fechaHoy}.xlsx` : `Reporte_${filtro}_PandaTools_${fechaHoy}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
    mostrarToast(`¡Reporte Excel (${esGlobal ? 'Global' : filtro}) descargado!`);
}

function abrirModoTV() {
    if(ultimasMesasGeneradas.length === 0) { mostrarToast("Genera las mesas primero.", "warning"); return; }
    let ventanaEmergente = window.open("", "VentanaTVCommander", "width=1280,height=720");
    if (!ventanaEmergente) { mostrarToast("Pop-ups bloqueados por el navegador.", "warning"); return; }
    
    let numMesas = ultimasMesasGeneradas.length; 
    let cols = 1; let rows = 1;
    if (numMesas === 2) { cols = 2; rows = 1; } else if (numMesas <= 4) { cols = 2; rows = 2; } else if (numMesas <= 6) { cols = 3; rows = 2; } else if (numMesas <= 8) { cols = 4; rows = 2; } else { cols = 3; rows = Math.ceil(numMesas / 3); }

    let htmlPods = ""; 
    ultimasMesasGeneradas.forEach((mesa, index) => { 
        htmlPods += `<div class="tv-pod"><h3>MESA ${index + 1}</h3>`; 
        mesa.forEach(jugador => { htmlPods += `<div class="tv-player"><span class="tv-icon">⚡</span> ${jugador.nombre}</div>`; }); 
        htmlPods += `</div>`; 
    });
    
    const htmlTV = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>TV</title><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700;900&display=swap" rel="stylesheet"><style>body{background:#09090e;color:white;font-family:'Poppins',sans-serif;margin:0;padding:2vh;box-sizing:border-box;height:100vh;display:flex;flex-direction:column;overflow:hidden;}.tv-title{font-size:4vh;font-weight:900;text-align:center;margin-bottom:2vh;background:linear-gradient(to right,#c084fc,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:4px;}.tv-grid{display:grid;grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rows},1fr);gap:2vh;flex-grow:1;}.tv-pod{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:20px;padding:20px;display:flex;flex-direction:column;justify-content:center;align-items:center;box-shadow:inset 0 0 20px rgba(139,92,246,0.1);position:relative;} .tv-pod::before{content:'';position:absolute;top:0;left:0;width:100%;height:4px;background:#f59e0b;border-radius:4px 4px 0 0;} h3{color:#f59e0b;margin:0 0 15px 0;font-size:3vh;font-weight:900;}.tv-player{font-size:2.5vh;font-weight:700;margin:4px 0;display:flex;align-items:center;gap:10px;}.tv-icon{color:#8b5cf6;}</style></head><body><div class="tv-title">EMPAREJAMIENTOS DE LA RONDA</div><div class="tv-grid">${htmlPods}</div></body></html>`;
    
    ventanaEmergente.document.open(); ventanaEmergente.document.write(htmlTV); ventanaEmergente.document.close(); 
    ventanaTV = ventanaEmergente; ventanaTV.focus();
}

function exportarDatos() { 
    const a = document.createElement("a"); 
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ jugadores, historial, finanzas }, null, 2)], { type: "application/json" })); 
    a.download = `Liga_Commander_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`; 
    a.click(); mostrarToast("Copia de seguridad JSON descargada."); 
}

function importarDatos(event) {
    const archivo = event.target.files[0]; if (!archivo) return; const lector = new FileReader();
    lector.onload = function(e) {
        try { 
            const datos = JSON.parse(e.target.result); 
            if (datos.jugadores && datos.historial) {
                abrirModal("📤 Importar Respaldo", "<p>¿Estás seguro? Esto sobreescribirá todos los datos de la liga.</p>", () => { 
                    jugadores = datos.jugadores; historial = datos.historial; finanzas = datos.finanzas || [];
                    guardarDatos(); mostrarToast("Base de datos restaurada."); return true; 
                }); 
            } 
        } catch (error) { mostrarToast("Archivo JSON corrupto.", "danger"); } 
        event.target.value = '';
    }; lector.readAsText(archivo);
}

document.addEventListener("DOMContentLoaded", actualizarUI);
