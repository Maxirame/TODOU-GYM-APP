// ==========================================
// SECCIÓN 1: IMPORTACIONES DE FIREBASE
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, sendEmailVerification, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, onSnapshot, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA91qTTlkWMA5H9cEvI1yja5j3WmkzEbqY",
  authDomain: "gym-app-social.firebaseapp.com",
  projectId: "gym-app-social",
  storageBucket: "gym-app-social.firebasestorage.app",
  messagingSenderId: "788607838572",
  appId: "1:788607838572:web:85ea3b15fdf467671aab49"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setPersistence(auth, browserSessionPersistence);

// ==========================================
// SECCIÓN 2: ESTADO GLOBAL Y SEGURIDAD
// ==========================================
function escapeHTML(str) {
    return str ? String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag])) : '';
}

function obtenerFechaLocal(fecha = new Date()) {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

const TOTAL_IMAGENES_MOTIVACION = 8; 

let baseDeDatosLocal = {};
let estadoDias = {}; 
let totalEntrenamientos = 0;
let fallosHistoricos = {}; 
let pesosMaximos = {}; 
let historialGlobal = []; 
let ultimoResetSemanal = 0; 
let logrosDesbloqueados = []; 
let misEventos = {}; // NUEVO: Diccionario para guardar metas/eventos

// VARIABLES SOCIALES REAL-TIME
let miTag = ""; 
let misAmigos = []; 
let solicitudesPendientes = [];
let unsubscribeMisDatos = null; 
let listenersAmigos = {}; 
let datosAmigosEnVivo = {}; 

let diaActivo = null;
let startTime, elapsedTime = 0, timerInterval, isRunning = false;
let tiempoDescansoGlobal = 180; 
let timerDescansoInterval;
let descansoRestante = 0;

const infoEjercicios = {
    "Aperturas Mancuerna": { youtubeId: "OtW0EYqBczI" },
    "Press Banca": { youtubeId: "TAH8RxOS0VI" },
    "Press Banca Mancuerna": { youtubeId: "TAH8RxOS0VI" },
    "Press Inclinado": { youtubeId: "-zbesyTNztQ" },
    "Press Inclinado Mancuerna": { youtubeId: "-zbesyTNztQ" },
    "Vuelo Lateral": { youtubeId: "UQkdNBpjFDo" }, 
    "Press Militar": { youtubeId: "DdITN8U-kFI" },
    "Elevacion Frontal": { youtubeId: "HciAFZSN2Qo" }, 
    "Press Frances": { youtubeId: "L3bEz-vcdGU" },
    "Dominadas": { youtubeId: "BT3CSQKeEww" }
};

function actualizarRango() {
    let rango = "Cadete";
    if (totalEntrenamientos >= 730) {
        rango = (logrosDesbloqueados && logrosDesbloqueados.length >= 10) ? "Satoru Gojo" : "Avanzado";
    } else if (totalEntrenamientos >= 365) {
        rango = "Intermedio";
    } else if (totalEntrenamientos >= 180) {
        rango = "Principiante";
    }
    
    const elRango = document.getElementById('titulo-rango');
    const elDias = document.getElementById('badge-dias-rango');
    
    if(elRango) elRango.innerText = rango;
    if(elDias) elDias.innerText = `${totalEntrenamientos} DÍAS`;
}

// ==========================================
// SECCIÓN 3: SISTEMA DE AUTENTICACIÓN
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('vista-auth').style.display = 'none';
        document.getElementById('vista-semana').style.display = 'flex';
        await cargarDatosDeNube(user.uid);
    } else {
        document.getElementById('vista-auth').style.display = 'flex';
        document.getElementById('vista-semana').style.display = 'none';
        document.getElementById('vista-dia').style.display = 'none';
        document.getElementById('vista-cuenta').style.display = 'none';
    }
});

document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    const errorMsg = document.getElementById('auth-error');
    if(!email || !pass) return errorMsg.innerText = "⚠️ Completa ambos campos.";
    try {
        errorMsg.innerText = "Cargando...";
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) { errorMsg.innerText = "⚠️ Error: Verifica tu correo o contraseña."; }
});

document.getElementById('btn-register').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    const errorMsg = document.getElementById('auth-error');
    if(!email || !pass) return errorMsg.innerText = "⚠️ Completa ambos campos.";
    try {
        errorMsg.innerText = "Creando cuenta...";
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        await sendEmailVerification(userCredential.user);
        alert("¡Cuenta creada exitosamente! Te hemos enviado un correo para verificar tu identidad.");
        setTimeout(() => editarNombre(), 1000); 
    } catch (error) {
        if (error.code === 'auth/weak-password') errorMsg.innerText = "⚠️ La contraseña debe tener al menos 6 caracteres.";
        else if (error.code === 'auth/email-already-in-use') errorMsg.innerText = "⚠️ Ese correo ya está registrado.";
        else errorMsg.innerText = "⚠️ Error: " + error.code;
    }
});

document.getElementById('btn-google').addEventListener('click', async () => {
    const errorMsg = document.getElementById('auth-error');
    try {
        errorMsg.innerText = "Abriendo ventana de Google...";
        await signInWithPopup(auth, new GoogleAuthProvider());
        if (auth.currentUser.displayName) document.getElementById('nombre-usuario').innerText = auth.currentUser.displayName.split(" ")[0];
    } catch (error) { errorMsg.innerText = "⚠️ Error al conectar con Google."; }
});

document.getElementById('btn-cerrar-sesion-main').addEventListener('click', () => signOut(auth));

// ==========================================
// SECCIÓN 4: BASE DE DATOS Y SINCRONIZACIÓN
// ==========================================
let latidoInterval = null;

async function guardarDatosEnNube() {
    if (!auth.currentUser) return;
    try {
        await setDoc(doc(db, "usuarios", auth.currentUser.uid), {
            baseDeDatosLocal, estadoDias, totalEntrenamientos, fallosHistoricos, pesosMaximos, historialGlobal,
            tiempoDescansoGlobal, ultimoResetSemanal, logrosDesbloqueados, misEventos,
            nombre: document.getElementById('nombre-usuario').innerText,
            tag: miTag,
            misAmigos
        }, { merge: true });
    } catch (e) { console.warn("Modo local activo"); }
}

