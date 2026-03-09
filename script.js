// ==========================================
// 1. IMPORTACIONES DE FIREBASE
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Tu Llave Maestra (Verificada)
const firebaseConfig = {
  apiKey: "AIzaSyA91qTTlkWMA5H9cEvI1yja5j3WmkzEbqY",
  authDomain: "gym-app-social.firebaseapp.com",
  projectId: "gym-app-social",
  storageBucket: "gym-app-social.firebasestorage.app",
  messagingSenderId: "788607838572",
  appId: "1:788607838572:web:85ea3b15fdf467671aab49"
};

// Inicializamos la app en la nube
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==========================================
// 2. VARIABLES DE MEMORIA DE LA APP
// ==========================================
const diasDeLaSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const TOTAL_IMAGENES_MOTIVACION = 8; 

let baseDeDatosLocal = {};
let estadoDias = {};
let totalEntrenamientos = 0;
let fallosHistoricos = {}; 
let pesosMaximos = {}; 
let historialGlobal = []; 
let diaActivo = null;
let domElementCrono = null;

// ==========================================
// 3. SISTEMA DE AUTENTICACIÓN (LOGIN)
// ==========================================

// El "Vigilante": Revisa si ya estabas logueado al entrar a la página
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

// BOTÓN: INICIAR SESIÓN
document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    const errorMsg = document.getElementById('auth-error');
    if(!email || !pass) { errorMsg.innerText = "⚠️ Completa ambos campos."; return; }
    
    try {
        errorMsg.innerText = "Cargando...";
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        console.error("Error de Firebase:", error.code);
        // Mostrar el error real en pantalla para saber qué pasa
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
            errorMsg.innerText = "⚠️ Correo o contraseña incorrectos.";
        } else {
            errorMsg.innerText = "⚠️ Error: " + error.code;
        }
    }
});

// BOTÓN: CREAR CUENTA
document.getElementById('btn-register').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    const errorMsg = document.getElementById('auth-error');
    if(!email || !pass) { errorMsg.innerText = "⚠️ Completa ambos campos."; return; }
    
    try {
        errorMsg.innerText = "Creando cuenta...";
        await createUserWithEmailAndPassword(auth, email, pass);
        setTimeout(() => editarNombre(), 1000); 
    } catch (error) {
        console.error("Error de Firebase:", error.code);
        if (error.code === 'auth/weak-password') {
            errorMsg.innerText = "⚠️ La contraseña debe tener al menos 6 caracteres.";
        } else if (error.code === 'auth/email-already-in-use') {
            errorMsg.innerText = "⚠️ Ese correo ya está registrado.";
        } else {
            errorMsg.innerText = "⚠️ Error: " + error.code;
        }
    }
});

// BOTÓN: CERRAR SESIÓN
document.getElementById('btn-cerrar-sesion').addEventListener('click', () => {
    signOut(auth);
});


// ==========================================
// 4. SINCRONIZACIÓN CON FIREBASE (NUBE)
// ==========================================

async function guardarDatosEnNube() {
    if (!auth.currentUser) return;
    const userRef = doc(db, "usuarios", auth.currentUser.uid);
    
    await setDoc(userRef, {
        baseDeDatosLocal,
        estadoDias,
        totalEntrenamientos,
        fallosHistoricos,
        pesosMaximos,
        historialGlobal,
        nombre: document.getElementById('nombre-usuario').innerText
    }, { merge: true });
}

async function cargarDatosDeNube(uid) {
    const userRef = doc(db, "usuarios", uid);
    const docSnap = await getDoc(userRef);
    
    if (docSnap.exists()) {
        const data = docSnap.data();
        baseDeDatosLocal = data.baseDeDatosLocal || {};
        estadoDias = data.estadoDias || {};
        totalEntrenamientos = data.totalEntrenamientos || 0;
        fallosHistoricos = data.fallosHistoricos || {};
        pesosMaximos = data.pesosMaximos || {};
        historialGlobal = data.historialGlobal || [];
        
        if(data.nombre) {
            document.getElementById('nombre-usuario').innerText = data.nombre;
            document.getElementById('titulo-perfil-nombre').innerText = data.nombre;
            document.getElementById('letra-avatar').innerText = data.nombre.charAt(0).toUpperCase();
        } else {
            document.getElementById('nombre-usuario').innerText = "Atleta";
        }
    } else {
        baseDeDatosLocal = {}; estadoDias = {}; totalEntrenamientos = 0; 
        fallosHistoricos = {}; pesosMaximos = {}; historialGlobal = [];
        document.getElementById('nombre-usuario').innerText = "Atleta";
    }
    renderizarSemana();
}

