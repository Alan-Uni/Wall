require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const https = require('https');
const fs = require('fs'); 

const app = express();
const port = 3000;

const httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, 'localhost-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'localhost.pem'))
};

const client = new MongoClient(process.env.MONGO_URI);
const dbName = 'TryIt';
const JWT_SECRET = process.env.JWT_SECRET;

let db;

app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
           scriptSrc: ["'self'", "'unsafe-inline'"],
        },
    })
);
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

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


async function startServer() {
    try {
        await client.connect();
        db = client.db(dbName); 
        
        console.log(`✅ Conectado exitosamente a la base de datos: ${dbName}`);

        https.createServer(httpsOptions, app).listen(port, () => {
            console.log(`🚀 Servidor corriendo de forma segura en https://localhost:${port}`);
        });

    } catch (err) {
        console.error("❌ No se pudo conectar a la base de datos.", err);
        process.exit(1); 
    }
}

startServer();