async function cargarDatosDeNube(uid) {
    const docRef = doc(db, "usuarios", uid);
    
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
        miTag = Math.floor(1000 + Math.random() * 9000).toString();
        document.getElementById('nombre-usuario').innerText = auth.currentUser.displayName ? auth.currentUser.displayName.split(" ")[0] : "Atleta";
        document.getElementById('tag-usuario').innerText = `#${miTag}`;
        await guardarDatosEnNube();
    }

    if(unsubscribeMisDatos) unsubscribeMisDatos();
    unsubscribeMisDatos = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            baseDeDatosLocal = data.baseDeDatosLocal || {}; estadoDias = data.estadoDias || {};
            totalEntrenamientos = data.totalEntrenamientos || 0; fallosHistoricos = data.fallosHistoricos || {};
            pesosMaximos = data.pesosMaximos || {}; historialGlobal = data.historialGlobal || [];
            tiempoDescansoGlobal = data.tiempoDescansoGlobal || 180; 
            ultimoResetSemanal = data.ultimoResetSemanal || 0;
            logrosDesbloqueados = data.logrosDesbloqueados || [];
            misEventos = data.misEventos || {};
            
            misAmigos = data.misAmigos || [];
            solicitudesPendientes = data.solicitudesPendientes || [];
            miTag = data.tag || "0000";
            
            document.getElementById('nombre-usuario').innerText = data.nombre || "Atleta";
            document.getElementById('tag-usuario').innerText = `#${miTag}`;
            document.getElementById('titulo-perfil-nombre').innerText = data.nombre || "Atleta";
            document.getElementById('letra-avatar').innerText = (data.nombre || "A").charAt(0).toUpperCase();

            renderizarSemana();
            if(typeof actualizarCountdownEventos === 'function') actualizarCountdownEventos();
            if(typeof renderizarSolicitudes === 'function') renderizarSolicitudes();
            if(typeof escucharAmigos === 'function') escucharAmigos();
        }
    });

    updateDoc(docRef, { estadoSocial: 'online', ultimaConexion: Date.now() }).catch(e=>console.log(e));
    
    if(latidoInterval) clearInterval(latidoInterval);
    latidoInterval = setInterval(() => {
        if (auth.currentUser) {
            updateDoc(docRef, { ultimaConexion: Date.now() }).catch(e=>console.warn("Error en latido"));
        }
    }, 60000);

    if(typeof activarEscuchaDeLlamadas === 'function') activarEscuchaDeLlamadas();
}

window.addEventListener('beforeunload', () => {
    if(auth.currentUser) {
        updateDoc(doc(db, "usuarios", auth.currentUser.uid), { estadoSocial: 'offline', ultimaConexion: Date.now() });
    }
});

function editarNombre() {
    let nuevoNombre = prompt("Ingresa tu nombre de atleta:", document.getElementById('nombre-usuario').innerText);
    if (nuevoNombre && nuevoNombre.trim() !== "") {
        const n = nuevoNombre.trim();
        document.getElementById('nombre-usuario').innerText = n;
        document.getElementById('titulo-perfil-nombre').innerText = n;
        document.getElementById('letra-avatar').innerText = n.charAt(0).toUpperCase();
        guardarDatosEnNube();
    }
}
document.getElementById('btn-editar-nombre').addEventListener('click', editarNombre);

// ==========================================
// SECCIÓN 5: RENDERIZADO DEL CALENDARIO
// ==========================================
function renderizarSemana() { 
    const contenedor = document.getElementById('contenedor-tarjetas');
    const hoyStr = obtenerFechaLocal();
    const hoyObj = new Date();
    
    const fechaInicio = new Date(2026, 2, 9);
    const fechaFin = new Date(hoyObj.getFullYear(), hoyObj.getMonth(), hoyObj.getDate() + 15);
    
    let html = '';
    let d = new Date(fechaInicio);
    
    while (d <= fechaFin) {
        const fechaStr = obtenerFechaLocal(d);
        const esHoy = fechaStr === hoyStr;
        const tieneFuego = estadoDias[fechaStr]; 
        const eventoTitulo = misEventos[fechaStr]; 
        
        const diasNombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const nombreDia = diasNombres[d.getDay()];
        const numDia = d.getDate();

        // Si es hoy, gana la clase 'hoy'. Si no es hoy pero tiene evento, gana 'evento-especial'.
        let claseTarjeta = '';
        if (esHoy) claseTarjeta = 'hoy';
        else if (eventoTitulo) claseTarjeta = 'evento-especial';

        html += `
            <div class="tarjeta-dia ${claseTarjeta}" data-dia="${fechaStr}">
                <span class="nombre-dia">${nombreDia}</span>
                <span class="num-dia">${numDia}</span>
                ${tieneFuego ? '<i class="ph-fill ph-fire fueguito"></i>' : '<div class="fuego-placeholder"></div>'}
                ${eventoTitulo && !esHoy ? `<div class="punto-evento" title="${escapeHTML(eventoTitulo)}"></div>` : ''}
            </div>
        `;
        
        d.setDate(d.getDate() + 1);
    }
    
    contenedor.innerHTML = html;
    actualizarRango();

    setTimeout(() => {
        const tarjetaHoy = contenedor.querySelector('.tarjeta-dia.hoy');
        if(tarjetaHoy) {
            const posicionCentro = tarjetaHoy.offsetLeft - (contenedor.clientWidth / 2) + (tarjetaHoy.clientWidth / 2);
            contenedor.scrollTo({ left: posicionCentro, behavior: 'smooth' });
        }
    }, 200);
}

document.getElementById('contenedor-tarjetas').addEventListener('click', (e) => {
    const tarjeta = e.target.closest('.tarjeta-dia');
    if (tarjeta) abrirDia(tarjeta.getAttribute('data-dia'));
});

