// backend/src/app.js

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'SpécimenManager API', version: '2.0.0' }));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/v1/auth',       require('./routes/auth.routes'));
app.use('/api/v1/projets',    require('./routes/projets.routes'));
app.use('/api/v1/missions',   require('./routes/missions.routes'));
app.use('/api/v1/localites',  require('./routes/localites.routes'));
app.use('/api/v1/methodes',   require('./routes/methodes.routes'));
app.use('/api/v1/hotes',      require('./routes/hotes.routes'));
app.use('/api/v1/containers', require('./routes/containers.routes'));
app.use('/api/v1/moustiques', require('./routes/specimens/moustiques.routes'));
app.use('/api/v1/tiques',     require('./routes/specimens/tiques.routes'));
app.use('/api/v1/puces',      require('./routes/specimens/puces.routes'));

app.use('/api/v1/dictionnaire/taxonomie-specimens',    require('./routes/dictionnaire/taxonomieSpecimens.routes'));
app.use('/api/v1/dictionnaire/taxonomie-hotes',        require('./routes/dictionnaire/taxonomieHotes.routes'));
app.use('/api/v1/dictionnaire/types-methode',          require('./routes/dictionnaire/typesMethode.routes'));
app.use('/api/v1/dictionnaire/solutions-conservation', require('./routes/dictionnaire/solutionsConservation.routes'));
app.use('/api/v1/dictionnaire/types-environnement',    require('./routes/dictionnaire/typesEnvironnement.routes'));
app.use('/api/v1/dictionnaire/types-habitat',          require('./routes/dictionnaire/typesHabitat.routes'));
app.use('/api/v1/dictionnaire/audit-logs',             require('./routes/dictionnaire/auditLogs.routes'));

app.use('/api/v1/recherche',  require('./routes/recherche.routes'));
app.use('/api/v1/import',     require('./routes/import.routes'));

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route introuvable' }));

// ── Error handler global (doit être en dernier) ───────────────
app.use(errorHandler);

module.exports = app;
