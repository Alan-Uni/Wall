require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');

const app = express();
const port = 3000;

// --- Configuración de MongoDB y JWT ---
const client = new MongoClient(process.env.MONGO_URI);
const dbName = 'TryIt';
const JWT_SECRET = process.env.JWT_SECRET;

// ✅ Variable para almacenar la conexión a la base de datos y reutilizarla
let db;

// --- Middleware ---
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            // 👇 CORREGIDO: Usa el NUEVO hash y sin comillas extra
           scriptSrc: ["'self'", "'unsafe-inline'"],
        },
    })
);
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para hacer la conexión 'db' accesible en todas las rutas
app.use((req, res, next) => {
    req.db = db;
    next();
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// --- Rutas de la API ---
// Ahora las rutas son más limpias, ya no manejan la conexión/desconexión

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Usuario y contraseña son requeridos.' });
    }
    try {
        const collection = req.db.collection('users');
        const hashedPassword = await bcrypt.hash(password, 10);
        await collection.insertOne({ username, password: hashedPassword });
        res.status(201).json({ message: 'Usuario registrado exitosamente.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al registrar el usuario.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await req.db.collection('users').findOne({ username });
        if (user && await bcrypt.compare(password, user.password)) {
            const accessToken = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '1h' });
            res.json({ accessToken: accessToken });
        } else {
            res.status(401).json({ message: 'Credenciales inválidas.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

// --- Rutas de las páginas ---

app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/inicio', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'inicio.html'));
});

app.get('/api/data', authenticateToken, (req, res) => {
    res.json({ message: `¡Bienvenido ${req.user.username}! Estos son datos protegidos.` });
});


// ✅ Función principal para conectar a la BD y luego iniciar el servidor
async function startServer() {
    try {
        // Conectar a MongoDB UNA SOLA VEZ
        await client.connect();
        db = client.db(dbName); // Asigna la conexión a la variable global 'db'
        
        // Este es el mensaje que esperabas
        console.log(`✅ Conectado exitosamente a la base de datos: ${dbName}`);

        // Solo si la conexión es exitosa, se inicia el servidor
        app.listen(port, () => {
            console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
        });

    } catch (err) {
        console.error("❌ No se pudo conectar a la base de datos.", err);
        process.exit(1); // Si no hay BD, el servidor no debe iniciar
    }
}

// Llama a la función para iniciar todo el proceso
startServer();