function editarNombre() {
    let nombreActual = document.getElementById('nombre-usuario').innerText;
    let nuevoNombre = prompt("Ingresa tu nombre de atleta:", nombreActual);
    
    if (nuevoNombre !== null && nuevoNombre.trim() !== "") {
        const finalName = nuevoNombre.trim();
        document.getElementById('nombre-usuario').innerText = finalName;
        document.getElementById('titulo-perfil-nombre').innerText = finalName;
        document.getElementById('letra-avatar').innerText = finalName.charAt(0).toUpperCase();
        guardarDatosEnNube();
    }
}
// Conectar botón editar nombre
document.getElementById('btn-editar-nombre').addEventListener('click', editarNombre);


// ==========================================
// 5. LÓGICA DE LA APP (DÍAS Y RUTINAS)
// ==========================================

function renderizarSemana() {
    const contenedorTarjetas = document.getElementById('contenedor-tarjetas');
    let acumuladorHTML = ''; 
    diasDeLaSemana.forEach(dia => {
        const completado = estadoDias[dia] || false;
        const claseColor = completado ? 'dia-verde' : '';
        const checkStatus = completado ? 'checked' : '';
        acumuladorHTML += `
            <div class="tarjeta-dia ${claseColor}" data-dia="${dia}">
                <span class="nombre-dia">${dia}</span>
                <span class="subtexto" style="margin-bottom: 10px;">Entrenar ➔</span>
                <button class="btn-wsp" data-wsp="true" title="Avisarle a mi bro">
                    <svg viewBox="0 0 24 24"><path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.122.553 4.161 1.6 5.967L.25 23.582l5.736-1.503c1.745.966 3.711 1.474 5.762 1.474 6.645 0 12.03-5.385 12.03-12.03S18.676 0 12.031 0zm-.016 21.603c-1.782 0-3.52-.478-5.045-1.383l-.36-.214-3.75.982.998-3.655-.235-.373c-1-1.583-1.528-3.414-1.528-5.312 0-5.568 4.531-10.1 10.1-10.1 5.568 0 10.1 4.531 10.1 10.1s-4.531 10.1-10.1 10.1zm5.55-7.584c-.304-.152-1.802-.888-2.081-.992-.278-.103-.482-.152-.686.152-.204.304-.787.992-.966 1.196-.179.204-.358.228-.662.076-.304-.152-1.285-.473-2.45-1.517-.905-.812-1.516-1.815-1.695-2.119-.179-.304-.019-.469.133-.621.137-.137.304-.358.456-.538.152-.18.204-.304.304-.508.103-.204.051-.383-.025-.535-.076-.152-.686-1.65-.94-2.258-.247-.591-.497-.512-.686-.521-.179-.009-.384-.009-.588-.009-.204 0-.538.076-.821.383-.284.307-1.09 1.063-1.09 2.593 0 1.53 1.116 3.012 1.272 3.22.156.208 2.193 3.35 5.313 4.694.743.32 1.323.511 1.774.654.747.237 1.428.203 1.965.123.6-.088 1.802-.736 2.056-1.446.254-.71.254-1.319.179-1.446-.076-.127-.28-.203-.584-.355z"/></svg>
                </button>
                <input type="checkbox" class="checkbox-dia" data-checkdia="${dia}" ${checkStatus}>
            </div>
        `;
    });
    contenedorTarjetas.innerHTML = acumuladorHTML;
    document.getElementById('contador-total').innerText = totalEntrenamientos;

    // Conectar eventos dinámicos a las tarjetas
    document.querySelectorAll('.tarjeta-dia').forEach(tarjeta => {
        tarjeta.addEventListener('click', (e) => {
            // Evitar abrir el día si hizo clic en WSP o Checkbox
            if(e.target.closest('.btn-wsp') || e.target.classList.contains('checkbox-dia')) return;
            abrirDia(tarjeta.getAttribute('data-dia'));
        });
    });

    document.querySelectorAll('.checkbox-dia').forEach(check => {
        check.addEventListener('change', (e) => {
            const diaAfectado = e.target.getAttribute('data-checkdia');
            marcarCompletado(diaAfectado, e.target.checked);
        });
    });

    document.querySelectorAll('.btn-wsp').forEach(btn => {
        btn.addEventListener('click', () => {
            window.open("https://chat.whatsapp.com/GPtrTGFtMhk8icwQlcMbfw", '_blank');
        });
    });
}