// ==========================================
// SECCIÓN 6: VISTA DEL DÍA Y LÓGICA DE EJERCICIOS
// ==========================================
function actualizarInterfazDia() {
    if (!diaActivo) return;
    const rutinaHoy = baseDeDatosLocal[diaActivo] || [];
    
    document.getElementById('listaEjerciciosUI').innerHTML = rutinaHoy.map((ej, idx) => {
        let htmlSeries = '';
        for (let i = 0; i < ej.series; i++) {
            const r = (ej.repesRealizadas && ej.repesRealizadas[i]) || ''; 
            const p = (ej.pesosRealizados && ej.pesosRealizados[i]) || ''; 
            const isCompleted = (ej.seriesCompletadas && ej.seriesCompletadas[i]) ? 'completada' : '';

            htmlSeries += `
                <div class="serie-swipe-wrapper">
                    <div class="serie-delete-bg">
                        <button class="btn-eliminar-serie" data-ej="${idx}" data-serie="${i}" title="Eliminar Serie"><i class="ph ph-trash"></i></button>
                    </div>
                    <div class="caja-serie ${isCompleted}">
                        <span class="numero-serie">S${i + 1}</span>
                        <div class="inputs-fila">
                            <input type="number" class="input-datos input-repes" data-ej="${idx}" data-serie="${i}" placeholder="-" value="${escapeHTML(r)}">
                            <span class="etiqueta-x">x</span>
                            <input type="number" class="input-datos input-peso" data-ej="${idx}" data-serie="${i}" placeholder="-" value="${escapeHTML(p)}">
                            <span class="etiqueta-kg">kg</span>
                        </div>
                        <button class="btn-check-serie" data-ej="${idx}" data-serie="${i}"><i class="ph ph-check"></i></button>
                    </div>
                </div>`;
        }
        
        htmlSeries += `
            <div style="display: flex; justify-content: center; margin-top: 5px;">
                <button class="btn-add-serie" data-ej="${idx}" title="Agregar Serie"><i class="ph ph-plus"></i></button>
            </div>
        `;
        
        const prReps = fallosHistoricos[ej.nombre] || '--';
        const prPeso = pesosMaximos[ej.nombre] || '--';
        const infoTecnica = infoEjercicios[ej.nombre] || {};
        
        const htmlBack = infoTecnica.youtubeId ? `
            <div class="header-back-carta">
                <h4 style="color: var(--accent-neon); margin: 0; font-size: 14px; text-transform: uppercase;">Técnica Correcta</h4>
                <button class="btn-cerrar-back btn-flip-back" data-ej="${idx}" title="Volver"><i class="ph ph-x"></i></button>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; padding-top: 5px;">
                <iframe width="100%" height="200" src="https://www.youtube.com/embed/${escapeHTML(infoTecnica.youtubeId)}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="border-radius: 8px; border: 1px solid var(--border-color);"></iframe>
            </div>
        ` : `
            <div class="header-back-carta">
                <h4 style="color: var(--text-muted); margin: 0; font-size: 14px; text-transform: uppercase;">Sin Información</h4>
                <button class="btn-cerrar-back btn-flip-back" data-ej="${idx}" title="Volver"><i class="ph ph-x"></i></button>
            </div>
            <p style="text-align: center; color: var(--text-muted); font-size: 12px; margin-top: 20px;">Aún no has cargado un enlace de YouTube para este ejercicio.</p>
        `;

        return `
            <div class="ejercicio-flip-container">
                <div class="ejercicio-card-inner" id="card-inner-${idx}">
                    <div class="ejercicio-card-front ejercicio-item">
                        <div class="ejercicio-header-top">
                            <h4 class="titulo-ejercicio">${escapeHTML(ej.nombre)}</h4>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <button class="btn-info-carta btn-flip" data-ej="${idx}" title="Ver Técnica"><i class="ph ph-info"></i></button>
                                <button class="btn-eliminar-ejercicio" data-ej="${idx}" title="Eliminar Ejercicio"><i class="ph ph-x"></i></button>
                            </div>
                        </div>
                        <div class="badge-pr" id="pr-${idx}"><i class="ph-fill ph-trophy"></i> Fallo: ${prPeso}kg x ${prReps} repes</div>
                        <div class="contenedor-series">${htmlSeries}</div>
                    </div>
                    <div class="ejercicio-card-back ejercicio-item">
                        ${htmlBack}
                    </div>
                </div>
            </div>`;
    }).join('');
}

const listaUI = document.getElementById('listaEjerciciosUI');

listaUI.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-eliminar-ejercicio') || e.target.closest('.btn-eliminar-ejercicio')) {
        const btn = e.target.classList.contains('btn-eliminar-ejercicio') ? e.target : e.target.closest('.btn-eliminar-ejercicio');
        if(confirm('¿Borrar este ejercicio del día?')) {
            baseDeDatosLocal[diaActivo].splice(btn.getAttribute('data-ej'), 1);
            guardarDatosEnNube(); actualizarInterfazDia();
        }
    }
    
    if (e.target.classList.contains('btn-flip') || e.target.closest('.btn-flip')) {
        const btn = e.target.classList.contains('btn-flip') ? e.target : e.target.closest('.btn-flip');
        const ejIdx = btn.getAttribute('data-ej');
        document.getElementById(`card-inner-${ejIdx}`).classList.add('flipped');
    }
    if (e.target.classList.contains('btn-flip-back') || e.target.closest('.btn-flip-back')) {
        const btn = e.target.classList.contains('btn-flip-back') ? e.target : e.target.closest('.btn-flip-back');
        const ejIdx = btn.getAttribute('data-ej');
        document.getElementById(`card-inner-${ejIdx}`).classList.remove('flipped');
    }
    
    const btnCheck = e.target.closest('.btn-check-serie');
    if (btnCheck) {
        const ejIdx = btnCheck.getAttribute('data-ej');
        const serieIdx = btnCheck.getAttribute('data-serie');
        
        if (!baseDeDatosLocal[diaActivo][ejIdx].seriesCompletadas) {
            baseDeDatosLocal[diaActivo][ejIdx].seriesCompletadas = new Array(baseDeDatosLocal[diaActivo][ejIdx].series).fill(false);
        }
        
        const estadoAnterior = baseDeDatosLocal[diaActivo][ejIdx].seriesCompletadas[serieIdx];
        const nuevoEstado = !estadoAnterior;
        baseDeDatosLocal[diaActivo][ejIdx].seriesCompletadas[serieIdx] = nuevoEstado;
        
        guardarDatosEnNube(); 
        
        const cajaSerie = btnCheck.closest('.caja-serie');
        if (nuevoEstado) {
            cajaSerie.classList.add('completada');
            if (typeof iniciarDescansoGlobal === 'function') iniciarDescansoGlobal();
        } else {
            cajaSerie.classList.remove('completada');
        }
    }

    const btnEliminarSerie = e.target.closest('.btn-eliminar-serie');
    if (btnEliminarSerie) {
        const ejIdx = btnEliminarSerie.getAttribute('data-ej');
        const serieIdx = parseInt(btnEliminarSerie.getAttribute('data-serie'));
        
        if (confirm('¿Seguro que quieres borrar esta serie?')) {
            const ej = baseDeDatosLocal[diaActivo][ejIdx];
            if (ej.series > 1) {
                ej.series--;
                ej.repesRealizadas.splice(serieIdx, 1);
                ej.pesosRealizados.splice(serieIdx, 1);
                ej.seriesCompletadas.splice(serieIdx, 1);
            } else {
                baseDeDatosLocal[diaActivo].splice(ejIdx, 1);
            }
            guardarDatosEnNube();
            actualizarInterfazDia();
        }
    }

    if (e.target.classList.contains('btn-add-serie') || e.target.closest('.btn-add-serie')) {
        const btn = e.target.classList.contains('btn-add-serie') ? e.target : e.target.closest('.btn-add-serie');
        const ejIdx = btn.getAttribute('data-ej');
        const ej = baseDeDatosLocal[diaActivo][ejIdx];
        
        ej.series++;
        if (!ej.repesRealizadas) ej.repesRealizadas = [];
        if (!ej.pesosRealizados) ej.pesosRealizados = [];
        if (!ej.seriesCompletadas) ej.seriesCompletadas = [];
        
        ej.repesRealizadas.push('');
        ej.pesosRealizados.push('');
        ej.seriesCompletadas.push(false);
        
        guardarDatosEnNube();
        actualizarInterfazDia();
    }
});

