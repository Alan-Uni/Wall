const express = require('express');
const { MongoClient } = require('mongodb');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = 3000;

// --- Configuración de MongoDB ---
const url = 'mongodb://localhost:27017'; // URL de conexión a MongoDB
const dbName = 'TryIt'; // Nombre de tu base de datos
const client = new MongoClient(url);

// --- Middleware ---
// Parsea los cuerpos de las solicitudes entrantes en formato URL-encoded
app.use(bodyParser.urlencoded({ extended: true }));
// Sirve archivos estáticos (HTML, CSS) desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Función para configurar la base de datos al iniciar el servidor.
 * Crea un usuario por defecto si la colección está vacía.
 */
async function setupDatabase() {
    try {
        await client.connect();
        console.log("Conectado a MongoDB para la configuración inicial.");
        const db = client.db(dbName);
        const collection = db.collection('users');

        // Revisa si ya existe algún usuario
        const userCount = await collection.countDocuments();
        if (userCount === 0) {
            // Si no hay usuarios, inserta uno por defecto
            await collection.insertOne({ username: "usuario", password: "123" });
            console.log("Base de datos 'TryIt' y colección 'users' configuradas con un usuario de prueba.");
        } else {
            console.log("La colección 'users' ya contiene datos.");
        }
    } catch (err) {
        console.error("Error durante la configuración de la base de datos:", err);
    } finally {
        await client.close();
    }
}


// --- Rutas de la aplicación ---

// Ruta para servir la página de login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Ruta para manejar el proceso de login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    let localClient; // Cliente local para esta operación

    try {
        localClient = new MongoClient(url);
        await localClient.connect();
        const db = localClient.db(dbName);
        const collection = db.collection('users');

        // Busca al usuario en la base de datos
        const user = await collection.findOne({ username: username });

        // Valida la contraseña (en un proyecto real, deberías usar hashing)
        if (user && user.password === password) {
            // Si las credenciales son correctas, redirige a la página de inicio
            res.redirect('/inicio.html');
        } else {
            // Si las credenciales son incorrectas
            res.send('Usuario o contraseña incorrectos. <a href="/">Volver a intentar</a>');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error en el servidor durante el inicio de sesión.');
    } finally {
        if (localClient) {
            await localClient.close();
        }
    }
});

// Inicia el servidor y llama a la configuración de la BD
app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
    setupDatabase(); // Ejecuta la configuración de la base de datos
});