function marcarCompletado(dia, estaMarcado) {
    if (estaMarcado && !estadoDias[dia]) totalEntrenamientos++;
    estadoDias[dia] = estaMarcado; 
    guardarDatosEnNube();
    renderizarSemana();
}

document.getElementById('btn-reiniciar-semana').addEventListener('click', () => {
    if(confirm('¿Listo para destruir una nueva semana? Tus marcas se conservan.')) {
        estadoDias = {}; 
        guardarDatosEnNube();
        renderizarSemana();
    }
});

document.getElementById('btn-reiniciar-historico').addEventListener('click', () => {
    if(confirm('⚠️ ¿Seguro que querés reiniciar tus días de gloria a cero?')) {
        totalEntrenamientos = 0; 
        guardarDatosEnNube();
        renderizarSemana();
    }
});

function cargarImagenMotivacion() {
    const contenedor = document.getElementById('contenedor-motivacion');
    const numeroAlAzar = Math.floor(Math.random() * TOTAL_IMAGENES_MOTIVACION) + 1;
    const rutaImagen = `motivacion/${numeroAlAzar}.jpg`;
    contenedor.innerHTML = `<img src="${rutaImagen}" alt="Motivación Gym" style="width: 100%; height: 200px; object-fit: cover; border-radius: 12px; border: 2px solid var(--accent-neon);">`;
}

function abrirDia(dia) {
    diaActivo = dia;
    document.getElementById('titulo-dia').innerText = `${dia} de Guerra`;
    document.getElementById('vista-semana').style.display = 'none';
    document.getElementById('vista-cuenta').style.display = 'none';
    document.getElementById('vista-dia').style.display = 'flex';
    cargarImagenMotivacion(); 
    actualizarInterfazDia(); 
    actualizarDisplayCrono();
}

document.getElementById('btn-volver-semana').addEventListener('click', () => {
    diaActivo = null;
    document.getElementById('vista-dia').style.display = 'none';
    document.getElementById('vista-cuenta').style.display = 'none';
    document.getElementById('vista-semana').style.display = 'flex';
});

// --- CRONÓMETRO ---
document.getElementById('btn-comenzar-pausa').addEventListener('click', () => {
    const btn = document.getElementById('btn-comenzar-pausa');
    if (isRunning) {
        elapsedTime += Date.now() - startTime; clearInterval(timerInterval); isRunning = false;
        btn.innerHTML = '▶ REANUDAR'; btn.classList.remove('btn-crono-pausa');
    } else {
        startTime = Date.now(); timerInterval = setInterval(actualizarDisplayCrono, 1000); isRunning = true;
        btn.innerHTML = '⏸ PAUSAR'; btn.classList.add('btn-crono-pausa');
    }
});

document.getElementById('btn-reset-crono').addEventListener('click', () => {
    if(confirm('¿Seguro que querés reiniciar el tiempo a cero?')) {
        clearInterval(timerInterval); isRunning = false; elapsedTime = 0;
        const btn = document.getElementById('btn-comenzar-pausa');
        btn.innerHTML = '▶ COMENZAR'; btn.classList.remove('btn-crono-pausa'); actualizarDisplayCrono();
    }
});


// --- VISTA CUENTA E HISTORIAL ---
document.getElementById('btn-abrir-cuenta').addEventListener('click', () => {
    document.getElementById('vista-semana').style.display = 'none';
    document.getElementById('vista-dia').style.display = 'none';
    document.getElementById('vista-cuenta').style.display = 'flex';
    renderizarHistorial();
});