listaUI.addEventListener('change', (e) => {
    const t = e.target;
    if (t.classList.contains('input-repes') || t.classList.contains('input-peso')) {
        const ejIdx = t.getAttribute('data-ej'); const serieIdx = t.getAttribute('data-serie');
        const tipo = t.classList.contains('input-repes') ? 'repesRealizadas' : 'pesosRealizados';
        
        if (!baseDeDatosLocal[diaActivo][ejIdx][tipo]) {
            baseDeDatosLocal[diaActivo][ejIdx][tipo] = new Array(baseDeDatosLocal[diaActivo][ejIdx].series).fill('');
        }
        baseDeDatosLocal[diaActivo][ejIdx][tipo][serieIdx] = t.value;
        
        const nombreEj = baseDeDatosLocal[diaActivo][ejIdx].nombre;
        const repsStr = baseDeDatosLocal[diaActivo][ejIdx].repesRealizadas[serieIdx];
        const pesoStr = baseDeDatosLocal[diaActivo][ejIdx].pesosRealizados[serieIdx];
        
        if (repsStr !== '' && pesoStr !== '' && repsStr !== undefined && pesoStr !== undefined) {
            const currentReps = parseFloat(repsStr);
            const currentPeso = parseFloat(pesoStr);
            let maxPesoGuardado = parseFloat(pesosMaximos[nombreEj]) || 0;
            let maxRepsGuardadas = parseFloat(fallosHistoricos[nombreEj]) || 0;
            let isNewPR = false;

            if (currentPeso > maxPesoGuardado) isNewPR = true;
            else if (currentPeso === maxPesoGuardado && currentReps > maxRepsGuardadas) isNewPR = true;

            if (isNewPR) {
                pesosMaximos[nombreEj] = currentPeso;
                fallosHistoricos[nombreEj] = currentReps;
                
                const badge = document.getElementById(`pr-${ejIdx}`);
                if(badge) {
                    badge.innerHTML = `<i class="ph-fill ph-trophy" style="color:#ffd700;"></i> Fallo: ${currentPeso}kg x ${currentReps} repes`;
                    badge.style.color = "var(--success-green)";
                    setTimeout(() => { badge.style.color = "var(--text-muted)"; }, 1500);
                }
            }
        }
        guardarDatosEnNube();
    }
});

let swipeStartX = 0;
let swipeStartY = 0;
let currentTranslate = 0;
let swipeActiveEl = null;
let isDragging = false;

const iniciarSwipe = (e, elemento) => {
    if (e.type === 'mousedown' && e.button !== 0) return; 
    if (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'button' || e.target.closest('button')) return;

    if (elemento) {
        isDragging = true;
        swipeActiveEl = elemento;
        swipeStartX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        swipeStartY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        
        swipeActiveEl.style.transition = 'none';
        currentTranslate = swipeActiveEl.classList.contains('swiped') ? -65 : 0;
    } else {
        document.querySelectorAll('.caja-serie.swiped').forEach(el => {
            el.style.transform = '';
            el.classList.remove('swiped');
        });
    }
};

const moverSwipe = (e) => {
    if (!isDragging || !swipeActiveEl) return;
    
    const currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const currentY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
    const diffX = currentX - swipeStartX;
    const diffY = Math.abs(currentY - swipeStartY);
    
    if (diffY > 10 && diffY > Math.abs(diffX)) {
        isDragging = false;
        swipeActiveEl.style.transform = '';
        return; 
    }

    if (e.cancelable) e.preventDefault(); 
    
    let newTranslate = currentTranslate + diffX;
    if (newTranslate > 0) newTranslate = 0; 
    if (newTranslate < -80) newTranslate = -80; 

    swipeActiveEl.style.transform = `translateX(${newTranslate}px)`;
};

const finalizarSwipe = (e) => {
    if (!isDragging || !swipeActiveEl) return;
    isDragging = false;
    
    swipeActiveEl.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    
    const currentX = e.type.includes('mouse') ? e.clientX : e.changedTouches[0].clientX;
    const diffX = currentX - swipeStartX;
    const finalPos = currentTranslate + diffX;

    swipeActiveEl.style.transform = ''; 

    if (finalPos < -35) { 
        swipeActiveEl.classList.add('swiped');
    } else { 
        swipeActiveEl.classList.remove('swiped');
    }
    swipeActiveEl = null;
};

listaUI.addEventListener('touchstart', (e) => iniciarSwipe(e, e.target.closest('.caja-serie')), {passive: true});
listaUI.addEventListener('touchmove', moverSwipe, {passive: false});
listaUI.addEventListener('touchend', finalizarSwipe);
listaUI.addEventListener('mousedown', (e) => iniciarSwipe(e, e.target.closest('.caja-serie')));
listaUI.addEventListener('mousemove', moverSwipe);
listaUI.addEventListener('mouseup', finalizarSwipe);
listaUI.addEventListener('mouseleave', finalizarSwipe);

document.getElementById('btn-toggle-add').addEventListener('click', () => {
    document.getElementById('burbuja-add-ejercicio').classList.toggle('visible');
});

document.getElementById('btn-cerrar-add').addEventListener('click', () => {
    document.getElementById('burbuja-add-ejercicio').classList.remove('visible');
});

document.getElementById('btn-agregar-ejercicio').addEventListener('click', () => {
    const nombre = document.getElementById('inputEjercicio').value.trim();
    const series = parseInt(document.getElementById('inputSeries').value);
    if (!nombre || !series) return alert("¡Hey! Completá el nombre y las series.");
    if (!baseDeDatosLocal[diaActivo]) baseDeDatosLocal[diaActivo] = [];
    
    baseDeDatosLocal[diaActivo].push({ 
        nombre, series, 
        repesRealizadas: new Array(series).fill(''), 
        pesosRealizados: new Array(series).fill(''),
        seriesCompletadas: new Array(series).fill(false)
    });
    
    document.getElementById('inputEjercicio').value = ''; document.getElementById('inputSeries').value = '';
    guardarDatosEnNube(); actualizarInterfazDia();
    document.getElementById('burbuja-add-ejercicio').classList.remove('visible');
});

document.getElementById('btn-limpiar-checks').addEventListener('click', () => {
    const rutina = baseDeDatosLocal[diaActivo];
    if (!diaActivo || !rutina || rutina.length === 0) return;
    
    if(confirm('¿Seguro que quieres desmarcar todas las series de hoy? Tus pesos anotados no se borrarán.')) {
        rutina.forEach(ej => {
            if(ej.seriesCompletadas) ej.seriesCompletadas = new Array(ej.series).fill(false);
        });
        guardarDatosEnNube();
        actualizarInterfazDia();
    }
});