document.getElementById('btn-volver-desde-cuenta').addEventListener('click', () => {
    document.getElementById('vista-dia').style.display = 'none';
    document.getElementById('vista-cuenta').style.display = 'none';
    document.getElementById('vista-semana').style.display = 'flex';
});

document.getElementById('btn-guardar-dia').addEventListener('click', () => {
    const rutinaActual = baseDeDatosLocal[diaActivo];
    if (!diaActivo || !rutinaActual || rutinaActual.length === 0) {
        alert("No tienes ejercicios cargados hoy para guardar."); return;
    }
    const fechaHoy = new Date().toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    
    historialGlobal.unshift({
        fecha: fechaHoy, diaSemana: diaActivo, rutina: JSON.parse(JSON.stringify(rutinaActual)),
        tiempo: document.getElementById('display-cronometro').innerText
    });
    
    guardarDatosEnNube();
    alert(`¡Día guardado con éxito! Puedes verlo en tu Cuenta.\nTiempo registrado: ${document.getElementById('display-cronometro').innerText}`);
});

document.getElementById('btn-borrar-todo').addEventListener('click', () => {
    if(confirm('⚠️ ¿Estás completamente seguro de borrar TODO tu historial guardado? Esta acción no se puede deshacer.')) {
        historialGlobal = [];
        guardarDatosEnNube();
        renderizarHistorial();
        alert('Historial borrado con éxito.');
    }
});

function renderizarHistorial() {
    const contenedor = document.getElementById('contenedor-historial');
    if (historialGlobal.length === 0) {
        contenedor.innerHTML = '<p style="color: var(--text-muted);">Aún no has guardado ningún entrenamiento en tu historial.</p>';
        return;
    }

    let acumuladorHTML = ''; 
    historialGlobal.forEach(registro => {
        let htmlEjercicios = '';
        registro.rutina.forEach(ej => {
            let htmlSeries = '';
            for (let i = 0; i < ej.series; i++) {
                const repes = (ej.repesRealizadas && ej.repesRealizadas[i]) ? ej.repesRealizadas[i] : '-';
                const peso = (ej.pesosRealizados && ej.pesosRealizados[i]) ? ej.pesosRealizados[i] : '-';
                htmlSeries += `<div class="mini-serie">S${i+1}: <strong>${repes}</strong>x<strong>${peso}kg</strong></div>`;
            }
            htmlEjercicios += `<div class="item-historial-ejercicio"><h4>${ej.nombre}</h4><div class="resumen-series">${htmlSeries}</div></div>`;
        });

        acumuladorHTML += `
            <div class="tarjeta-historial">
                <div class="fecha-historial">
                    ${registro.fecha} <span class="badge-dia">${registro.diaSemana} - ⏱ ${registro.tiempo}</span>
                </div>
                ${htmlEjercicios}
            </div>
        `;
    });
    contenedor.innerHTML = acumuladorHTML;
}