// ==========================================
// SECCIÓN 7: CRONÓMETRO Y DESCANSOS (LÓGICA FUEGUITO)
// ==========================================
function formatearTiempo(ms) {
    let seg = Math.floor((ms / 1000) % 60);
    let min = Math.floor((ms / (1000 * 60)) % 60);
    let hrs = Math.floor((ms / (1000 * 60 * 60)));
    return `${hrs.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
}

function actualizarDisplayCrono() {
    document.getElementById('display-cronometro').innerText = formatearTiempo(elapsedTime);
}

document.getElementById('btn-comenzar-pausa').addEventListener('click', () => {
    if (isRunning) {
        clearInterval(timerInterval);
        document.getElementById('btn-comenzar-pausa').innerHTML = '<i class="ph-fill ph-play"></i> CONTINUAR';
        isRunning = false;
        if(auth.currentUser) updateDoc(doc(db, "usuarios", auth.currentUser.uid), { estadoSocial: 'online' });
    } else {
        startTime = Date.now() - elapsedTime;
        if(auth.currentUser) updateDoc(doc(db, "usuarios", auth.currentUser.uid), { estadoSocial: 'entrenando' });
        
        timerInterval = setInterval(() => {
            elapsedTime = Date.now() - startTime;
            actualizarDisplayCrono();
            
            if (elapsedTime >= 60000 && diaActivo && !estadoDias[diaActivo]) {
                estadoDias[diaActivo] = true;
                totalEntrenamientos++;
                guardarDatosEnNube();
                renderizarSemana(); 
                alert("🔥 ¡MÁS DE 1 MINUTO DE ESFUERZO! 🔥\nHas ganado tu llama diaria y sumaste 1 día de entrenamiento a tu récord.");
            }
        }, 1000);
        
        document.getElementById('btn-comenzar-pausa').innerHTML = '<i class="ph-fill ph-pause"></i> PAUSA';
        isRunning = true;
    }
});

document.getElementById('btn-reset-crono').addEventListener('click', () => {
    if (confirm('¿Reiniciar cronómetro a cero?')) {
        clearInterval(timerInterval);
        elapsedTime = 0;
        isRunning = false;
        actualizarDisplayCrono();
        document.getElementById('btn-comenzar-pausa').innerHTML = '<i class="ph-fill ph-play"></i> COMENZAR';
        if(auth.currentUser) updateDoc(doc(db, "usuarios", auth.currentUser.uid), { estadoSocial: 'online' });
    }
});

function iniciarDescansoGlobal() {
    clearInterval(timerDescansoInterval);
    descansoRestante = tiempoDescansoGlobal; 
    const isla = document.getElementById('isla-descanso');
    isla.classList.add('visible');
    actualizarUIISla();
    
    timerDescansoInterval = setInterval(() => {
        descansoRestante--;
        actualizarUIISla();
        if (descansoRestante <= 0) {
            clearInterval(timerDescansoInterval);
            isla.classList.remove('visible');
        }
    }, 1000);
}

function actualizarUIISla() {
    let m = Math.floor(descansoRestante / 60).toString().padStart(2, '0');
    let s = (descansoRestante % 60).toString().padStart(2, '0');
    const display = document.getElementById('tiempo-descanso-ui');
    if(display) display.innerText = `${m}:${s}`;
}

document.getElementById('btn-cerrar-descanso')?.addEventListener('click', () => {
    clearInterval(timerDescansoInterval);
    document.getElementById('isla-descanso').classList.remove('visible');
});

// ==========================================
// SECCIÓN 8: FLUJO DE VENTANAS E HISTORIAL
// ==========================================
function abrirDia(dia) {
    diaActivo = dia;
    
    const [year, month, day] = dia.split('-');
    const fechaObj = new Date(year, month - 1, day);
    const diasNombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const titulo = `${diasNombres[fechaObj.getDay()]} ${day}/${month}`;
    
    document.getElementById('titulo-dia').innerText = `${titulo}`;
    document.getElementById('vista-semana').style.display = 'none';
    document.getElementById('vista-cuenta').style.display = 'none';
    document.getElementById('vista-dia').style.display = 'flex';
    
    actualizarInterfazDia(); 
    actualizarDisplayCrono();
}

document.getElementById('btn-volver-semana').addEventListener('click', () => { diaActivo = null; document.getElementById('vista-dia').style.display = 'none'; document.getElementById('vista-cuenta').style.display = 'none'; document.getElementById('vista-semana').style.display = 'flex'; });
document.getElementById('btn-abrir-cuenta').addEventListener('click', () => { document.getElementById('vista-semana').style.display = 'none'; document.getElementById('vista-dia').style.display = 'none'; document.getElementById('vista-cuenta').style.display = 'flex'; renderizarHistorial(); });
document.getElementById('btn-volver-desde-cuenta').addEventListener('click', () => { document.getElementById('vista-dia').style.display = 'none'; document.getElementById('vista-cuenta').style.display = 'none'; document.getElementById('vista-semana').style.display = 'flex'; });

document.getElementById('btn-guardar-dia').addEventListener('click', () => {
    if (!diaActivo || !baseDeDatosLocal[diaActivo] || baseDeDatosLocal[diaActivo].length === 0) return alert("No tienes ejercicios cargados hoy para guardar.");
    
    // Refuerzo: Si al guardar pasaste el minuto, forzamos el fueguito
    if (elapsedTime >= 600000 && !estadoDias[diaActivo]) {
        estadoDias[diaActivo] = true;
        totalEntrenamientos++;
        renderizarSemana();
    }

    historialGlobal.unshift({ fecha: new Date().toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' }), diaSemana: diaActivo, rutina: JSON.parse(JSON.stringify(baseDeDatosLocal[diaActivo])), tiempo: document.getElementById('display-cronometro').innerText });
    guardarDatosEnNube(); alert(`¡Día guardado con éxito!\nTiempo: ${document.getElementById('display-cronometro').innerText}`);
});

document.getElementById('btn-reiniciar-historico').addEventListener('click', () => { 
    if(confirm('⚠️ ¿Reiniciar tus días totales de gloria a cero? Esto afectará tu rango actual.')) { 
        totalEntrenamientos = 0; 
        estadoDias = {}; 
        guardarDatosEnNube(); 
        actualizarRango(); 
        renderizarSemana();
    } 
});

document.getElementById('btn-borrar-todo').addEventListener('click', () => { if(confirm('⚠️ ¿Estás seguro de borrar TODO tu historial guardado? Esta acción no se puede deshacer.')) { historialGlobal = []; guardarDatosEnNube(); renderizarHistorial(); alert('Historial borrado con éxito.'); } });

function renderizarHistorial() {
    const contenedor = document.getElementById('contenedor-historial');
    if (historialGlobal.length === 0) return contenedor.innerHTML = '<p style="text-align:center; color: var(--text-muted);">Aún no has guardado ningún entrenamiento.</p>';
    contenedor.innerHTML = historialGlobal.map(registro => `
        <div class="tarjeta-historial">
            <div class="fecha-historial">${escapeHTML(registro.fecha)} <span class="badge-dia">${escapeHTML(registro.diaSemana)} - <i class="ph ph-clock"></i> ${escapeHTML(registro.tiempo)}</span></div>
            ${registro.rutina.map(ej => `
                <div class="item-historial-ejercicio"><h4>${escapeHTML(ej.nombre)}</h4><div class="resumen-series">
                    ${Array.from({length: ej.series}).map((_, i) => `<div class="mini-serie">S${i+1}: <strong>${escapeHTML((ej.repesRealizadas && ej.repesRealizadas[i]) || '-')}</strong>x<strong>${escapeHTML((ej.pesosRealizados && ej.pesosRealizados[i]) || '-')}kg</strong></div>`).join('')}
                </div></div>
            `).join('')}
        </div>`).join('');
}

// ==========================================
// SECCIÓN 9: RED SOCIAL Y MOTOR EN TIEMPO REAL
// ==========================================
document.addEventListener('click', async (e) => {
    if (e.target.closest('.btn-add-amigo')) {
        let input = prompt("Añade a tu compañero de entreno\n\nIngresa su nombre y tag exactos (Ejemplo: Maxi #3423):");
        if (!input || !input.includes('#')) return;

        let partes = input.split('#');
        let nombreBuscado = partes[0].trim();
        let tagBuscado = partes[1].trim();

        if (nombreBuscado.toLowerCase() === document.getElementById('nombre-usuario').innerText.toLowerCase() && tagBuscado === miTag) {
            return alert("⚠️ Eres un lobo solitario, pero no puedes agregarte a ti mismo.");
        }

        try {
            const usuariosRef = collection(db, "usuarios");
            const q = query(usuariosRef, where("nombre", "==", nombreBuscado), where("tag", "==", tagBuscado));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                alert("❌ No se encontró al atleta. Revisa mayúsculas y minúsculas.");
            } else {
                querySnapshot.forEach(async (docSnap) => {
                    const amigoId = docSnap.id;

                    if (misAmigos.some(a => a.uid === amigoId)) return alert("⚠️ Ya son amigos.");

                    const yo = { uid: auth.currentUser.uid, nombre: document.getElementById('nombre-usuario').innerText, tag: miTag };
                    await updateDoc(doc(db, "usuarios", amigoId), { solicitudesPendientes: arrayUnion(yo) });

                    alert(`✅ Solicitud enviada a ${escapeHTML(nombreBuscado)}.`);
                });
            }
        } catch (error) { console.error(error); }
    }

    if (e.target.closest('.btn-ver-solicitudes')) {
        document.querySelectorAll('.panel-solicitudes').forEach(panel => {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });
    }

    if (e.target.closest('.btn-aceptar-sol')) {
        const btn = e.target.closest('.btn-aceptar-sol');
        const idx = btn.getAttribute('data-idx');
        const amigoData = solicitudesPendientes[idx];
        
        solicitudesPendientes.splice(idx, 1);
        misAmigos.push(amigoData);
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { solicitudesPendientes, misAmigos });

        const yo = { uid: auth.currentUser.uid, nombre: document.getElementById('nombre-usuario').innerText, tag: miTag };
        await updateDoc(doc(db, "usuarios", amigoData.uid), { misAmigos: arrayUnion(yo) });
        
        alert(`🤝 ¡Tú y ${escapeHTML(amigoData.nombre)} ahora son compañeros!`);
        renderizarSolicitudes();
    }

    if (e.target.closest('.btn-rechazar-sol')) {
        const btn = e.target.closest('.btn-rechazar-sol');
        const idx = btn.getAttribute('data-idx');
        solicitudesPendientes.splice(idx, 1);
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { solicitudesPendientes });
        renderizarSolicitudes();
    }

    if (e.target.closest('.btn-llamar')) {
        const item = e.target.closest('.amigo-item');
        const amigoUid = item.querySelector('.btn-eliminar-amigo').getAttribute('data-uid');
        const amigoNombre = item.querySelector('.amigo-nombre').childNodes[0].nodeValue.trim(); 
        if(typeof iniciarLlamada === 'function') iniciarLlamada(amigoUid, amigoNombre);
    }

    if (e.target.closest('.btn-eliminar-amigo')) {
        const btn = e.target.closest('.btn-eliminar-amigo');
        const amigoUid = btn.getAttribute('data-uid');
        if (confirm('¿Seguro que quieres eliminar a este compañero?')) {
            misAmigos = misAmigos.filter(a => a.uid !== amigoUid);
            await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { misAmigos });
            try {
                const amigoRef = doc(db, "usuarios", amigoUid);
                const amigoSnap = await getDoc(amigoRef);
                if (amigoSnap.exists()) {
                    let amigosDeMiAmigo = amigoSnap.data().misAmigos || [];
                    amigosDeMiAmigo = amigosDeMiAmigo.filter(a => a.uid !== auth.currentUser.uid);
                    await updateDoc(amigoRef, { misAmigos: amigosDeMiAmigo });
                }
            } catch (error) {}

            if (listenersAmigos[amigoUid]) {
                listenersAmigos[amigoUid](); 
                delete listenersAmigos[amigoUid];
                delete datosAmigosEnVivo[amigoUid];
            }
            renderizarAmigos();
        }
    }
});

function renderizarSolicitudes() {
    const listas = document.querySelectorAll('.lista-solicitudes');
    const badges = document.querySelectorAll('.badge-notif');
    
    if (solicitudesPendientes.length > 0) {
        badges.forEach(b => b.style.display = 'block');
        const html = solicitudesPendientes.map((sol, idx) => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); padding:8px 12px; border-radius:12px; border:1px solid var(--border-color); margin-bottom:5px;">
                <span style="font-size:12px; font-weight:700;">${escapeHTML(sol.nombre)} <span style="color:var(--text-muted); font-weight:400;">#${escapeHTML(sol.tag)}</span></span>
                <div style="display:flex; gap:8px;">
                    <button class="btn-aceptar-sol" data-idx="${idx}" style="background:var(--success-green); color:#000; border:none; border-radius:8px; padding:6px 12px; cursor:pointer; font-weight:800;"><i class="ph ph-check" style="pointer-events:none;"></i></button>
                    <button class="btn-rechazar-sol" data-idx="${idx}" style="background:var(--danger); color:#fff; border:none; border-radius:8px; padding:6px 12px; cursor:pointer; font-weight:800;"><i class="ph ph-x" style="pointer-events:none;"></i></button>
                </div>
            </div>
        `).join('');
        listas.forEach(l => l.innerHTML = html);
    } else {
        badges.forEach(b => b.style.display = 'none');
        document.querySelectorAll('.panel-solicitudes').forEach(p => p.style.display = 'none');
        listas.forEach(l => l.innerHTML = '');
    }
}

function escucharAmigos() {
    misAmigos.forEach(amigo => {
        if (!listenersAmigos[amigo.uid]) {
            listenersAmigos[amigo.uid] = onSnapshot(doc(db, "usuarios", amigo.uid), (docSnap) => {
                if (docSnap.exists()) {
                    datosAmigosEnVivo[amigo.uid] = docSnap.data(); 
                    renderizarAmigos(); 
                }
            });
        }
    });
    renderizarAmigos();
}

function renderizarAmigos() {
    const contenedores = document.querySelectorAll('.contenedor-lista-amigos');
    if (contenedores.length === 0) return;
    
    if (misAmigos.length === 0) {
        const msgVacio = '<p style="text-align:center; color:var(--text-muted); font-size:12px; margin-top:20px;">Aún no tienes compañeros de batalla.</p>';
        contenedores.forEach(c => c.innerHTML = msgVacio);
        return;
    }

    const html = misAmigos.map(amigo => {
        const dataVivo = datosAmigosEnVivo[amigo.uid] || {};
        const nombreMostrar = dataVivo.nombre || amigo.nombre; 
        
        let estado = dataVivo.estadoSocial || 'offline';
        const ultConexion = dataVivo.ultimaConexion || 0;
        const ahora = Date.now();
        
        if (estado !== 'offline' && (ahora - ultConexion > 180000)) {
            estado = 'offline';
        }
        
        let textoEstado = ""; let claseEstado = "offline";
        if (estado === 'online') { textoEstado = "Online"; claseEstado = "online"; } 
        else if (estado === 'entrenando') { textoEstado = "Entrenando..."; claseEstado = "entrenando"; } 
        else {
            if(ultConexion > 0) {
                const mins = Math.floor((ahora - ultConexion) / 60000);
                const horas = Math.floor(mins / 60);
                const dias = Math.floor(horas / 24);
                if (dias > 0) textoEstado = `hace ${dias}d`;
                else if (horas > 0) textoEstado = `hace ${horas}h`;
                else if (mins > 0) textoEstado = `hace ${mins}m`;
                else textoEstado = "Desconectado";
            } else { textoEstado = "Desconectado"; }
            claseEstado = "offline";
        }

        return `
        <div class="amigo-item ${claseEstado}"> 
            <div class="amigo-avatar">${escapeHTML(nombreMostrar).charAt(0).toUpperCase()}</div>
            <div class="amigo-info">
                <span class="amigo-nombre">${escapeHTML(nombreMostrar)} <span class="amigo-tag">#${escapeHTML(amigo.tag)}</span></span>
                <span class="amigo-estado">${textoEstado}</span>
            </div>
            <div style="display: flex; gap: 5px;">
                <button class="btn-llamar" title="Entrenar Juntos"><i class="ph-fill ph-video-camera" style="pointer-events:none;"></i></button>
                <button class="btn-eliminar-amigo" data-uid="${amigo.uid}" title="Eliminar Amigo"><i class="ph ph-user-minus" style="pointer-events:none;"></i></button>
            </div>
        </div>
        `;
    }).join('');

    contenedores.forEach(c => c.innerHTML = html);
}

// ==========================================
// SECCIÓN 10: MOTOR DE VIDEOLLAMADAS (WEBRTC)
// ==========================================
const servidoresG = { iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }] };

let pc = null;
let localStream = null;
let remoteStream = null;
let currentCallDocId = null;
let unsubscribeLlamadasEntrantes = null;
let unsubscribeCall = null;

const videoLocal = document.getElementById('video-local');
const videoRemoto = document.getElementById('video-remoto');
const modalEntrante = document.getElementById('modal-llamada-entrante');
const salaVideo = document.getElementById('sala-video');

async function configurarCamara() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        remoteStream = new MediaStream();
        videoLocal.srcObject = localStream;
        videoRemoto.srcObject = remoteStream;
    } catch (err) {
        alert("⚠️ Necesitas dar permisos de cámara y micrófono a tu navegador para entrenar juntos.");
        throw err;
    }
}

function crearConexion() {
    pc = new RTCPeerConnection(servidoresG);
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    pc.ontrack = event => { event.streams[0].getTracks().forEach(track => { remoteStream.addTrack(track); }); };
}