// --- GESTIÓN DE EJERCICIOS ---
function actualizarInterfazDia() {
    if (!diaActivo) return;
    const rutinaHoy = baseDeDatosLocal[diaActivo] || [];
    const contenedor = document.getElementById('listaEjerciciosUI');
    let acumuladorHTML = ''; 

    rutinaHoy.forEach((ej, indexEjercicio) => {
        const valorFallo = fallosHistoricos[ej.nombre] || '';
        const valorPesoMax = pesosMaximos[ej.nombre] || '';
        
        let htmlSeries = '';
        for (let i = 0; i < ej.series; i++) {
            const repesGuardadas = (ej.repesRealizadas && ej.repesRealizadas[i]) ? ej.repesRealizadas[i] : ''; 
            const pesoGuardado = (ej.pesosRealizados && ej.pesosRealizados[i]) ? ej.pesosRealizados[i] : ''; 
            htmlSeries += `
                <div class="caja-serie">
                    <span class="numero-serie">SET ${i + 1}</span>
                    <span class="etiqueta-input">Repes</span>
                    <input type="number" class="input-datos input-repes" data-ej="${indexEjercicio}" data-serie="${i}" placeholder="-" value="${repesGuardadas}">
                    <span class="etiqueta-input">Kg</span>
                    <input type="number" class="input-datos input-peso" data-ej="${indexEjercicio}" data-serie="${i}" placeholder="-" value="${pesoGuardado}">
                </div>
            `;
        }

        acumuladorHTML += `
            <div class="ejercicio-item">
                <div class="ejercicio-cabecera">
                    <h4 class="titulo-ejercicio">${ej.nombre}</h4>
                    <div class="contenedor-records">
                        <div class="caja-record"><label>Fallo</label><input type="number" class="input-fallo" data-nombre="${ej.nombre}" placeholder="--" value="${valorFallo}"></div>
                        <div class="caja-record"><label>Max Kg</label><input type="number" class="input-maxpeso" data-nombre="${ej.nombre}" placeholder="--" value="${valorPesoMax}"></div>
                        <button class="btn-eliminar" data-ej="${indexEjercicio}">✖ Eliminar</button>
                    </div>
                </div>
                <div class="contenedor-series">${htmlSeries}</div>
            </div>
        `;
    });
    contenedor.innerHTML = acumuladorHTML;

    // Conectar eventos dinámicos a los inputs generados
    document.querySelectorAll('.input-repes').forEach(input => {
        input.addEventListener('change', (e) => {
            const indexEj = e.target.getAttribute('data-ej');
            const indexSerie = e.target.getAttribute('data-serie');
            if (!baseDeDatosLocal[diaActivo][indexEj].repesRealizadas) baseDeDatosLocal[diaActivo][indexEj].repesRealizadas = new Array(baseDeDatosLocal[diaActivo][indexEj].series).fill('');
            baseDeDatosLocal[diaActivo][indexEj].repesRealizadas[indexSerie] = e.target.value;
            guardarDatosEnNube();
        });
    });

    document.querySelectorAll('.input-peso').forEach(input => {
        input.addEventListener('change', (e) => {
            const indexEj = e.target.getAttribute('data-ej');
            const indexSerie = e.target.getAttribute('data-serie');
            if (!baseDeDatosLocal[diaActivo][indexEj].pesosRealizados) baseDeDatosLocal[diaActivo][indexEj].pesosRealizados = new Array(baseDeDatosLocal[diaActivo][indexEj].series).fill('');
            baseDeDatosLocal[diaActivo][indexEj].pesosRealizados[indexSerie] = e.target.value;
            guardarDatosEnNube();
        });
    });

    document.querySelectorAll('.input-fallo').forEach(input => {
        input.addEventListener('change', (e) => { fallosHistoricos[e.target.getAttribute('data-nombre')] = e.target.value; guardarDatosEnNube(); });
    });

    document.querySelectorAll('.input-maxpeso').forEach(input => {
        input.addEventListener('change', (e) => { pesosMaximos[e.target.getAttribute('data-nombre')] = e.target.value; guardarDatosEnNube(); });
    });

    document.querySelectorAll('.btn-eliminar').forEach(btn => {
        btn.addEventListener('click', (e) => { 
            baseDeDatosLocal[diaActivo].splice(e.target.getAttribute('data-ej'), 1); 
            guardarDatosEnNube(); 
            actualizarInterfazDia(); 
        });
    });
}

document.getElementById('btn-agregar-ejercicio').addEventListener('click', () => {
    const nombre = document.getElementById('inputEjercicio').value.trim();
    const series = parseInt(document.getElementById('inputSeries').value);
    if (!nombre || !series) { alert("¡Hey! Completá el nombre y las series."); return; }
    if (!baseDeDatosLocal[diaActivo]) baseDeDatosLocal[diaActivo] = [];
    
    baseDeDatosLocal[diaActivo].push({ 
        nombre: nombre, series: series,
        repesRealizadas: new Array(series).fill(''), pesosRealizados: new Array(series).fill('') 
    });
    
    document.getElementById('inputEjercicio').value = ''; document.getElementById('inputSeries').value = '';
    guardarDatosEnNube();
    actualizarInterfazDia();
});