async function iniciarLlamada(amigoUid, amigoNombre) {
    alert(`Llamando a ${escapeHTML(amigoNombre)}... Enciende tu cámara.`);
    await configurarCamara();
    salaVideo.classList.remove('oculto');
    crearConexion();

    const callDocRef = doc(collection(db, "llamadas"));
    const offerCandidatesRef = collection(callDocRef, "offerCandidates");
    const answerCandidatesRef = collection(callDocRef, "answerCandidates");

    currentCallDocId = callDocRef.id;

    pc.onicecandidate = event => { if(event.candidate) addDoc(offerCandidatesRef, event.candidate.toJSON()); };

    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const callData = {
        callerId: auth.currentUser.uid,
        callerName: document.getElementById('nombre-usuario').innerText,
        calleeId: amigoUid,
        offer: { type: offerDescription.type, sdp: offerDescription.sdp }
    };

    await setDoc(callDocRef, callData);

    unsubscribeCall = onSnapshot(callDocRef, (docSnap) => {
        const data = docSnap.data();
        if (!pc.currentRemoteDescription && data?.answer) {
            const answerDescription = new RTCSessionDescription(data.answer);
            pc.setRemoteDescription(answerDescription);
        }
        if (!docSnap.exists()) colgarLlamada(); 
    });

    onSnapshot(answerCandidatesRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
            }
        });
    });
}

function activarEscuchaDeLlamadas() {
    if(unsubscribeLlamadasEntrantes) unsubscribeLlamadasEntrantes();
    
    const q = query(collection(db, "llamadas"), where("calleeId", "==", auth.currentUser.uid));
    
    unsubscribeLlamadasEntrantes = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const callData = change.doc.data();
                currentCallDocId = change.doc.id;
                document.getElementById('texto-llamante').innerText = `${escapeHTML(callData.callerName)} te está llamando para entrenar...`;
                modalEntrante.classList.remove('oculto');
            }
            if (change.type === "removed") {
                modalEntrante.classList.add('oculto');
                if (currentCallDocId === change.doc.id) colgarLlamada(false); 
            }
        });
    });
}

document.getElementById('btn-aceptar-llamada').addEventListener('click', async () => {
    modalEntrante.classList.add('oculto');
    await configurarCamara();
    salaVideo.classList.remove('oculto');
    crearConexion();

    const callDocRef = doc(db, "llamadas", currentCallDocId);
    const answerCandidatesRef = collection(callDocRef, "answerCandidates");
    const offerCandidatesRef = collection(callDocRef, "offerCandidates");

    pc.onicecandidate = event => { if(event.candidate) addDoc(answerCandidatesRef, event.candidate.toJSON()); };

    const callDocSnap = await getDoc(callDocRef);
    const callData = callDocSnap.data();

    const offerDescription = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    await updateDoc(callDocRef, { answer: { type: answerDescription.type, sdp: answerDescription.sdp } });

    onSnapshot(offerCandidatesRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
            }
        });
    });

    unsubscribeCall = onSnapshot(callDocRef, (docSnap) => { if (!docSnap.exists()) colgarLlamada(); });
});

document.getElementById('btn-rechazar-llamada').addEventListener('click', () => {
    modalEntrante.classList.add('oculto');
    if(currentCallDocId) deleteDoc(doc(db, "llamadas", currentCallDocId));
    currentCallDocId = null;
});

document.getElementById('btn-colgar').addEventListener('click', () => colgarLlamada(true));

async function colgarLlamada(borrarDoc = true) {
    salaVideo.classList.add('oculto');
    modalEntrante.classList.add('oculto');
    
    if (localStream) { localStream.getTracks().forEach(track => track.stop()); localStream = null; }
    if (remoteStream) { remoteStream.getTracks().forEach(track => track.stop()); remoteStream = null; }
    if (pc) { pc.close(); pc = null; }
    if (unsubscribeCall) { unsubscribeCall(); unsubscribeCall = null; }
    if (borrarDoc && currentCallDocId) { await deleteDoc(doc(db, "llamadas", currentCallDocId)); }
    currentCallDocId = null;
}

// ==========================================
// SECCIÓN 11: LÓGICA DE METAS Y EVENTOS
// ==========================================
let fechaEventoActivo = null;

document.getElementById('btn-nuevo-evento').addEventListener('click', () => {
    document.getElementById('modal-evento').classList.add('visible'); // Se anima desde el +
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    document.getElementById('input-fecha-evento').value = obtenerFechaLocal(manana);
});

document.getElementById('btn-cerrar-modal-evento').addEventListener('click', () => {
    document.getElementById('modal-evento').classList.remove('visible'); // Vuelve al +
});

document.getElementById('btn-guardar-evento').addEventListener('click', () => {
    const titulo = document.getElementById('input-titulo-evento').value.trim();
    const fecha = document.getElementById('input-fecha-evento').value;
    
    if(!titulo || !fecha) return alert('Por favor, ingresa el nombre de la meta y selecciona una fecha.');
    
    misEventos[fecha] = titulo;
    guardarDatosEnNube();
    
    renderizarSemana();
    actualizarCountdownEventos();
    
    document.getElementById('modal-evento').classList.remove('visible'); 
    document.getElementById('input-titulo-evento').value = '';
});

function actualizarCountdownEventos() {
    const contenedor = document.getElementById('contenedor-proximo-evento');
    const texto = document.getElementById('texto-proximo-evento');
    
    const hoyStr = obtenerFechaLocal();
    const hoyObj = new Date(hoyStr + 'T00:00:00'); 
    
    let proximoEvento = null;
    let minDiff = Infinity;
    fechaEventoActivo = null;

    for (const [fechaStr, titulo] of Object.entries(misEventos)) {
        const evObj = new Date(fechaStr + 'T00:00:00');
        const diffTime = evObj.getTime() - hoyObj.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays < minDiff) {
            minDiff = diffDays;
            proximoEvento = { titulo, dias: diffDays };
            fechaEventoActivo = fechaStr;
        }
    }

    if (proximoEvento) {
        contenedor.style.display = 'flex';
        let txtDias = proximoEvento.dias === 0 ? "¡Es HOY!" : (proximoEvento.dias === 1 ? "Falta 1 día" : `Faltan ${proximoEvento.dias} días`);
        texto.innerText = `${txtDias} para: ${proximoEvento.titulo}`;
    } else {
        contenedor.style.display = 'none';
    }
}

// Lógica para el botón de eliminar evento
document.getElementById('btn-eliminar-evento-activo')?.addEventListener('click', () => {
    if(fechaEventoActivo && confirm(`¿Seguro que quieres eliminar la meta: "${misEventos[fechaEventoActivo]}"?`)) {
        delete misEventos[fechaEventoActivo];
        guardarDatosEnNube();
        renderizarSemana();
        actualizarCountdownEventos();
    }
});
